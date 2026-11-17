/**
 * Geometric Validation Rules
 * Refuses self-intersections, NaN/Infinity, invalid rings, and uncontained holes.
 * Error messages in clear, friendly Indonesian.
 */

import { ringArea, ringSignedArea } from "./area";
import type { GeometryWarning, MultiPolygon2D, Point2D, Polygon2D, Ring2D } from "./types";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: GeometryWarning[];
}

/** Check if value is a valid finite coordinate */
function isFiniteNumber(val: number): boolean {
  return typeof val === "number" && Number.isFinite(val);
}

/** Vector cross product (p2 - p1) x (p3 - p1) */
function crossProduct(p1: Point2D, p2: Point2D, p3: Point2D): number {
  return (p2[0] - p1[0]) * (p3[1] - p1[1]) - (p2[1] - p1[1]) * (p3[0] - p1[0]);
}

/** Check if point q lies on segment pr */
function onSegment(p: Point2D, q: Point2D, r: Point2D): boolean {
  return (
    q[0] <= Math.max(p[0], r[0]) + 1e-9 &&
    q[0] >= Math.min(p[0], r[0]) - 1e-9 &&
    q[1] <= Math.max(p[1], r[1]) + 1e-9 &&
    q[1] >= Math.min(p[1], r[1]) - 1e-9
  );
}

/** Check if two line segments (p1-q1) and (p2-q2) strictly intersect */
function segmentsIntersect(p1: Point2D, q1: Point2D, p2: Point2D, q2: Point2D): boolean {
  const d1 = crossProduct(p2, q2, p1);
  const d2 = crossProduct(p2, q2, q1);
  const d3 = crossProduct(p1, q1, p2);
  const d4 = crossProduct(p1, q1, q2);

  if (((d1 > 1e-9 && d2 < -1e-9) || (d1 < -1e-9 && d2 > 1e-9)) &&
      ((d3 > 1e-9 && d4 < -1e-9) || (d3 < -1e-9 && d4 > 1e-9))) {
    return true;
  }

  // Collinear checks
  if (Math.abs(d1) <= 1e-9 && onSegment(p2, p1, q2)) return true;
  if (Math.abs(d2) <= 1e-9 && onSegment(p2, q1, q2)) return true;
  if (Math.abs(d3) <= 1e-9 && onSegment(p1, p2, q1)) return true;
  if (Math.abs(d4) <= 1e-9 && onSegment(p1, q2, q1)) return true;

  return false;
}

/** Ray casting point-in-polygon test */
export function isPointInRing(point: Point2D, ring: Ring2D): boolean {
  let inside = false;
  const n = ring.length;
  const [px, py] = point;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Normalize ring by removing closed duplicate end point if present */
export function getRingVertices(ring: Ring2D): Point2D[] {
  if (!ring.length) return [];
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (ring.length > 1 && Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-9) {
    return ring.slice(0, -1);
  }
  return ring;
}

/** Check if a ring self-intersects */
export function ringHasSelfIntersection(ring: Ring2D): boolean {
  const pts = getRingVertices(ring);
  const n = pts.length;
  if (n < 4) return false;

  for (let i = 0; i < n; i++) {
    const p1 = pts[i];
    const q1 = pts[(i + 1) % n];

    for (let j = i + 1; j < n; j++) {
      // Skip adjacent segments
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue;

      const p2 = pts[j];
      const q2 = pts[(j + 1) % n];

      if (segmentsIntersect(p1, q1, p2, q2)) {
        return true;
      }
    }
  }
  return false;
}

/** Validate a single ring */
export function validateRing(ring: Ring2D, label = "Poligon"): string[] {
  const errors: string[] = [];

  if (!ring || ring.length < 3) {
    errors.push(`${label} minimal harus memiliki 3 titik sudut.`);
    return errors;
  }

  // Check finite coordinates
  for (let i = 0; i < ring.length; i++) {
    const [x, y] = ring[i];
    if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
      errors.push(`Titik ke-${i + 1} pada ${label} tidak valid (bukan angka terhingga).`);
      return errors;
    }
  }

  // Check non-zero area
  const area = ringArea(ring);
  if (area < 0.001) {
    errors.push(`Luas ${label} terlalu kecil atau berbentuk garis lurus (luas < 0,001 m²).`);
  }

  // Check self-intersection
  if (ringHasSelfIntersection(ring)) {
    errors.push(`Garis sisi ${label} saling berpotongan (self-intersection). Harap rapikan urutan titik sudut.`);
  }

  return errors;
}

/** Validate MultiPolygon geometry */
export function validateGeometry(mp: MultiPolygon2D): ValidationResult {
  const errors: string[] = [];
  const warnings: GeometryWarning[] = [];

  if (!mp || mp.length === 0) {
    return {
      valid: false,
      errors: ["Bentuk lahan kosong. Masukkan minimal satu poligon."],
      warnings,
    };
  }

  for (let pIdx = 0; pIdx < mp.length; pIdx++) {
    const poly = mp[pIdx];
    const polyLabel = mp.length > 1 ? `Poligon ke-${pIdx + 1}` : "Poligon";

    if (!poly || poly.length === 0) {
      errors.push(`${polyLabel} tidak memiliki sisi.`);
      continue;
    }

    // Validate exterior ring
    const exterior = poly[0];
    const exteriorErrors = validateRing(exterior, `${polyLabel} batas luar`);
    errors.push(...exteriorErrors);

    // Validate interior hole rings
    for (let hIdx = 1; hIdx < poly.length; hIdx++) {
      const hole = poly[hIdx];
      const holeLabel = `Lubang (hole) ke-${hIdx} pada ${polyLabel}`;
      const holeErrors = validateRing(hole, holeLabel);
      errors.push(...holeErrors);

      // Verify hole is completely inside exterior ring
      if (holeErrors.length === 0 && exteriorErrors.length === 0) {
        let allPointsInside = true;
        for (const pt of hole) {
          if (!isPointInRing(pt, exterior)) {
            allPointsInside = false;
            break;
          }
        }
        if (!allPointsInside) {
          errors.push(`${holeLabel} berada di luar atau melintasi batas luar poligon.`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
