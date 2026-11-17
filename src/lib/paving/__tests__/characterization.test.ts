import { describe, expect, it } from "vitest";
import {
  autoShares,
  CAD_OPTIONS,
  CalcState,
  ceilSafe,
  compute,
  decodeState,
  detailLines,
  effectiveColors,
  encodeState,
  fmt,
  fmtPct,
  parseNum,
  PRODUCTS,
  ProductId,
  roleCounts,
  unitOf,
  URL_KEYS,
  waMessage,
} from "../legacy";
import { PAVING_CATALOG } from "../catalog";

describe("Legacy Characterization Tests", () => {
  describe("Public label pcs/m² invariants", () => {
    it("matches catalog labelPcsPerM2 for all products", () => {
      expect(PRODUCTS.truepave.pcs).toBe(PAVING_CATALOG.truepave.labelPcsPerM2);
      expect(PRODUCTS.hexagon.pcs).toBe(PAVING_CATALOG.hexagon.labelPcsPerM2);
      expect(PRODUCTS.fp21.pcs).toBe(PAVING_CATALOG.fp21.labelPcsPerM2);
      expect(PRODUCTS.fp30.pcs).toBe(PAVING_CATALOG.fp30.labelPcsPerM2);
      expect(PRODUCTS.grass.pcs).toBe(PAVING_CATALOG.grass.labelPcsPerM2);

      expect(PRODUCTS.truepave.pcs).toBe(44);
      expect(PRODUCTS.hexagon.pcs).toBe(27);
      expect(PRODUCTS.fp21.pcs).toBe(22);
      expect(PRODUCTS.fp30.pcs).toBe(11);
      expect(PRODUCTS.grass.pcs).toBe(7.5);
    });
  });

  describe("compute() - 20+ Combinations Characterization", () => {
    const products: ProductId[] = ["truepave", "hexagon", "fp21", "fp30", "grass"];
    const reserves = [0, 3, 5, 10];
    const testCases: {
      jenis: ProductId;
      motif: string;
      mode: "pl" | "luas";
      p: string;
      l: string;
      luas: string;
      cad: number;
      k: boolean;
      ks: 40 | 60;
      kp: string;
      abu: boolean;
      bc: boolean;
      expectedArea: number;
      expectedTotal: number;
    }[] = [
      // 1. Truepave 100m² cad 5%
      {
        jenis: "truepave",
        motif: "bata",
        mode: "pl",
        p: "10",
        l: "10",
        luas: "",
        cad: 5,
        k: true,
        ks: 60,
        kp: "",
        abu: true,
        bc: true,
        expectedArea: 100,
        expectedTotal: 4620, // ceil(100 * 44 * 1.05)
      },
      // 2. Truepave 100m² cad 0%
      {
        jenis: "truepave",
        motif: "tulang90",
        mode: "luas",
        p: "",
        l: "",
        luas: "100",
        cad: 0,
        k: false,
        ks: 40,
        kp: "",
        abu: false,
        bc: false,
        expectedArea: 100,
        expectedTotal: 4400,
      },
      // 3. Truepave 50m² cad 10%
      {
        jenis: "truepave",
        motif: "tulang45",
        mode: "luas",
        p: "",
        l: "",
        luas: "50",
        cad: 10,
        k: true,
        ks: 40,
        kp: "20",
        abu: true,
        bc: false,
        expectedArea: 50,
        expectedTotal: 2420, // ceil(50 * 44 * 1.10)
      },
      // 4. Truepave 25.5m² cad 3%
      {
        jenis: "truepave",
        motif: "anyaman",
        mode: "pl",
        p: "5,1",
        l: "5",
        luas: "",
        cad: 3,
        k: false,
        ks: 40,
        kp: "",
        abu: true,
        bc: true,
        expectedArea: 25.5,
        expectedTotal: 1156, // ceil(25.5 * 44 * 1.03) = ceil(1155.66) = 1156
      },
      // 5. Hexagon 100m² cad 10%
      {
        jenis: "hexagon",
        motif: "polos",
        mode: "luas",
        p: "",
        l: "",
        luas: "100",
        cad: 10,
        k: true,
        ks: 40,
        kp: "",
        abu: true,
        bc: false,
        expectedArea: 100,
        expectedTotal: 2970, // ceil(100 * 27 * 1.10)
      },
      // 6. Hexagon 50m² cad 5%
      {
        jenis: "hexagon",
        motif: "garis",
        mode: "pl",
        p: "10",
        l: "5",
        luas: "",
        cad: 5,
        k: false,
        ks: 40,
        kp: "",
        abu: false,
        bc: false,
        expectedArea: 50,
        expectedTotal: 1418, // ceil(50 * 27 * 1.05) = ceil(1417.5) = 1418
      },
      // 7. Hexagon 30m² cad 0%
      {
        jenis: "hexagon",
        motif: "titik",
        mode: "luas",
        p: "",
        l: "",
        luas: "30",
        cad: 0,
        k: true,
        ks: 60,
        kp: "12",
        abu: true,
        bc: true,
        expectedArea: 30,
        expectedTotal: 810, // 30 * 27
      },
      // 8. Hexagon 75m² cad 3%
      {
        jenis: "hexagon",
        motif: "bunga",
        mode: "luas",
        p: "",
        l: "",
        luas: "75",
        cad: 3,
        k: false,
        ks: 40,
        kp: "",
        abu: true,
        bc: false,
        expectedArea: 75,
        expectedTotal: 2086, // ceil(75 * 27 * 1.03) = ceil(2085.75) = 2086
      },
      // 9. Fullpave 21 100m² cad 0%
      {
        jenis: "fp21",
        motif: "lurus",
        mode: "luas",
        p: "",
        l: "",
        luas: "100",
        cad: 0,
        k: true,
        ks: 60,
        kp: "",
        abu: true,
        bc: true,
        expectedArea: 100,
        expectedTotal: 2200, // 100 * 22
      },
      // 10. Fullpave 21 80m² cad 5%
      {
        jenis: "fp21",
        motif: "catur",
        mode: "pl",
        p: "10",
        l: "8",
        luas: "",
        cad: 5,
        k: false,
        ks: 40,
        kp: "",
        abu: false,
        bc: false,
        expectedArea: 80,
        expectedTotal: 1848, // ceil(80 * 22 * 1.05)
      },
      // 11. Fullpave 21 40m² cad 10%
      {
        jenis: "fp21",
        motif: "diagonal",
        mode: "luas",
        p: "",
        l: "",
        luas: "40",
        cad: 10,
        k: true,
        ks: 40,
        kp: "25",
        abu: true,
        bc: false,
        expectedArea: 40,
        expectedTotal: 968, // ceil(40 * 22 * 1.10)
      },
      // 12. Fullpave 21 65m² cad 3%
      {
        jenis: "fp21",
        motif: "bingkai",
        mode: "luas",
        p: "",
        l: "",
        luas: "65",
        cad: 3,
        k: false,
        ks: 40,
        kp: "",
        abu: true,
        bc: true,
        expectedArea: 65,
        expectedTotal: 1473, // ceil(65 * 22 * 1.03) = ceil(1472.9) = 1473
      },
      // 13. Fullpave 30 100m² cad 0%
      {
        jenis: "fp30",
        motif: "lurus",
        mode: "luas",
        p: "",
        l: "",
        luas: "100",
        cad: 0,
        k: true,
        ks: 60,
        kp: "",
        abu: true,
        bc: true,
        expectedArea: 100,
        expectedTotal: 1100, // 100 * 11
      },
      // 14. Fullpave 30 120m² cad 5%
      {
        jenis: "fp30",
        motif: "setengah",
        mode: "pl",
        p: "12",
        l: "10",
        luas: "",
        cad: 5,
        k: false,
        ks: 40,
        kp: "",
        abu: false,
        bc: false,
        expectedArea: 120,
        expectedTotal: 1386, // ceil(120 * 11 * 1.05)
      },
      // 15. Fullpave 30 35m² cad 10%
      {
        jenis: "fp30",
        motif: "diagonal-catur",
        mode: "luas",
        p: "",
        l: "",
        luas: "35",
        cad: 10,
        k: true,
        ks: 40,
        kp: "20",
        abu: true,
        bc: false,
        expectedArea: 35,
        expectedTotal: 424, // ceil(35 * 11 * 1.10) = ceil(423.5) = 424
      },
      // 16. Fullpave 30 90m² cad 3%
      {
        jenis: "fp30",
        motif: "bingkai-titik",
        mode: "luas",
        p: "",
        l: "",
        luas: "90",
        cad: 3,
        k: false,
        ks: 40,
        kp: "",
        abu: true,
        bc: true,
        expectedArea: 90,
        expectedTotal: 1020, // ceil(90 * 11 * 1.03) = ceil(1019.7) = 1020
      },
      // 17. Grass Block 100m² cad 0%
      {
        jenis: "grass",
        motif: "sejajar",
        mode: "luas",
        p: "",
        l: "",
        luas: "100",
        cad: 0,
        k: true,
        ks: 60,
        kp: "",
        abu: true,
        bc: true,
        expectedArea: 100,
        expectedTotal: 750, // 100 * 7.5
      },
      // 18. Grass Block 40m² cad 5%
      {
        jenis: "grass",
        motif: "selang",
        mode: "pl",
        p: "8",
        l: "5",
        luas: "",
        cad: 5,
        k: true,
        ks: 40,
        kp: "",
        abu: false,
        bc: false,
        expectedArea: 40,
        expectedTotal: 315, // ceil(40 * 7.5 * 1.05)
      },
      // 19. Grass Block 60m² cad 10%
      {
        jenis: "grass",
        motif: "sejajar",
        mode: "luas",
        p: "",
        l: "",
        luas: "60",
        cad: 10,
        k: false,
        ks: 40,
        kp: "",
        abu: true,
        bc: false,
        expectedArea: 60,
        expectedTotal: 495, // ceil(60 * 7.5 * 1.10)
      },
      // 20. Grass Block 55m² cad 3%
      {
        jenis: "grass",
        motif: "selang",
        mode: "luas",
        p: "",
        l: "",
        luas: "55",
        cad: 3,
        k: true,
        ks: 60,
        kp: "30",
        abu: true,
        bc: true,
        expectedArea: 55,
        expectedTotal: 425, // ceil(55 * 7.5 * 1.03) = ceil(424.875) = 425
      },
      // 21. Floating point precision test: 0.5 x 10m x 44 x 1.10 = 242.00000000000003 -> ceilSafe must give 242
      {
        jenis: "truepave",
        motif: "bata",
        mode: "pl",
        p: "0,5",
        l: "10",
        luas: "",
        cad: 10,
        k: false,
        ks: 40,
        kp: "",
        abu: false,
        bc: false,
        expectedArea: 5,
        expectedTotal: 242,
      },
    ];

    testCases.forEach((tc, idx) => {
      it(`calculates test case ${idx + 1} (${tc.jenis} - ${tc.motif} - ${tc.cad}%) accurately`, () => {
        const state: CalcState = {
          jenis: tc.jenis,
          motif: tc.motif,
          warna: ["N", "M", "H"],
          tebal: PRODUCTS[tc.jenis].tebal[0],
          mode: tc.mode,
          p: tc.p,
          l: tc.l,
          luas: tc.luas,
          cad: tc.cad,
          k: tc.k,
          ks: tc.ks,
          kp: tc.kp,
          abu: tc.abu,
          bc: tc.bc,
          manual: false,
          persen: {},
        };

        const res = compute(state);
        expect(res.area).toBe(tc.expectedArea);
        expect(res.total).toBe(tc.expectedTotal);

        if (tc.abu) {
          expect(res.abuM3).toBeCloseTo(tc.expectedArea * 0.05, 4);
        } else {
          expect(res.abuM3).toBe(0);
        }

        if (tc.bc) {
          expect(res.bcM3).toBeCloseTo(tc.expectedArea * 0.2, 4);
        } else {
          expect(res.bcM3).toBe(0);
        }

        if (tc.k) {
          if (tc.kp) {
            expect(res.kanstin.len).toBe(parseNum(tc.kp));
          } else if (tc.mode === "pl") {
            expect(res.kanstin.len).toBe(2 * (parseNum(tc.p) + parseNum(tc.l)));
          }
          expect(res.kanstin.pcs).toBe(ceilSafe((res.kanstin.len * 100) / tc.ks));
        } else {
          expect(res.kanstin.pcs).toBe(0);
        }
      });
    });
  });

  describe("encodeState / decodeState round-trip", () => {
    it("preserves state through encode -> decode roundtrip for all URL_KEYS", () => {
      const original: CalcState = {
        jenis: "truepave",
        motif: "anyaman",
        warna: ["M", "N", "H"],
        tebal: 8,
        mode: "pl",
        p: "12,5",
        l: "6",
        luas: "",
        cad: 10,
        k: true,
        ks: 60,
        kp: "37",
        abu: false,
        bc: true,
        manual: true,
        persen: { N: "40" },
      };

      const q = encodeState(original);
      const queryObj: Record<string, string> = {};
      q.forEach((v, k) => {
        queryObj[k] = v;
      });

      const decoded = decodeState(queryObj);
      expect(decoded.jenis).toBe(original.jenis);
      expect(decoded.motif).toBe(original.motif);
      expect(decoded.warna[0]).toBe("M");
      expect(decoded.warna[1]).toBe("N");
      expect(decoded.tebal).toBe(8);
      expect(decoded.mode).toBe("pl");
      expect(decoded.p).toBe("12,5");
      expect(decoded.l).toBe("6");
      expect(decoded.cad).toBe(10);
      expect(decoded.k).toBe(true);
      expect(decoded.ks).toBe(60);
      expect(decoded.kp).toBe("37");
      expect(decoded.abu).toBe(false);
      expect(decoded.bc).toBe(true);
      expect(decoded.manual).toBe(true);
    });

    it("handles default fallback cleanly for empty query", () => {
      const decoded = decodeState({});
      expect(decoded.jenis).toBe("truepave");
      expect(decoded.motif).toBe("bata");
      expect(decoded.cad).toBe(5);
      expect(decoded.k).toBe(true);
      expect(decoded.ks).toBe(40);
      expect(decoded.abu).toBe(true);
      expect(decoded.bc).toBe(false);
    });
  });

  describe("detailLines and waMessage exact output", () => {
    it("generates expected lines and WhatsApp message", () => {
      const state: CalcState = {
        jenis: "truepave",
        motif: "bata",
        warna: ["N", "M", "H"],
        tebal: 6,
        mode: "pl",
        p: "10",
        l: "5",
        luas: "",
        cad: 5,
        k: true,
        ks: 60,
        kp: "",
        abu: true,
        bc: false,
        manual: false,
        persen: {},
      };

      const res = compute(state);
      const lines = detailLines(state, res);
      expect(lines).toContain("• Produk: Truepave / Bata 21 × 10,5 cm, tebal 6 cm");
      expect(lines).toContain("• Motif: Susun bata");
      expect(lines).toContain("• Ukuran area: 10 × 5 m = 50 m²");
      expect(lines).toContain("• Cadangan: 5%");
      expect(lines).toContain("• Total paving: 2.310 pcs (44 pcs/m²)");
      expect(lines).toContain("• Kanstin 60 cm: 50 pcs (keliling 30 m)");
      expect(lines).toContain("• Abu batu 5 cm: 2,5 m³");

      const msg = waMessage(lines, "https://istanablock.com/pola-paving?test=1");
      expect(msg).toContain("Halo Istana Block, saya mau minta penawaran paving sesuai hasil Kalkulator Pola Paving:");
      expect(msg).toContain("Lihat pola: https://istanablock.com/pola-paving?test=1");
    });
  });

  describe("Motifs and Units integrity", () => {
    it("ensures all 23 motifs build valid units with non-zero dimensions and tiles", () => {
      let totalMotifs = 0;
      for (const [prodId, prod] of Object.entries(PRODUCTS)) {
        for (const motif of prod.motifs) {
          totalMotifs++;
          const unit = unitOf(prod.id, motif.id);
          expect(unit.w).toBeGreaterThan(0);
          expect(unit.h).toBeGreaterThan(0);
          expect(unit.tiles.length).toBeGreaterThan(0);

          const counts = roleCounts(unit);
          const totalRoleTiles = counts.reduce((a, b) => a + b, 0);
          expect(totalRoleTiles).toBe(unit.tiles.length);
        }
      }
      expect(totalMotifs).toBe(30); // 8 + 6 + 7 + 7 + 2 = 30 motifs across all 5 products
    });
  });
});
