/**
 * Engine Types & Result Contracts
 * Core definitions for pattern lattice, clipping engine, layout results, and material estimation.
 */

import type { ColorId, ProductId } from "../legacy/types";

export interface PatternConfig {
  productId: ProductId;
  motifId: string;
  thicknessM: number;
  colorShares?: Partial<Record<ColorId, number>>; // Fractional shares (0 to 1) summing to 1
  reservePercent: number; // 0, 3, 5, 10 (%)
  originM?: { x: number; y: number }; // Offset origin in meters (default: 0, 0)
  rotationDeg?: number; // 0 or 45 degrees
}

export interface LayoutTile {
  id: string;
  sourceTileId: string;
  status: "full" | "partial";
  role: 0 | 1 | 2; // Color role (0: primary, 1: accent 1, 2: accent 2)
  polygon: Array<{ x: number; y: number }>; // Planar polygon boundary in meters
  areaM2: number;
  cutReason?: "site-boundary" | "hole-boundary";
}

export interface LayoutWarning {
  code: string;
  message: string;
  details?: unknown;
}

export interface LayoutResult {
  engineVersion: string; // "1.0.0"
  schemaVersion: string; // "1.0.0"
  inputHash: string;
  tiles: LayoutTile[];
  metrics: {
    siteAreaM2: number;
    coveredAreaM2: number;
    fullCount: number;
    partialCount: number;
    sourceTilesTouched: number;
  };
  warnings: LayoutWarning[];
}

export interface MaterialEstimate {
  engineVersion: string;
  areaM2: number;
  fullUnits: number;
  cutInstalledPieces: number;
  estimatedStockUnitsForCuts: number;
  baseUnits: number;
  reservePercent: number;
  reserveUnits: number;
  recommendedPurchaseUnits: number;
  byColor?: Record<ColorId, number>;
  pallets?: { count: number; basis: "provisional" | "confirmed" };
  trucks?: { count: number; basis: "provisional" | "confirmed" };
  extras?: {
    kerbPcs?: number;
    stoneDustM3?: number;
    baseCourseM3?: number;
  };
  assumptions: string[];
  warnings: string[];
}
