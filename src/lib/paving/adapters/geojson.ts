/**
 * GeoJSON Adapter (RFC 7946 WGS84 -> Canonical ProjectGeometry)
 * Pure computational engine: No DOM, no window, no external network calls.
 */

import { projectWgs84MultiPolygon } from "../geometry/project";
import type { MultiPolygon2D, Point2D, Polygon2D, ProjectGeometry, Ring2D } from "../geometry/types";

/** Supported GeoJSON Coordinate type */
type GeoJsonPosition = number[];

export interface GeoJsonParseOptions {
  /** If multiple polygon features are present, combine them into one MultiPolygon (default: true) */
  combineMultiFeatures?: boolean;
}

/**
 * Validate position numbers and detect flipped coordinates or non-degree coordinates.
 */
function sanitizePoint(pos: GeoJsonPosition): Point2D {
  if (!Array.isArray(pos) || pos.length < 2) {
    throw new Error("Format koordinat titik tidak valid: bukan array minimal 2 angka.");
  }

  const lon = Number(pos[0]);
  const lat = Number(pos[1]);

  if (isNaN(lon) || isNaN(lat)) {
    throw new Error("Nilai koordinat bukan angka numerik yang valid.");
  }

  // Detect coordinates already projected into meters/UTM
  if (Math.abs(lon) > 1000 || Math.abs(lat) > 1000) {
    throw new Error(
      `Koordinat bernilai besar (${lon.toFixed(1)}, ${lat.toFixed(1)}). ` +
        "Berkas tampaknya sudah berkoordinat meter lokal/UTM dan bukan koordinat derajat geografis WGS84 (EPSG:4326).",
    );
  }

  // Detect flipped coordinates (Lat, Lon instead of standard Lon, Lat)
  // Latitude can never exceed ±90°
  // For Indonesia: Lon is around +95° to +141°, Lat is around -11° to +6°
  if (
    Math.abs(lat) > 90 ||
    (lat > 95 && lat < 141 && lon < 6 && lon > -11)
  ) {
    throw new Error(
      `Koordinat tampak terbalik ([latitude: ${lat}, longitude: ${lon}]). ` +
        "Standar GeoJSON (RFC 7946) mensyaratkan urutan [bujur/longitude, lintang/latitude].",
    );
  }

  if (Math.abs(lon) > 180) {
    throw new Error(`Nilai bujur/longitude ${lon} di luar rentang valid (-180° s/d +180°).`);
  }
  if (Math.abs(lat) > 90) {
    throw new Error(`Nilai lintang/latitude ${lat} di luar rentang valid (-90° s/d +90°).`);
  }

  return [lon, lat];
}

/**
 * Sanitize and ensure closed ring
 */
function sanitizeRing(rawRing: GeoJsonPosition[]): Ring2D {
  if (!Array.isArray(rawRing) || rawRing.length < 3) {
    throw new Error("Garis batas (ring) poligon harus memiliki minimal 3 titik koordinat.");
  }

  const ring: Ring2D = rawRing.map(sanitizePoint);

  // Ensure ring is closed
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]]);
  }

  if (ring.length < 4) {
    throw new Error("Poligon tertutup harus memiliki minimal 3 sudut berbeda (4 titik termasuk penutup).");
  }

  return ring;
}

/**
 * Parse GeoJSON Polygon coordinates: Ring[] (outer ring + optional hole rings)
 */
function sanitizePolygon(rawPoly: GeoJsonPosition[][]): Polygon2D {
  if (!Array.isArray(rawPoly) || rawPoly.length === 0) {
    throw new Error("Poligon tidak memiliki ring koordinat.");
  }
  return rawPoly.map(sanitizeRing);
}

/**
 * Parse GeoJSON text or object and project to canonical ProjectGeometry.
 */
export function parseGeoJsonToProjectGeometry(
  rawInput: string | Record<string, unknown>,
  options: GeoJsonParseOptions = { combineMultiFeatures: true },
): ProjectGeometry {
  let geo: any;
  if (typeof rawInput === "string") {
    try {
      geo = JSON.parse(rawInput);
    } catch {
      throw new Error("Format berkas GeoJSON tidak valid (gagal parsing JSON).");
    }
  } else {
    geo = rawInput;
  }

  if (!geo || typeof geo !== "object") {
    throw new Error("Konten GeoJSON kosong atau bukan objek JSON yang valid.");
  }

  // 1. Check CRS if specified (RFC 7946 deprecates non-WGS84 crs)
  if (geo.crs) {
    const crsName =
      geo.crs.properties?.name ||
      geo.crs.properties?.code ||
      JSON.stringify(geo.crs);

    const isWgs84 =
      typeof crsName === "string" &&
      (crsName.includes("4326") ||
        crsName.includes("CRS84") ||
        crsName.includes("WGS84") ||
        crsName.includes("wgs84"));

    if (!isWgs84) {
      throw new Error(
        `Sistem koordinat '${crsName}' tidak didukung. ` +
          "Harap gunakan berkas berproyeksi geografis WGS84 (EPSG:4326).",
      );
    }
  }

  // 2. Extract geometries
  const multiPolygon: MultiPolygon2D = [];
  const nonPolygonTypesFound = new Set<string>();

  function processGeometry(geometry: any) {
    if (!geometry || !geometry.type) return;

    if (geometry.type === "Polygon") {
      multiPolygon.push(sanitizePolygon(geometry.coordinates));
    } else if (geometry.type === "MultiPolygon") {
      for (const polyCoords of geometry.coordinates) {
        multiPolygon.push(sanitizePolygon(polyCoords));
      }
    } else if (geometry.type === "GeometryCollection") {
      if (Array.isArray(geometry.geometries)) {
        for (const subGeom of geometry.geometries) {
          processGeometry(subGeom);
        }
      }
    } else {
      nonPolygonTypesFound.add(geometry.type);
    }
  }

  if (geo.type === "FeatureCollection") {
    const features = Array.isArray(geo.features) ? geo.features : [];
    if (features.length === 0) {
      throw new Error("FeatureCollection tidak memiliki data bidang (array features kosong).");
    }
    for (const feat of features) {
      processGeometry(feat.geometry);
    }
  } else if (geo.type === "Feature") {
    processGeometry(geo.geometry);
  } else {
    // Direct geometry object
    processGeometry(geo);
  }

  // 3. Validation results
  if (multiPolygon.length === 0) {
    if (nonPolygonTypesFound.size > 0) {
      const typesStr = Array.from(nonPolygonTypesFound).join(", ");
      throw new Error(
        `Geometri bertipe '${typesStr}' tidak dapat dipaving. ` +
          "Paving memerlukan poligon bidang tertutup (Polygon / MultiPolygon).",
      );
    }
    throw new Error("Tidak ditemukan poligon bidang lahan yang valid dalam berkas GeoJSON.");
  }

  const selectedMp = options.combineMultiFeatures ? multiPolygon : [multiPolygon[0]];

  // 4. Project WGS84 to local planar meters
  return projectWgs84MultiPolygon(selectedMp, "geojson");
}
