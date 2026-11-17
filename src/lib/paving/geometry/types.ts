/**
 * Core 2D Geometry Types
 * Pure geometric data structures for site boundaries and clipping.
 * Units: meters (m), origin at local planar coordinates.
 */

export type Point2D = [number, number]; // [x, y] in meters

/**
 * Ring: closed sequence of points.
 * Winding convention:
 * Exterior ring: Counter-Clockwise (CCW)
 * Interior hole rings: Clockwise (CW)
 * First and last points should match or will be closed automatically.
 */
export type Ring2D = Point2D[];

/**
 * Polygon: [exteriorRing, ...interiorHoleRings]
 */
export type Polygon2D = Ring2D[];

/**
 * MultiPolygon: array of Polygons.
 */
export type MultiPolygon2D = Polygon2D[];

export interface BBox2D {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface GeometryWarning {
  code: string;
  message: string;
  details?: unknown;
}

export interface ProjectGeometry {
  schemaVersion: string; // "1.0.0"
  source: "preset" | "grid" | "map" | "geojson" | "kml";
  sourceCrs: "EPSG:4326" | "local-meter";
  projection?: {
    kind: "utm" | "local-tangent";
    zone?: string;
    epsg?: string;
    originLonLat: [number, number];
  };
  workingUnit: "meter";
  geometry: MultiPolygon2D;
  metrics: {
    areaM2: number;
    perimeterM: number;
    bounds: BBox2D;
  };
  warnings: GeometryWarning[];
}
