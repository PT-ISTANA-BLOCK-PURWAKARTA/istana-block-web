import "server-only";
import { cache } from "react";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { PageKind } from "@/db/schema";
import { memo } from "./memo";

const { products, articles, testimonials, pages } = schema;

// Dua lapis: cache() React = sekali per request (layout, generateMetadata, halaman memanggil fungsi yang sama);
// memo() = sekali per ~30 detik per isolate, supaya render dingin berikutnya tidak mengulang query D1.
// Argumen cache() harus primitif, itu sebabnya listProducts/listArticles dipecah menjadi dua fungsi.

const productsPublished = cache((onlyFeatured: boolean) =>
  memo(`products:${onlyFeatured}`, async () => {
    const db = await getDb();
    const where = onlyFeatured ? and(eq(products.published, true), eq(products.featured, true)) : eq(products.published, true);
    return db.select().from(products).where(where).orderBy(asc(products.sortOrder), asc(products.name));
  }),
);

export function listProducts(opts: { onlyFeatured?: boolean } = {}) {
  return productsPublished(!!opts.onlyFeatured);
}

export const getProductBySlug = cache((slug: string) =>
  memo(`product:${slug}`, async () => {
    const db = await getDb();
    return db.query.products.findFirst({ where: and(eq(products.slug, slug), eq(products.published, true)) });
  }),
);

const articlesPublished = cache((limit: number) =>
  memo(`articles:${limit}`, async () => {
    const db = await getDb();
    const q = db
      .select()
      .from(articles)
      .where(eq(articles.published, true))
      .orderBy(desc(articles.publishedAt), desc(articles.id));
    return limit > 0 ? q.limit(limit) : q;
  }),
);

/** `limit` kosong = semua artikel terbit. */
export function listArticles(limit?: number) {
  return articlesPublished(limit ?? 0);
}

export type ArticleSummary = {
  id: number;
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  coverKey: string | null;
  publishedAt: Date | null;
  readMinutes: number;
};

const articleSummaries = cache((limit: number) =>
  memo(`article-summaries:${limit}`, async (): Promise<ArticleSummary[]> => {
    const db = await getDb();
    const q = db
      .select({
        id: articles.id,
        slug: articles.slug,
        title: articles.title,
        category: articles.category,
        excerpt: articles.excerpt,
        coverKey: articles.coverKey,
        publishedAt: articles.publishedAt,
        contentLen: sql<number>`length(${articles.content})`,
      })
      .from(articles)
      .where(eq(articles.published, true))
      .orderBy(desc(articles.publishedAt), desc(articles.id));
    const rows = await (limit > 0 ? q.limit(limit) : q);
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      category: r.category,
      excerpt: r.excerpt,
      coverKey: r.coverKey,
      publishedAt: r.publishedAt,
      readMinutes: Math.max(1, Math.round((r.contentLen || 0) / 1200)),
    }));
  }),
);

/** Ringkasan artikel terbit tanpa memuat isi markdown penuh (hemat memori & bandwidth). */
export function listArticleSummaries(limit?: number) {
  return articleSummaries(limit ?? 0);
}

export async function getRelatedArticles(category: string, excludeSlug: string, limit = 3): Promise<ArticleSummary[]> {
  const all = await listArticleSummaries();
  const same = all.filter((a) => a.category === category && a.slug !== excludeSlug);
  if (same.length >= limit) return same.slice(0, limit);
  const rest = all.filter((a) => a.category !== category && a.slug !== excludeSlug);
  return [...same, ...rest].slice(0, limit);
}

export const getArticleBySlug = cache((slug: string) =>
  memo(`article:${slug}`, async () => {
    const db = await getDb();
    return db.query.articles.findFirst({ where: and(eq(articles.slug, slug), eq(articles.published, true)) });
  }),
);

export const listTestimonials = cache(() =>
  memo("testimonials", async () => {
    const db = await getDb();
    return db
      .select()
      .from(testimonials)
      .where(eq(testimonials.published, true))
      .orderBy(asc(testimonials.sortOrder), desc(testimonials.id));
  }),
);

/** Halaman statis yang sudah terbit, berdasarkan slug (tanpa garis miring). */
export const getPageBySlug = cache((slug: string) =>
  memo(`page:${slug}`, async () => {
    const db = await getDb();
    return db.query.pages.findFirst({ where: and(eq(pages.slug, slug), eq(pages.published, true)) });
  }),
);

const pagesPublished = cache((kind: PageKind | "") =>
  memo(`pages:${kind}`, async () => {
    const db = await getDb();
    const where = kind ? and(eq(pages.published, true), eq(pages.kind, kind)) : eq(pages.published, true);
    return db.select().from(pages).where(where).orderBy(asc(pages.title));
  }),
);

/** Semua halaman statis yang terbit, opsional difilter per jenis ("area" / "info"). */
export function listPages(kind?: PageKind) {
  return pagesPublished(kind ?? "");
}
