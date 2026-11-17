/**
 * Geometry Calculations: Area (Shoelace), Perimeter, and Bounding Box
 * Units: meters (m), area in m²
 */

import type { BBox2D, MultiPolygon2D, Polygon2D, Ring2D } from "./types";

/**
 * Signed area using Shoelace formula.
 * Positive = Counter-Clockwise (CCW), Negative = Clockwise (CW)
 */
export function ringSignedArea(ring: Ring2D): number {
  if (ring.length < 3) return 0;
  let sum = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const p1 = ring[i];
    const p2 = ring[(i + 1) % n];
    sum += p1[0] * p2[1] - p2[0] * p1[1];
  }
  return sum / 2;
}

export function ringArea(ring: Ring2D): number {
  return Math.abs(ringSignedArea(ring));
}

export function polygonArea(poly: Polygon2D): number {
  if (!poly.length || !poly[0].length) return 0;
  const exterior = ringArea(poly[0]);
  let holes = 0;
  for (let i = 1; i < poly.length; i++) {
    holes += ringArea(poly[i]);
  }
  return Math.max(0, exterior - holes);
}

export function multiPolygonArea(mp: MultiPolygon2D): number {
  let total = 0;
  for (const poly of mp) {
    total += polygonArea(poly);
  }
  return total;
}

export function ringPerimeter(ring: Ring2D): number {
  if (ring.length < 2) return 0;
  let total = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const p1 = ring[i];
    const p2 = ring[(i + 1) % n];
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    total += Math.hypot(dx, dy);
  }
  return total;
}

export function multiPolygonPerimeter(mp: MultiPolygon2D): number {
  let total = 0;
  for (const poly of mp) {
    if (poly.length > 0) {
      total += ringPerimeter(poly[0]); // Exterior boundary
    }
  }
  return total;
}

export function multiPolygonBounds(mp: MultiPolygon2D): BBox2D {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  let hasPoints = false;
  for (const poly of mp) {
    for (const ring of poly) {
      for (const [x, y] of ring) {
        hasPoints = true;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!hasPoints) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Ensures ring has the desired winding (CCW for exterior, CW for holes).
 */
export function ensureWinding(ring: Ring2D, expectCCW: boolean): Ring2D {
  const isCCW = ringSignedArea(ring) > 0;
  if (isCCW !== expectCCW) {
    return [...ring].reverse();
  }
  return ring;
}
