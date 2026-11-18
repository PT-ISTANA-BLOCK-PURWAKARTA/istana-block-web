import { describe, expect, it } from "vitest";
import {
  addHoleToGeometry,
  createLShapePreset,
  createRectanglePreset,
  createTrapezoidPreset,
  createUShapePreset,
  generateLayout,
} from "../index";
import { buildProjectGeometry } from "../adapters/preset";
import type { PatternConfig } from "../engine/types";
import type { ProjectGeometry, Ring2D } from "../geometry/types";

const cfg = (over: Partial<PatternConfig> = {}): PatternConfig => ({
  productId: "fp30",
  motifId: "lurus",
  thicknessM: 0.06,
  reservePercent: 0,
  originM: { x: 0, y: 0 },
  rotationDeg: 0,
  ...over,
});

// Cekung: bentuk "C" tidak beraturan dengan sudut miring.
const concave: Ring2D = [
  [0, 0],
  [9, 0],
  [9, 2.3],
  [3.1, 2.7],
  [3.1, 5.9],
  [9, 6.4],
  [9, 8.7],
  [0, 8.7],
  [0, 0],
];

const withHole = (): ProjectGeometry => {
  const base = createRectanglePreset(8.3, 6.1);
  const hole: Ring2D = [
    [2.2, 1.7],
    [2.2, 4.4],
    [5.9, 4.4],
    [5.9, 1.7],
    [2.2, 1.7],
  ];
  return addHoleToGeometry(base, hole);
};

// Lubang kecil yang seluruhnya jatuh di dalam satu keping.
const tinyHole = (): ProjectGeometry => {
  const hole: Ring2D = [
    [1.1, 1.1],
    [1.1, 1.15],
    [1.15, 1.15],
    [1.15, 1.1],
    [1.1, 1.1],
  ];
  return addHoleToGeometry(createRectanglePreset(5, 4), hole);
};

const fixtures: Array<[string, () => ProjectGeometry]> = [
  ["persegi", () => createRectanglePreset(7.3, 4.9)],
  ["persegi 50 m2", () => createRectanglePreset(10, 5)],
  ["bentuk L", () => createLShapePreset(10, 8, 4, 4)],
  ["bentuk U", () => createUShapePreset(12, 8, 3, 3, 3)],
  ["trapesium", () => createTrapezoidPreset(10, 6, 5, 2)],
  ["poligon cekung", () => buildProjectGeometry([[concave]], "Cekung")],
  ["lahan dengan lubang", withHole],
  ["lubang kecil di dalam keping", tinyHole],
];

const configs: Array<[string, PatternConfig]> = [
  ["fp30 lurus", cfg()],
  ["fp30 miring 30", cfg({ rotationDeg: 30 })],
  ["truepave", cfg({ productId: "truepave" })],
  ["hexagon", cfg({ productId: "hexagon" })],
];

describe("Jalur cepat keping utuh identik dengan clipping penuh", () => {
  for (const [gName, mk] of fixtures) {
    for (const [cName, c] of configs) {
      it(`${gName} / ${cName}`, () => {
        const geom = mk();
        const slow = generateLayout(geom, c, { fastPath: false });
        const fast = generateLayout(geom, c);
        expect(fast.metrics).toEqual(slow.metrics);
        expect(fast.tiles.length).toBe(slow.tiles.length);
        expect(fast.tiles).toEqual(slow.tiles);
        expect(fast.warnings).toEqual(slow.warnings);
      });
    }
  }

  it("lubang di dalam keping membuat keping itu tetap dipotong", () => {
    const geom = tinyHole();
    const fast = generateLayout(geom, cfg());
    expect(fast.metrics.partialCount).toBeGreaterThan(0);
  });
});
