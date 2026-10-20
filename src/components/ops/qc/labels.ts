// Label, nilai bawaan, dan pembantu format untuk modul QC (aman dipakai di server maupun klien).
import type { CheckStatus, MaterialLine, MixLayer, ReviewStatus } from "@/db/erp";
import { addDays, parseQty, tglPanjang } from "@/lib/erp/util";

export const LAYERS: readonly MixLayer[] = ["badan", "kepalaan", "lainnya"];
export const LAYER_LABELS: Record<MixLayer, string> = { badan: "Badan", kepalaan: "Kepalaan", lainnya: "Lainnya" };
export const CHECK_STATUS_LABELS: Record<CheckStatus, string> = { sesuai: "Sesuai", tidak_sesuai: "Tidak sesuai", perlu_perbaikan: "Perlu perbaikan" };
export const CHECK_STATUSES: readonly CheckStatus[] = ["sesuai", "tidak_sesuai", "perlu_perbaikan"];
export const REVIEW_LABELS: Record<ReviewStatus, string> = { menunggu: "Menunggu ACC", disetujui: "Sudah ACC", revisi: "Perlu revisi" };

/** Komposisi bawaan per lapisan (isian awal formulir; bukan data template). */
export const DEFAULT_MATERIALS: Record<MixLayer, MaterialLine[]> = {
  badan: [
    { name: "Semen", qty: 80, unit: "kg" },
    { name: "Pasir", qty: 500, unit: "kg" },
    { name: "Galunggung", qty: 300, unit: "kg" },
    { name: "Screening", qty: 200, unit: "kg" },
    { name: "Air", qty: 70, unit: "kg" },
  ],
  kepalaan: [
    { name: "Semen", qty: 80, unit: "kg" },
    { name: "Pasir", qty: 500, unit: "kg" },
    { name: "Air", qty: 50, unit: "detik" },
  ],
  lainnya: [
    { name: "Semen", qty: null, unit: "kg" },
    { name: "Pasir", qty: null, unit: "kg" },
    { name: "Air", qty: null, unit: "kg" },
  ],
};
export const DEFAULT_COMPOSITION: MaterialLine[] = ["Abu batu badan", "Pasir badan", "Skrining", "Air", "Semen badan", "Pasir kepalaan", "Semen kepalaan"].map((name) => ({ name, qty: null, unit: "kg" }));

/** Baris bahan di formulir: jumlah disimpan sebagai teks agar koma desimal tidak hilang saat mengetik. */
export type MatRow = { name: string; qty: string; unit: string };

export const numText = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(Math.round(n * 1000) / 1000).replace(".", ","));
export const toRows = (items: MaterialLine[]): MatRow[] => items.map((m) => ({ name: m.name, qty: numText(m.qty), unit: m.unit }));
export const fromRows = (rows: MatRow[]): MaterialLine[] =>
  rows.filter((r) => r.name.trim()).map((r) => ({ name: r.name.trim(), qty: r.qty.trim() === "" ? null : parseQty(r.qty), unit: r.unit.trim() }));

const num = (value: number | null | undefined, digits = 2) => (value === null || value === undefined ? "" : value.toLocaleString("id-ID", { maximumFractionDigits: digits }));
export { num as qnum };

/** "SEMEN 80 KG, PASIR 500 KG, ..." seperti pada form kertas. */
export const materialText = (materials: MaterialLine[]) => materials.map((m) => `${m.name.toUpperCase()} ${num(m.qty)} ${m.unit.toUpperCase()}`.replace(/\s+/g, " ").trim()).join(", ");

const dayName = (date: string, opts: Intl.DateTimeFormatOptions) => new Date(`${date}T00:00:00Z`).toLocaleDateString("id-ID", { ...opts, timeZone: "UTC" });
/** "Sabtu, 17/10/2026" */
export const dayLong = (date: string) => dayName(date, { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
/** "Sab, 17 Okt" */
export const dayShort = (date: string) => dayName(date, { weekday: "short", day: "2-digit", month: "short" });
/** "17/10/2026" */
export const dateShort = (date: string | null | undefined) => (date ? `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}` : "");
/** "17 OKTOBER - 23 OKTOBER 2026" */
export const periodText = (from: string, to: string) => `${tglPanjang(from).replace(/ \d{4}$/, "").toUpperCase()} - ${tglPanjang(to).toUpperCase()}`;

/** Periode form QC: Sabtu s/d Jumat (contoh form: 10-16 Oktober 2026). offset = jumlah minggu dari minggu ini. */
export function weekRange(day: string, offsetWeeks = 0) {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay();
  const from = addDays(day, -((dow + 1) % 7) + offsetWeeks * 7);
  return { from, to: addDays(from, 6) };
}
