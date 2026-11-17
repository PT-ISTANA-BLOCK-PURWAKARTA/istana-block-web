/**
 * Material Estimation Engine
 * Derives accurate bill of quantities from geometric layout results.
 * Formula: recommended = full + stock_for_cuts + reserve
 */

import { BASE_DEPTH_M, BED_DEPTH_M, PAVING_CATALOG } from "../catalog";
import type { ColorId } from "../legacy/types";
import { ENGINE_VERSION } from "./layout";
import type { LayoutResult, MaterialEstimate, PatternConfig } from "./types";

export interface EstimateOptions {
  includeKanstin?: boolean;
  kanstinLengthCm?: 40 | 60;
  customKanstinLengthM?: number;
  perimeterM?: number;
  includeAbuBatu?: boolean;
  includeBaseCourse?: boolean;
}

export function calculateMaterialEstimate(
  layout: LayoutResult,
  config: PatternConfig,
  options: EstimateOptions = {},
): MaterialEstimate {
  const fullUnits = layout.metrics.fullCount;
  const cutInstalledPieces = layout.metrics.partialCount;

  // Provisional default: 1 installed cut piece = 1 source block
  const estimatedStockUnitsForCuts = cutInstalledPieces;
  const baseUnits = fullUnits + estimatedStockUnitsForCuts;

  const reservePercent = config.reservePercent;
  const reserveUnits = Math.ceil(baseUnits * (reservePercent / 100));
  const recommendedPurchaseUnits = baseUnits + reserveUnits;

  // Support materials
  const areaM2 = layout.metrics.siteAreaM2;
  const incAbu = options.includeAbuBatu ?? true;
  const incBc = options.includeBaseCourse ?? false;

  const stoneDustM3 = incAbu ? Math.round(areaM2 * BED_DEPTH_M * 100) / 100 : 0;
  const baseCourseM3 = incBc ? Math.round(areaM2 * BASE_DEPTH_M * 100) / 100 : 0;

  // Kanstin
  let kerbPcs = 0;
  if (options.includeKanstin) {
    const ks = options.kanstinLengthCm ?? 60;
    const kLen = options.customKanstinLengthM ?? options.perimeterM ?? 0;
    if (kLen > 0) {
      kerbPcs = Math.ceil((kLen * 100) / ks);
    }
  }

  // Color breakdown
  let byColor: Record<ColorId, number> | undefined;
  if (config.colorShares) {
    byColor = { N: 0, M: 0, H: 0 };
    for (const [col, share] of Object.entries(config.colorShares)) {
      if (share && (col === "N" || col === "M" || col === "H")) {
        byColor[col as ColorId] = Math.ceil(recommendedPurchaseUnits * share);
      }
    }
  }

  const assumptions = [
    "Estimasi potongan: 1 potongan terpasang dihitung dari 1 blok utuh sebagai bahan potong (standar aman pengerjaan lapangan).",
    `Cadangan ${reservePercent}% untuk kompensasi toleransi potong sisi dan penanganan material.`,
    "Abu batu tebal 5 cm padat sebagai lapis perata alas paving.",
    "Perlu verifikasi ukuran lapangan dan batas aktual sebelum pemesanan final.",
  ];

  const warnings: string[] = [];
  for (const w of layout.warnings) {
    warnings.push(w.message);
  }

  return {
    engineVersion: ENGINE_VERSION,
    areaM2,
    fullUnits,
    cutInstalledPieces,
    estimatedStockUnitsForCuts,
    baseUnits,
    reservePercent,
    reserveUnits,
    recommendedPurchaseUnits,
    byColor,
    extras: {
      kerbPcs,
      stoneDustM3,
      baseCourseM3,
    },
    assumptions,
    warnings,
  };
}
