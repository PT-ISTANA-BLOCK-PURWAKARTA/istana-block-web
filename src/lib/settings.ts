import { cache } from "react";
import { getDb, schema } from "@/db";

export type SettingField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "url" | "email" | "faq";
  help?: string;
  rows?: number;
  group: "Perusahaan" | "Kontak" | "Beranda" | "SEO";
};

export const SETTING_FIELDS = [
  { key: "company_name", label: "Nama usaha", type: "text", group: "Perusahaan" },
  { key: "legal_name", label: "Nama badan usaha", type: "text", group: "Perusahaan" },
  { key: "founded_year", label: "Tahun berdiri", type: "text", group: "Perusahaan" },
  { key: "quality_label", label: "Mutu beton (ringkas)", type: "text", group: "Perusahaan", help: "Contoh: K-350–K-450" },
  { key: "service_area", label: "Area pengiriman", type: "text", group: "Perusahaan" },
  { key: "tkdn_note", label: "Nomor & masa berlaku sertifikat TKDN", type: "textarea", group: "Perusahaan" },
  { key: "payment_terms", label: "Syarat pembayaran", type: "text", group: "Perusahaan" },
  { key: "delivery_cities", label: "Kota tujuan kirim (dipisah koma)", type: "textarea", group: "Perusahaan", rows: 2 },
  { key: "catalog_url", label: "Tautan katalog/brosur (PDF)", type: "url", group: "Perusahaan", help: "Opsional; diawali https://" },
  { key: "whatsapp", label: "Nomor WhatsApp", type: "text", group: "Kontak", help: "Format 0813…; dipakai untuk semua tombol WhatsApp" },
  { key: "phone", label: "Nomor telepon", type: "text", group: "Kontak" },
  { key: "phone_office", label: "Telepon kantor", type: "text", group: "Kontak", help: "Contoh: 0264 200476" },
  { key: "email", label: "Email", type: "email", group: "Kontak" },
  { key: "address", label: "Alamat pabrik", type: "textarea", group: "Kontak" },
  { key: "hours", label: "Jam operasional", type: "text", group: "Kontak" },
  { key: "maps_url", label: "Tautan Google Maps / profil bisnis", type: "url", group: "Kontak" },
  {
    key: "maps_embed_url",
    label: "URL embed Google Maps (src iframe)",
    type: "text",
    group: "Kontak",
    help: "Di Google Maps: Bagikan → Sematkan peta → Salin HTML. Tempel isi src=\"…\" (diawali https://www.google.com/maps/embed) atau seluruh kode iframe-nya; peta tampil di halaman Kontak.",
  },
  { key: "google_rating", label: "Rating Google", type: "text", group: "Kontak", help: "Contoh: 4,8" },
  { key: "google_review_count", label: "Jumlah ulasan Google", type: "text", group: "Kontak" },
  { key: "hero_title", label: "Judul utama beranda", type: "text", group: "Beranda" },
  { key: "hero_subtitle", label: "Paragraf pembuka beranda", type: "textarea", group: "Beranda" },
  { key: "project_title", label: "Judul blok kontraktor", type: "text", group: "Beranda" },
  { key: "project_text", label: "Isi blok kontraktor", type: "textarea", group: "Beranda" },
  {
    key: "home_faq",
    label: "FAQ beranda",
    type: "faq",
    group: "Beranda",
    help: "Pertanyaan yang sering ditanyakan calon pembeli, tampil di bagian bawah beranda",
  },
  { key: "seo_title", label: "Judul SEO beranda", type: "text", group: "SEO", help: "Ideal ≤ 60 karakter" },
  { key: "seo_description", label: "Deskripsi SEO beranda", type: "textarea", group: "SEO", help: "Ideal 120–155 karakter" },
] as const satisfies readonly SettingField[];

export type SettingKey = (typeof SETTING_FIELDS)[number]["key"];
export type Settings = Record<SettingKey, string>;

export const DEFAULT_SETTINGS: Settings = {
  company_name: "Istana Block Purwakarta",
  legal_name: "PT Istana Block Purwakarta",
  founded_year: "2016",
  quality_label: "K-350–K-450",
  service_area: "Purwakarta, Jawa Barat, dan Jabodetabek (skala proyek)",
  tkdn_note: "Sertifikat TKDN Kemenperin No. 9632, 9656, 9657/SJ-IND.8/TKDN/LVI/08/2026, berlaku 18 Agustus 2026 – 18 Agustus 2031.",
  payment_terms: "DP saat PO, pelunasan saat barang tiba di lokasi.",
  delivery_cities: "Purwakarta, Karawang, Cikampek, Subang, Bekasi, Cikarang, Bandung, Jakarta, Bogor, Depok, Tangerang, Cirebon, Indramayu",
  catalog_url: "",
  whatsapp: "081388885141",
  phone: "087881777660",
  phone_office: "0264 200476",
  email: "cs@istanablock.com",
  address: "Jl. Terusan Kapten Halim No.121, Kec. Pasawahan, Purwakarta, Jawa Barat 41172",
  hours: "Sabtu–Kamis, 07.30–17.00",
  maps_url: "",
  maps_embed_url: "",
  google_rating: "4,8",
  google_review_count: "42",
  hero_title: "Beton yang tertata, dari pabrik ke halaman Anda.",
  hero_subtitle:
    "Paving block, U-Ditch, buis beton, kanstin, dan genteng beton. Mutu K-350 sampai K-450, bersertifikat TKDN, dikirim dengan armada sendiri ke Jawa Barat dan Jabodetabek.",
  project_title: "Untuk kontraktor dan pengadaan",
  project_text:
    "Paving, kanstin, U-Ditch, buis, dan genteng dalam satu penawaran tertulis, lengkap dengan dokumen TKDN untuk tender.",
  home_faq:
    "Di mana lokasi pabrik Istana Block? :: Di Jl. Terusan Kapten Halim No.121, Kec. Pasawahan, Purwakarta, Jawa Barat. Anda bisa datang langsung; hubungi admin dulu agar kunjungan bisa dijadwalkan. Jam operasional Sabtu–Kamis, 07.30–17.00.\nApakah bisa kirim ke luar Purwakarta? :: Bisa. Kami mengirim dengan armada sendiri ke Karawang, Cikampek, Subang, Bandung, Cimahi, Bandung Barat, Cianjur, dan Sumedang. Jabodetabek dilayani khusus untuk pesanan skala proyek dengan volume minimal. Ongkir dihitung dari jarak, volume, dan akses di titik bongkar.\nBerapa harga paving block per m²? :: Mulai Rp80.000/m² untuk material, harga pabrik belum termasuk ongkir. Harga akhir tergantung jenis, tebal 6 atau 8 cm, warna, mutu, dan volume pesanan. Harga bisa berubah; penawaran tertulis memuat harga dan ongkir untuk lokasi Anda.\nBerapa jumlah paving per m²? :: Truepave (bata) 21×10,5 cm: 44 pcs. Hexagon 20×20 cm: 27 pcs. Ubin 21×21 cm: 22 pcs. Fullpave 30×30 cm: 11 pcs. Grass block: 7,5 pcs. Tambahkan cadangan 5% untuk pola lurus dan 10% untuk pola diagonal atau hexagon.\nApakah ada jasa pemasangan? :: Ada. Jasa pasang paving untuk luas minimal 200 m² dengan lahan siap pasang. Lokasi disurvei dan diukur dulu tanpa biaya, dan pemasangan bergaransi 1 bulan. Kanstin juga bisa dipasang; ketentuannya tanyakan ke admin.\nBagaimana cara memesan? :: Kirim produk, volume, dan lokasi lewat WhatsApp 0813 8888 5141 atau telepon 0878 8177 7660. Admin membalas dengan penawaran berisi harga produk dan ongkir. Pembayaran: DP saat PO, pelunasan saat barang tiba di lokasi.",
  seo_title: "Paving Block, U-Ditch & Buis Beton Purwakarta | Istana Block",
  seo_description:
    "Pabrik paving block, U-Ditch, buis beton, kanstin, dan genteng beton di Purwakarta. Mutu K-350–K-450, TKDN Kemenperin, armada sendiri.",
};

// cache(): layout, generateMetadata, dan halaman memanggil ini dalam satu request; query cukup sekali.
export const getSettings = cache(async (): Promise<Settings> => {
  const db = await getDb();
  const rows = await db.select().from(schema.settings);
  const out = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (r.key in out) out[r.key as SettingKey] = r.value;
  return out;
});

/**
 * Ubah teks FAQ (satu baris per tanya-jawab, format "Pertanyaan :: Jawaban") menjadi daftar.
 * Baris kosong atau tanpa pemisah "::" diabaikan.
 */
export { formatFaq, parseFaq } from "./faq";

export const MAPS_EMBED_PREFIX = "https://www.google.com/maps/embed";

/** true bila URL aman dipakai sebagai src iframe Google Maps. */
export function isMapsEmbedUrl(url: string | null | undefined) {
  return !!url && url.startsWith(MAPS_EMBED_PREFIX) && !/["'<>\s]/.test(url);
}
