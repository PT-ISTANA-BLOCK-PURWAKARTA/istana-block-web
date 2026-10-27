// Inti Rekap Pelanggan: label, rumus closing/kepuasan, ringkasan, parser impor Excel "TABEL PENILAIAN KONSUMEN",
// penyusun lembar ekspor, dan angka Sasaran Mutu otomatis. Fungsi murni (aman dipakai di klien, server, dan cron).
// TANPA "server-only" dan TANPA alias "@/" karena iso-core.ts (ikut dibundel worker.ts) mengimpor berkas ini.
import type { GetbackResult, LeadFeedback, LeadReason, LeadStatus } from "../../db/erp";
import type { SheetData } from "./excel";

/* ------------------------------------------------------------------ label */

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = { membeli: "Membeli", follow_up: "Follow up", tidak_membeli: "Tidak membeli" };
export const LEAD_STATUS_ORDER: LeadStatus[] = ["membeli", "follow_up", "tidak_membeli"];

export const LEAD_SOURCES = ["Google Ads", "WhatsApp", "Instagram / Facebook", "Datang langsung", "Telepon", "Referensi", "Pelanggan lama", "Lainnya"] as const;

export const REASON_META: { code: LeadReason; label: string; short: string; excel: string; hint: string }[] = [
  { code: "harga_mahal", label: "Harga mahal", short: "HM", excel: "HARGA MAHAL", hint: "Ada kompetitor yang menjual barang sejenis dengan harga lebih murah" },
  { code: "min_order", label: "Min order", short: "MO", excel: "MIN ORDER", hint: "Tidak masuk SOP kiriman pabrik (min 15 m² area Purwakarta & 1 truk luar Purwakarta)" },
  { code: "luar_provinsi", label: "Luar provinsi", short: "LP", excel: "LUAR PROVINSI", hint: "Konsumen berdomisili di luar Jawa Barat" },
  { code: "tidak_ada_info", label: "Tidak ada info", short: "TI", excel: "TIDAK ADA INFO", hint: "Konsumen tidak membalas lagi setelah direspon" },
  { code: "tidak_tersedia", label: "Tidak tersedia", short: "TT", excel: "TIDAK TERSEDIA", hint: "Jenis / ukuran produk yang ditanyakan tidak diproduksi" },
];
export const REASON_LABEL = Object.fromEntries(REASON_META.map((r) => [r.code, r.label])) as Record<LeadReason, string>;

export const STAR_WORDS = ["belum dinilai", "Sangat buruk", "Buruk", "Cukup", "Baik", "Sangat baik"];

export const BULAN_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/** "2026-10" -> "Oktober 2026". */
export function monthName(key: string) {
  const m = Number(key.slice(5, 7));
  return m >= 1 && m <= 12 ? `${BULAN_ID[m - 1]} ${key.slice(0, 4)}` : key;
}

/** Baris impor hanya presisi bulan (tanggal 1): tampil "Oktober 2026"; selain itu "17 Okt 2026". */
export function leadDateText(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return day;
  if (day.endsWith("-01")) return monthName(day.slice(0, 7));
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

const dmy = (day: string | null | undefined) => (day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}` : "");

/* ------------------------------------------------------------------ tipe baris */

/** Baris konsumen seperti dilihat UI / ekspor (nama pengguna sudah digabung). */
export type LeadRow = {
  id: string;
  contactDate: string;
  source: string;
  name: string;
  phone: string | null;
  address: string | null;
  product: string | null;
  status: LeadStatus;
  saleValue: number | null;
  priceNett: number | null;
  priceOffer: number | null;
  reasons: LeadReason[];
  notes: string | null;
  ratingService: number | null;
  ratingQuality: number | null;
  ratingSpeed: number | null;
  ratingNote: string | null;
  feedback: LeadFeedback | null;
  complaintDate: string | null;
  complaintNote: string | null;
  getbackDate: string | null;
  getbackNote: string | null;
  getbackResult: GetbackResult | null;
  getbackByName: string | null;
  ratedByName: string | null;
  /** Tertaut ke pelanggan web (fin_contacts). */
  contactId: string | null;
};

/** Kolom minimum yang dibutuhkan rumus (dipakai juga oleh Sasaran Mutu). */
export type LeadCalcRow = Pick<
  LeadRow,
  "contactDate" | "status" | "saleValue" | "priceNett" | "priceOffer" | "reasons" | "ratingService" | "ratingQuality" | "ratingSpeed" | "feedback" | "complaintDate" | "getbackDate" | "getbackResult"
>;

/* ------------------------------------------------------------------ rumus */

/** Skor bintang 0-100 = round(rata-rata bintang terisi x 20); null bila ketiganya kosong. */
export function ratingScore(r: Pick<LeadCalcRow, "ratingService" | "ratingQuality" | "ratingSpeed">): number | null {
  const v = [r.ratingService, r.ratingQuality, r.ratingSpeed].filter((x): x is number => typeof x === "number");
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 20) : null;
}

/**
 * Kepuasan pembeli: komplain -> puas hanya bila get back berhasil; ada bintang -> skor >= 80; tanpa bintang ->
 * keterangan Puas = true; selain itu null (belum dinilai).
 */
export function isSatisfied(r: LeadCalcRow): boolean | null {
  if (r.feedback === "komplain") return r.getbackResult === "puas";
  const n = ratingScore(r);
  if (n !== null) return n >= 80;
  return r.feedback === "puas" ? true : null;
}

export type LeadChip = "semua" | "membeli" | "belum_dinilai" | "komplain" | "belum_getback" | "follow_up" | "tidak_membeli";
export const LEAD_CHIPS: { key: LeadChip; label: string }[] = [
  { key: "semua", label: "Semua" },
  { key: "membeli", label: "Membeli" },
  { key: "belum_dinilai", label: "Pembeli belum dinilai" },
  { key: "komplain", label: "Komplain" },
  { key: "belum_getback", label: "Komplain belum di-get back" },
  { key: "follow_up", label: "Follow up" },
  { key: "tidak_membeli", label: "Tidak membeli" },
];
export const isChip = (v: unknown): v is LeadChip => LEAD_CHIPS.some((c) => c.key === v);

export function matchChip(r: LeadRow, chip: LeadChip): boolean {
  switch (chip) {
    case "semua": return true;
    case "belum_dinilai": return r.status === "membeli" && r.feedback === null;
    case "komplain": return r.feedback === "komplain";
    case "belum_getback": return r.feedback === "komplain" && !r.getbackDate;
    default: return r.status === chip;
  }
}

/** Cari substring (huruf kecil) pada nama, HP, alamat, produk, keterangan. */
export function matchQuery(r: LeadRow, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return [r.name, r.phone, r.address, r.product, r.notes].some((x) => (x ?? "").toLowerCase().includes(s));
}

const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);

export type LeadSummary = ReturnType<typeof summarizeLeads>;

/** Kartu ringkasan: dihitung dari SELURUH baris periode (bukan dari chip status / pencarian). */
export function summarizeLeads(rows: LeadCalcRow[]) {
  const buyers = rows.filter((r) => r.status === "membeli");
  const sat = buyers.map((r) => isSatisfied(r));
  const rated = sat.filter((x) => x !== null).length;
  const satisfied = sat.filter((x) => x === true).length;
  const scores = buyers.map(ratingScore).filter((x): x is number => x !== null);
  const aspect = (k: "ratingService" | "ratingQuality" | "ratingSpeed") => mean(buyers.map((r) => r[k]).filter((x): x is number => typeof x === "number"));
  const complaints = buyers.filter((r) => r.feedback === "komplain");
  return {
    total: rows.length,
    membeli: buyers.length,
    followUp: rows.filter((r) => r.status === "follow_up").length,
    tidakMembeli: rows.filter((r) => r.status === "tidak_membeli").length,
    closingPct: rows.length ? Math.round((buyers.length / rows.length) * 100) : null,
    saleValue: buyers.reduce((s, r) => s + (r.saleValue ?? 0), 0),
    rated,
    satisfied,
    satisfiedPct: rated ? Math.round((satisfied / rated) * 100) : null,
    avgScore: scores.length ? Math.round(mean(scores) as number) : null,
    complaints: complaints.length,
    ungetback: complaints.filter((r) => !r.getbackDate).length,
    unrated: buyers.length - rated,
    reasons: Object.fromEntries(REASON_META.map((m) => [m.code, rows.filter((r) => r.reasons.includes(m.code)).length])) as Record<LeadReason, number>,
    avg: { service: aspect("ratingService"), quality: aspect("ratingQuality"), speed: aspect("ratingSpeed") },
  };
}

/** Angka desimal gaya Indonesia: 4.25 -> "4,3". */
export const oneDecimal = (n: number | null) => (n === null ? "-" : n.toFixed(1).replace(".", ","));

export type MonthlyRow = { month: string; total: number; membeli: number; closing: number | null; followUp: number; tidakMembeli: number; saleValue: number; reasons: Record<LeadReason, number> };

/** Ringkasan per bulan (kunci = contactDate.slice(0, 7)), urut naik. closing = round(membeli/konsumen x 1000)/10. */
export function monthlySummary(rows: LeadCalcRow[]): MonthlyRow[] {
  const by = new Map<string, LeadCalcRow[]>();
  for (const r of rows) {
    const k = r.contactDate.slice(0, 7);
    by.set(k, [...(by.get(k) ?? []), r]);
  }
  return [...by.keys()].sort().map((month) => {
    const s = summarizeLeads(by.get(month) as LeadCalcRow[]);
    return { month, total: s.total, membeli: s.membeli, closing: s.total ? Math.round((s.membeli / s.total) * 1000) / 10 : null, followUp: s.followUp, tidakMembeli: s.tidakMembeli, saleValue: s.saleValue, reasons: s.reasons };
  });
}

/* ------------------------------------------------------------------ Sasaran Mutu otomatis */

const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/**
 * Angka 5 Sasaran Mutu otomatis dari Rekap Pelanggan. Bulan/periode = contactDate.
 * RUMUS TAFSIRAN (tidak terlihat dari klien app live, lihat spek 1.9) - ubah di sini bila pemilik menetapkan lain:
 *  - no.13 chat: total = semua konsumen periode; tercapai diisi MANUAL per bulan (lihat iso-core.ts).
 *  - no.14 penawaran: total = semua konsumen periode; tercapai = status membeli ATAU harga nett/harga tawar terisi.
 *  - no.16 kepuasan: total = pembeli yang sudah dinilai (isSatisfied != null); tercapai = puas.
 *  - no.20 tanpa keluhan: total = pembeli; tercapai = pembeli tanpa keterangan Komplain.
 *  - no.22 keluhan <= 24 jam: total = pembeli komplain; tercapai = ada tanggal get back paling lambat 1 hari setelah
 *    tanggal komplain (bila tanggal komplain kosong dipakai contactDate).
 */
export function leadObjectives(rows: LeadCalcRow[]) {
  const buyers = rows.filter((r) => r.status === "membeli");
  const rated = buyers.map((r) => isSatisfied(r)).filter((x): x is boolean => x !== null);
  const complaints = buyers.filter((r) => r.feedback === "komplain");
  return {
    chat: { total: rows.length },
    offer: { total: rows.length, achieved: rows.filter((r) => r.status === "membeli" || (r.priceNett ?? 0) > 0 || (r.priceOffer ?? 0) > 0).length },
    satisfaction: { total: rated.length, achieved: rated.filter(Boolean).length },
    noComplaint: { total: buyers.length, achieved: buyers.filter((r) => r.feedback !== "komplain").length },
    getback24: {
      total: complaints.length,
      achieved: complaints.filter((r) => !!r.getbackDate && dayDiff(r.complaintDate || r.contactDate, r.getbackDate) <= 1).length,
    },
  };
}

/* ------------------------------------------------------------------ normalisasi */

/** Nomor HP: hanya digit, >= 6 digit, awalan 62 -> 0, selain itu bila tak berawalan 0 ditambah 0. */
export function normalizePhone(raw: unknown): string | null {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.length < 6) return null;
  if (d.startsWith("62")) d = `0${d.slice(2)}`;
  else if (!d.startsWith("0")) d = `0${d}`;
  return d;
}

/** Angka rupiah dari isian bebas: hanya digit; kosong/0 -> null. */
export function digitsToInt(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? Math.round(v) : null;
  const d = String(v ?? "").replace(/\D/g, "");
  if (!d) return null;
  const n = Number(d);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/* ------------------------------------------------------------------ impor Excel */

/** Satu konsumen hasil baca file; dikirim ke server dalam potongan <= 300. */
export type ImportLead = {
  importKey: string;
  contactDate: string;
  source: "Google Ads";
  name: string;
  phone: string | null;
  address: string | null;
  product: string | null;
  status: LeadStatus;
  saleValue: number | null;
  priceNett: number | null;
  priceOffer: number | null;
  reasons: LeadReason[];
  notes: string | null;
};

export type ParsedWorkbook = { leads: ImportLead[]; months: string[]; skipped: string[] };

const MONTHS_IMPORT: Record<string, number> = {
  JANUARI: 1, JANUARY: 1, FEBRUARI: 2, FEBRUARY: 2, MARET: 3, MARCH: 3, APRIL: 4, MEI: 5, MAY: 5, JUNI: 6, JUNE: 6,
  JULI: 7, JULY: 7, AGUSTUS: 8, AUGUST: 8, SEPTEMBER: 9, OKTOBER: 10, OCTOBER: 10, NOVEMBER: 11, DESEMBER: 12, DECEMBER: 12,
};
const MONTH_RE = new RegExp(`(${Object.keys(MONTHS_IMPORT).join("|")})\\s+(\\d{4})\\s*$`);

const cell = (v: unknown) => String(v ?? "").trim();
const tidy = (v: unknown) => {
  const s = cell(v).replace(/\s+/g, " ");
  return s === "-" || s === "0" ? "" : s;
};
const tick = (v: unknown) => /^(YES|YA|V|✓|1)$/i.test(cell(v));

/**
 * Baca hasil sheet_to_json(header:1) tiap sheet. Satu sheet per bulan, judul "PERIODE <BULAN> <TAHUN>".
 * Aturan persis spek 1.6: status dari kolom PRODUK TERJUAL / centang alasan; importKey = "YYYY-MM|NO|nama".
 */
export function parseCustomerWorkbook(sheets: { name: string; rows: unknown[][] }[]): ParsedWorkbook {
  const leads: ImportLead[] = [];
  const months: string[] = [];
  const skipped: string[] = [];
  for (const sheet of sheets) {
    const rows = sheet.rows;
    let periodKey: string | null = null;
    for (const r of rows.slice(0, 6)) {
      for (const c of r) {
        const t = cell(c).toUpperCase();
        if (!t.includes("PERIODE")) continue;
        const m = MONTH_RE.exec(t);
        if (m) periodKey = `${m[2]}-${String(MONTHS_IMPORT[m[1]]).padStart(2, "0")}`;
      }
      if (periodKey) break;
    }
    const headerAt = rows.findIndex((r) => r.some((c) => cell(c).toUpperCase() === "NAMA PELANGGAN"));
    if (!periodKey || headerAt < 0) {
      skipped.push(`${sheet.name} (judul periode / kolom NAMA PELANGGAN tidak ditemukan)`);
      continue;
    }
    const colOf = (row: unknown[] | undefined, title: string) => (row ?? []).findIndex((c) => cell(c).toUpperCase() === title);
    const head = rows[headerAt], sub = rows[headerAt + 1];
    const iNo = colOf(head, "NO"), iName = colOf(head, "NAMA PELANGGAN"), iPhone = colOf(head, "NO WA"), iAddr = colOf(head, "ALAMAT");
    const iProd = colOf(head, "NAMA PRODUK"), iSold = colOf(head, "PRODUK TERJUAL"), iNett = colOf(head, "HARGA NETT"), iOffer = colOf(head, "HARGA TAWAR"), iNote = colOf(head, "KETERANGAN");
    const reasonCols = REASON_META.map((m) => ({ code: m.code, at: colOf(sub, m.excel) }));
    const at = (r: unknown[], i: number) => (i >= 0 ? r[i] : "");
    let count = 0;
    for (let i = headerAt + 2; i < rows.length; i++) {
      const r = rows[i];
      if (r.some((c) => cell(c).toUpperCase().startsWith("JUMLAH"))) break;
      const no = cell(at(r, iNo));
      const name = tidy(at(r, iName));
      const phone = normalizePhone(at(r, iPhone));
      const product = tidy(at(r, iProd));
      if (!/^\d+$/.test(no) || !(name || phone || product)) continue;
      const soldRaw = at(r, iSold);
      const soldNum = digitsToInt(soldRaw);
      const soldText = cell(soldRaw).toUpperCase();
      const reasons = reasonCols.filter((c) => c.at >= 0 && tick(r[c.at])).map((c) => c.code);
      let status: LeadStatus;
      if (soldNum !== null || /^(YES|YA|TERJUAL|CLOSING)$/.test(soldText)) status = "membeli";
      else if (soldText.includes("FOLLOW")) status = "follow_up";
      else if (reasons.length) status = "tidak_membeli";
      else status = "follow_up";
      leads.push({
        importKey: `${periodKey}|${no}|${(name || phone || "").toLowerCase()}`.slice(0, 120),
        contactDate: `${periodKey}-01`,
        source: "Google Ads",
        name: name || phone || "(tanpa nama)",
        phone,
        address: tidy(at(r, iAddr)) || null,
        product: product || null,
        status,
        saleValue: status === "membeli" ? soldNum : null,
        priceNett: digitsToInt(at(r, iNett)),
        priceOffer: digitsToInt(at(r, iOffer)),
        reasons: status === "tidak_membeli" ? reasons : [],
        notes: tidy(at(r, iNote)) || null,
      });
      count++;
    }
    if (count) months.push(periodKey);
  }
  return { leads, months: [...new Set(months)].sort(), skipped };
}

/* ------------------------------------------------------------------ ekspor Excel */

const star = (n: number | null) => (n === null ? "" : n);

/**
 * Tiga lembar ekspor. `rows` = daftar tersaring (chip + cari); `monthly` = ringkasan dari SELURUH periode
 * (sengaja tidak ikut tersaring, supaya closing per bulan tidak menyesatkan - beda dari app live).
 */
export function leadSheets(rows: LeadRow[], monthly: MonthlyRow[]): SheetData[] {
  const perMonth: SheetData = {
    name: "Per bulan",
    title: "Ringkasan per bulan",
    columns: [
      { key: "bulan", header: "Bulan" }, { key: "konsumen", header: "Konsumen" }, { key: "membeli", header: "Membeli" },
      { key: "closing", header: "Closing (%)" }, { key: "followUp", header: "Follow up" }, { key: "tidak", header: "Tidak membeli" },
      { key: "nilai", header: "Nilai penjualan (Rp)" }, ...REASON_META.map((m) => ({ key: m.code, header: m.label })),
    ],
    rows: monthly.map((m) => ({
      bulan: monthName(m.month), konsumen: m.total, membeli: m.membeli, closing: m.closing ?? "", followUp: m.followUp, tidak: m.tidakMembeli, nilai: m.saleValue,
      ...m.reasons,
    })),
  };

  const feedbackText = (r: LeadRow) => (r.feedback === "puas" ? "Puas" : r.feedback === "komplain" ? "Komplain" : "");
  const getbackText = (r: LeadRow) => (r.getbackResult === "puas" ? "Puas setelah get back" : r.getbackResult === "tidak_puas" ? "Tetap tidak puas" : "");
  const rated = rows.filter((r) => r.status === "membeli" && (ratingScore(r) !== null || r.feedback !== null));
  const ratings: SheetData = {
    name: "Penilaian",
    title: "Penilaian pembeli (layanan, kualitas, kecepatan, puas / komplain, get back)",
    columns: [
      { key: "no", header: "No", width: 5 }, { key: "tgl", header: "Tanggal" }, { key: "nama", header: "Nama" }, { key: "produk", header: "Produk" },
      { key: "layanan", header: "Layanan (1-5)" }, { key: "kualitas", header: "Kualitas (1-5)" }, { key: "kecepatan", header: "Kecepatan (1-5)" },
      { key: "nilai", header: "Nilai (0-100)" }, { key: "ket", header: "Keterangan" }, { key: "tglKomplain", header: "Tgl komplain" },
      { key: "isiKomplain", header: "Isi komplain" }, { key: "tglGetback", header: "Tgl get back" }, { key: "catGetback", header: "Catatan get back" },
      { key: "hasilGetback", header: "Hasil get back" }, { key: "puas", header: "Puas (Sasaran Mutu)" }, { key: "catatan", header: "Catatan" }, { key: "oleh", header: "Dinilai oleh" },
    ],
    rows: rated.map((r, i) => {
      const s = isSatisfied(r);
      return {
        no: i + 1, tgl: leadDateText(r.contactDate), nama: r.name, produk: r.product ?? "", layanan: star(r.ratingService), kualitas: star(r.ratingQuality), kecepatan: star(r.ratingSpeed),
        nilai: ratingScore(r) ?? "", ket: feedbackText(r), tglKomplain: dmy(r.complaintDate), isiKomplain: r.complaintNote ?? "", tglGetback: dmy(r.getbackDate),
        catGetback: r.getbackNote ?? "", hasilGetback: getbackText(r), puas: s === null ? "" : s ? "Ya" : "Tidak", catatan: r.ratingNote ?? "", oleh: r.ratedByName ?? "",
      };
    }),
  };

  const list: SheetData = {
    name: "Konsumen",
    title: "Daftar konsumen",
    columns: [
      { key: "no", header: "No", width: 5 }, { key: "tgl", header: "Tanggal" }, { key: "sumber", header: "Sumber" }, { key: "nama", header: "Nama pelanggan" },
      { key: "wa", header: "No WA" }, { key: "alamat", header: "Alamat" }, { key: "produk", header: "Produk" }, { key: "status", header: "Status" },
      { key: "nilai", header: "Nilai penjualan (Rp)" }, { key: "nett", header: "Harga nett" }, { key: "tawar", header: "Harga tawar" },
      { key: "alasan", header: "Alasan tidak membeli" }, { key: "layanan", header: "Layanan" }, { key: "kualitas", header: "Kualitas" }, { key: "kecepatan", header: "Kecepatan" },
      { key: "puasKomplain", header: "Puas/Komplain" }, { key: "hasilGetback", header: "Hasil get back" }, { key: "ket", header: "Keterangan" },
    ],
    rows: rows.map((r, i) => ({
      no: i + 1, tgl: leadDateText(r.contactDate), sumber: r.source, nama: r.name, wa: r.phone ?? "", alamat: r.address ?? "", produk: r.product ?? "", status: LEAD_STATUS_LABEL[r.status],
      nilai: r.status === "membeli" ? (r.saleValue ?? "") : "", nett: r.priceNett ?? "", tawar: r.priceOffer ?? "",
      alasan: r.reasons.map((c) => REASON_LABEL[c]).join(", "), layanan: star(r.ratingService), kualitas: star(r.ratingQuality), kecepatan: star(r.ratingSpeed),
      puasKomplain: feedbackText(r), hasilGetback: getbackText(r), ket: r.notes ?? "",
    })),
  };
  return [perMonth, ratings, list];
}
