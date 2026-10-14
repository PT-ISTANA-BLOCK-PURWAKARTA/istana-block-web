"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import type { FormState } from "@/components/admin/FormMessage";
import { requireAdmin } from "@/lib/auth";
import { slugify } from "@/lib/format";
import { deleteImage, saveImage, UploadError } from "@/lib/media";

const ArticleInput = z.object({
  title: z.string().trim().min(5, "Judul minimal 5 huruf.").max(160),
  slug: z.string().trim().max(80),
  excerpt: z.string().trim().max(300),
  content: z.string().max(60000),
  seoTitle: z.string().trim().max(70),
  seoDescription: z.string().trim().max(170),
});

export async function saveArticle(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const id = Number(form.get("id")) || null;
  const parsed = ArticleInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  const d = parsed.data;
  const slug = slugify(d.slug || d.title);
  if (!slug) return { error: "Slug tidak valid." };

  const db = await getDb();
  const clash = await db.query.articles.findFirst({
    where: id ? and(eq(schema.articles.slug, slug), ne(schema.articles.id, id)) : eq(schema.articles.slug, slug),
  });
  if (clash) return { error: `Slug "${slug}" sudah dipakai artikel lain.` };
  const existing = id ? await db.query.articles.findFirst({ where: eq(schema.articles.id, id) }) : undefined;
  if (id && !existing) return { error: "Artikel tidak ditemukan." };

  let coverKey = existing?.coverKey ?? null;
  try {
    const up = await saveImage(form.get("cover"), "artikel");
    if (up) {
      await deleteImage(coverKey);
      coverKey = up;
    } else if (form.get("cover_remove")) {
      await deleteImage(coverKey);
      coverKey = null;
    }
  } catch (e) {
    if (e instanceof UploadError) return { error: e.message };
    throw e;
  }

  const published = form.get("published") === "on";
  const values = {
    title: d.title,
    slug,
    excerpt: d.excerpt,
    content: d.content,
    seoTitle: d.seoTitle || null,
    seoDescription: d.seoDescription || null,
    coverKey,
    published,
    publishedAt: published ? (existing?.publishedAt ?? new Date()) : (existing?.publishedAt ?? null),
    updatedAt: new Date(),
  };
  if (existing) await db.update(schema.articles).set(values).where(eq(schema.articles.id, existing.id));
  else await db.insert(schema.articles).values(values);

  revalidatePath("/", "layout");
  redirect(`/admin/artikel?ok=${encodeURIComponent(d.title)}`);
}

export async function deleteArticle(id: number) {
  await requireAdmin();
  const db = await getDb();
  const a = await db.query.articles.findFirst({ where: eq(schema.articles.id, id) });
  if (!a) return;
  await db.delete(schema.articles).where(eq(schema.articles.id, id));
  await deleteImage(a.coverKey);
  revalidatePath("/", "layout");
}
