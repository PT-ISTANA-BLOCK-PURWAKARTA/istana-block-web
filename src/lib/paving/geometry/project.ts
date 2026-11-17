/**
 * Map Coordinate Projection Engine (WGS84 -> Local Planar Meters)
 * Evaluated in F0: Centroid-based UTM Zone 48S / 49S Transverse Mercator
 *
 * EPSG:32748 (UTM Zone 48S) - Bujur < 108° (Purwakarta, Karawang, Jakarta, Bandung barat)
 * EPSG:32749 (UTM Zone 49S) - Bujur >= 108° (Subang timur, Cirebon, Jawa Tengah)
 *
 * All formulas use standard WGS84 Transverse Mercator with < 0.02% distortion.
 */

import type { MultiPolygon2D, Point2D, Polygon2D, ProjectGeometry, Ring2D } from "./types";
import { multiPolygonArea, multiPolygonBounds, multiPolygonPerimeter } from "./area";
import { validateGeometry } from "./validate";

const WGS84_A = 6378137.0; // semi-major axis (m)
const WGS84_F = 1 / 298.257223563; // flattening
const WGS84_E2 = 2 * WGS84_F - WGS84_F * WGS84_F; // eccentricity squared
const WGS84_E_PRIME2 = WGS84_E2 / (1 - WGS84_E2);
const UTM_K0 = 0.9996; // scale factor
const FALSE_EASTING = 500000.0;
const FALSE_NORTHING = 10000000.0; // Southern hemisphere

/** Convert degrees to radians */
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/**
 * Determine UTM Zone for southern hemisphere:
 * Lon < 108 -> Zone 48S (Central Meridian 105°E)
 * Lon >= 108 -> Zone 49S (Central Meridian 111°E)
 */
export function getUtmZone(lon: number): { zone: "48S" | "49S"; epsg: string; centralMeridianLon: number } {
  if (lon < 108) {
    return { zone: "48S", epsg: "EPSG:32748", centralMeridianLon: 105 };
  }
  return { zone: "49S", epsg: "EPSG:32749", centralMeridianLon: 111 };
}

/**
 * Forward Transverse Mercator projection: [lon, lat] in degrees -> [Easting, Northing] in meters
 */
export function projectWgs84ToUtm(
  lon: number,
  lat: number,
  centralMeridianLon: number,
): [number, number] {
  const phi = toRad(lat);
  const lambda = toRad(lon);
  const lambda0 = toRad(centralMeridianLon);

  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const tanPhi = Math.tan(phi);

  const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinPhi * sinPhi);
  const T = tanPhi * tanPhi;
  const C = WGS84_E_PRIME2 * cosPhi * cosPhi;
  const A = (lambda - lambda0) * cosPhi;

  // Meridional distance M
  const e2 = WGS84_E2;
  const M =
    WGS84_A *
    ((1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 * e2 * e2) / 256) * phi -
      ((3 * e2) / 8 + (3 * e2 * e2) / 32 + (45 * e2 * e2 * e2) / 1024) * Math.sin(2 * phi) +
      ((15 * e2 * e2) / 256 + (45 * e2 * e2 * e2) / 1024) * Math.sin(4 * phi) -
      ((35 * e2 * e2 * e2) / 3072) * Math.sin(6 * phi));

  // Easting
  const x =
    FALSE_EASTING +
    UTM_K0 *
      N *
      (A +
        ((1 - T + C) * A * A * A) / 6 +
        ((5 - 18 * T + T * T + 72 * C - 58 * WGS84_E_PRIME2) * A * A * A * A * A) / 120);

  // Northing (Southern Hemisphere uses false northing 10,000,000 m)
  const y =
    FALSE_NORTHING +
    UTM_K0 *
      (M +
        N *
          tanPhi *
          ((A * A) / 2 +
            ((5 - T + 9 * C + 4 * C * C) * A * A * A * A) / 24 +
            ((61 - 58 * T + T * T + 600 * C - 330 * WGS84_E_PRIME2) * A * A * A * A * A * A) / 720));

  return [x, y];
}

/**
 * Project a MultiPolygon from WGS84 coordinates ([lon, lat]) to local planar meter coordinates.
 * Rebases planar coordinates so the lower-left bounding box corner is at (0, 0).
 */
export function projectWgs84MultiPolygon(
  wgs84Mp: MultiPolygon2D,
  sourceType: "map" | "geojson" | "kml" = "map",
): ProjectGeometry {
  // 1. Calculate centroid lon/lat to choose UTM Zone
  let sumLon = 0;
  let sumLat = 0;
  let pointCount = 0;

  for (const poly of wgs84Mp) {
    for (const ring of poly) {
      for (const [lon, lat] of ring) {
        sumLon += lon;
        sumLat += lat;
        pointCount++;
      }
    }
  }

  if (pointCount === 0) {
    throw new Error("Geometri WGS84 kosong tanpa titik.");
  }

  const centroidLon = sumLon / pointCount;
  const centroidLat = sumLat / pointCount;

  // Validate latitude (Target area is Indonesia Southern hemisphere, lat between -11 and 0)
  const warnings = [];
  if (centroidLat > 0) {
    warnings.push({
      code: "NORTHERN_HEMISPHERE",
      message: "Koordinat berada di belahan bumi utara. Sistem dikalibrasi untuk Jawa Barat (Selatan).",
    });
  }

  const { zone, epsg, centralMeridianLon } = getUtmZone(centroidLon);

  // 2. Project all points
  const rawProjected: MultiPolygon2D = wgs84Mp.map((poly) =>
    poly.map((ring) =>
      ring.map(([lon, lat]) => projectWgs84ToUtm(lon, lat, centralMeridianLon)),
    ),
  );

  // 3. Rebase to local origin (minX -> 0, minY -> 0)
  const rawBounds = multiPolygonBounds(rawProjected);
  const originX = rawBounds.minX;
  const originY = rawBounds.minY;

  const localMp: MultiPolygon2D = rawProjected.map((poly) =>
    poly.map((ring) =>
      ring.map(([x, y]) => [
        Math.round((x - originX) * 1e6) / 1e6,
        Math.round((y - originY) * 1e6) / 1e6,
      ]),
    ),
  );

  const val = validateGeometry(localMp);
  if (!val.valid) {
    throw new Error(`Geometri hasil proyeksi tidak valid: ${val.errors.join("; ")}`);
  }

  const allWarnings = [...warnings, ...val.warnings];

  const bounds = multiPolygonBounds(localMp);
  const areaM2 = Math.round(multiPolygonArea(localMp) * 1e6) / 1e6;
  const perimeterM = Math.round(multiPolygonPerimeter(localMp) * 1e6) / 1e6;

  return {
    schemaVersion: "1.0.0",
    source: sourceType,
    sourceCrs: "EPSG:4326",
    projection: {
      kind: "utm",
      zone,
      epsg,
      originLonLat: [centroidLon, centroidLat],
    },
    workingUnit: "meter",
    geometry: localMp,
    metrics: {
      areaM2,
      perimeterM,
      bounds,
    },
    warnings: allWarnings,
  };
}
