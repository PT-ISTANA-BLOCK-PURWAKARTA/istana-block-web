import { desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getCurrentAdmin } from "@/lib/auth";
import { can } from "@/lib/roles";

const STATIC = [
  { label: "Beranda", href: "/" },
  { label: "Semua produk", href: "/produk" },
  { label: "Artikel", href: "/artikel" },
  { label: "Area pengiriman", href: "/area-pengiriman" },
  { label: "Paket proyek", href: "/paket-proyek" },
  { label: "Pola paving", href: "/pola-paving" },
  { label: "Galeri", href: "/galeri" },
  { label: "Kontak", href: "/kontak" },
];

/** Daftar halaman situs untuk saran tautan di editor isi. */
export async function GET() {
  const me = await getCurrentAdmin();
  if (!me || !can(me.roles, "web")) return new Response(JSON.stringify({ links: [] }), { status: 401, headers: { "content-type": "application/json" } });
  const db = await getDb();
  const [products, articles, pages] = await Promise.all([
    db.select({ slug: schema.products.slug, name: schema.products.name }).from(schema.products).orderBy(schema.products.name),
    db.select({ slug: schema.articles.slug, title: schema.articles.title, published: schema.articles.published }).from(schema.articles).orderBy(desc(schema.articles.id)),
    db.select({ slug: schema.pages.slug, title: schema.pages.title, published: schema.pages.published }).from(schema.pages).orderBy(schema.pages.title),
  ]);
  const links = [
    ...STATIC.map((l) => ({ ...l, kind: "Halaman utama" })),
    ...products.map((p) => ({ label: p.name, href: `/produk/${p.slug}`, kind: "Produk" })),
    ...pages.map((p) => ({ label: p.title, href: `/${p.slug}`, kind: p.published ? "Halaman" : "Halaman (belum terbit)" })),
    ...articles.map((a) => ({ label: a.title, href: `/artikel/${a.slug}`, kind: a.published ? "Artikel" : "Artikel (belum terbit)" })),
  ];
  return new Response(JSON.stringify({ links }), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, max-age=60" } });
}
