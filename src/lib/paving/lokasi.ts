/**
 * Lokasi proyek: urai masukan pencarian (koordinat, tautan Google Maps, nama tempat),
 * pemeriksa host anti-SSRF, pembantu Nominatim, dan baris lokasi untuk pesan WhatsApp.
 * Modul murni: tanpa DOM, tanpa fetch, dapat diuji penuh di Vitest.
 */

export interface TitikLokasi {
  lat: number;
  lng: number;
}

/** Lokasi proyek yang ikut ke pesan WA dan tautan bagi. `asal: "poligon"` = titik tengah gambar, bukan hasil cari. */
export interface LokasiProyek extends TitikLokasi {
  asal?: "cari" | "poligon";
}

export type HasilTitik = ({ ok: true } & TitikLokasi) | { ok: false; pesan: string };

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

export function titikValid(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

// ---------------------------------------------------------------------------
// Koordinat desimal
// ---------------------------------------------------------------------------

const NUM = String.raw`[-+]?\d+(?:\.\d+)?`;
const NUM_KOMA = String.raw`[-+]?\d+,\d+`;
const RE_PASANGAN = new RegExp(`^(${NUM})\\s*[,;]\\s*(${NUM})$|^(${NUM})\\s+(${NUM})$`);
// Gaya Indonesia: "-6,5569 107,4433" atau "-6,5569; 107,4433" (koma sebagai desimal).
const RE_PASANGAN_KOMA = new RegExp(`^(${NUM_KOMA})\\s*[;\\s]\\s*(${NUM_KOMA})$`);
const RE_MIRIP_KOORDINAT = /^[-+]?\d+(?:[.,]\d+)?\s*[,;\s]\s*[-+]?\d+(?:[.,]\d+)?$/;

/** Teks tampak seperti dua angka (belum tentu valid). */
export function miripKoordinat(teks: string): boolean {
  return RE_MIRIP_KOORDINAT.test(teks.trim());
}

/** Periksa rentang; beri pesan ramah bila urutannya tampak terbalik. */
export function validasiKoordinat(lat: number, lng: number): HasilTitik {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { ok: false, pesan: "Koordinat bukan angka yang benar." };
  if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
    return {
      ok: false,
      pesan: `Urutannya tampak terbalik. Tulis lintang dulu, lalu bujur, contoh: ${round6(lng)}, ${round6(lat)}.`,
    };
  }
  if (Math.abs(lat) > 90) return { ok: false, pesan: "Lintang (angka pertama) harus antara -90 dan 90." };
  if (Math.abs(lng) > 180) return { ok: false, pesan: "Bujur (angka kedua) harus antara -180 dan 180." };
  return { ok: true, lat: round6(lat), lng: round6(lng) };
}

/** Urai "-6.5569, 107.4433" (koma/titik koma/spasi). null bila teks bukan pasangan angka. */
export function parseKoordinat(teks: string): HasilTitik | null {
  const t = teks.trim();
  if (!t) return null;
  let a: string | undefined;
  let b: string | undefined;
  const m = RE_PASANGAN.exec(t);
  if (m) {
    a = m[1] ?? m[3];
    b = m[2] ?? m[4];
  } else {
    const k = RE_PASANGAN_KOMA.exec(t);
    if (k) {
      a = k[1].replace(",", ".");
      b = k[2].replace(",", ".");
    }
  }
  if (a === undefined || b === undefined) return null;
  return validasiKoordinat(Number(a), Number(b));
}

// ---------------------------------------------------------------------------
// Tautan Google Maps
// ---------------------------------------------------------------------------

const GOOGLE_PARAM = ["q", "ll", "query", "destination", "daddr", "center"];

function koordinatDariTeks(teks: string): TitikLokasi | null {
  const bersih = teks.trim().replace(/^loc:/i, "").replace(/\+/g, " ");
  const r = parseKoordinat(bersih);
  return r && r.ok ? { lat: r.lat, lng: r.lng } : null;
}

function aman(teks: string): string {
  try {
    return decodeURIComponent(teks);
  } catch {
    return teks;
  }
}

/**
 * Ambil koordinat dari URL Google Maps panjang. Urutan prioritas (pin lebih tepat daripada pusat tampilan):
 * `!3d..!4d..`, parameter `q/ll/query/destination/center`, segmen `/place/` atau `/search/` berisi koordinat, lalu `@lat,lng`.
 */
export function koordinatDariUrlGoogle(url: string): TitikLokasi | null {
  const teks = aman(url.trim());

  const pin = /!3d([-+]?\d+(?:\.\d+)?)!4d([-+]?\d+(?:\.\d+)?)/.exec(teks);
  if (pin) {
    const v = validasiKoordinat(Number(pin[1]), Number(pin[2]));
    if (v.ok) return { lat: v.lat, lng: v.lng };
  }

  let u: URL | null = null;
  try {
    u = new URL(/^[a-z]+:\/\//i.test(teks) ? teks : `https://${teks}`);
  } catch {
    u = null;
  }
  if (u) {
    for (const nama of GOOGLE_PARAM) {
      const nilai = u.searchParams.get(nama);
      if (nilai) {
        const t = koordinatDariTeks(nilai);
        if (t) return t;
      }
    }
    for (const seg of u.pathname.split("/")) {
      const t = koordinatDariTeks(aman(seg));
      if (t) return t;
    }
  }

  const at = /@([-+]?\d+(?:\.\d+)?),([-+]?\d+(?:\.\d+)?)/.exec(teks);
  if (at) {
    const v = validasiKoordinat(Number(at[1]), Number(at[2]));
    if (v.ok) return { lat: v.lat, lng: v.lng };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Pemeriksa host (anti-SSRF) untuk endpoint perluasan tautan pendek
// ---------------------------------------------------------------------------

export const HOST_GOOGLE_DIIZINKAN: readonly string[] = [
  "maps.app.goo.gl",
  "goo.gl",
  "maps.google.com",
  "www.google.com",
  "google.com",
];
const RE_GOOGLE_CO_ID = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*google\.co\.id$/;
export const MAKS_REDIRECT = 5;

export function hostDiizinkan(host: string): boolean {
  const h = host.toLowerCase();
  return HOST_GOOGLE_DIIZINKAN.includes(h) || RE_GOOGLE_CO_ID.test(h);
}

export type HasilUrl = { ok: true; url: URL } | { ok: false; alasan: string };

/** Hanya https, tanpa kredensial, port bawaan, dan host dalam daftar putih. Dipakai di tiap hop redirect. */
export function periksaUrlGoogle(masukan: string | URL): HasilUrl {
  let u: URL;
  try {
    u = typeof masukan === "string" ? new URL(masukan) : masukan;
  } catch {
    return { ok: false, alasan: "URL tidak valid." };
  }
  if (u.protocol !== "https:") return { ok: false, alasan: "Hanya https yang diizinkan." };
  if (u.username || u.password) return { ok: false, alasan: "URL tidak boleh memuat kredensial." };
  if (u.port && u.port !== "443") return { ok: false, alasan: "Port tidak diizinkan." };
  if (!hostDiizinkan(u.hostname)) return { ok: false, alasan: "Host tidak diizinkan." };
  return { ok: true, url: u };
}

/** Tujuan hop redirect berikutnya (Location bisa relatif). null bila tidak bisa diurai. */
export function tujuanRedirect(dari: URL, location: string | null): URL | null {
  if (!location) return null;
  try {
    return new URL(location, dari);
  } catch {
    return null;
  }
}

function urlDariTeks(masukan: string): URL | null {
  const t = masukan.trim();
  if (!t || /\s/.test(t)) return null;
  try {
    return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`);
  } catch {
    return null;
  }
}

/** Tautan pendek Google Maps yang perlu diperluas lewat server. */
export function adalahLinkPendek(masukan: string): boolean {
  const u = urlDariTeks(masukan);
  if (!u) return false;
  const h = u.hostname.toLowerCase();
  if (h === "maps.app.goo.gl") return true;
  return h === "goo.gl" && /^\/maps(\/|$)/i.test(u.pathname);
}

// ---------------------------------------------------------------------------
// Deteksi format satu kotak masukan
// ---------------------------------------------------------------------------

export type Tafsir =
  | { jenis: "kosong" }
  | { jenis: "koordinat"; hasil: HasilTitik }
  | { jenis: "link-panjang"; hasil: HasilTitik }
  | { jenis: "link-pendek"; url: string }
  | { jenis: "nama"; kueri: string };

const RE_HOST_GOOGLE_UMUM = /^(?:[a-z0-9-]+\.)*(?:google\.[a-z.]+|goo\.gl)$/i;

export function tafsirMasukan(masukan: string): Tafsir {
  const t = masukan.trim();
  if (!t) return { jenis: "kosong" };

  if (miripKoordinat(t)) {
    const hasil = parseKoordinat(t);
    if (hasil) return { jenis: "koordinat", hasil };
  }

  const u = urlDariTeks(t);
  if (u && u.hostname.includes(".") && RE_HOST_GOOGLE_UMUM.test(u.hostname)) {
    if (adalahLinkPendek(t)) {
      return { jenis: "link-pendek", url: u.toString() };
    }
    const titik = koordinatDariUrlGoogle(t);
    return {
      jenis: "link-panjang",
      hasil: titik
        ? { ok: true, ...titik }
        : {
            ok: false,
            pesan:
              "Tautan ini tidak memuat koordinat. Buka lokasinya di Google Maps lalu salin tautan dari tombol Bagikan, atau ketik nama tempatnya.",
          },
    };
  }
  if (u && /^https?:\/\//i.test(t)) {
    return {
      jenis: "link-panjang",
      hasil: { ok: false, pesan: "Hanya tautan Google Maps yang didukung. Atau ketik nama tempat / koordinatnya." },
    };
  }
  return { jenis: "nama", kueri: t };
}

// ---------------------------------------------------------------------------
// Nominatim (OpenStreetMap)
// ---------------------------------------------------------------------------

export const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search";
/** Kebijakan pakai Nominatim: maksimal 1 permintaan per detik. */
export const NOMINATIM_JEDA_MS = 1000;

export function urlNominatim(kueri: string): string {
  const p = new URLSearchParams({
    format: "jsonv2",
    q: kueri.trim(),
    countrycodes: "id",
    "accept-language": "id",
    limit: "5",
  });
  return `${NOMINATIM_BASE}?${p.toString()}`;
}

export interface HasilCari extends TitikLokasi {
  nama: string;
}

/** Saring respons Nominatim menjadi daftar {nama, lat, lng}; entri rusak dibuang. */
export function parseHasilNominatim(data: unknown): HasilCari[] {
  if (!Array.isArray(data)) return [];
  const out: HasilCari[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const lat = Number(r.lat);
    const lng = Number(r.lon);
    const nama = typeof r.display_name === "string" ? r.display_name : "";
    if (!nama || !titikValid(lat, lng)) continue;
    out.push({ nama, lat: round6(lat), lng: round6(lng) });
    if (out.length >= 5) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Pesan WhatsApp & geometri
// ---------------------------------------------------------------------------

export function linkGoogleMaps(lat: number, lng: number): string {
  return `https://maps.google.com/?q=${round6(lat)},${round6(lng)}`;
}

/** Baris "Lokasi proyek: ..." untuk pesan WA; poligon tanpa pencarian diberi tanda perkiraan. */
export function barisLokasiWa(lok: LokasiProyek | null | undefined): string | null {
  if (!lok || !titikValid(lok.lat, lok.lng)) return null;
  const baris = `Lokasi proyek: ${linkGoogleMaps(lok.lat, lok.lng)}`;
  return lok.asal === "poligon" ? `${baris} (perkiraan: titik tengah lahan yang digambar di peta)` : baris;
}

/** Titik tengah poligon [lng, lat] (berbobot luas; jatuh ke rata-rata bila luas nol). null bila < 3 titik. */
export function titikTengahPoligon(titik: ReadonlyArray<readonly [number, number]>): TitikLokasi | null {
  const n = titik.length;
  if (n < 3) return null;
  // Geser ke titik pertama supaya selisih kecil tidak hilang oleh presisi desimal.
  const [ox, oy] = titik[0];
  let a2 = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    const x0 = titik[i][0] - ox;
    const y0 = titik[i][1] - oy;
    const x1 = titik[(i + 1) % n][0] - ox;
    const y1 = titik[(i + 1) % n][1] - oy;
    const k = x0 * y1 - x1 * y0;
    a2 += k;
    cx += (x0 + x1) * k;
    cy += (y0 + y1) * k;
  }
  let lng: number;
  let lat: number;
  if (Math.abs(a2) < 1e-18) {
    lng = titik.reduce((s, p) => s + p[0], 0) / n;
    lat = titik.reduce((s, p) => s + p[1], 0) / n;
  } else {
    lng = ox + cx / (3 * a2);
    lat = oy + cy / (3 * a2);
  }
  if (!titikValid(lat, lng)) return null;
  return { lat: round6(lat), lng: round6(lng) };
}

/**
 * Koordinat dari isi halaman Google Maps (cadangan bila redirect tidak memuatnya). Hanya pola spesifik:
 * `!3d..!4d..`, `center=lat,lng` (meta peta statis), dan `/@lat,lng,zoomz`.
 */
export function koordinatDariHtmlGoogle(html: string): TitikLokasi | null {
  const kandidat: Array<[number, number]> = [];
  const pin = /!3d([-+]?\d+(?:\.\d+)?)!4d([-+]?\d+(?:\.\d+)?)/.exec(html);
  if (pin) kandidat.push([Number(pin[1]), Number(pin[2])]);
  const pusat = /[?&;]center=([-+]?\d+(?:\.\d+)?)(?:%2C|,)([-+]?\d+(?:\.\d+)?)/i.exec(html);
  if (pusat) kandidat.push([Number(pusat[1]), Number(pusat[2])]);
  const at = /\/@([-+]?\d+(?:\.\d+)?),([-+]?\d+(?:\.\d+)?),\d+(?:\.\d+)?[zm]/.exec(html);
  if (at) kandidat.push([Number(at[1]), Number(at[2])]);
  for (const [lat, lng] of kandidat) {
    const v = validasiKoordinat(lat, lng);
    if (v.ok) return { lat: v.lat, lng: v.lng };
  }
  return null;
}
