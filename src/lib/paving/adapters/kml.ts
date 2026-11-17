/**
 * KML & KMZ Adapter (OGC KML / ZIP KMZ -> Canonical ProjectGeometry)
 * Pure computational engine: No DOM, no window, no external network calls.
 * Uses `fflate` for pure in-memory uncompressed ZIP extraction.
 */

import { strFromU8, unzipSync } from "fflate";
import { projectWgs84MultiPolygon } from "../geometry/project";
import type { MultiPolygon2D, Point2D, Polygon2D, ProjectGeometry, Ring2D } from "../geometry/types";

const MAX_KMZ_COMPRESSED_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_KMZ_UNCOMPRESSED_BYTES = 20 * 1024 * 1024; // 20 MB (Zip Bomb defense)
const MAX_KMZ_FILE_COUNT = 100;

/**
 * Validate and parse a coordinate string: "lon,lat[,alt]"
 */
function parseCoordinateTuple(tupleStr: string): Point2D {
  const parts = tupleStr.split(",").map((s) => s.trim());
  if (parts.length < 2) {
    throw new Error(`Format koordinat KML tidak valid: '${tupleStr}'.`);
  }

  const lon = Number(parts[0]);
  const lat = Number(parts[1]);

  if (isNaN(lon) || isNaN(lat)) {
    throw new Error(`Nilai koordinat KML bukan angka numerik: '${tupleStr}'.`);
  }

  // Detect coordinates in meters/UTM
  if (Math.abs(lon) > 1000 || Math.abs(lat) > 1000) {
    throw new Error(
      `Koordinat KML bernilai besar (${lon.toFixed(1)}, ${lat.toFixed(1)}). ` +
        "Berkas tampaknya sudah berkoordinat meter dan bukan derajat WGS84.",
    );
  }

  // Detect swapped Lat/Lon
  if (Math.abs(lat) > 90 || (lat > 95 && lat < 141 && lon < 6 && lon > -11)) {
    throw new Error(
      `Koordinat KML tampak terbalik ([latitude: ${lat}, longitude: ${lon}]). ` +
        "Standar KML mensyaratkan urutan bujur/longitude terlebih dahulu baru lintang/latitude.",
    );
  }

  if (Math.abs(lon) > 180) {
    throw new Error(`Bujur ${lon} di luar rentang valid (-180° s/d +180°).`);
  }
  if (Math.abs(lat) > 90) {
    throw new Error(`Lintang ${lat} di luar rentang valid (-90° s/d +90°).`);
  }

  return [lon, lat];
}

/**
 * Parse a block of coordinates text inside <coordinates>...</coordinates>
 */
function parseCoordinatesBlock(blockText: string): Ring2D {
  const trimmed = blockText.trim();
  if (!trimmed) {
    throw new Error("Blok <coordinates> dalam KML kosong.");
  }

  // Split by whitespace/newline
  const rawTuples = trimmed.split(/\s+/).filter(Boolean);
  if (rawTuples.length < 3) {
    throw new Error("Ring poligon KML memiliki kurang dari 3 titik sudut.");
  }

  const ring: Ring2D = rawTuples.map(parseCoordinateTuple);

  // Ensure ring is closed
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]]);
  }

  if (ring.length < 4) {
    throw new Error("Ring poligon KML harus memiliki minimal 3 sudut berbeda.");
  }

  return ring;
}

/**
 * Extract coordinates block inside a container tag like <outerBoundaryIs> or <innerBoundaryIs>
 */
function extractRingFromTag(tagContent: string): Ring2D | null {
  const coordMatch = tagContent.match(/<(?:\w+:)?coordinates[^>]*>([\s\S]*?)<\/(?:\w+:)?coordinates>/i);
  if (!coordMatch || !coordMatch[1]) return null;
  return parseCoordinatesBlock(coordMatch[1]);
}

/**
 * Parse KML text string into canonical ProjectGeometry.
 */
export function parseKmlToProjectGeometry(kmlText: string): ProjectGeometry {
  if (!kmlText || typeof kmlText !== "string" || !kmlText.trim()) {
    throw new Error("Konten KML kosong.");
  }

  // Extract all <Polygon>...</Polygon> tags
  const polygonRegex = /<(?:\w+:)?Polygon\b[^>]*>([\s\S]*?)<\/(?:\w+:)?Polygon>/gi;
  const multiPolygon: MultiPolygon2D = [];

  let match: RegExpExecArray | null;
  while ((match = polygonRegex.exec(kmlText)) !== null) {
    const polyBody = match[1];

    // Find outer boundary
    const outerMatch = polyBody.match(/<(?:\w+:)?outerBoundaryIs\b[^>]*>([\s\S]*?)<\/(?:\w+:)?outerBoundaryIs>/i);
    if (!outerMatch || !outerMatch[1]) {
      continue;
    }

    const outerRing = extractRingFromTag(outerMatch[1]);
    if (!outerRing) continue;

    const currentPoly: Polygon2D = [outerRing];

    // Find all inner boundaries (holes)
    const innerRegex = /<(?:\w+:)?innerBoundaryIs\b[^>]*>([\s\S]*?)<\/(?:\w+:)?innerBoundaryIs>/gi;
    let innerMatch: RegExpExecArray | null;
    while ((innerMatch = innerRegex.exec(polyBody)) !== null) {
      const innerRing = extractRingFromTag(innerMatch[1]);
      if (innerRing) {
        currentPoly.push(innerRing);
      }
    }

    multiPolygon.push(currentPoly);
  }

  if (multiPolygon.length === 0) {
    // Check if Point or LineString was present
    if (/<(?:\w+:)?Point\b/i.test(kmlText)) {
      throw new Error(
        "Berkas KML hanya memuat titik (Point). Paving memerlukan poligon bidang tertutup (Polygon).",
      );
    }
    if (/<(?:\w+:)?LineString\b/i.test(kmlText)) {
      throw new Error(
        "Berkas KML hanya memuat garis (LineString). Paving memerlukan poligon bidang tertutup (Polygon).",
      );
    }
    throw new Error("Tidak ditemukan elemen Poligon (<Polygon>) yang valid dalam berkas KML.");
  }

  return projectWgs84MultiPolygon(multiPolygon, "kml");
}

/**
 * Parse KMZ compressed binary into canonical ProjectGeometry.
 */
export function parseKmzToProjectGeometry(
  kmzBuffer: Uint8Array | ArrayBuffer,
): ProjectGeometry {
  const bytes = kmzBuffer instanceof Uint8Array ? kmzBuffer : new Uint8Array(kmzBuffer);

  if (bytes.byteLength === 0) {
    throw new Error("Berkas KMZ kosong (0 byte).");
  }

  if (bytes.byteLength > MAX_KMZ_COMPRESSED_BYTES) {
    throw new Error(
      `Ukuran berkas KMZ (${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB) ` +
        `melebihi batas maksimum 5 MB.`,
    );
  }

  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = unzipSync(bytes);
  } catch (err: any) {
    throw new Error(`Gagal mengekstrak berkas KMZ: arsip ZIP tidak valid (${err?.message || "format salah"}).`);
  }

  const fileNames = Object.keys(unzipped);
  if (fileNames.length === 0) {
    throw new Error("Arsip KMZ kosong tanpa berkas di dalamnya.");
  }
  if (fileNames.length > MAX_KMZ_FILE_COUNT) {
    throw new Error("Arsip KMZ memuat terlalu banyak berkas (> 100 berkas).");
  }

  let totalUncompressedSize = 0;
  for (const name of fileNames) {
    totalUncompressedSize += unzipped[name].byteLength;
    if (totalUncompressedSize > MAX_KMZ_UNCOMPRESSED_BYTES) {
      throw new Error("Ukuran berkas KMZ yang diekstrak melebihi batas aman 20 MB (proteksi zip bomb).");
    }
  }

  // Find target KML file (prefer doc.kml or first *.kml)
  let kmlFileName = fileNames.find((name) => /(^|\/)doc\.kml$/i.test(name));
  if (!kmlFileName) {
    kmlFileName = fileNames.find((name) => /\.kml$/i.test(name));
  }

  if (!kmlFileName || !unzipped[kmlFileName]) {
    throw new Error("Arsip KMZ tidak memuat berkas berekstensi .kml di dalamnya.");
  }

  const kmlText = strFromU8(unzipped[kmlFileName]);
  return parseKmlToProjectGeometry(kmlText);
}
