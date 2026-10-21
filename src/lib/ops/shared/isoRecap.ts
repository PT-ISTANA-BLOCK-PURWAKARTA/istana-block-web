// Rekap form ISO: baris "Rekap Bulanan" (bagian A–H), angka dashboard, dan Sasaran Mutu dari ringkasan server.
// Bagian murni dari client/src/lib/isoRecap.ts; tipe IsoOverview ditulis di sini (tujuan tanpa tRPC) mengikuti
// keluaran isoOverview() di inventori-ops (worker/iso.ts) — fungsi kueri server harus mengembalikan bentuk ini.
import { addDays, FORM_BY_CODE, ISO_CODES, type IsoCode, type IsoColumn, type IsoValue } from "./isoForms";
import { objectiveResult, QUALITY_OBJECTIVES } from "./isoObjectives";

export type DayRange = { from: string; to: string };

export type IsoOverview = {
  range: DayRange;
  today: string;
  counts: Record<IsoCode, number>;
  tests: { total: number; passed: number };
  production: { entries: number; target: number; realized: number; realizedWithTarget: number; rejects: number };
  machine: { breakdowns: number; downtime: number; openNow: number; dueInRange: number; overdueNow: number; soonNow: number; equipment: number };
  environment: { total: number; ok: number };
  material: { total: number; rejected: number };
  ncr: { opened: number; closed: number; complaints: number; openNow: number };
  warehouse: { total: number; avgScore: number | null };
  vendor: { evaluated: number; avgScore: number | null };
  meetings: { decisions: number; overdueNow: number };
  /** Satu entri per Sasaran Mutu: source "auto" (dihitung dari data aplikasi), "manual" (isian bulanan), atau null (belum diisi). */
  objectives: { no: number; total: number | null; achieved: number | null; source: "auto" | "manual" | null; months: string[] }[];
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MONTHS_LONG = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/** Bulan-bulan dalam rentang (dipotong sesuai tanggal awal/akhir). */
export function monthsInRange(range: DayRange) {
  const out: (DayRange & { label: string; month: string })[] = [];
  let cursor = `${range.from.slice(0, 7)}-01`;
  while (cursor <= range.to && out.length < 40) {
    const [year, month] = cursor.split("-").map(Number);
    const next = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
    out.push({ from: cursor < range.from ? range.from : cursor, to: addDays(next, -1) > range.to ? range.to : addDays(next, -1), label: `${MONTHS[month - 1]} ${String(year).slice(2)}`, month: cursor.slice(0, 7) });
    cursor = next;
  }
  return out;
}

export const monthLabel = (month: string) => { const [year, m] = month.split("-").map(Number); return `${MONTHS_LONG[m - 1]} ${year}`; };
export const dayText = (day: IsoValue | undefined) => typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day) ? `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}` : "";
export const rangeText = (range: DayRange) => `${dayText(range.from)} s/d ${dayText(range.to)}`;

const share = (part: number, whole: number) => whole ? part / whole : null;

export type RecapLine = { section?: string; label: string; source: string; code?: string; value: (o: IsoOverview) => number | null; format?: "percent" | "decimal1" | "decimal2" };

/** Sama dengan sheet "Rekap Bulanan" di file Rekap Form Audit SNI. */
export const RECAP_LINES: RecapLine[] = [
  ...ISO_CODES.map((code, index): RecapLine => ({ section: index === 0 ? "A. JUMLAH REKAMAN PER FORM" : undefined, label: FORM_BY_CODE[code].short, source: code, code, value: o => o.counts[code] })),
  { label: "TOTAL REKAMAN", source: "Semua form", value: o => ISO_CODES.reduce((sum, code) => sum + o.counts[code], 0) },
  { section: "B. UJI MUTU PRODUK (F04)", label: "Jumlah pengujian", source: "F-IB-04", value: o => o.tests.total },
  { label: "Lulus", source: "F-IB-04", value: o => o.tests.passed },
  { label: "Tidak lulus", source: "F-IB-04", value: o => o.tests.total - o.tests.passed },
  { label: "% Lulus", source: "hitungan", format: "percent", value: o => share(o.tests.passed, o.tests.total) },
  { section: "C. PRODUKSI (F02)", label: "Target", source: "F-IB-02", value: o => o.production.target || null },
  { label: "Realisasi", source: "F-IB-02", value: o => o.production.realized },
  { label: "Reject", source: "F-IB-02", value: o => o.production.rejects },
  { label: "% Pencapaian target", source: "hitungan (baris yang ada targetnya)", format: "percent", value: o => share(o.production.realizedWithTarget, o.production.target) },
  { label: "% Reject", source: "hitungan", format: "percent", value: o => share(o.production.rejects, o.production.realized) },
  { section: "D. MESIN & ALAT (F06, F07)", label: "Jumlah kerusakan/gangguan", source: "F-IB-07", value: o => o.machine.breakdowns },
  { label: "Total downtime (jam)", source: "F-IB-07", format: "decimal1", value: o => o.machine.downtime },
  { label: "Kalibrasi/maintenance jatuh tempo", source: "F-IB-06", value: o => o.machine.dueInRange },
  { section: "E. LINGKUNGAN KERJA (F05)", label: "Jumlah pengukuran", source: "F-IB-05", value: o => o.environment.total },
  { label: "Sesuai standar", source: "F-IB-05", value: o => o.environment.ok },
  { label: "% Sesuai", source: "hitungan", format: "percent", value: o => share(o.environment.ok, o.environment.total) },
  { section: "F. MATERIAL MASUK (F09)", label: "Jumlah penerimaan", source: "F-IB-09", value: o => o.material.total },
  { label: "Ditolak / retur", source: "F-IB-09", value: o => o.material.rejected },
  { label: "% Ditolak", source: "hitungan", format: "percent", value: o => share(o.material.rejected, o.material.total) },
  { section: "G. KETIDAKSESUAIAN & KELUHAN (F15)", label: "NCR baru", source: "F-IB-15", value: o => o.ncr.opened },
  { label: "NCR ditutup (closed)", source: "F-IB-15", value: o => o.ncr.closed },
  { label: "Keluhan pelanggan", source: "F-IB-15", value: o => o.ncr.complaints },
  { section: "H. CHECKLIST GUDANG (F12)", label: "Jumlah pemeriksaan", source: "F-IB-12", value: o => o.warehouse.total },
  { label: "Rata-rata skor", source: "F-IB-12", format: "percent", value: o => o.warehouse.avgScore },
];

/** Sasaran Mutu lengkap: definisi + angka periode + status. */
export function objectiveRows(overview: IsoOverview) {
  return QUALITY_OBJECTIVES.map(objective => {
    const value = overview.objectives.find(item => item.no === objective.no);
    const total = value?.total ?? null, achieved = value?.achieved ?? null;
    return { ...objective, total, achieved, source: value?.source ?? null, months: value?.months ?? [], ...objectiveResult(objective, total, achieved) };
  });
}
export type ObjectiveRow = ReturnType<typeof objectiveRows>[number];

export function objectiveSummary(rows: ObjectiveRow[]) {
  return { reached: rows.filter(row => row.status === "TERCAPAI").length, missed: rows.filter(row => row.status === "BELUM TERCAPAI").length, empty: rows.filter(row => row.status === "BELUM DIISI").length };
}

/** Angka dashboard (sama dengan sheet "Dashboard" file rekap). */
export function dashboardItems(o: IsoOverview) {
  const objectives = objectiveSummary(objectiveRows(o));
  return [
    { key: "total", label: "Total rekaman", value: ISO_CODES.reduce((sum, code) => sum + o.counts[code], 0), format: undefined, hint: "semua form F-IB-01 s/d 15" },
    { key: "lulus", label: "% Lulus uji mutu", value: share(o.tests.passed, o.tests.total), format: "percent" as const, hint: `${o.tests.passed} dari ${o.tests.total} uji` },
    { key: "pencapaian", label: "Pencapaian produksi", value: share(o.production.realizedWithTarget, o.production.target), format: "percent" as const, hint: o.production.target ? "realisasi ÷ target" : "target belum diisi" },
    { key: "reject", label: "Reject produksi", value: share(o.production.rejects, o.production.realized), format: "percent" as const, hint: `${o.production.entries} input produksi` },
    { key: "material", label: "Material ditolak", value: share(o.material.rejected, o.material.total), format: "percent" as const, hint: `${o.material.rejected} dari ${o.material.total} penerimaan` },
    { key: "vendor", label: "Rata-rata nilai vendor (1-5)", value: o.vendor.avgScore, format: "decimal2" as const, hint: `${o.vendor.evaluated} vendor dinilai` },
    { key: "lingkungan", label: "% Lingkungan sesuai", value: share(o.environment.ok, o.environment.total), format: "percent" as const, hint: `${o.environment.total} pengukuran` },
    { key: "mesin", label: "Jadwal mesin TERLAMBAT", value: o.machine.overdueNow, format: undefined, hint: `${o.machine.soonNow} jatuh tempo ≤ 7 hari · ${o.machine.equipment} alat` },
    { key: "ncr", label: "NCR masih open", value: o.ncr.openNow, format: undefined, hint: "per hari ini" },
    { key: "sasaran", label: "Sasaran mutu tercapai", value: objectives.reached, format: undefined, hint: `dari 30 · ${objectives.missed} belum tercapai · ${objectives.empty} belum diisi` },
  ];
}

export function formatNumber(value: number | null | undefined, format?: IsoColumn["format"] | "decimal2") {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  if (format === "percent") return `${(value * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
  if (format === "integer") return Math.round(value).toLocaleString("id-ID");
  return value.toLocaleString("id-ID", { maximumFractionDigits: format === "decimal1" ? 1 : 2 });
}

/** Tampilan satu sel form (tanggal dd/mm/yyyy, persen, desimal). */
export function cellText(column: IsoColumn, value: IsoValue | undefined) {
  if (value === null || value === undefined || value === "") return "";
  if (column.type === "date") return dayText(value);
  if (typeof value === "number") return formatNumber(value, column.format);
  return String(value);
}
