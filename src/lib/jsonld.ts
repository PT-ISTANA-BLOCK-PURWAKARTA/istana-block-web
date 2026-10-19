import type { PriceRow } from "@/db/schema";
import type { Settings } from "./settings";

/** "0264 200476" → "+62264200476" (format internasional untuk data terstruktur). */
function intlPhone(n: string) {
  const d = n.replace(/\D/g, "").replace(/^0/, "62");
  return d ? `+${d}` : undefined;
}

const HARI = ["senin", "selasa", "rabu", "kamis", "jumat", "sabtu", "minggu"];
const HARI_SCHEMA = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/**
 * "Sabtu–Kamis, 07.30–17.00" → openingHoursSpecification schema.org (mesin tidak bisa membaca teks bebas).
 * Rentang hari boleh melewati akhir pekan: Sabtu–Kamis = Sabtu, Minggu, Senin sampai Kamis.
 * Bentuk yang tidak dikenali mengembalikan undefined: lebih baik tanpa jam buka daripada salah.
 */
export function openingHoursSpec(hours: string) {
  const t = hours
    .toLowerCase()
    .replace(/[–—−]/g, "-")
    .replace(/['’]/g, "")
    .replace(/\bwib\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const m = t.match(/^([a-z]+)(?: ?(?:-|sampai|s\/d|hingga) ?([a-z]+))?[, ]+(\d{1,2})[.:](\d{2}) ?(?:-|sampai|s\/d|hingga) ?(\d{1,2})[.:](\d{2})$/);
  if (!m) return undefined;
  const from = HARI.indexOf(m[1]);
  const to = m[2] ? HARI.indexOf(m[2]) : from;
  const [h1, m1, h2, m2] = [m[3], m[4], m[5], m[6]].map(Number);
  if (from < 0 || to < 0 || h1 > 23 || h2 > 23 || m1 > 59 || m2 > 59) return undefined;
  if (h2 * 60 + m2 <= h1 * 60 + m1) return undefined; // jam tutup sebelum buka: bukan jam kerja biasa, jangan ditebak
  const days: string[] = [];
  for (let i = from; ; i = (i + 1) % 7) {
    days.push(HARI_SCHEMA[i]);
    if (i === to) break;
  }
  const hm = (h: number, mm: number) => `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  return [{ "@type": "OpeningHoursSpecification", dayOfWeek: days, opens: hm(h1, m1), closes: hm(h2, m2) }];
}

/** Kode pos 5 digit terakhir yang tampak di alamat ("… Jawa Barat 41172" → "41172"). */
function postalCode(address: string) {
  return [...address.matchAll(/\b\d{5}\b/g)].pop()?.[0];
}

/** Koordinat dari kolom pengaturan; kolom kosong atau di luar rentang → undefined (jangan jadi 0,0). */
function coord(v: string, max: number) {
  const t = v.trim().replace(",", ".");
  const n = t ? Number(t) : NaN;
  return Number.isFinite(n) && Math.abs(n) <= max ? n : undefined;
}

// Catatan: aggregateRating sengaja tidak dicantumkan. Google tidak menampilkan rating
// "self-serving" (ulasan tentang bisnis sendiri yang dipasang di situs bisnis itu).
export function localBusiness(s: Settings, siteUrl: string) {
  const office = intlPhone(s.phone_office);
  const mobile = intlPhone(s.phone);
  const hours = openingHoursSpec(s.hours);
  const zip = postalCode(s.address);
  const lat = coord(s.geo_lat, 90);
  const lng = coord(s.geo_lng, 180);
  // Hanya URL https; satu tautan per baris, dari pengaturan agar admin bisa membuang profil yang sudah tidak aktif.
  const sameAs = s.same_as
    .split(/\r?\n/)
    .map((u) => u.trim())
    .filter((u) => u.startsWith("https://"));
  return {
    "@context": "https://schema.org",
    "@type": "HomeAndConstructionBusiness",
    "@id": `${siteUrl}/#business`,
    name: s.company_name,
    legalName: s.legal_name,
    url: siteUrl,
    logo: `${siteUrl}/brand/logo-istana-block.png`,
    image: `${siteUrl}/img/pabrik/pabrik-mesin-paving.webp`,
    telephone: office ?? mobile,
    ...(office && mobile && office !== mobile
      ? { contactPoint: [{ "@type": "ContactPoint", contactType: "sales", telephone: mobile, availableLanguage: "id" }] }
      : {}),
    email: s.email,
    foundingDate: s.founded_year,
    address: {
      "@type": "PostalAddress",
      streetAddress: s.address,
      addressLocality: "Purwakarta",
      addressRegion: "Jawa Barat",
      ...(zip ? { postalCode: zip } : {}),
      addressCountry: "ID",
    },
    ...(lat !== undefined && lng !== undefined ? { geo: { "@type": "GeoCoordinates", latitude: lat, longitude: lng } } : {}),
    areaServed: s.service_area,
    ...(hours ? { openingHoursSpecification: hours } : {}),
    ...(s.maps_url ? { hasMap: s.maps_url } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
}

/**
 * Node WebSite untuk beranda: Google mengambil nama situs dari sini. Merujuk bisnis lewat @id (bukan menyalin
 * LocalBusiness). Sengaja TANPA potentialAction/SearchAction: situs tidak punya halaman pencarian.
 */
export function webSite(s: Settings, siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    url: siteUrl,
    name: s.company_name,
    alternateName: ["Istana Block"],
    inLanguage: "id-ID",
    publisher: { "@id": `${siteUrl}/#business` },
  };
}

/** Harga yang layak tampil: angka berhingga dan > 0 (0 atau kosong berarti "Hubungi", bukan gratis). */
const isPrice = (n: number | null | undefined): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;

/**
 * AggregateOffer halaman produk. Isinya hanya angka yang BENAR-BENAR tampil di halaman, supaya data
 * terstruktur tidak menjanjikan harga yang tidak terlihat pengunjung (Google bisa mencabut rich result-nya):
 * (1) harga di hero (priceLabel): "mulai X" atau rentang X–Y per satuan produk; bila hero kosong,
 * (2) baris tabel yang berangka, hanya satuan terbanyak, agar m² dan unit tidak bercampur di satu
 * lowPrice/highPrice. Hero kosong dan semua baris "Hubungi" → undefined (tanpa offers).
 * "Mulai X" tidak diberi highPrice (X bukan harga tertinggi). Sengaja TANPA priceValidUntil dan
 * availability: tidak ada tanggal berlaku atau info stok di data maupun di halaman.
 */
export function productOffers(
  p: { priceFrom: number | null; priceTo: number | null; unit: string; priceRows: PriceRow[] },
  siteUrl: string,
) {
  const rows = p.priceRows.flatMap((r) => (isPrice(r.price) ? [{ price: r.price, unit: (r.unit || p.unit).trim() }] : []));
  let unit = p.unit.trim();
  let low: number;
  let high: number | undefined;
  if (isPrice(p.priceFrom)) {
    low = p.priceFrom;
    if (isPrice(p.priceTo) && p.priceTo > p.priceFrom) high = p.priceTo;
  } else if (rows.length) {
    const tally = new Map<string, number>();
    for (const r of rows) tally.set(r.unit, (tally.get(r.unit) ?? 0) + 1);
    unit = [...tally].sort((a, b) => b[1] - a[1])[0][0]; // sort stabil: seri menang oleh baris yang tampil lebih dulu
    const same = rows.filter((r) => r.unit === unit).map((r) => r.price);
    low = Math.min(...same);
    high = Math.max(...same);
  } else {
    return undefined;
  }
  // Jumlah baris berangka (satuan sama) yang jatuh di rentang yang diumumkan; tanpa itu offerCount dibuang.
  const count = rows.filter((r) => r.unit === unit && r.price >= low && (high === undefined || r.price <= high)).length;
  return {
    "@type": "AggregateOffer",
    priceCurrency: "IDR",
    lowPrice: low,
    ...(high !== undefined ? { highPrice: high } : {}),
    ...(count ? { offerCount: count } : {}),
    // Satuan tertulis eksplisit: lowPrice/highPrice tidak punya kolom satuan.
    description: `Harga${unit ? ` per ${unit}` : ""}, belum termasuk ongkir.`,
    seller: { "@id": `${siteUrl}/#business` },
  };
}
