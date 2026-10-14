"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { pageKinds } from "@/db/schema";
import type { FormState } from "@/components/admin/FormMessage";
import { requireAdmin } from "@/lib/auth";
import { slugify } from "@/lib/format";
import { deleteImage, saveImage, UploadError } from "@/lib/media";
import { pageSlugProblem } from "@/lib/pages";

const PageInput = z.object({
  title: z.string().trim().min(3, "Judul minimal 3 huruf.").max(160),
  slug: z.string().trim().max(80),
  kind: z.enum(pageKinds, { error: "Jenis halaman tidak valid." }),
  excerpt: z.string().trim().max(300),
  content: z.string().max(60000),
  seoTitle: z.string().trim().max(70),
  seoDescription: z.string().trim().max(170),
});

export async function savePage(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const id = Number(form.get("id")) || null;
  const parsed = PageInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  const d = parsed.data;
  const slug = slugify(d.slug || d.title);
  if (!slug) return { error: "Slug tidak valid." };
  const problem = pageSlugProblem(d.slug, slug);
  if (problem) return { error: problem };

  const db = await getDb();
  const clash = await db.query.pages.findFirst({
    where: id ? and(eq(schema.pages.slug, slug), ne(schema.pages.id, id)) : eq(schema.pages.slug, slug),
  });
  if (clash) return { error: `Slug "${slug}" sudah dipakai halaman "${clash.title}".` };
  const existing = id ? await db.query.pages.findFirst({ where: eq(schema.pages.id, id) }) : undefined;
  if (id && !existing) return { error: "Halaman tidak ditemukan." };

  let coverKey = existing?.coverKey ?? null;
  try {
    const up = await saveImage(form.get("cover"), "halaman");
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

  const values = {
    title: d.title,
    slug,
    kind: d.kind,
    excerpt: d.excerpt,
    content: d.content,
    seoTitle: d.seoTitle || null,
    seoDescription: d.seoDescription || null,
    coverKey,
    published: form.get("published") === "on",
    updatedAt: new Date(),
  };
  if (existing) await db.update(schema.pages).set(values).where(eq(schema.pages.id, existing.id));
  else await db.insert(schema.pages).values(values);

  revalidatePath("/", "layout");
  redirect(`/admin/halaman?ok=${encodeURIComponent(d.title)}`);
}

export async function deletePage(id: number) {
  await requireAdmin();
  const db = await getDb();
  const p = await db.query.pages.findFirst({ where: eq(schema.pages.id, id) });
  if (!p) return;
  await db.delete(schema.pages).where(eq(schema.pages.id, id));
  await deleteImage(p.coverKey);
  revalidatePath("/", "layout");
}
