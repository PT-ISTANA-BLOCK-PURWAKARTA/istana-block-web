// Impor saldo awal piutang / hutang per faktur dari ekspor Zahir ("Piutang Usaha Per Pelanggan - Rincian" /
// "Rincian Hutang"), format CSV atau Excel. Fungsi di sini murni (tanpa database) supaya bisa dites.

export type OpeningKind = "piutang" | "hutang";

/** Satu baris faktur terbuka hasil baca file. */
export type OpeningRow = {
  line: number;
  code: string;
  name: string;
  date: string;
  dueDate: string;
  docType: string;
  ref: string;
  /** Nilai faktur (bila ada di file); tidak dipakai untuk saldo. */
  amount: number | null;
  /** Sisa piutang/hutang (boleh minus: kelebihan bayar). */
  balance: number;
  currency: string;
};

/** Nama kolom yang dikenali (huruf kecil, tanpa spasi/tanda baca). */
const HEADERS: Record<keyof Omit<OpeningRow, "line">, string[]> = {
  code: ["kode", "kodepelanggan", "kodepemasok", "id", "idpelanggan", "idpemasok", "customerid", "vendorid"],
  name: ["nama", "namapelanggan", "namapemasok", "pelanggan", "pemasok", "perusahaan", "customer", "vendor"],
  date: ["tanggal", "tglfaktur", "tanggalfaktur", "date"],
  dueDate: ["jatuhtempo", "tanggaljatuhtempo", "tgljatuhtempo", "duedate"],
  docType: ["tipe", "tp", "jenis"],
  ref: ["noref", "noreferensi", "nofaktur", "nomorfaktur", "nomor", "referensi", "ref"],
  amount: ["nilai", "nilaifaktur", "total", "jumlah"],
  balance: ["sisa", "sisapiutang", "sisahutang", "saldo", "terutang", "outstanding"],
  currency: ["matauang", "currency"],
};
const key = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Angka gaya Indonesia atau Inggris: "1.234.567,50", "1,234,567.50", "1234567.5", "(1.000)" = -1000, "-76,50".
 * Pemisah desimal = tanda terakhir bila diikuti 1–2 angka.
 */
export function parseAmount(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v ?? "").trim().replace(/\s|rp|idr/gi, "");
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (s.startsWith("-")) { neg = !neg; s = s.slice(1); }
  const lastDot = s.lastIndexOf("."), lastComma = s.lastIndexOf(",");
  const last = Math.max(lastDot, lastComma);
  let intPart = s, frac = "";
  if (last >= 0 && s.length - last - 1 <= 2 && s.length - last - 1 >= 1) {
    // Satu tanda saja dengan 3 angka di belakang = ribuan ("1.000"), bukan desimal — ditangani karena panjang ≤ 2 di sini.
    intPart = s.slice(0, last);
    frac = s.slice(last + 1);
  }
  intPart = intPart.replace(/[.,]/g, "");
  if (!/^\d+$/.test(intPart || "0") || (frac && !/^\d+$/.test(frac))) return null;
  const n = Number(`${intPart || "0"}${frac ? `.${frac}` : ""}`);
  return neg ? -n : n;
}

/** Tanggal "27/11/2026", "27-11-2026", "2026-11-27", atau nomor seri Excel → "YYYY-MM-DD". */
export function parseDay(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === "number" && v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + v * 86400000).toISOString().slice(0, 10);
  const s = String(v ?? "").trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) {
    const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return null;
}

/** Baris mentah (array per sel, baris pertama berisi judul kolom di mana saja) → baris faktur + daftar kesalahan. */
export function readOpeningTable(table: unknown[][]): { rows: OpeningRow[]; errors: string[] } {
  const errors: string[] = [];
  const headIdx = table.findIndex((r) => {
    const ks = r.map(key);
    return HEADERS.balance.some((h) => ks.includes(h)) && HEADERS.ref.some((h) => ks.includes(h));
  });
  if (headIdx < 0) return { rows: [], errors: ["Judul kolom tidak ditemukan. Minimal ada kolom No. Faktur/No. Ref dan Sisa."] };
  const head = table[headIdx].map(key);
  const col = Object.fromEntries(Object.entries(HEADERS).map(([f, names]) => [f, head.findIndex((h) => names.includes(h))])) as Record<keyof typeof HEADERS, number>;
  for (const need of ["name", "date", "ref", "balance"] as const) if (col[need] < 0) errors.push(`Kolom wajib "${need === "name" ? "Nama" : need === "date" ? "Tanggal" : need === "ref" ? "No. Faktur" : "Sisa"}" tidak ada.`);
  if (errors.length) return { rows: [], errors };
  const rows: OpeningRow[] = [];
  table.slice(headIdx + 1).forEach((r, i) => {
    const line = headIdx + i + 2;
    const cell = (c: number) => (c >= 0 ? r[c] : undefined);
    const ref = String(cell(col.ref) ?? "").trim();
    const name = String(cell(col.name) ?? "").trim();
    if (!ref && !name) return; // baris kosong / subtotal
    if (/^(saldo|total|grand ?total)/i.test(name) || /^(saldo|total)/i.test(ref)) return;
    const date = parseDay(cell(col.date));
    const balance = parseAmount(cell(col.balance));
    if (!ref) { errors.push(`Baris ${line}: nomor faktur kosong.`); return; }
    if (!name) { errors.push(`Baris ${line} (${ref}): nama kosong.`); return; }
    if (!date) { errors.push(`Baris ${line} (${ref}): tanggal tidak terbaca.`); return; }
    if (balance === null) { errors.push(`Baris ${line} (${ref}): sisa tidak terbaca.`); return; }
    if (balance === 0) return;
    rows.push({
      line, code: String(cell(col.code) ?? "").trim(), name, date, dueDate: parseDay(cell(col.dueDate)) ?? date, docType: String(cell(col.docType) ?? "").trim(),
      ref, amount: parseAmount(cell(col.amount)), balance, currency: String(cell(col.currency) ?? "IDR").trim() || "IDR",
    });
  });
  const seen = new Set<string>();
  for (const r of rows) {
    const k = `${normName(r.name)}|${r.docType}|${r.ref}`;
    if (seen.has(k)) errors.push(`Faktur ${r.docType} ${r.ref} (${r.name}) muncul dua kali di file.`);
    seen.add(k);
  }
  for (const r of rows) if (r.currency.toUpperCase() !== "IDR") errors.push(`Faktur ${r.ref}: mata uang ${r.currency} belum didukung (hanya IDR).`);
  return { rows, errors };
}

/** Nama untuk pencocokan: huruf besar, tanpa tanda baca & spasi ganda ("BPK. BUDI" = "Bpk Budi"). */
export const normName = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();

/** Nomor faktur saldo awal: tipe + nomor Zahir ("SJ/00000378"); kunci anti-dobel = nomor ini + kontak. */
export const openingNumber = (r: Pick<OpeningRow, "docType" | "ref">) => (r.docType ? `${r.docType}/${r.ref}` : r.ref).toUpperCase();

/** Kelompok umur (hari lewat jatuh tempo per tanggal posisi): 0 = belum jatuh tempo, 1 = 1–30, 2 = 31–60, 3 = 61–90, 4 = > 90. */
export function agingBucket(dueDate: string, asOf: string) {
  const days = Math.round((Date.parse(`${asOf}T00:00:00Z`) - Date.parse(`${dueDate}T00:00:00Z`)) / 86400000);
  return days <= 0 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : days <= 90 ? 3 : 4;
}

/** Total sisa dibulatkan ke rupiah (sen dari Zahir dibulatkan per faktur, sama seperti saat disimpan). */
export const openingTotal = (rows: Pick<OpeningRow, "balance">[]) => rows.reduce((s, r) => s + Math.round(r.balance), 0);
