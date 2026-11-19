/**
 * Jembatan ProjectGeometry <-> ShareState.geom (modul murni, tanpa DOM).
 * Persegi dikirim sebagai preset ringkas; bentuk lain (L, U, poligon bebas, hasil impor,
 * berlubang, multi-poligon) dikirim sebagai poligon terkuantisasi cm sehingga tautan
 * memulihkan bentuk yang sama, bukan persegi pembungkusnya.
 */

import {
  buildProjectGeometry,
  createLShapePreset,
  createRectanglePreset,
  createTrapezoidPreset,
  createUShapePreset,
} from "./adapters/preset";
import type { MultiPolygon2D, Point2D, ProjectGeometry, Ring2D } from "./geometry/types";
import type { ShareState } from "./share";

export type ShareGeom = ShareState["geom"];
type PolygonShareGeom = Extract<ShareGeom, { kind: "polygon" }>;
type CmRing = Array<[number, number]>;

const MAX_RING_POINTS = 500;
const MAX_HOLES = 50;
const MAX_PARTS = 20;

const toCm = (v: number): number => Math.round(v * 100);
const ringToCm = (ring: Ring2D): CmRing => ring.map(([x, y]) => [toCm(x), toCm(y)]);
const ringFromCm = (ring: ReadonlyArray<readonly [number, number]>): Ring2D =>
  ring.map(([x, y]): Point2D => [x / 100, y / 100]);

export interface EncodedShareGeom {
  geom: ShareGeom;
  /** false bila bentuk terlalu rumit untuk tautan dan diganti persegi pembungkus. */
  exact: boolean;
}

function boundingRectangle(geom: ProjectGeometry): ShareGeom {
  const b = geom.metrics.bounds;
  return {
    kind: "preset",
    preset: "rectangle",
    params: {
      lengthM: Math.max(0.5, Math.round((b.maxX - b.minX) * 10) / 10),
      widthM: Math.max(0.5, Math.round((b.maxY - b.minY) * 10) / 10),
    },
  };
}

/** Persegi sumbu-sejajar dengan sudut kiri-bawah tepat di (0,0)? Kembalikan [panjang, lebar] dalam meter. */
function originRectangle(mp: MultiPolygon2D): [number, number] | null {
  if (mp.length !== 1 || mp[0].length !== 1) return null;
  const ring = mp[0][0];
  const pts = ring.length === 5 && ring[0][0] === ring[4][0] && ring[0][1] === ring[4][1] ? ring.slice(0, 4) : ring;
  if (pts.length !== 4) return null;
  const xs = pts.map((p) => toCm(p[0]));
  const ys = pts.map((p) => toCm(p[1]));
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  if (minX !== 0 || minY !== 0 || maxX <= 0 || maxY <= 0) return null;
  // Keempat titik harus tepat di sudut kotak (bukan jajaran genjang / berlian).
  const corners = new Set(pts.map((p) => `${toCm(p[0])},${toCm(p[1])}`));
  const expected = [`0,0`, `${maxX},0`, `${maxX},${maxY}`, `0,${maxY}`];
  if (corners.size !== 4 || !expected.every((e) => corners.has(e))) return null;
  return [maxX / 100, maxY / 100];
}

/** ProjectGeometry -> bagian `geom` ShareState. Tidak pernah melempar. */
export function geometryToShareGeom(geom: ProjectGeometry): EncodedShareGeom {
  const mp = geom.geometry;
  const rect = originRectangle(mp);
  if (rect) {
    return { geom: { kind: "preset", preset: "rectangle", params: { lengthM: rect[0], widthM: rect[1] } }, exact: true };
  }

  const tooComplex =
    mp.length === 0 ||
    mp.length - 1 > MAX_PARTS ||
    mp.some((poly) => poly.length === 0 || poly.length - 1 > MAX_HOLES) ||
    mp.some((poly) => poly.some((ring) => ring.length < 3 || ring.length > MAX_RING_POINTS));
  if (tooComplex) return { geom: boundingRectangle(geom), exact: false };

  const [first, ...rest] = mp;
  const out: PolygonShareGeom = { kind: "polygon", points: ringToCm(first[0]) };
  if (geom.source !== "preset") out.source = geom.source;
  if (first.length > 1) out.holes = first.slice(1).map(ringToCm);
  if (rest.length) out.parts = rest.map((poly) => poly.map(ringToCm));
  return { geom: out, exact: true };
}

/** Bagian `geom` ShareState -> ProjectGeometry. Melempar bila dimensi tidak valid. */
export function shareGeomToGeometry(g: ShareGeom): ProjectGeometry {
  if (g.kind === "preset") {
    const p = g.params;
    switch (g.preset) {
      case "l-shape":
        return createLShapePreset(p.totalW ?? 10, p.totalH ?? 8, p.legW ?? 4, p.legH ?? 4);
      case "u-shape":
        return createUShapePreset(p.totalW ?? 12, p.totalH ?? 8, p.leftLegW ?? 3, p.rightLegW ?? 3, p.baseH ?? 3);
      case "trapezoid":
        return createTrapezoidPreset(p.bottomW ?? 10, p.topW ?? 6, p.height ?? 5, p.offset ?? 2);
      default:
        return createRectanglePreset(p.lengthM ?? 10, p.widthM ?? 5);
    }
  }
  const mp: MultiPolygon2D = [
    [ringFromCm(g.points), ...(g.holes ?? []).map(ringFromCm)],
    ...(g.parts ?? []).map((poly) => poly.map(ringFromCm)),
  ];
  const built = buildProjectGeometry(mp, "Poligon tautan");
  return { ...built, source: g.source ?? "preset" };
}
