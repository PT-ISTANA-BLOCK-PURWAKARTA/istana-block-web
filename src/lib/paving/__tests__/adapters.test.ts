/**
 * Adapters Test Suite — GeoJSON & KML/KMZ Parsing & Projection
 * Verifies RFC 7946 compliance, UTM 48S vs 49S zone selection, hole handling,
 * error handling for points/lines/non-WGS84, and pure client-side execution.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { parseGeoJsonToProjectGeometry } from "../adapters/geojson";
import { parseKmlToProjectGeometry, parseKmzToProjectGeometry } from "../adapters/kml";

const FIXTURES_DIR = join(__dirname, "fixtures");

describe("F4 Adapters — GeoJSON & KML/KMZ", () => {
  describe("GeoJSON Adapter", () => {
    it("parses valid Purwakarta GeoJSON (Lon < 108 -> UTM 48S)", () => {
      const content = readFileSync(join(FIXTURES_DIR, "purwakarta-valid.geojson"), "utf-8");
      const geom = parseGeoJsonToProjectGeometry(content);

      expect(geom.source).toBe("geojson");
      expect(geom.sourceCrs).toBe("EPSG:4326");
      expect(geom.workingUnit).toBe("meter");
      expect(geom.projection?.zone).toBe("48S");
      expect(geom.projection?.epsg).toBe("EPSG:32748");

      // Bounding box in meters should be approximately 100m x 100m
      const bounds = geom.metrics.bounds;
      const widthM = bounds.maxX - bounds.minX;
      const heightM = bounds.maxY - bounds.minY;

      expect(widthM).toBeGreaterThan(90);
      expect(widthM).toBeLessThan(110);
      expect(heightM).toBeGreaterThan(90);
      expect(heightM).toBeLessThan(110);

      // Area should be around 10,000 m² (± 15% due to 0.0009 degree approx)
      expect(geom.metrics.areaM2).toBeGreaterThan(8500);
      expect(geom.metrics.areaM2).toBeLessThan(11500);

      // Verify origin rebased to (0, 0)
      expect(bounds.minX).toBe(0);
      expect(bounds.minY).toBe(0);
    });

    it("parses valid Cirebon GeoJSON (Lon >= 108 -> UTM 49S)", () => {
      const content = readFileSync(join(FIXTURES_DIR, "cirebon-valid.geojson"), "utf-8");
      const geom = parseGeoJsonToProjectGeometry(content);

      expect(geom.projection?.zone).toBe("49S");
      expect(geom.projection?.epsg).toBe("EPSG:32749");
      expect(geom.metrics.areaM2).toBeGreaterThan(0);
    });

    it("rejects non-polygon GeoJSON (Point) with clear Indonesian message", () => {
      const content = readFileSync(join(FIXTURES_DIR, "invalid-point.geojson"), "utf-8");
      expect(() => parseGeoJsonToProjectGeometry(content)).toThrowError(
        /Geometri bertipe 'Point' tidak dapat dipaving/i,
      );
    });

    it("rejects non-WGS84 CRS in GeoJSON", () => {
      const content = readFileSync(join(FIXTURES_DIR, "invalid-crs.geojson"), "utf-8");
      expect(() => parseGeoJsonToProjectGeometry(content)).toThrowError(
        /Sistem koordinat '.*' tidak didukung.*WGS84/i,
      );
    });

    it("rejects swapped latitude/longitude coordinates", () => {
      const swappedGeoJson = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [-6.556, 107.443], // [Lat, Lon] swapped!
                  [-6.556, 107.444],
                  [-6.555, 107.444],
                  [-6.555, 107.443],
                  [-6.556, 107.443],
                ],
              ],
            },
          },
        ],
      };

      expect(() => parseGeoJsonToProjectGeometry(swappedGeoJson)).toThrowError(
        /Koordinat tampak terbalik/i,
      );
    });

    it("rejects self-intersecting polygon geometry", () => {
      const content = readFileSync(join(FIXTURES_DIR, "invalid-self-intersect.geojson"), "utf-8");
      expect(() => parseGeoJsonToProjectGeometry(content)).toThrowError(
        /tidak valid:.*berpotongan/i,
      );
    });

    it("verifies degree coordinates are never used directly as planar meters", () => {
      const content = readFileSync(join(FIXTURES_DIR, "purwakarta-valid.geojson"), "utf-8");
      const geom = parseGeoJsonToProjectGeometry(content);
      // In degree² it would be 0.0009 * 0.0009 ≈ 8.1e-7. In projected meters it is ~10,000 m²
      expect(geom.metrics.areaM2).toBeGreaterThan(1000);
    });
  });

  describe("KML & KMZ Adapter", () => {
    it("parses valid KML with outer ring and inner hole", () => {
      const content = readFileSync(join(FIXTURES_DIR, "purwakarta-valid.kml"), "utf-8");
      const geom = parseKmlToProjectGeometry(content);

      expect(geom.source).toBe("kml");
      expect(geom.geometry).toHaveLength(1); // 1 polygon
      expect(geom.geometry[0]).toHaveLength(2); // 1 outer ring + 1 hole ring

      // Bounding box should be ~110m x 110m
      expect(geom.metrics.bounds.maxX).toBeGreaterThan(90);
      expect(geom.metrics.bounds.maxY).toBeGreaterThan(90);

      // Area should be positive (outer polygon minus hole)
      expect(geom.metrics.areaM2).toBeGreaterThan(5000);
      expect(geom.metrics.areaM2).toBeLessThan(15000);
    });

    it("parses valid KMZ archive containing doc.kml in memory", () => {
      const kmlContent = readFileSync(join(FIXTURES_DIR, "purwakarta-valid.kml"), "utf-8");
      const kmzBytes = zipSync({
        "doc.kml": strToU8(kmlContent),
      });

      const geom = parseKmzToProjectGeometry(kmzBytes);
      expect(geom.source).toBe("kml");
      expect(geom.geometry[0]).toHaveLength(2);
      expect(geom.metrics.areaM2).toBeGreaterThan(5000);
    });

    it("rejects corrupted KMZ bytes safely", () => {
      const corruptedBytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(() => parseKmzToProjectGeometry(corruptedBytes)).toThrowError(
        /Gagal mengekstrak berkas KMZ/i,
      );
    });

    it("rejects KMZ archive missing any .kml file", () => {
      const kmzNoKml = zipSync({
        "readme.txt": strToU8("Just a text file"),
      });
      expect(() => parseKmzToProjectGeometry(kmzNoKml)).toThrowError(
        /Arsip KMZ tidak memuat berkas berekstensi \.kml/i,
      );
    });

    it("rejects KML with only Point or LineString", () => {
      const pointKml = `<?xml version="1.0" encoding="UTF-8"?>
        <kml xmlns="http://www.opengis.net/kml/2.2">
          <Placemark><Point><coordinates>107.44,-6.55,0</coordinates></Point></Placemark>
        </kml>`;
      expect(() => parseKmlToProjectGeometry(pointKml)).toThrowError(
        /hanya memuat titik \(Point\)/i,
      );
    });
  });
});
