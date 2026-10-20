// Daftar pilihan untuk barang masuk (satpam) dan hasil produksi (mandor & QC).
import { MATERIALS } from "./sand";

/** Bahan baku agregat yang dinilai tier & diuji lumpur. */
export const RAW_MATERIALS = MATERIALS;
export const RAW_UNITS = ["m³", "rit", "ton"];

/** Barang lain yang biasa datang (bisa diketik bebas). */
export const OTHER_GOODS = ["Semen", "Besi", "Pigmen / pewarna", "Solar", "Oli", "Sparepart", "Palet", "Lainnya"];
export const OTHER_UNITS = ["sak", "kg", "ton", "liter", "batang", "pcs", "unit", "m³"];

export const MAX_RECEIPT_PHOTOS = 3;

/** Produk precast diinput mandor; paving diinput QC. */
export const PRECAST_PRODUCTS = ["U-Ditch", "Greffel", "Buis Beton", "Genteng", "Kanstin", "Grass Block", "Lainnya"];
export const PRECAST_UNITS = ["buah", "unit", "m"];
export const PAVING_UNITS = ["m²"];

export const PRODUCTION_CATEGORY_LABELS = { precast: "Precast", paving: "Paving" } as const;

/** Kendala produksi yang dicatat PIC (mandor/QC); rinciannya di keterangan. */
export const PRODUCTION_ISSUES = ["Mesin trouble", "Listrik padam", "Bahan baku kurang", "Cetakan rusak", "Hujan / cuaca", "Kurang tenaga kerja", "Lainnya"];

/** Awalan kode batch produksi (F-IB-02), mis. PB-261005-01 = paving tanggal 05/10/2026 batch ke-1. */
const BATCH_PREFIXES: Record<string, string> = { "U-Ditch": "UD", "Greffel": "GF", "Buis Beton": "BB", "Genteng": "GT", "Kanstin": "KS", "Grass Block": "GB" };
export const batchPrefix = (category: "precast" | "paving", product: string) => category === "paving" ? "PB" : BATCH_PREFIXES[product] ?? "PC";

/** Lini produksi pada form F-IB-02. */
export const productionLine = (category: "precast" | "paving", product: string) => category === "paving" ? "Paving Block" : product === "Genteng" ? "Genteng Beton" : product === "Buis Beton" ? "Buis Beton" : "Precast";

/** Ringkas jumlah per satuan, mis. "42 m³ + 3 rit". */
export function quantityText(items: { quantity: number | null; unit: string }[], format: (value: number) => string) {
  const byUnit = new Map<string, number>();
  for (const item of items) if (item.quantity) byUnit.set(item.unit, (byUnit.get(item.unit) ?? 0) + item.quantity);
  return [...byUnit.entries()].map(([unit, total]) => `${format(total)} ${unit}`).join(" + ") || "-";
}
