import { describe, expect, it } from "vitest";
import {
  addHoleToGeometry,
  calculateMaterialEstimate,
  createLShapePreset,
  createRectanglePreset,
  generateLayout,
  PatternConfig,
  ProjectGeometry,
  validateGeometry,
} from "../index";
import { PAVING_CATALOG } from "../catalog";

describe("F2 Engine Core - Layout, Clipping, & Material Estimation", () => {
  describe("Fullpave 30 Exact Math Cases (modul = 0.3015 m)", () => {
    const FP30_MOD = 0.3015;
    const cfg: PatternConfig = {
      productId: "fp30",
      motifId: "lurus",
      thicknessM: 0.06,
      reservePercent: 0,
      originM: { x: 0, y: 0 },
      rotationDeg: 0,
    };

    it("1. Grid Test (20 x 10 modul): exactly 200 full, 0 cuts", () => {
      const lengthM = 20 * FP30_MOD; // 6.03 m
      const widthM = 10 * FP30_MOD; // 3.015 m
      const geom = createRectanglePreset(lengthM, widthM);
      expect(geom.metrics.areaM2).toBeCloseTo(18.18045, 4);

      const layout = generateLayout(geom, cfg);
      expect(layout.metrics.fullCount).toBe(200);
      expect(layout.metrics.partialCount).toBe(0);
      expect(layout.metrics.coveredAreaM2).toBeCloseTo(18.18045, 4);

      const est = calculateMaterialEstimate(layout, cfg);
      expect(est.fullUnits).toBe(200);
      expect(est.cutInstalledPieces).toBe(0);
      expect(est.baseUnits).toBe(200);
      expect(est.recommendedPurchaseUnits).toBe(200);
    });

    it("2. L-Shape Test (20x20 modul minus 10x10 corner): exactly 300 full, 0 cuts", () => {
      const totalW = 20 * FP30_MOD; // 6.03 m
      const totalH = 20 * FP30_MOD; // 6.03 m
      const legW = 10 * FP30_MOD; // 3.015 m
      const legH = 10 * FP30_MOD; // 3.015 m
      const geom = createLShapePreset(totalW, totalH, legW, legH);
      expect(geom.metrics.areaM2).toBeCloseTo(27.270675, 4);

      const layout = generateLayout(geom, cfg);
      expect(layout.metrics.fullCount).toBe(300);
      expect(layout.metrics.partialCount).toBe(0);
      expect(layout.metrics.coveredAreaM2).toBeCloseTo(27.270675, 4);
    });

    it("3. Hole Test (20x20 modul with 10x10 hole): exactly 300 full, 0 cuts, hole preserved", () => {
      const baseGeom = createRectanglePreset(20 * FP30_MOD, 20 * FP30_MOD);
      const holeRing = [
        [5 * FP30_MOD, 5 * FP30_MOD],
        [15 * FP30_MOD, 5 * FP30_MOD],
        [15 * FP30_MOD, 15 * FP30_MOD],
        [5 * FP30_MOD, 15 * FP30_MOD],
        [5 * FP30_MOD, 5 * FP30_MOD],
      ] as [number, number][];

      const geomWithHole = addHoleToGeometry(baseGeom, holeRing);
      expect(geomWithHole.metrics.areaM2).toBeCloseTo(27.270675, 4);

      const layout = generateLayout(geomWithHole, cfg);
      expect(layout.metrics.fullCount).toBe(300);
      expect(layout.metrics.partialCount).toBe(0);
      expect(layout.metrics.coveredAreaM2).toBeCloseTo(27.270675, 4);
    });

    it("4. Right-Angled Triangle Test (legs 20 modul): 190 full + 20 cuts", () => {
      const legM = 20 * FP30_MOD; // 6.03 m
      // Triangle ring (0,0) -> (6.03, 0) -> (0, 6.03) -> (0, 0)
      const geom: ProjectGeometry = {
        schemaVersion: "1.0.0",
        source: "grid",
        sourceCrs: "local-meter",
        workingUnit: "meter",
        geometry: [
          [
            [
              [0, 0],
              [legM, 0],
              [0, legM],
              [0, 0],
            ],
          ],
        ],
        metrics: {
          areaM2: 18.18045,
          perimeterM: legM * 2 + Math.hypot(legM, legM),
          bounds: { minX: 0, minY: 0, maxX: legM, maxY: legM },
        },
        warnings: [],
      };

      const layout = generateLayout(geom, cfg);
      expect(layout.metrics.fullCount).toBe(190);
      expect(layout.metrics.partialCount).toBe(20);
      expect(layout.metrics.coveredAreaM2).toBeCloseTo(18.18045, 3);
    });

    it("5. Half-Module Shift: cuts occur, covered area conserved", () => {
      const lengthM = 20 * FP30_MOD;
      const widthM = 10 * FP30_MOD;
      const geom = createRectanglePreset(lengthM, widthM);

      const shiftedCfg: PatternConfig = {
        ...cfg,
        originM: { x: FP30_MOD / 2, y: 0 },
      };

      const layout = generateLayout(geom, shiftedCfg);
      expect(layout.metrics.partialCount).toBeGreaterThan(0);
      expect(layout.metrics.coveredAreaM2).toBeCloseTo(18.18045, 3);
    });
  });

  describe("Truepave 10 x 20 m (200 m²) Runbook Exact Verification", () => {
    it("matches exact 8602 full, 328 cuts, 8930 base, 9377 recommended", () => {
      const geom = createRectanglePreset(10, 20); // 10 m wide x 20 m high = 200 m²
      const cfg: PatternConfig = {
        productId: "truepave",
        motifId: "bata",
        thicknessM: 0.06,
        reservePercent: 5,
        originM: { x: 0, y: 0 },
        rotationDeg: 0,
      };

      const layout = generateLayout(geom, cfg);
      expect(layout.metrics.fullCount).toBe(8602);
      expect(layout.metrics.partialCount).toBe(328);
      expect(layout.metrics.coveredAreaM2).toBeCloseTo(200, 1);

      const est = calculateMaterialEstimate(layout, cfg);
      expect(est.fullUnits).toBe(8602);
      expect(est.cutInstalledPieces).toBe(328);
      expect(est.estimatedStockUnitsForCuts).toBe(328);
      expect(est.baseUnits).toBe(8930);
      expect(est.reserveUnits).toBe(447); // ceil(8930 * 0.05) = ceil(446.5) = 447
      expect(est.recommendedPurchaseUnits).toBe(9377); // 8930 + 447 = 9377
    });
  });

  describe("Hexagon 10 x 10 m Area Conservation", () => {
    it("tiles hexagon pattern deterministically with area conservation", () => {
      const geom = createRectanglePreset(10, 10); // 100 m²
      const cfg: PatternConfig = {
        productId: "hexagon",
        motifId: "polos",
        thicknessM: 0.06,
        reservePercent: 10,
        originM: { x: 0, y: 0 },
        rotationDeg: 0,
      };

      const layout = generateLayout(geom, cfg);
      expect(layout.metrics.fullCount).toBeLessThanOrEqual(2700);
      expect(layout.metrics.fullCount).toBeGreaterThan(2500);
      expect(layout.metrics.coveredAreaM2).toBeCloseTo(100, 1);
    });
  });

  describe("Invariants & Validation", () => {
    it("rejects self-intersecting polygons with clear error message", () => {
      // Hourglass figure 8: (0,0) -> (4,4) -> (4,0) -> (0,4) -> (0,0)
      const selfIntersectingRing = [
        [0, 0],
        [4, 4],
        [4, 0],
        [0, 4],
        [0, 0],
      ] as [number, number][];

      const val = validateGeometry([[selfIntersectingRing]]);
      expect(val.valid).toBe(false);
      expect(val.errors.some((e) => e.includes("berpotongan"))).toBe(true);
    });

    it("determinism: 5 executions produce identical inputHash and identical metrics", () => {
      const geom = createRectanglePreset(5, 5);
      const cfg: PatternConfig = {
        productId: "truepave",
        motifId: "bata",
        thicknessM: 0.06,
        reservePercent: 5,
      };

      const first = generateLayout(geom, cfg);
      for (let i = 0; i < 4; i++) {
        const next = generateLayout(geom, cfg);
        expect(next.inputHash).toBe(first.inputHash);
        expect(next.metrics.fullCount).toBe(first.metrics.fullCount);
        expect(next.metrics.partialCount).toBe(first.metrics.partialCount);
        expect(next.metrics.coveredAreaM2).toBe(first.metrics.coveredAreaM2);
      }
    });

    it("invariant: src/lib/paving contains 0 imports of react, three, react-dom, document, or window", () => {
      const fs = require("fs");
      const path = require("path");

      function getTsFiles(dir: string): string[] {
        let results: string[] = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            results = results.concat(getTsFiles(fullPath));
          } else if (entry.isFile() && fullPath.endsWith(".ts") && !fullPath.includes("__tests__")) {
            results.push(fullPath);
          }
        }
        return results;
      }

      const pavingDir = path.resolve(__dirname, "..");
      const files = getTsFiles(pavingDir);
      expect(files.length).toBeGreaterThan(5);

      const impurePattern = /from\s+['"](react|three|react-dom)['"]|\bdocument\.|\bwindow\./;
      for (const file of files) {
        const content = fs.readFileSync(file, "utf8");
        expect(impurePattern.test(content)).toBe(false);
      }
    });
  });
});
