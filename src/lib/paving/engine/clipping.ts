/**
 * Pure Geometric Clipping Adapter
 * Wraps polygon-clipping library for robust 2D Boolean operations.
 * Input & Output: Canonical MultiPolygon2D in meters.
 */

import polygonClipping from "polygon-clipping";
import type { MultiPolygon2D, Polygon2D, Ring2D } from "../geometry/types";

/**
 * Computes intersection of subject geometry with mask geometry.
 * Returns MultiPolygon2D of subject pieces inside mask.
 */
export function clipIntersection(
  subject: MultiPolygon2D,
  mask: MultiPolygon2D,
): MultiPolygon2D {
  if (!subject.length || !mask.length) return [];
  try {
    const res = polygonClipping.intersection(
      subject as polygonClipping.MultiPolygon,
      mask as polygonClipping.MultiPolygon,
    );
    return res as unknown as MultiPolygon2D;
  } catch (err) {
    // If degenerate slivers occur, return empty safely
    return [];
  }
}

/**
 * Computes difference (subject MINUS mask).
 */
export function clipDifference(
  subject: MultiPolygon2D,
  mask: MultiPolygon2D,
): MultiPolygon2D {
  if (!subject.length) return [];
  if (!mask.length) return subject;
  try {
    const res = polygonClipping.difference(
      subject as polygonClipping.MultiPolygon,
      mask as polygonClipping.MultiPolygon,
    );
    return res as unknown as MultiPolygon2D;
  } catch (err) {
    return subject;
  }
}

/**
 * Computes union of multiple geometries.
 */
export function clipUnion(geoms: MultiPolygon2D[]): MultiPolygon2D {
  if (!geoms.length) return [];
  if (geoms.length === 1) return geoms[0];
  try {
    const res = polygonClipping.union(
      geoms[0] as polygonClipping.MultiPolygon,
      ...(geoms.slice(1) as polygonClipping.MultiPolygon[]),
    );
    return res as unknown as MultiPolygon2D;
  } catch (err) {
    return geoms[0];
  }
}
