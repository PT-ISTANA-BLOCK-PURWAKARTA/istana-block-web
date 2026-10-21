// Nilai overall barang masuk / supplier: kualitas (tier QC) + kecepatan kirim (kantor) + harga (Hamad Salim), skala 0–100.
import type { SandTier } from "./sand";

/** Bobot: kualitas paling menentukan mutu beton; kecepatan & harga sama besar. */
export const SCORE_WEIGHTS = { quality: 40, speed: 30, price: 30 } as const;

/** Tier 1 Bagus = 100 … Tier 4 Brangkal & lumpur = 0. */
export const qualityPoints = (tier: SandTier | null | undefined) => tier ? Math.round(((4 - tier) / 3) * 100) : null;
/** Lambat / Mahal = 0, Standard / Sedang = 50, Cepat / Affordable = 100. */
export const threeLevelPoints = (rating: number | null | undefined) => rating ? ((rating - 1) / 2) * 100 : null;

export type ScoreParts = { quality: number | null; speed: number | null; price: number | null };

/** Rata-rata berbobot dari komponen yang sudah dinilai; lengkap bila ketiganya ada. */
export function overallScore(parts: ScoreParts) {
  let total = 0, weight = 0;
  for (const key of ["quality", "speed", "price"] as const) {
    const value = parts[key];
    if (value === null) continue;
    total += value * SCORE_WEIGHTS[key];
    weight += SCORE_WEIGHTS[key];
  }
  return { overall: weight ? Math.round(total / weight) : null, complete: parts.quality !== null && parts.speed !== null && parts.price !== null };
}

export const receiptParts = (row: { tier: SandTier | null; speedRating: number | null; priceRating: number | null }): ScoreParts =>
  ({ quality: qualityPoints(row.tier), speed: threeLevelPoints(row.speedRating), price: threeLevelPoints(row.priceRating) });

/** Rata-rata tiap komponen dari banyak kiriman (mis. per supplier). */
export function averageParts(rows: ScoreParts[]): ScoreParts {
  const avg = (values: (number | null)[]) => { const list = values.filter((value): value is number => value !== null); return list.length ? list.reduce((sum, value) => sum + value, 0) / list.length : null; };
  return { quality: avg(rows.map(row => row.quality)), speed: avg(rows.map(row => row.speed)), price: avg(rows.map(row => row.price)) };
}

export const GRADES = [
  { grade: "A", min: 80, label: "Sangat baik" },
  { grade: "B", min: 60, label: "Baik" },
  { grade: "C", min: 40, label: "Cukup" },
  { grade: "D", min: 0, label: "Kurang" },
] as const;
export type Grade = (typeof GRADES)[number]["grade"];

export const gradeOf = (score: number | null) => score === null ? null : GRADES.find(item => score >= item.min)!;
