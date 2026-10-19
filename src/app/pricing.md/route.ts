import { getEnv } from "@/db";
import { priceLabel, rupiah, tanggal, waLink } from "@/lib/format";
import { listProducts } from "@/lib/queries";
import { getSettings } from "@/lib/settings";

// Daftar harga dalam Markdown untuk mesin AI. Dibangkitkan dari database tiap request (worker.ts
// menyimpannya 5 menit), jadi angkanya selalu sama dengan halaman produk dan panel. Hanya angka
// yang tampil di halaman produk: baris tanpa harga ("Hubungi") tidak pernah diberi angka di sini.
export const dynamic = "force-dynamic";

const oneLine = (t: string) => t.replace(/\s+/g, " ").trim();
/** Isi sel tabel Markdown: satu baris, tanda "|" di-escape. */
const cell = (t: string) => oneLine(t).replace(/\|/g, "\\|");

export async function GET() {
  const [s, env, products] = await Promise.all([getSettings(), getEnv(), listProducts()]);
  const base = env.SITE_URL;
  const latest = products.length ? new Date(Math.max(...products.map((p) => p.updatedAt.getTime()))) : null;

  const contact = [
    s.whatsapp && `WhatsApp ${oneLine(s.whatsapp)} (${waLink(s.whatsapp)})`,
    s.phone && `telepon ${oneLine(s.phone)}`,
    s.email && `email ${oneLine(s.email)}`,
  ]
    .filter(Boolean)
    .join(", ");

  const lines = [
    `# Daftar harga ${oneLine(s.company_name)}`,
    "",
    "> Harga pabrik per produk dan satuan, dalam rupiah (IDR), belum termasuk ongkir. Harga dapat berubah; penawaran tertulis yang berlaku.",
    "",
    ...(latest ? [`- Diperbarui: ${tanggal(latest)}`] : []),
    ...(contact ? [`- Minta penawaran (harga, ongkir, dan jadwal kirim): ${contact}`] : []),
    ...(oneLine(s.payment_terms) ? [`- Pembayaran: ${oneLine(s.payment_terms)}`] : []),
    `- Sumber resmi: ${base}/produk`,
  ];

  for (const p of products) {
    // Baris berangka dengan satuan yang sama seperti di halaman produk (satuan kosong → satuan produk).
    const priced = p.priceRows.filter((r) => typeof r.price === "number" && r.price > 0);
    const unpriced = p.priceRows.length - priced.length;
    lines.push("", `## ${oneLine(p.name)}`, "", `- Halaman: ${base}/produk/${p.slug}`);
    if (p.priceFrom != null) lines.push(`- Harga ${priceLabel(p)}, belum termasuk ongkir`);
    lines.push(`- Diperbarui: ${tanggal(p.updatedAt)}`);
    if (priced.length) {
      lines.push(
        "",
        "| Grup | Varian | Keterangan | Harga | Satuan |",
        "|---|---|---|---|---|",
        ...priced.map((r) => `| ${cell(r.group || "Daftar harga")} | ${cell(r.variant)} | ${cell(r.detail ?? "")} | ${rupiah(r.price)} | ${cell(r.unit || p.unit)} |`),
      );
    }
    // Tanpa satu pun baris berangka → kalimat ajakan; sebagian berangka → catatan untuk baris sisanya.
    if (!priced.length) lines.push("", "Harga per ukuran dan jenis mengikuti ukuran dan volume pesanan; minta penawaran via WhatsApp.");
    else if (unpriced) lines.push("", `${unpriced} varian lain: harga mengikuti ukuran dan volume pesanan, minta penawaran via WhatsApp.`);
  }
  lines.push("");

  return new Response(lines.join("\n"), {
    headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "public, max-age=300" },
  });
}
