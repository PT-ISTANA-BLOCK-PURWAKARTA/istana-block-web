// Periode laporan dalam waktu WIB (UTC+7): harian, mingguan (Senin–Minggu), bulanan.
import { addDays } from "../../erp/util";

export const PERIODS = ["harian", "mingguan", "bulanan"] as const;
export type Period = (typeof PERIODS)[number];
export const PERIOD_LABELS: Record<Period, string> = { harian: "Harian", mingguan: "Mingguan", bulanan: "Bulanan" };

const WIB_MS = 7 * 3600_000;
const pad = (n: number) => String(n).padStart(2, "0");

/** Tanggal WIB (YYYY-MM-DD) dari sebuah waktu. */
export const wibDate = (date: Date) => { const d = new Date(date.getTime() + WIB_MS); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
/** Awal hari WIB (00.00) untuk tanggal YYYY-MM-DD. */
const wibMidnight = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - WIB_MS);

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const dayText = (day: string) => { const d = new Date(`${day}T00:00:00Z`); return `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };

/** Rentang [from, to) untuk periode yang memuat tanggal tersebut, beserta periode sebelumnya untuk perbandingan. */
export function periodRange(period: Period, day: string) {
  let start: string, end: string, label: string;
  if (period === "harian") { start = day; end = addDays(day, 1); label = dayText(day); }
  else if (period === "mingguan") {
    const weekday = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7; // Senin = 0
    start = addDays(day, -weekday); end = addDays(start, 7);
    label = `Minggu ${dayText(start).split(", ")[1]} – ${dayText(addDays(end, -1)).split(", ")[1]}`;
  } else {
    const [year, month] = day.split("-").map(Number);
    start = `${year}-${pad(month)}-01`;
    end = month === 12 ? `${year + 1}-01-01` : `${year}-${pad(month + 1)}-01`;
    label = `${MONTHS[month - 1]} ${year}`;
  }
  const length = wibMidnight(end).getTime() - wibMidnight(start).getTime();
  const previousStart = period === "bulanan" ? (() => { const [y, m] = start.split("-").map(Number); return m === 1 ? `${y - 1}-12-01` : `${y}-${pad(m - 1)}-01`; })() : wibDate(new Date(wibMidnight(start).getTime() - length));
  return { start, end, label, from: wibMidnight(start), to: wibMidnight(end), previousFrom: wibMidnight(previousStart), previousTo: wibMidnight(start) };
}

/** Geser tanggal acuan satu periode ke depan/belakang. */
export function shiftPeriod(period: Period, day: string, direction: 1 | -1) {
  if (period === "harian") return addDays(day, direction);
  if (period === "mingguan") return addDays(day, 7 * direction);
  const [year, month] = day.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + direction, 1));
  return `${target.getUTCFullYear()}-${pad(target.getUTCMonth() + 1)}-01`;
}
