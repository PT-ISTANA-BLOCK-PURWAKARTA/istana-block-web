/**
 * Site Layout Engine
 * Clips paving lattice against arbitrary project boundaries with holes and MultiPolygons.
 * Classifies tiles into full and partial cut units.
 */

import { PAVING_CATALOG } from "../catalog";
import { multiPolygonArea } from "../geometry/area";
import type { MultiPolygon2D, ProjectGeometry, Ring2D } from "../geometry/types";
import { validateGeometry } from "../geometry/validate";
import { clipIntersection } from "./clipping";
import { buildSiteIndex, isTileStrictlyInside } from "./fastpath";
import { generateCandidateLattice } from "./lattice";
import type { LayoutResult, LayoutTile, LayoutWarning, PatternConfig } from "./types";

export const ENGINE_VERSION = "1.0.0";
export const SCHEMA_VERSION = "1.0.0";

const SLIVER_THRESHOLD_M2 = 0.0001; // 1 cm²
const FULL_TOLERANCE_M2 = 1e-6; // 1 mm² tolerance for full tiles

/** Simple fast deterministic string hash */
export function computeInputHash(geom: ProjectGeometry, cfg: PatternConfig): string {
  const parts = [
    geom.metrics.areaM2.toFixed(4),
    geom.metrics.perimeterM.toFixed(4),
    cfg.productId,
    cfg.motifId,
    cfg.thicknessM,
    cfg.reservePercent,
    cfg.originM?.x ?? 0,
    cfg.originM?.y ?? 0,
    cfg.rotationDeg ?? 0,
  ];
  let h = 0x811c9dc5;
  const str = parts.join("|");
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export interface GenerateLayoutOptions {
  /** Lewati clipping untuk keping yang pasti utuh di dalam lahan. Bawaan: true. */
  fastPath?: boolean;
}

export function generateLayout(
  projectGeom: ProjectGeometry,
  config: PatternConfig,
  options: GenerateLayoutOptions = {},
): LayoutResult {
  const validation = validateGeometry(projectGeom.geometry);
  if (!validation.valid) {
    throw new Error(`Geometri lahan tidak valid: ${validation.errors.join("; ")}`);
  }

  const spec = PAVING_CATALOG[config.productId];
  if (!spec) {
    throw new Error(`Produk paving '${config.productId}' tidak ditemukan dalam katalog.`);
  }

  const warnings: LayoutWarning[] = [];
  const candidates = generateCandidateLattice(
    projectGeom.metrics.bounds,
    config,
    spec.shape,
  );

  const tiles: LayoutTile[] = [];
  const sourceTilesTouchedSet = new Set<string>();
  let sliverCount = 0;
  const site = options.fastPath === false ? null : buildSiteIndex(projectGeom.geometry);

  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i];

    // Jalur cepat: keping yang pasti utuh di dalam lahan tidak perlu di-clip.
    if (site && isTileStrictlyInside(cand.polygon, site)) {
      sourceTilesTouchedSet.add(cand.sourceTileId);
      tiles.push({
        id: `tile_${tiles.length}`,
        sourceTileId: cand.sourceTileId,
        status: "full",
        role: cand.role,
        polygon: cand.polygon.map(([x, y]) => ({ x, y })),
        areaM2: cand.areaM2,
      });
      continue;
    }

    const candMultiPoly: MultiPolygon2D = [[[...cand.polygon]]];

    // Clip candidate against site boundary
    const clipped = clipIntersection(candMultiPoly, projectGeom.geometry);
    if (!clipped.length) continue;

    const clippedArea = multiPolygonArea(clipped);
    if (clippedArea < SLIVER_THRESHOLD_M2) {
      sliverCount++;
      continue;
    }

    sourceTilesTouchedSet.add(cand.sourceTileId);

    // Check if fully inside
    if (clippedArea >= cand.areaM2 - FULL_TOLERANCE_M2) {
      tiles.push({
        id: `tile_${tiles.length}`,
        sourceTileId: cand.sourceTileId,
        status: "full",
        role: cand.role,
        polygon: cand.polygon.map(([x, y]) => ({ x, y })),
        areaM2: cand.areaM2,
      });
    } else {
      // Partial cut block: may produce 1 or more polygons
      for (const poly of clipped) {
        if (!poly.length) continue;
        const exterior = poly[0];
        const area = multiPolygonArea([poly]);
        if (area < SLIVER_THRESHOLD_M2) {
          sliverCount++;
          continue;
        }

        tiles.push({
          id: `tile_${tiles.length}`,
          sourceTileId: cand.sourceTileId,
          status: "partial",
          role: cand.role,
          polygon: exterior.map(([x, y]) => ({ x, y })),
          areaM2: Math.round(area * 1e6) / 1e6,
          cutReason: "site-boundary",
        });
      }
    }
  }

  if (sliverCount > 0) {
    warnings.push({
      code: "SLIVERS_DROPPED",
      message: `${sliverCount} potongan kecil (< 1 cm²) diabaikan dari tata letak untuk kerapihan.`,
      details: { sliverCount },
    });
  }

  let fullCount = 0;
  let partialCount = 0;
  let coveredAreaM2 = 0;

  for (const t of tiles) {
    if (t.status === "full") fullCount++;
    else partialCount++;
    coveredAreaM2 += t.areaM2;
  }

  coveredAreaM2 = Math.round(coveredAreaM2 * 1e6) / 1e6;

  return {
    engineVersion: ENGINE_VERSION,
    schemaVersion: SCHEMA_VERSION,
    inputHash: computeInputHash(projectGeom, config),
    tiles,
    metrics: {
      siteAreaM2: projectGeom.metrics.areaM2,
      coveredAreaM2,
      fullCount,
      partialCount,
      sourceTilesTouched: sourceTilesTouchedSet.size,
    },
    warnings,
  };
}
