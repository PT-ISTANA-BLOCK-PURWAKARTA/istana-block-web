import { describe, expect, it } from "vitest";
import { createRectanglePreset, generateLayout } from "../index";
import type { PatternConfig } from "../engine/types";
import { unitOf } from "../legacy/patterns";
import { GRASS } from "../legacy/types";
import { drawGrassHoles, grassCfgFor } from "../render/draw-grass";
import { grassHolePlacements, grassHolesForCut, holesInsidePolygon, latticeCfgFromUnit } from "../render/grass-holes";
import { packTiles } from "../render/packed-tiles";

const cfgOf = (productId: PatternConfig["productId"], motifId: string, rotationDeg: number): PatternConfig => ({
  productId,
  motifId,
  thicknessM: 0.06,
  reservePercent: 0,
  originM: { x: 0, y: 0 },
  rotationDeg,
});

type Hole = ReturnType<typeof grassHolePlacements>[number];
const corners = (h: Hole) => {
  const c = Math.cos(h.angle);
  const s = Math.sin(h.angle);
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([u, v]) => ({ x: h.cx + (u * h.w * c) / 2 - (v * h.h * s) / 2, y: h.cy + (u * h.w * s) / 2 + (v * h.h * c) / 2 }));
};

describe("Grass Block: lubang di potongan tepi", () => {
  it("holesInsidePolygon hanya menyimpan lubang yang utuh di dalam poligon", () => {
    const tile = [
      { x: 0, y: 0 },
      { x: 0.45, y: 0 },
      { x: 0.45, y: 0.3 },
      { x: 0, y: 0.3 },
    ];
    const all = grassHolePlacements(tile);
    expect(holesInsidePolygon(all, tile)).toHaveLength(6);
    const cut = [
      { x: 0, y: 0 },
      { x: 0.2, y: 0 },
      { x: 0.2, y: 0.3 },
      { x: 0, y: 0.3 },
    ];
    const kept = holesInsidePolygon(all, cut);
    expect(kept.length).toBeGreaterThan(0);
    expect(kept.length).toBeLessThan(6);
    for (const h of kept) for (const p of corners(h)) expect(p.x).toBeLessThanOrEqual(0.2 + 1e-9);
  });

  for (const rot of [0, 30]) {
    it(`layout nyata (rotasi ${rot}): potongan hanya berlubang di dalam poligonnya`, () => {
      const layout = generateLayout(createRectanglePreset(1.3, 0.87), cfgOf("grass", "sejajar", rot));
      const cfg = latticeCfgFromUnit(unitOf("grass", "sejajar"), rot);
      const cuts = layout.tiles.filter((t) => t.status === "partial");
      expect(cuts.length).toBeGreaterThan(0);
      let total = 0;
      for (const cut of cuts) {
        const holes = grassHolesForCut(cut.polygon, cfg);
        expect(holes.length).toBeLessThanOrEqual(6);
        total += holes.length;
        expect(holesInsidePolygon(holes, cut.polygon)).toHaveLength(holes.length);
      }
      expect(total).toBeGreaterThan(0);
    });
  }
});

function mockCtx() {
  const log = { fills: [] as string[], begins: 0 };
  let style = "";
  const ctx = {
    get fillStyle() {
      return style;
    },
    set fillStyle(v: string) {
      style = v;
    },
    beginPath: () => void log.begins++,
    moveTo: () => {},
    lineTo: () => {},
    fill: () => void log.fills.push(style),
  } as unknown as CanvasRenderingContext2D;
  return { ctx, log };
}

describe("drawGrassHoles (kanvas 2D)", () => {
  const layout = generateLayout(createRectanglePreset(1.3, 0.87), cfgOf("grass", "sejajar", 0));
  const packed = packTiles(layout.tiles);
  const cfg = latticeCfgFromUnit(unitOf("grass", "sejajar"), 0);

  it("Grass Block: satu fill hijau per irisan, memuat lubang keping utuh dan potongan", () => {
    const { ctx, log } = mockCtx();
    const n = drawGrassHoles(ctx, packed, 0, packed.count, { cfg, gapM: 0, scale: 300 });
    const fullCount = layout.tiles.filter((t) => t.status === "full").length;
    expect(n).toBeGreaterThan(fullCount * 6);
    expect(log.fills).toEqual([GRASS]);
    expect(log.begins).toBe(1);
  });

  it("produk selain Grass Block: tidak ada cfg lubang sehingga tidak ada fill hijau", () => {
    for (const [id, motif] of [["truepave", "bata"], ["hexagon", "bata"], ["fp30", "bata"]] as const)
      expect(grassCfgFor(id, motif, 0)).toBeNull();
    expect(grassCfgFor("grass", "sejajar", 0)).not.toBeNull();
  });

  it("lubang terlalu kecil di layar: tidak ada fill", () => {
    const { ctx, log } = mockCtx();
    expect(drawGrassHoles(ctx, packed, 0, packed.count, { cfg, gapM: 0, scale: 1 })).toBe(0);
    expect(log.fills).toEqual([]);
  });
});
