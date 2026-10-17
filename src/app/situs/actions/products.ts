"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { categories, type FaqItem, type PriceRow, type SpecItem } from "@/db/schema";
import type { FormState } from "@/components/admin/FormMessage";
import { requireAdmin } from "@/lib/auth";
import { slugify } from "@/lib/format";
import { deleteImage, saveImage, UploadError } from "@/lib/media";

const toInt = (v: unknown) => {
  const s = String(v ?? "").replace(/[^\d]/g, "");
  return s ? parseInt(s, 10) : null;
};

const ProductInput = z.object({
  name: z.string().trim().min(2, "Nama produk minimal 2 huruf.").max(120),
  slug: z.string().trim().max(80),
  category: z.enum(categories),
  summary: z.string().trim().max(400),
  description: z.string().max(20000),
  unit: z.string().trim().min(1, "Satuan wajib diisi, misalnya m², pcs, unit.").max(20),
  tkdn: z.string().trim().max(10),
  seoTitle: z.string().trim().max(70),
  seoDescription: z.string().trim().max(170),
  waText: z.string().trim().max(600).default(""),
  sortOrder: z.coerce.number().int().min(0).max(9999),
});

function parseJson<T>(v: FormDataEntryValue | null): T[] {
  try {
    const x = JSON.parse(String(v ?? "[]"));
    return Array.isArray(x) ? x : [];
  } catch {
    return [];
  }
}

export async function saveProduct(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const id = toInt(form.get("id"));
  const parsed = ProductInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  const d = parsed.data;
  const slug = slugify(d.slug || d.name);
  if (!slug) return { error: "Slug tidak valid." };

  const specs: SpecItem[] = parseJson<Record<string, string>>(form.get("specs"))
    .map((r) => ({ label: String(r.label ?? "").trim(), value: String(r.value ?? "").trim() }))
    .filter((r) => r.label && r.value);
  const priceRows: PriceRow[] = parseJson<Record<string, string>>(form.get("priceRows"))
    .map((r) => ({
      group: String(r.group ?? "").trim(),
      variant: String(r.variant ?? "").trim(),
      detail: String(r.detail ?? "").trim(),
      price: toInt(r.price),
      unit: String(r.unit ?? "").trim() || d.unit,
    }))
    .filter((r) => r.variant);
  const faq: FaqItem[] = parseJson<Record<string, string>>(form.get("faq"))
    .map((r) => ({ q: String(r.q ?? "").trim(), a: String(r.a ?? "").trim() }))
    .filter((r) => r.q && r.a);

  // Harga "mulai" otomatis dari tabel harga bila tidak diisi manual.
  const prices = priceRows.map((r) => r.price).filter((x): x is number => x != null);
  const priceFrom = toInt(form.get("priceFrom")) ?? (prices.length ? Math.min(...prices) : null);
  const priceTo = toInt(form.get("priceTo")) ?? (prices.length > 1 ? Math.max(...prices) : null);

  const db = await getDb();
  const clash = await db.query.products.findFirst({
    where: id ? and(eq(schema.products.slug, slug), ne(schema.products.id, id)) : eq(schema.products.slug, slug),
  });
  if (clash) return { error: `Slug "${slug}" sudah dipakai produk "${clash.name}".` };

  const existing = id ? await db.query.products.findFirst({ where: eq(schema.products.id, id) }) : undefined;
  if (id && !existing) return { error: "Produk tidak ditemukan." };

  let imageKey = existing?.imageKey ?? null;
  try {
    const uploaded = await saveImage(form.get("image"), "produk");
    if (uploaded) {
      await deleteImage(imageKey);
      imageKey = uploaded;
    } else if (form.get("image_remove")) {
      await deleteImage(imageKey);
      imageKey = null;
    }
  } catch (e) {
    if (e instanceof UploadError) return { error: e.message };
    throw e;
  }

  const values = {
    name: d.name,
    slug,
    category: d.category,
    summary: d.summary,
    description: d.description,
    unit: d.unit,
    tkdn: d.tkdn || null,
    seoTitle: d.seoTitle || null,
    seoDescription: d.seoDescription || null,
    waText: d.waText || null,
    sortOrder: d.sortOrder,
    priceFrom,
    priceTo,
    specs,
    priceRows,
    faq,
    imageKey,
    published: form.get("published") === "on",
    featured: form.get("featured") === "on",
    updatedAt: new Date(),
  };

  if (existing) await db.update(schema.products).set(values).where(eq(schema.products.id, existing.id));
  else await db.insert(schema.products).values(values);

  revalidatePath("/", "layout");
  redirect(`/situs/produk?ok=${encodeURIComponent(d.name)}`);
}

export async function deleteProduct(id: number) {
  await requireAdmin();
  const db = await getDb();
  const p = await db.query.products.findFirst({ where: eq(schema.products.id, id) });
  if (!p) return;
  await db.delete(schema.products).where(eq(schema.products.id, id));
  await deleteImage(p.imageKey);
  revalidatePath("/", "layout");
}
