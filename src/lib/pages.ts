import legacyRedirects from "@/data/legacy-redirects.json";
import { slugify } from "./format";

/** Slug yang sudah dipakai rute, file statis, atau fitur lain sehingga tidak boleh dipakai halaman. */
export const RESERVED_PAGE_SLUGS = [
  "produk",
  "artikel",
  "kontak",
  "admin",
  "media",
  "reel",
  "reel-src",
  "brand",
  "img",
  "galeri",
  "pola-paving",
  "area-pengiriman",
  "paket-proyek",
  "sitemap.xml",
  "robots.txt",
  "api",
  "_next",
  "favicon.ico",
  "icon.png",
  "apple-icon.png",
] as const;

// Termasuk bentuk hasil slugify (mis. "sitemap.xml" → "sitemap-xml", "_next" → "next").
const RESERVED = new Set<string>([...RESERVED_PAGE_SLUGS, ...RESERVED_PAGE_SLUGS.map((s) => slugify(s))]);

const LEGACY = new Map<string, string>(
  Object.entries(legacyRedirects as Record<string, string>).map(([k, v]) => [k.trim().toLowerCase().replace(/\/+$/, ""), String(v)]),
);

/** Format slug halaman yang valid (sama dengan hasil slugify). */
export const PAGE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Pesan kesalahan bila slug tidak boleh dipakai halaman statis, atau null bila aman.
 * `raw` = isian admin sebelum di-slugify, `slug` = hasil slugify.
 */
export function pageSlugProblem(raw: string, slug: string): string | null {
  const r = raw.trim().toLowerCase().replace(/^\/+|\/+$/g, "");
  if (RESERVED.has(slug) || (r && RESERVED.has(r))) return `Slug "${slug}" sudah dipakai sistem situs. Pilih slug lain.`;
  const legacy = LEGACY.get(`/${slug}`);
  if (legacy && legacy !== `/${slug}`) {
    const to = legacy === "410" ? "status 410 (dihapus)" : legacy;
    return `Alamat /${slug} dialihkan ke ${to} oleh peta alamat lama (src/data/legacy-redirects.json). Pilih slug lain atau hapus entri itu.`;
  }
  return null;
}
