import type { MetadataRoute } from "next";
import { getEnv } from "@/db";
import { listArticles, listPages, listProducts } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [env, products, articles, pages] = await Promise.all([getEnv(), listProducts(), listArticles(), listPages()]);
  const base = env.SITE_URL;
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/produk`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/artikel`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/kontak`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/pola-paving`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/paket-proyek`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/area-pengiriman`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/galeri`, changeFrequency: "monthly", priority: 0.6 },
    ...products.map((p) => ({ url: `${base}/produk/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "monthly" as const, priority: 0.8 })),
    ...articles.map((a) => ({ url: `${base}/artikel/${a.slug}`, lastModified: a.updatedAt, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...pages.map((pg) => ({ url: `${base}/${pg.slug}`, lastModified: pg.updatedAt, changeFrequency: "monthly" as const, priority: pg.kind === "area" ? 0.7 : 0.5 })),
  ];
}
