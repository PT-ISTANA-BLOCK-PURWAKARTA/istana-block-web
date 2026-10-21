import { fmt } from "./format";

/**
 * Patokan kadar lumpur pasir (uji gelas ukur / botol di gerbang):
 * ≤ 5% = pasir bagus, 5–10% = masih diterima, > 10% = melebihi batas maksimal.
 */
export const GOOD_SILT_PERCENT = 5;
export const MAX_SILT_PERCENT = 10;

const round2 = (value: number) => Math.round(value * 100) / 100;

export type SiltLevel = "bagus" | "cukup" | "lewat";

export function siltLevel(percent: number, max = MAX_SILT_PERCENT): SiltLevel {
  const value = round2(percent);
  return value <= GOOD_SILT_PERCENT ? "bagus" : value <= max ? "cukup" : "lewat";
}

export const SILT_LEVEL_LABELS: Record<SiltLevel, string> = {
  bagus: `Bagus (≤ ${GOOD_SILT_PERCENT}%)`,
  cukup: `Masih diterima (${GOOD_SILT_PERCENT}–${MAX_SILT_PERCENT}%)`,
  lewat: `Melebihi batas maks ${MAX_SILT_PERCENT}%`,
};

/** Kalimat hasil sesuai patokan: ≤5% bagus, ≤ batas maks masih diterima, di atasnya melebihi batas. (Dari client/lib/sandDocuments.ts.) */
export function siltVerdict(row: { siltPercent: number; maxSiltPercent: number }) {
  const level = siltLevel(row.siltPercent, row.maxSiltPercent);
  if (level === "bagus") return { level, text: `BAGUS — memenuhi patokan ≤ ${GOOD_SILT_PERCENT}%` };
  if (level === "cukup") return { level, text: `MASIH DITERIMA — di atas patokan ${GOOD_SILT_PERCENT}%, di bawah batas maks ${fmt(row.maxSiltPercent)}%` };
  return { level, text: `MELEBIHI batas kadar lumpur maks ${fmt(row.maxSiltPercent)}%` };
}

/** Keputusan akhir QC atas satu uji lumpur. */
export type SandDecision = "diterima" | "ditolak" | "diterima_bersyarat";
export const DECISION_LABELS: Record<SandDecision, string> = { diterima: "Diterima", ditolak: "Ditolak", diterima_bersyarat: "Diterima bersyarat" };

/** Asal bahan: supplier + quarry, mis. "CV Maju · Quarry Cileungsi". */
export const sourceLabel = (row: { supplier: string | null; quarry: string | null }) => [row.supplier && row.supplier !== "-" ? row.supplier : null, row.quarry ? `Quarry ${row.quarry}` : null].filter(Boolean).join(" · ") || "-";

/** Bahan baku yang datang dan diuji satpam (pasir & agregat lain). */
export const MATERIALS = ["Pasir", "Pasir badan", "Pasir kepalaan", "Abu batu", "Screening", "Split", "Lainnya"];

/** Tier bahan baku: 1 terbaik, 4 terburuk. */
export const SAND_TIERS = [1, 2, 3, 4] as const;
export type SandTier = (typeof SAND_TIERS)[number];

export const TIER_LABELS: Record<SandTier, string> = {
  1: "Bagus",
  2: "Banyak brangkal",
  3: "Banyak lumpur",
  4: "Brangkal & lumpur",
};

/** Saran tier otomatis dari kadar lumpur (> 5% = banyak lumpur) dan temuan brangkal satpam. */
export function suggestTier(siltPercent: number, hasBrangkal: boolean | null | undefined): SandTier {
  const muddy = round2(siltPercent) > GOOD_SILT_PERCENT;
  if (hasBrangkal && muddy) return 4;
  if (muddy) return 3;
  if (hasBrangkal) return 2;
  return 1;
}

/** Siapa yang mengantar pasir: armada milik quarry/supplier sendiri, atau ekspedisi pihak ketiga. */
export const DELIVERY_MODES = ["quarry", "ekspedisi"] as const;
export type DeliveryMode = (typeof DELIVERY_MODES)[number];

export const DELIVERY_MODE_LABELS: Record<DeliveryMode, string> = {
  quarry: "Vendor quarry / supplier",
  ekspedisi: "Ekspedisi pihak ketiga",
};

/** Penilaian kecepatan pengiriman oleh kantor (3 = terbaik). */
export const SPEED_LABELS: Record<number, string> = {
  3: "Cepat",
  2: "Standard",
  1: "Lambat",
};

/** Penilaian harga oleh Hamad Salim (3 = terbaik). */
export const PRICE_LABELS: Record<number, string> = {
  3: "Affordable",
  2: "Sedang",
  1: "Mahal",
};
