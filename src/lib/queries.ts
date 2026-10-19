import "server-only";
import { cache } from "react";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { PageKind } from "@/db/schema";

const { products, articles, testimonials, pages } = schema;

export async function listProducts(opts: { onlyFeatured?: boolean } = {}) {
  const db = await getDb();
  const where = opts.onlyFeatured
    ? and(eq(products.published, true), eq(products.featured, true))
    : eq(products.published, true);
  return db.select().from(products).where(where).orderBy(asc(products.sortOrder), asc(products.name));
}

// get…BySlug dibungkus cache(): generateMetadata dan halaman memanggilnya dalam satu request.
export const getProductBySlug = cache(async (slug: string) => {
  const db = await getDb();
  return db.query.products.findFirst({ where: and(eq(products.slug, slug), eq(products.published, true)) });
});

export async function listArticles(limit?: number) {
  const db = await getDb();
  const q = db
    .select()
    .from(articles)
    .where(eq(articles.published, true))
    .orderBy(desc(articles.publishedAt), desc(articles.id));
  return limit ? q.limit(limit) : q;
}

export const getArticleBySlug = cache(async (slug: string) => {
  const db = await getDb();
  return db.query.articles.findFirst({ where: and(eq(articles.slug, slug), eq(articles.published, true)) });
});

export async function listTestimonials() {
  const db = await getDb();
  return db
    .select()
    .from(testimonials)
    .where(eq(testimonials.published, true))
    .orderBy(asc(testimonials.sortOrder), desc(testimonials.id));
}

/** Halaman statis yang sudah terbit, berdasarkan slug (tanpa garis miring). */
export const getPageBySlug = cache(async (slug: string) => {
  const db = await getDb();
  return db.query.pages.findFirst({ where: and(eq(pages.slug, slug), eq(pages.published, true)) });
});

/** Semua halaman statis yang terbit, opsional difilter per jenis ("area" / "info"). */
export async function listPages(kind?: PageKind) {
  const db = await getDb();
  const where = kind ? and(eq(pages.published, true), eq(pages.kind, kind)) : eq(pages.published, true);
  return db.select().from(pages).where(where).orderBy(asc(pages.title));
}
