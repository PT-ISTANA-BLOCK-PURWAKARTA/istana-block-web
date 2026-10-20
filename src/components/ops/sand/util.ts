// Pembantu murni uji lumpur pasir (aman di server maupun klien): rumus kadar lumpur dan pembacaan endapan.
import type { ReadingUnit, SandDecision } from "@/db/erp";
import { parseQty } from "@/lib/erp/util";
import { siltLevel, type SiltLevel } from "@/lib/ops/shared/sand";

/** kadar lumpur (%) = lumpur / (pasir + lumpur) × 100, dibulatkan 2 desimal. */
export function siltPercentOf(sand: number, silt: number) {
  const total = sand + silt;
  return total > 0 ? Math.round((silt / total) * 10_000) / 100 : 0;
}

/** Saran keputusan: ≤5% diterima, 5–10% diterima bersyarat, >10% ditolak. */
export const LEVEL_DECISION: Record<SiltLevel, SandDecision> = { bagus: "diterima", cukup: "diterima_bersyarat", lewat: "ditolak" };

/** Penguji: yang menyelesaikan, atau yang memulai bila belum selesai. */
export const testerName = (row: { completedByName: string | null; createdByName: string | null }) => row.completedByName ?? row.createdByName ?? "-";

/** Endapan dianggap cukup setelah 1 jam (lebih baik 3 jam). */
export const MIN_SETTLE_MS = 60 * 60_000;

export const UNIT_LABELS: Record<ReadingUnit, string> = { ml: "Gelas ukur (ml)", cm: "Botol + penggaris (cm)" };

export const DECISIONS: SandDecision[] = ["diterima", "diterima_bersyarat", "ditolak"];

/** Batas pembacaan yang masuk akal (server menolak lebih dari ini). */
export const MAX_READING = 2000;

const parse = (text: string) => (/\d/.test(text) ? parseQty(text) : undefined);

/**
 * Pembacaan endapan. Gelas ukur (ml): isian = skala batas atas pasir & batas atas lumpur, lumpur = selisihnya.
 * Botol (cm): isian = tebal endapan pasir & tebal endapan lumpur.
 */
export function readingOf(unit: ReadingUnit, sandTop: string, siltTop: string, decision: string) {
  const a = parse(sandTop);
  const b = parse(siltTop);
  const sand = a;
  const silt = unit === "ml" ? (a !== undefined && b !== undefined ? b - a : undefined) : b;
  const invalid = silt !== undefined && silt < 0;
  const percent = !invalid && sand !== undefined && sand > 0 && silt !== undefined ? siltPercentOf(sand, silt) : null;
  const level = percent === null ? null : siltLevel(percent);
  const effective = (decision || (level ? LEVEL_DECISION[level] : "")) as SandDecision | "";
  return { sand, silt, invalid, percent, level, decision: effective };
}
