// Pembantu murni (aman di server maupun klien) untuk halaman barang masuk, uji lumpur pasir, dan bahan baku.
import type { ReceiptCategory } from "@/db/erp";
import type { Role } from "@/lib/roles";
import { fmt } from "@/lib/ops/shared/format";
import { quantityText } from "@/lib/ops/shared/goods";

export const WIB_MS = 7 * 3600 * 1000;

export const CATEGORY_LABELS: Record<ReceiptCategory, string> = { bahan_baku: "Bahan baku", lainnya: "Barang lain" };

/** Tautan foto privat di R2 (butuh login + izin lihat_ops). */
export const berkasUrl = (key: string) => `/operasional/berkas/${key}`;

/** Nilai awal <input type="datetime-local"> untuk saat ini menurut WIB. */
export const wibNowLocal = () => new Date(Date.now() + WIB_MS).toISOString().slice(0, 16);

/** "YYYY-MM-DDTHH:mm" (isian datetime-local, WIB) → Date; null bila bentuknya salah. */
export function parseWibLocal(value: unknown): Date | null {
  const text = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) return null;
  const date = new Date(`${text}:00+07:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Tanggal bisnis (WIB) dari sebuah waktu: "YYYY-MM-DD". */
export const wibDay = (value: Date | string | number) => new Date(new Date(value).getTime() + WIB_MS).toISOString().slice(0, 10);
/** Bulan (WIB) dari sebuah waktu: "YYYY-MM". */
export const wibMonth = (value: Date | string | number) => wibDay(value).slice(0, 7);

/** Rentang dua tanggal WIB (inklusif) sebagai Date awal & akhir hari. */
export const wibRange = (from: string, to: string) => ({ from: new Date(`${from}T00:00:00+07:00`), to: new Date(`${to}T23:59:59.999+07:00`) });

const TIME_ZONE = "Asia/Jakarta";
/** "21 Okt, 09.30" */
export const whenText = (value: Date | string | number) =>
  new Date(value).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });
/** "21 Okt 26, 09.30" */
export const whenFull = (value: Date | string | number) =>
  new Date(value).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });
/** "21 Okt 26" */
export const shortDate = (value: Date | string | number) =>
  new Date(value).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "2-digit", timeZone: TIME_ZONE });
/** "Oktober 2026" dari kunci bulan "2026-10". */
export const monthName = (key: string) => new Date(`${key}-15T00:00:00Z`).toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "UTC" });
/** "Okt 26" dari kunci bulan "2026-10". */
export const monthShort = (key: string) => new Date(`${key}-15T00:00:00Z`).toLocaleDateString("id-ID", { month: "short", year: "2-digit", timeZone: "UTC" });

/** Lama berlalu: "35 menit" / "2 jam 5 menit". */
export function elapsed(from: Date | string | number, now: number) {
  const minutes = Math.max(0, Math.floor((now - new Date(from).getTime()) / 60_000));
  return minutes < 60 ? `${minutes} menit` : `${Math.floor(minutes / 60)} jam ${minutes % 60} menit`;
}

/** Kantor = pemilik atau operasional (boleh menghapus kapan saja, menilai pengiriman, dll.). */
export const isOffice = (roles: readonly Role[]) => roles.includes("owner") || roles.includes("operasional");

/** Satpam murni hanya boleh melihat catatan barang masuk miliknya sendiri. */
export const onlyOwnReceipts = (roles: readonly Role[]) =>
  roles.includes("satpam") && !isOffice(roles) && !roles.some((role) => role === "qc" || role === "manajer_qc" || role === "pimpinan");

/** Rekap per barang untuk barang yang diterima: jumlah kiriman, ditolak, total per satuan. */
export type ItemSummary<T extends { category: ReceiptCategory; itemName: string; status: string; receivedAt: Date | string; quantity: number | null; unit: string }> = {
  item: string; category: ReceiptCategory; count: number; rejected: number; rows: T[]; last: Date;
};

export function itemSummary<T extends { category: ReceiptCategory; itemName: string; status: string; receivedAt: Date | string; quantity: number | null; unit: string }>(rows: T[]): ItemSummary<T>[] {
  const map = new Map<string, ItemSummary<T>>();
  for (const row of rows) {
    const key = `${row.category}|${row.itemName.trim().toLowerCase()}`;
    const entry = map.get(key) ?? { item: row.itemName, category: row.category, count: 0, rejected: 0, rows: [], last: new Date(0) };
    entry.count += 1;
    if (row.status === "ditolak") entry.rejected += 1;
    entry.rows.push(row);
    const at = new Date(row.receivedAt);
    if (at > entry.last) entry.last = at;
    map.set(key, entry);
  }
  return [...map.values()].sort((a, b) => a.category.localeCompare(b.category) || b.count - a.count);
}

/** "42 m³ + 3 rit" untuk sekumpulan baris. */
export const quantitySum = (rows: { quantity: number | null; unit: string }[]) => quantityText(rows, (value) => fmt(value));
