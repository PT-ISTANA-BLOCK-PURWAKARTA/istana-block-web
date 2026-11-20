import { describe, expect, it } from "vitest";
import { createRectanglePreset, generateLayout } from "../index";
import { grassHolePlacements, grassHoleRects } from "../render/grass-holes";
import { drawLatticeCell, latticeCell } from "../render/lattice-texture";
import { GRASS } from "../legacy/types";

const ring = (x: number, y: number, w: number, h: number) => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];

describe("Grass Block 3D: lubang rumput & motif", () => {
  it("grassHoleRects memberi 3 x 2 lubang di dalam keping, proporsi sama dengan 2D", () => {
    const holes = grassHoleRects(45, 30);
    expect(holes).toHaveLength(6);
    for (const h of holes) {
      expect(h.w).toBeCloseTo(9, 9);
      expect(h.h).toBeCloseTo(9, 9);
      expect(h.x).toBeGreaterThan(0);
      expect(h.y).toBeGreaterThan(0);
      expect(h.x + h.w).toBeLessThan(45);
      expect(h.y + h.h).toBeLessThan(30);
    }
  });

  it("grassHolePlacements menaruh enam lubang di dalam keping dan mengikuti rotasi", () => {
    const flat = grassHolePlacements(ring(1, 2, 0.45, 0.3));
    expect(flat).toHaveLength(6);
    expect(flat.every((h) => h.angle === 0)).toBe(true);
    expect(flat.every((h) => h.cx > 1 && h.cx < 1.45 && h.cy > 2 && h.cy < 2.3)).toBe(true);
    // keping tegak (sisi panjang searah y): sudut sisi panjang 90 derajat
    const upright = grassHolePlacements(ring(0, 0, 0.3, 0.45));
    expect(upright).toHaveLength(6);
    expect(upright[0].angle).toBeCloseTo(Math.PI / 2, 9);
    expect(grassHolePlacements([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }])).toEqual([]);
  });

  it("layout 3D motif Selang-seling bergeser setengah keping per baris, Susun sejajar tidak", () => {
    const xByRow = (motifId: string) => {
      const l = generateLayout(createRectanglePreset(3, 1.5), {
        productId: "grass",
        motifId,
        thicknessM: 0.06,
        reservePercent: 0,
        originM: { x: 0, y: 0 },
        rotationDeg: 0,
      });
      const rows = new Map<number, number>();
      for (const t of l.tiles) {
        if (t.status !== "full") continue;
        const y = Math.round(Math.min(...t.polygon.map((p) => p.y)) * 1000);
        const x = Math.min(...t.polygon.map((p) => p.x));
        rows.set(y, Math.min(rows.get(y) ?? Infinity, x));
      }
      return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, x]) => x);
    };
    const selang = xByRow("selang");
    expect(selang[0]).toBeCloseTo(0, 6);
    expect(selang[1]).toBeGreaterThan(0.2); // baris kedua bergeser ~1/2 keping (22,6 cm)
    expect(xByRow("sejajar").every((x) => Math.abs(x) < 1e-6)).toBe(true);
  });

  it("tekstur lahan besar: sel Grass Block menggambar enam lubang hijau per keping, produk lain tidak", () => {
    const fills: string[] = [];
    const ctx = {
      set fillStyle(v: string) {
        fills.push(v);
      },
      get fillStyle() {
        return "";
      },
      fillRect: () => {},
      beginPath: () => {},
      rect: () => {},
      fill: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
    } as unknown as CanvasRenderingContext2D;
    const grassCell = latticeCell("grass", "selang");
    expect(grassCell.grass).toBe(true);
    let rects = 0;
    (ctx as unknown as { fillRect: () => void }).fillRect = () => {
      rects++;
    };
    drawLatticeCell(ctx, grassCell, ["#b5b4af"], 4);
    // 1 fillRect latar nat + 6 lubang x 9 salinan tetangga x jumlah keping
    expect(rects).toBe(1 + 6 * 9 * grassCell.tiles.length);
    expect(fills).toContain(GRASS);

    const plain = latticeCell("truepave", "bata");
    expect(plain.grass).toBe(false);
    fills.length = 0;
    drawLatticeCell(ctx, plain, ["#b5b4af"], 4);
    expect(fills).not.toContain(GRASS);
  });
});
