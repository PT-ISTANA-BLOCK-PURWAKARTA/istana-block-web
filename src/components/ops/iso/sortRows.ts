import type { IsoForm, IsoValues } from "@/lib/ops/shared/isoForms";

const URGENCY: Record<string, number> = { TERLAMBAT: 0, SEGERA: 1, Terjadwal: 2 };

/** Urutan tampil: daftar induk (F-IB-06) menurut kemendesakan, lainnya menurut tanggal form lalu nomor. Murni (aman di server & klien). */
export function sortRows<T extends { values: IsoValues; number: string | null; key: string }>(form: IsoForm, rows: T[]) {
  if (form.master) {
    return [...rows].sort((a, b) => (URGENCY[String(a.values.status)] ?? 3) - (URGENCY[String(b.values.status)] ?? 3) || String(a.values.berikutnya ?? "").localeCompare(String(b.values.berikutnya ?? "")));
  }
  return [...rows].sort((a, b) => String(a.values[form.dateKey] ?? "").localeCompare(String(b.values[form.dateKey] ?? "")) || (a.number ?? "").localeCompare(b.number ?? "") || a.key.localeCompare(b.key));
}
