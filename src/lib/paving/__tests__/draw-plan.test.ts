import { describe, expect, it } from "vitest";
import { fitView, groupPacked, jointWidthM, strokeWidthsM, viewAspect, viewPaddingM } from "../render/draw-plan";
import {
  packLayout,
  packTiles,
  packedTransferables,
  unpackLayout,
  unpackTiles,
} from "../render/packed-tiles";
import { createRectanglePreset } from "../adapters/preset";
import { generateLayout } from "../engine/layout";
import type { LayoutTile, PatternConfig } from "../engine/types";

function tile(id: string, status: "full" | "partial", role: 0 | 1 | 2, extra = 0): LayoutTile {
  const polygon = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
  ];
  if (extra) polygon.push({ x: 0, y: 1 });
  return { id, sourceTileId: id, status, role, polygon, areaM2: 0.5 };
}

describe("packTiles / unpackTiles", () => {
  const tiles = [
    tile("a", "full", 1),
    tile("b", "partial", 0, 1),
    { ...tile("c", "full", 2), areaM2: 0.123456 },
    tile("d", "partial", 2),
  ];

  it("round-trip menjaga status, peran, luas, dan titik", () => {
    const back = unpackTiles(packTiles(tiles));
    expect(back).toHaveLength(4);
    back.forEach((t, i) => {
      expect(t.status).toBe(tiles[i].status);
      expect(t.role).toBe(tiles[i].role);
      expect(t.areaM2).toBe(tiles[i].areaM2);
      expect(t.polygon).toEqual(tiles[i].polygon);
    });
    expect(back[1].cutReason).toBe("site-boundary");
    expect(back[0].cutReason).toBeUndefined();
  });

  it("offsets menunjuk batas tiap keping (jumlah titik berbeda-beda)", () => {
    const p = packTiles(tiles);
    expect(p.count).toBe(4);
    expect(Array.from(p.offsets)).toEqual([0, 3, 7, 10, 13]);
    expect(p.coords.length).toBe(13 * 2);
  });

  it("daftar kosong", () => {
    const p = packTiles([]);
    expect(p.count).toBe(0);
    expect(unpackTiles(p)).toEqual([]);
  });

  it("packedTransferables memuat lima buffer unik", () => {
    const bufs = packedTransferables(packTiles(tiles));
    expect(bufs).toHaveLength(5);
    expect(new Set(bufs).size).toBe(5);
  });

  it("packLayout/unpackLayout pada hasil engine nyata menjaga jumlah, metrik, dan geometri", () => {
    const cfg: PatternConfig = {
      productId: "fp30",
      motifId: "lurus",
      thicknessM: 0.06,
      reservePercent: 5,
      originM: { x: 0, y: 0 },
      rotationDeg: 0,
    };
    const layout = generateLayout(createRectanglePreset(7.3, 4.1), cfg);
    const packed = packLayout(layout);
    expect("tiles" in packed).toBe(false);
    expect(packed.metrics).toEqual(layout.metrics);
    expect(packed.packed.count).toBe(layout.tiles.length);
    const back = unpackLayout(packed);
    expect(back.tiles).toHaveLength(layout.tiles.length);
    for (let i = 0; i < layout.tiles.length; i++) {
      expect(back.tiles[i].polygon).toEqual(layout.tiles[i].polygon);
      expect(back.tiles[i].status).toBe(layout.tiles[i].status);
      expect(back.tiles[i].role).toBe(layout.tiles[i].role);
    }
  });
});

describe("groupPacked", () => {
  const p = packTiles([
    tile("a", "full", 1),
    tile("b", "partial", 0),
    tile("c", "full", 0),
    tile("d", "full", 1),
    tile("e", "partial", 2),
  ]);

  it("mengelompokkan per status dan peran, utuh dulu lalu potongan", () => {
    const g = groupPacked(p);
    expect(g.map((x) => `${x.partial ? "cut" : "full"}${x.role}:${x.indices.length}`)).toEqual([
      "full0:1",
      "full1:2",
      "cut0:1",
      "cut2:1",
    ]);
    expect(Array.from(g[1].indices)).toEqual([0, 3]);
  });

  it("onlyPartial membuang keping utuh", () => {
    const g = groupPacked(p, true);
    expect(g.every((x) => x.partial)).toBe(true);
    expect(g.reduce((n, x) => n + x.indices.length, 0)).toBe(2);
  });

  it("jumlah keping terjaga dan jumlah kelompok dibatasi (bukan satu per keping)", () => {
    const many = packTiles(
      Array.from({ length: 50_000 }, (_, i) => tile(`t${i}`, i % 20 === 0 ? "partial" : "full", (i % 3) as 0 | 1 | 2)),
    );
    const g = groupPacked(many);
    expect(g.reduce((n, x) => n + x.indices.length, 0)).toBe(50_000);
    expect(g.length).toBeLessThanOrEqual(6);
  });

  it("daftar kosong menghasilkan kelompok kosong", () => {
    expect(groupPacked(packTiles([]))).toEqual([]);
  });
});

describe("fitView", () => {
  const bounds = { minX: 0, minY: 0, maxX: 10, maxY: 5 };

  it("memusatkan lahan dan menjaga rasio (meet)", () => {
    const pad = viewPaddingM(bounds);
    const v = fitView(bounds, 700, 700);
    const viewW = 10 + pad * 2;
    expect(v.scale).toBeCloseTo(700 / viewW, 6);
    // x = 0 m berada sejauh padding dari tepi kiri; x = 10 m sejauh padding dari tepi kanan
    expect(v.originX).toBeCloseTo(pad * v.scale, 6);
    expect(v.originX + 10 * v.scale).toBeCloseTo(700 - pad * v.scale, 6);
  });

  it("sumbu Y dibalik: y besar berada di atas layar", () => {
    const v = fitView(bounds, 700, 350);
    const yTop = v.originY - 5 * v.scale;
    const yBottom = v.originY - 0 * v.scale;
    expect(yTop).toBeLessThan(yBottom);
  });

  it("kanvas tidak persegi: sisi yang lebih sempit membatasi skala", () => {
    const wide = fitView(bounds, 1000, 100);
    const pad = viewPaddingM(bounds);
    expect(wide.scale).toBeCloseTo(100 / (5 + pad * 2), 6);
  });

  it("lebar tampilan ikut bantalan", () => {
    expect(fitView(bounds, 500, 500).viewWidthM).toBeCloseTo(10 + viewPaddingM(bounds) * 2, 9);
  });
});

describe("strokeWidthsM & viewAspect", () => {
  it("memberi batas bawah tebal garis", () => {
    const s = strokeWidthsM(1);
    expect(s).toEqual({ joint: 0.006, cutEdge: 0.012, outline: 0.018 });
  });

  it("tebal garis tumbuh dengan lebar tampilan", () => {
    const s = strokeWidthsM(100);
    expect(s.joint).toBeCloseTo(0.11, 9);
    expect(s.cutEdge).toBeCloseTo(0.18, 9);
  });

  it("rasio dijepit antara 1 dan 2,2", () => {
    expect(viewAspect({ minX: 0, minY: 0, maxX: 1, maxY: 20 })).toBe(1);
    expect(viewAspect({ minX: 0, minY: 0, maxX: 100, maxY: 1 })).toBe(2.2);
  });
});

describe("jointWidthM", () => {
  it("lahan kecil: tebal nat tidak berubah", () => {
    // keping 0,2 x 0,1 m (0,02 m2): batas 0,12 * 0,141 = 0,017 > 0,006
    expect(jointWidthM(0.006, 0.02)).toBe(0.006);
  });
  it("lahan besar: nat dibatasi sebanding keping", () => {
    const w = jointWidthM(0.11, 0.02);
    expect(w).toBeCloseTo(0.12 * Math.sqrt(0.02), 9);
    expect(w).toBeLessThan(0.11);
  });
  it("luas keping tak valid memakai tebal dasar", () => {
    expect(jointWidthM(0.05, 0)).toBe(0.05);
  });
});
