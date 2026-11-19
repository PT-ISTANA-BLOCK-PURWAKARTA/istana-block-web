/**
 * T3: tautan bagi memulihkan bentuk, dan pembagian warna dari peran layout.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { addHoleToGeometry, buildProjectGeometry, createLShapePreset, createRectanglePreset, createUShapePreset } from "../adapters/preset";
import { parseGeoJsonToProjectGeometry } from "../adapters/geojson";
import { splitColorsByLayoutRoles } from "../engine/color-split";
import { generateLayout } from "../engine/layout";
import { calculateMaterialEstimate } from "../engine/estimate";
import type { PatternConfig } from "../engine/types";
import type { ProjectGeometry } from "../geometry/types";
import {
  buildShareUrl,
  decodeShareStateFromBase64,
  encodeShareStateToBase64,
  readShareCode,
  type ShareState,
} from "../share";
import { geometryToShareGeom, shareGeomToGeometry } from "../share-geometry";

const cfg = { productId: "truepave", motifId: "bata", reservePercent: 5 } as const;

/** Lewat jalur penuh seperti di halaman: geom -> ShareState -> URL -> kode -> geom. */
function viaUrl(geom: ProjectGeometry): { back: ProjectGeometry; exact: boolean; kind: string } {
  const enc = geometryToShareGeom(geom);
  const state: ShareState = { v: 1, engineVersion: "1.0.0", geom: enc.geom, cfg: { ...cfg } };
  const url = buildShareUrl("https://istanablock.com/pola-paving", state);
  const code = readShareCode(new URL(url).search);
  const decoded = decodeShareStateFromBase64(code);
  return { back: shareGeomToGeometry(decoded.geom), exact: enc.exact, kind: decoded.geom.kind };
}

function expectSameShape(a: ProjectGeometry, b: ProjectGeometry, tolM = 0.006) {
  expect(b.geometry.length).toBe(a.geometry.length);
  a.geometry.forEach((poly, pi) => {
    expect(b.geometry[pi].length).toBe(poly.length);
    poly.forEach((ring, ri) => {
      expect(b.geometry[pi][ri].length).toBe(ring.length);
      ring.forEach(([x, y], i) => {
        expect(Math.abs(b.geometry[pi][ri][i][0] - x)).toBeLessThanOrEqual(tolM);
        expect(Math.abs(b.geometry[pi][ri][i][1] - y)).toBeLessThanOrEqual(tolM);
      });
    });
  });
  expect(Math.abs(b.metrics.areaM2 - a.metrics.areaM2) / a.metrics.areaM2).toBeLessThan(0.001);
}

describe("T3 tautan bagi memulihkan bentuk lahan", () => {
  it("persegi: preset ringkas, ukuran sama", () => {
    const g = createRectanglePreset(12.5, 6);
    const r = viaUrl(g);
    expect(r.kind).toBe("preset");
    expect(r.exact).toBe(true);
    expectSameShape(g, r.back);
  });

  it("bentuk L tidak berubah jadi persegi", () => {
    const g = createLShapePreset(10, 8, 4, 3);
    const r = viaUrl(g);
    expect(r.kind).toBe("polygon");
    expectSameShape(g, r.back);
    expect(r.back.metrics.areaM2).toBeCloseTo(g.metrics.areaM2, 6);
    expect(r.back.metrics.areaM2).toBeLessThan(10 * 8);
  });

  it("bentuk U tidak berubah jadi persegi", () => {
    const g = createUShapePreset(12, 8, 3, 2.5, 3);
    const r = viaUrl(g);
    expectSameShape(g, r.back);
    expect(r.back.metrics.areaM2).toBeCloseTo(g.metrics.areaM2, 6);
  });

  it("poligon bebas (grid) dengan sumber terjaga", () => {
    const mp = [[[[2, 1], [9.35, 1.2], [11, 6.6], [5.05, 8], [1.9, 5], [2, 1]]]] as ProjectGeometry["geometry"];
    const g = { ...buildProjectGeometry(mp, "bebas"), source: "grid" as const };
    const r = viaUrl(g);
    expect(r.back.source).toBe("grid");
    expectSameShape(g, r.back);
  });

  it("poligon impor GeoJSON (koordinat hasil proyeksi) tetap sama dalam toleransi cm", () => {
    const content = readFileSync(join(__dirname, "fixtures", "purwakarta-valid.geojson"), "utf-8");
    const g = parseGeoJsonToProjectGeometry(content);
    const r = viaUrl(g);
    expect(r.back.source).toBe("geojson");
    expectSameShape(g, r.back);
    expect(Math.abs(r.back.metrics.areaM2 - g.metrics.areaM2) / g.metrics.areaM2).toBeLessThan(0.001);
  });

  it("lahan berlubang: lubang ikut terbawa", () => {
    const base = createRectanglePreset(10, 10);
    const hole: [number, number][] = [[4, 4], [4, 6], [6, 6], [6, 4], [4, 4]];
    const g = addHoleToGeometry(base, hole);
    const r = viaUrl(g);
    expect(r.back.geometry[0].length).toBe(2);
    expect(r.back.metrics.areaM2).toBeCloseTo(96, 6);
  });

  it("multi-poligon: semua bagian ikut terbawa", () => {
    const mp = [
      [[[1, 1], [5, 1], [5, 4], [1, 4], [1, 1]]],
      [[[7, 1], [10, 1], [10, 5], [7, 5], [7, 1]]],
    ] as ProjectGeometry["geometry"];
    const g = buildProjectGeometry(mp, "dua bagian");
    const r = viaUrl(g);
    expect(r.back.geometry.length).toBe(2);
    expect(r.back.metrics.areaM2).toBeCloseTo(24, 6);
  });

  it("bentuk terlalu rumit (>500 titik) jatuh ke persegi pembungkus dan ditandai tidak persis", () => {
    const ring: [number, number][] = [];
    for (let i = 0; i < 600; i++) {
      const a = (i / 600) * Math.PI * 2;
      ring.push([50 + 40 * Math.cos(a), 50 + 40 * Math.sin(a)]);
    }
    ring.push(ring[0]);
    const g = buildProjectGeometry([[ring]], "lingkaran");
    const enc = geometryToShareGeom(g);
    expect(enc.exact).toBe(false);
    expect(enc.geom.kind).toBe("preset");
  });

  it("kode lama dengan nama pd_share tetap terbaca, nama d diutamakan", () => {
    const state: ShareState = { v: 1, engineVersion: "1.0.0", geom: { kind: "preset", preset: "rectangle", params: { lengthM: 3, widthM: 3 } }, cfg: { ...cfg } };
    const code = encodeShareStateToBase64(state);
    expect(readShareCode(`?pd_share=${code}`)).toBe(code);
    expect(readShareCode(`?d=abc&pd_share=${code}`)).toBe("abc");
    expect(readShareCode("?x=1")).toBe("");
  });

  it("tautan polygon lama tanpa holes/parts tetap valid", () => {
    const state: ShareState = {
      v: 1,
      engineVersion: "1.0.0",
      geom: { kind: "polygon", points: [[0, 0], [1000, 0], [1000, 500], [0, 500], [0, 0]], source: "grid" },
      cfg: { ...cfg },
    };
    expect(decodeShareStateFromBase64(encodeShareStateToBase64(state))).toEqual(state);
  });
});

describe("T3 pembagian warna dari peran layout", () => {
  const tiles = (roles: number[]) => roles.map((role) => ({ role: role as 0 | 1 | 2 }));

  it("dihitung dari jumlah keping per peran, bukan persentase pola Fixed", () => {
    const res = splitColorsByLayoutRoles(tiles([0, 0, 0, 0, 0, 0, 1, 1, 2, 2]), ["N", "M", "H"], 100);
    expect(res).toEqual([
      { c: "N", share: 0.6, pcs: 60 },
      { c: "M", share: 0.2, pcs: 20 },
      { c: "H", share: 0.2, pcs: 20 },
    ]);
  });

  it("peran dengan warna sama digabung, urutan menurut peran", () => {
    const res = splitColorsByLayoutRoles(tiles([2, 1, 0, 0]), ["N", "H", "N"], 8);
    expect(res.map((x) => x.c)).toEqual(["N", "H"]);
    expect(res[0].share).toBeCloseTo(0.75);
    expect(res[0].pcs).toBe(6);
    expect(res[1].pcs).toBe(2);
  });

  it("pembulatan ke atas per warna dan peran tak terpakai tidak muncul", () => {
    const res = splitColorsByLayoutRoles(tiles([0, 0, 1]), ["N", "M", "H"], 10);
    expect(res.map((x) => x.pcs)).toEqual([7, 4]);
    expect(res.find((x) => x.c === "H")).toBeUndefined();
  });

  it("layout kosong menghasilkan daftar kosong", () => {
    expect(splitColorsByLayoutRoles([], ["N"], 10)).toEqual([]);
  });

  it("memakai layout nyata: porsi mengikuti peran keping lahan L", () => {
    const geom = createLShapePreset(10, 8, 4, 3);
    const config: PatternConfig = { productId: "truepave", motifId: "bata-list", thicknessM: 0.06, reservePercent: 5, rotationDeg: 0 };
    const layout = generateLayout(geom, config);
    const est = calculateMaterialEstimate(layout, config);
    const res = splitColorsByLayoutRoles(layout.tiles, ["N", "M"], est.recommendedPurchaseUnits);
    const role1 = layout.tiles.filter((t) => t.role === 1).length;
    expect(res).toHaveLength(2);
    expect(res[1].share).toBeCloseTo(role1 / layout.tiles.length, 10);
    expect(res[0].share + res[1].share).toBeCloseTo(1, 10);
    expect(res[0].pcs + res[1].pcs).toBeGreaterThanOrEqual(est.recommendedPurchaseUnits);
    expect(res[0].pcs + res[1].pcs).toBeLessThanOrEqual(est.recommendedPurchaseUnits + 1);
  }, 60000);
});
