// Tipe dan pembantu bersama komponen kalender (aman untuk klien maupun server; tanpa server-only).
import { addDays } from "@/lib/erp/util";

export type CalType = "rapat" | "training" | "lainnya";
export type EventPerson = { userId: number; name: string; role: string };
/** Acara untuk tampilan; waktu berupa ISO string (UTC) supaya bisa melintasi batas server/klien. */
export type EventView = {
  id: string; title: string; type: CalType; startAt: string; endAt: string | null; location: string; description: string;
  reminderMinutes: number[]; seriesId: string | null; createdByName: string | null; participants: EventPerson[]; isMine: boolean;
};
export type Person = { id: number; name: string; role: string };

export const TYPE_LABEL: Record<CalType, string> = { rapat: "Rapat", training: "Training", lainnya: "Acara lain" };
export const REMINDER_OPTIONS: [number, string][] = [[1440, "H-1 (sehari sebelum)"], [180, "3 jam sebelum"], [60, "1 jam sebelum"], [30, "30 menit sebelum"], [15, "15 menit sebelum"], [0, "Saat mulai"]];
export const reminderText = (minutes: number) => REMINDER_OPTIONS.find(([v]) => v === minutes)?.[1] ?? `${minutes} menit sebelum`;

const WIB_MS = 7 * 3600_000;
const pad = (n: number) => String(n).padStart(2, "0");
const wib = (iso: string | Date) => new Date(new Date(iso).getTime() + WIB_MS);

/** Tanggal WIB "YYYY-MM-DD" dari waktu ISO. */
export const wibKey = (iso: string | Date) => wib(iso).toISOString().slice(0, 10);
/** Jam WIB "HH:mm". */
export const wibTime = (iso: string | Date) => { const d = wib(iso); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; };

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
/** "Sabtu, 17 Oktober 2026" dari "YYYY-MM-DD". */
export function longDay(day: string) {
  const d = new Date(`${day}T00:00:00Z`);
  return `${HARI[d.getUTCDay()]}, ${d.getUTCDate()} ${BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
export const monthLabel = (month: string) => `${BULAN[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
export const shiftMonth = (month: string, delta: number) => {
  const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
};
/** 42 hari (6 minggu, mulai Senin) yang menampilkan bulan "YYYY-MM". */
export function monthGrid(month: string) {
  const first = `${month}-01`;
  const start = addDays(first, -((new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function whenText(e: Pick<EventView, "startAt" | "endAt">) {
  const sk = wibKey(e.startAt);
  if (!e.endAt) return `${longDay(sk)} · ${wibTime(e.startAt)} WIB`;
  const ek = wibKey(e.endAt);
  return sk === ek
    ? `${longDay(sk)} · ${wibTime(e.startAt)}–${wibTime(e.endAt)} WIB`
    : `${longDay(sk)} ${wibTime(e.startAt)} s/d ${longDay(ek)} ${wibTime(e.endAt)} WIB`;
}

/** Acara berlangsung pada hari "YYYY-MM-DD" (WIB), termasuk acara beberapa hari. */
export function occursOn(e: Pick<EventView, "startAt" | "endAt">, day: string) {
  return wibKey(e.startAt) <= day && day <= wibKey(e.endAt ?? e.startAt);
}
