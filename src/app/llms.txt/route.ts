import { getEnv } from "@/db";
import { priceLabel, waLink } from "@/lib/format";
import { listArticles, listPages, listProducts } from "@/lib/queries";
import { getSettings } from "@/lib/settings";

// Ringkasan situs untuk mesin AI (format llmstxt.org). Dibangkitkan dari database tiap request supaya
// selalu sinkron dengan panel; worker.ts menyimpannya 5 menit. Isi hanya dari data situs sendiri:
// pengaturan, produk, halaman, artikel. Tidak ada klaim tambahan (mis. SNI/ISO) di luar data itu.
export const dynamic = "force-dynamic";

const PRIVACY_SLUG = "privacy-policy";

const oneLine = (t: string) => t.replace(/\s+/g, " ").trim();
/** Satu kalimat utuh: spasi dirapikan dan diakhiri titik bila belum ada tanda baca penutup. */
const sentence = (t: string) => {
  const s = oneLine(t);
  return !s || /[.!?]$/.test(s) ? s : `${s}.`;
};

export async function GET() {
  const [s, env, products, articles, pages] = await Promise.all([getSettings(), getEnv(), listProducts(), listArticles(20), listPages()]);
  const base = env.SITE_URL;
  const item = (title: string, path: string, ...notes: (string | null | undefined)[]) => {
    const text = notes.map((n) => sentence(n ?? "")).filter(Boolean).join(" ");
    return `- [${title.replace(/[[\]]/g, "")}](${base}${path})${text ? `: ${text}` : ""}`;
  };
  const pageItem = (pg: (typeof pages)[number]) => item(pg.title, `/${pg.slug}`, pg.excerpt || pg.seoDescription);

  const goods = products.filter((p) => p.category !== "Jasa");
  const services = products.filter((p) => p.category === "Jasa");
  const productItem = (p: (typeof products)[number]) =>
    item(p.name, `/produk/${p.slug}`, p.summary, p.priceFrom != null ? `Harga ${priceLabel(p)}, belum termasuk ongkir` : null);

  const facts = [
    ["Perusahaan", `${s.legal_name}${s.founded_year ? `, berdiri ${s.founded_year}` : ""}`],
    ["Alamat pabrik", s.address],
    ["Jam operasional", s.hours],
    ["Mutu beton", s.quality_label],
    ["TKDN", s.tkdn_note],
    ["Area pengiriman", s.service_area],
    ["Harga", "harga pabrik, belum termasuk ongkir; admin mengirim penawaran tertulis berisi harga, ongkir, dan jadwal kirim lewat WhatsApp"],
    ["Pembayaran", s.payment_terms],
    [
      "Kontak",
      [
        s.whatsapp && `WhatsApp ${oneLine(s.whatsapp)} (${waLink(s.whatsapp)})`,
        s.phone && `telepon ${oneLine(s.phone)}`,
        s.phone_office && `kantor ${oneLine(s.phone_office)}`,
        s.email && `email ${oneLine(s.email)}`,
      ]
        .filter(Boolean)
        .join(", "),
    ],
    ["Bahasa situs", "Indonesia"],
  ]
    .filter(([, v]) => oneLine(v))
    .map(([k, v]) => `- ${k}: ${oneLine(v).replace(/\.+$/, "")}`); // titik penutup nilai pengaturan dibuang agar butir seragam

  const areaPages = pages.filter((pg) => pg.kind === "area");
  const infoPages = pages.filter((pg) => pg.kind === "info" && pg.slug !== PRIVACY_SLUG);
  const privacyPages = pages.filter((pg) => pg.slug === PRIVACY_SLUG);

  const lines = [
    `# ${oneLine(s.company_name)}`,
    "",
    `> ${oneLine(s.seo_description || s.hero_subtitle)}`,
    "",
    ...facts,
    "",
    "## Produk",
    "",
    item("Daftar harga ringkas (Markdown)", "/pricing.md", "Harga pabrik per produk dan satuan, belum termasuk ongkir, lengkap dengan tanggal pembaruan"),
    ...goods.map(productItem),
    item("Semua produk", "/produk", "Katalog lengkap dengan daftar harga"),
    "",
    "## Layanan",
    "",
    ...services.map(productItem),
    item("Paket material proyek dan dokumen TKDN", "/paket-proyek", s.project_text),
    item("Kalkulator pola dan warna paving", "/pola-paving", "Pilih jenis, motif, dan warna paving lalu hitung pcs per warna, kanstin, abu batu, dan base course; hasilnya bisa dikirim ke WhatsApp"),
    "",
    "## Informasi",
    "",
    ...infoPages.map(pageItem),
    item("Kontak dan lokasi pabrik", "/kontak", "Alamat pabrik, jam operasional, WhatsApp, dan telepon"),
    item("Area pengiriman dan cara hitung ongkir", "/area-pengiriman", s.service_area ? `Pengiriman ke ${s.service_area}` : null, "Cara hitung ongkir dan cara pesan"),
    ...areaPages.map(pageItem),
    item("Artikel", "/artikel", "Panduan memilih, menghitung, dan memasang paving block, U-Ditch, buis beton, kanstin, dan genteng beton"),
    ...articles.map((a) => item(a.title, `/artikel/${a.slug}`, a.excerpt)),
    "",
    "## Optional",
    "",
    item("Galeri", "/galeri", "Dokumentasi pemasangan paving block dan foto produk di pabrik"),
    ...privacyPages.map(pageItem),
    item("Peta situs (XML)", "/sitemap.xml"),
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=300" },
  });
}
