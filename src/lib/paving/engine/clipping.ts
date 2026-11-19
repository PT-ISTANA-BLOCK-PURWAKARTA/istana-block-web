/**
 * Pure Geometric Clipping Adapter
 * Wraps polygon-clipping library for robust 2D Boolean operations.
 * Input & Output: Canonical MultiPolygon2D in meters.
 */

import polygonClipping from "polygon-clipping";
import type { MultiPolygon2D } from "../geometry/types";

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
