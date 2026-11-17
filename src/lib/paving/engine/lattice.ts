/**
 * Paving Pattern Lattice Generator
 * Generates candidate unclipped paving blocks covering the site bounding box.
 * Uses exact product modules and motif repeat units.
 */

import { HD_CM, HR_CM } from "../catalog";
import type { BBox2D, Point2D, Ring2D } from "../geometry/types";
import { unitOf } from "../legacy/patterns";
import type { ProductId, Shape, Tile, Unit } from "../legacy/types";
import type { PatternConfig } from "./types";

export interface CandidateBlock {
  sourceTileId: string;
  role: 0 | 1 | 2;
  polygon: Ring2D; // CCW closed ring in meters
  areaM2: number;
  bbox: BBox2D;
}

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Rotate point (x, y) around origin (ox, oy) by rad */
function rotatePoint(x: number, y: number, ox: number, oy: number, cos: number, sin: number): Point2D {
  const dx = x - ox;
  const dy = y - oy;
  return [ox + dx * cos - dy * sin, oy + dx * sin + dy * cos];
}

/** Compute bounding box of a ring */
function ringBBox(ring: Ring2D): BBox2D {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/** Check if two bounding boxes overlap */
export function bboxesOverlap(b1: BBox2D, b2: BBox2D): boolean {
  return !(b1.maxX < b2.minX || b1.minX > b2.maxX || b1.maxY < b2.minY || b1.minY > b2.maxY);
}

/**
 * Generates candidate blocks covering the target bounding box.
 */
export function generateCandidateLattice(
  targetBBox: BBox2D,
  config: PatternConfig,
  shape: Shape,
): CandidateBlock[] {
  const unit = unitOf(config.productId, config.motifId);
  const uW = unit.w / 100; // repeat unit width in meters
  const uH = unit.h / 100; // repeat unit height in meters

  const originX = config.originM?.x ?? 0;
  const originY = config.originM?.y ?? 0;
  const rotDeg = config.rotationDeg ?? 0;
  const rotRad = toRad(rotDeg);
  const cosRot = Math.cos(rotRad);
  const sinRot = Math.sin(rotRad);

  // If rotated, compute inverse bounding box for index ranges
  let searchMinX = targetBBox.minX;
  let searchMaxX = targetBBox.maxX;
  let searchMinY = targetBBox.minY;
  let searchMaxY = targetBBox.maxY;

  if (rotDeg !== 0) {
    // Expand search area by diagonal
    const diag = Math.hypot(targetBBox.maxX - targetBBox.minX, targetBBox.maxY - targetBBox.minY);
    const cx = (targetBBox.minX + targetBBox.maxX) / 2;
    const cy = (targetBBox.minY + targetBBox.maxY) / 2;
    searchMinX = cx - diag / 2;
    searchMaxX = cx + diag / 2;
    searchMinY = cy - diag / 2;
    searchMaxY = cy + diag / 2;
  }

  // Pre-calculate max dimensions of tiles within unit
  let maxTileW = 0;
  let maxTileH = 0;
  for (const t of unit.tiles) {
    const tw = (t.w || HD_CM) / 100;
    const th = (t.h || HD_CM) / 100;
    if (tw > maxTileW) maxTileW = tw;
    if (th > maxTileH) maxTileH = th;
  }

  const i0 = Math.floor((searchMinX - originX - maxTileW * 2) / uW);
  const i1 = Math.ceil((searchMaxX - originX + maxTileW * 2) / uW);
  const j0 = Math.floor((searchMinY - originY - maxTileH * 2) / uH);
  const j1 = Math.ceil((searchMaxY - originY + maxTileH * 2) / uH);

  const candidates: CandidateBlock[] = [];
  const hrM = HR_CM / 100;

  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const unitOffsetX = i * uW + originX;
      const unitOffsetY = j * uH + originY;

      for (let k = 0; k < unit.tiles.length; k++) {
        const t = unit.tiles[k];
        let rawRing: Ring2D;
        let areaM2: number;

        if (shape === "hex") {
          // Regular hexagon centered at (cx, cy)
          const cx = unitOffsetX + t.x / 100;
          const cy = unitOffsetY + t.y / 100;
          const pts: Point2D[] = [];
          for (let s = 0; s < 6; s++) {
            const a = (Math.PI / 3) * s - Math.PI / 2;
            pts.push([cx + hrM * Math.cos(a), cy + hrM * Math.sin(a)]);
          }
          pts.push(pts[0]); // Close ring
          rawRing = pts;
          areaM2 = (3 * Math.sqrt(3) / 2) * hrM * hrM;
        } else {
          // Rectangle (Truepave, Fullpave, Grass Block)
          const x0 = unitOffsetX + t.x / 100;
          const y0 = unitOffsetY + t.y / 100;
          const wM = t.w / 100;
          const hM = t.h / 100;
          rawRing = [
            [x0, y0],
            [x0 + wM, y0],
            [x0 + wM, y0 + hM],
            [x0, y0 + hM],
            [x0, y0],
          ];
          areaM2 = wM * hM;
        }

        // Apply rotation if needed
        let finalRing: Ring2D;
        if (rotDeg !== 0) {
          finalRing = rawRing.map(([x, y]) => rotatePoint(x, y, originX, originY, cosRot, sinRot));
        } else {
          finalRing = rawRing;
        }

        const bbox = ringBBox(finalRing);
        if (bboxesOverlap(bbox, targetBBox)) {
          candidates.push({
            sourceTileId: `${i}_${j}_${k}`,
            role: (t.r ?? 0) as 0 | 1 | 2,
            polygon: finalRing,
            areaM2,
            bbox,
          });
        }
      }
    }
  }

  return candidates;
}
