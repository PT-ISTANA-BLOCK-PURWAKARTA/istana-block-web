import type { MetadataRoute } from "next";
import gallery from "@/data/gallery.json";
import { getEnv } from "@/db";
import { imageUrl } from "@/lib/format";
import { listArticles, listPages, listProducts } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [env, products, articles, pages] = await Promise.all([getEnv(), listProducts(), listArticles(), listPages()]);
  const base = env.SITE_URL;
  // Sitemap gambar wajib URL absolut; imageUrl() mengembalikan path ("/media/…", "/img/…") atau URL penuh.
  // Tanpa foto, entri tidak membawa properti images sama sekali (bukan array kosong).
  const photo = (key: string | null | undefined) => {
    const u = imageUrl(key);
    return u ? { images: [u.startsWith("http") ? u : `${base}${u}`] } : {};
  };
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/produk`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/artikel`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/kontak`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/pola-paving`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/paket-proyek`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/area-pengiriman`, changeFrequency: "monthly", priority: 0.7 },
    // Sama dengan contentUrl di JSON-LD ImageGallery halaman /galeri (semua foto, tanpa filter ?k=).
    { url: `${base}/galeri`, changeFrequency: "monthly", priority: 0.6, images: gallery.map((g) => `${base}${g.src}`) },
    ...products.map((p) => ({ url: `${base}/produk/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "monthly" as const, priority: 0.8, ...photo(p.imageKey) })),
    ...articles.map((a) => ({ url: `${base}/artikel/${a.slug}`, lastModified: a.updatedAt, changeFrequency: "monthly" as const, priority: 0.6, ...photo(a.coverKey) })),
    ...pages.map((pg) => ({ url: `${base}/${pg.slug}`, lastModified: pg.updatedAt, changeFrequency: "monthly" as const, priority: pg.kind === "area" ? 0.7 : 0.5 })),
  ];
}
