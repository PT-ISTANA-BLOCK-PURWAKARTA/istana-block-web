// Inti tutup buku tanpa akses database: periode (bulan), urutan tutup, dan ringkasan hasil analisa.
// Aman dipakai di server, klien (paket audit Excel), dan tes.

export type CheckStatus = "ok" | "info" | "perhatian" | "masalah";
export type CheckArea = "buku_besar" | "neraca" | "laba_rugi" | "arus_kas" | "piutang_hutang" | "stok" | "bahan_baku" | "dokumen";

export const AREA_LABEL: Record<CheckArea, string> = {
  buku_besar: "Buku besar & jurnal",
  neraca: "Neraca",
  laba_rugi: "Laba rugi",
  arus_kas: "Arus kas, kas & bank",
  piutang_hutang: "Piutang & hutang",
  stok: "Stok barang jadi",
  bahan_baku: "Bahan baku",
  dokumen: "Dokumen & pencatatan",
};
export const AREA_ORDER = Object.keys(AREA_LABEL) as CheckArea[];

export const STATUS_LABEL: Record<CheckStatus, string> = { ok: "Sesuai", info: "Info", perhatian: "Perhatian", masalah: "Masalah" };

/** Tabel rincian kecil di bawah sebuah pemeriksaan (maks. beberapa puluh baris). */
export type CheckTable = { cols: string[]; rows: (string | number)[][]; more?: number };

export type Check = {
  key: string;
  area: CheckArea;
  label: string;
  status: CheckStatus;
  /** Ringkasan angka/hasil, satu kalimat. */
  value: string;
  /** Penjelasan / saran perbaikan. */
  hint?: string;
  table?: CheckTable;
  href?: string;
};

export type CheckSummary = { masalah: number; perhatian: number; ok: number; info: number };

export function summarizeChecks(checks: Pick<Check, "status">[]): CheckSummary {
  const s: CheckSummary = { masalah: 0, perhatian: 0, ok: 0, info: 0 };
  for (const c of checks) s[c.status] += 1;
  return s;
}

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export const isPeriod = (s: unknown): s is string => typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
export const periodOf = (date: string) => date.slice(0, 7);

/** Tanggal pertama & terakhir sebuah periode yyyy-mm, plus nama bulannya. */
export function periodRange(period: string) {
  const y = Number(period.slice(0, 4));
  const m = Number(period.slice(5, 7));
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${period}-01`, to: `${period}-${String(last).padStart(2, "0")}`, label: `${BULAN[m - 1]} ${y}` };
}

export function addMonths(period: string, n: number) {
  const y = Number(period.slice(0, 4));
  const m = Number(period.slice(5, 7)) - 1 + n;
  const yy = y + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  return `${yy}-${String(mm + 1).padStart(2, "0")}`;
}

/** Daftar periode dari..sampai (inklusif), urut naik. */
export function periodsBetween(from: string, to: string) {
  const out: string[] = [];
  for (let p = from; p <= to && out.length < 600; p = addMonths(p, 1)) out.push(p);
  return out;
}

export const isMonthEnd = (date: string) => periodRange(periodOf(date)).to === date;

/**
 * Periode berikutnya yang boleh ditutup. Tutup buku harus berurutan: kunci = akhir bulan terakhir yang ditutup.
 * Kunci lama yang jatuh di tengah bulan (diatur manual dulu) → bulan itu yang ditutup berikutnya.
 */
export function closablePeriod(lockDate: string, firstPeriod: string) {
  if (!lockDate) return firstPeriod;
  const p = periodOf(lockDate);
  const next = isMonthEnd(lockDate) ? addMonths(p, 1) : p;
  return next < firstPeriod ? firstPeriod : next;
}

/** Status periode terhadap tanggal kunci: ditutup penuh, terkunci sebagian (kunci lama), atau terbuka. */
export function periodLockState(period: string, lockDate: string): "ditutup" | "sebagian" | "terbuka" {
  if (!lockDate) return "terbuka";
  const { from, to } = periodRange(period);
  if (lockDate >= to) return "ditutup";
  if (lockDate >= from) return "sebagian";
  return "terbuka";
}

/** Alasan wajib (tetap menutup walau ada masalah / membuka kembali). */
export const MIN_REASON = 15;
