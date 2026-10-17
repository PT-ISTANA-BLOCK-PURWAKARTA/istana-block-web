/** Utilitas kecil untuk modul keuangan & operasional (aman dipakai di server maupun klien). */

/** Tanggal bisnis hari ini di WIB (UTC+7) sebagai "YYYY-MM-DD". */
export function today(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

export function isDate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

export function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function yearStart(date: string): string {
  return `${date.slice(0, 4)}-01-01`;
}

/** "1.250.000", "1250000", "Rp 1.250.000" → 1250000. Desimal (koma) dibulatkan. */
export function parseRupiah(v: unknown): number {
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const neg = /^-|\(.*\)/.test(s);
  const clean = s.replace(/[^\d,]/g, "").replace(",", ".");
  const n = Math.round(parseFloat(clean || "0"));
  return Number.isFinite(n) ? (neg ? -n : n) : 0;
}

/** "2,5" atau "2.5" → 2.5; "1.000" (ribuan) → 1000 bila tidak ada koma. */
export function parseQty(v: unknown): number {
  let s = String(v ?? "").trim().replace(/\s/g, "");
  if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : 0;
}

export function formatQty(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  const r = Math.round(n * 1000) / 1000;
  const [i, d] = String(Math.abs(r)).split(".");
  const int = i.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${r < 0 ? "−" : ""}${int}${d ? `,${d}` : ""}`;
}

/** Rupiah tanpa "Rp" untuk tabel angka; negatif dalam kurung (gaya laporan keuangan). */
export function formatAmount(n: number | null | undefined, opts: { blankZero?: boolean } = {}): string {
  if (n == null || !Number.isFinite(n)) return "";
  if (n === 0 && opts.blankZero) return "";
  const s = Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return n < 0 ? `(${s})` : s;
}

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const BULAN_PANJANG = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/** "2026-10-17" → "17 Okt 2026" */
export function tgl(date: string | null | undefined): string {
  if (!date) return "";
  const [y, m, d] = date.split("-").map(Number);
  return `${d} ${BULAN[m - 1]} ${y}`;
}

/** "2026-10-17" → "17 Oktober 2026" */
export function tglPanjang(date: string | null | undefined): string {
  if (!date) return "";
  const [y, m, d] = date.split("-").map(Number);
  return `${d} ${BULAN_PANJANG[m - 1]} ${y}`;
}

export function terbilang(n: number): string {
  const s = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];
  const f = (x: number): string => {
    if (x < 12) return s[x];
    if (x < 20) return `${f(x - 10)} belas`;
    if (x < 100) return `${f(Math.floor(x / 10))} puluh ${f(x % 10)}`;
    if (x < 200) return `seratus ${f(x - 100)}`;
    if (x < 1000) return `${f(Math.floor(x / 100))} ratus ${f(x % 100)}`;
    if (x < 2000) return `seribu ${f(x - 1000)}`;
    if (x < 1e6) return `${f(Math.floor(x / 1000))} ribu ${f(x % 1000)}`;
    if (x < 1e9) return `${f(Math.floor(x / 1e6))} juta ${f(x % 1e6)}`;
    if (x < 1e12) return `${f(Math.floor(x / 1e9))} miliar ${f(x % 1e9)}`;
    return `${f(Math.floor(x / 1e12))} triliun ${f(x % 1e12)}`;
  };
  const r = Math.round(Math.abs(n));
  if (r === 0) return "nol rupiah";
  return `${f(r).replace(/\s+/g, " ").trim()} rupiah`;
}
