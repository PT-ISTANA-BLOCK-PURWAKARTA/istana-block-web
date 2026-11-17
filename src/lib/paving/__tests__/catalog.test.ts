import { describe, expect, it } from "vitest";
import { PAVING_CATALOG, HD_CM, TA_CM, Ta_CM, GW_CM, GH_CM } from "../catalog";

describe("Katalog Produk Paving (F1)", () => {
  it("menghitung pcs/m² geometri sesuai tabel target F1", () => {
    const { truepave, hexagon, fp21, fp30, grass } = PAVING_CATALOG;

    // Truepave: 44,083 pcs/m²
    expect(truepave.pcsPerM2).toBeCloseTo(44.083, 3);
    expect(Math.round(truepave.pcsPerM2)).toBe(truepave.labelPcsPerM2); // 44

    // Hexagon: 27,000 pcs/m²
    expect(hexagon.pcsPerM2).toBeCloseTo(27.0, 3);
    expect(Math.round(hexagon.pcsPerM2)).toBe(hexagon.labelPcsPerM2); // 27

    // Fullpave 21: 22,041 pcs/m²
    expect(fp21.pcsPerM2).toBeCloseTo(22.041, 3);
    expect(Math.round(fp21.pcsPerM2)).toBe(fp21.labelPcsPerM2); // 22

    // Fullpave 30: 11,001 pcs/m²
    expect(fp30.pcsPerM2).toBeCloseTo(11.001, 3);
    expect(Math.round(fp30.pcsPerM2)).toBe(fp30.labelPcsPerM2); // 11

    // Grass block: 7,2855 pcs/m² (geometri) vs 7,5 (angka publik resmi)
    expect(grass.pcsPerM2).toBeCloseTo(7.2855, 3);
    expect(grass.labelPcsPerM2).toBe(7.5);
    // Selisih tercatat ~2,86%
    const diffPct = ((grass.labelPcsPerM2 - grass.pcsPerM2) / grass.labelPcsPerM2) * 100;
    expect(diffPct).toBeGreaterThan(2.5);
    expect(diffPct).toBeLessThan(3.0);
  });

  it("memverifikasi geometri hexagon sisi-ke-sisi", () => {
    const hex = PAVING_CATALOG.hexagon;
    // Sisi datar ke sisi datar asli 20 cm
    expect(hex.actualLengthM).toBe(0.2);
    // HD_CM = sqrt(20000 / (27 * sqrt(3))) ≈ 20,6801 cm
    expect(HD_CM).toBeCloseTo(20.6801, 3);
    // Nat terhitung ≈ 0,680 cm
    expect(hex.jointLengthM * 100).toBeCloseTo(0.6801, 3);
    // Panjang sisi heksagon reguler s = HD_CM / sqrt(3)
    const sideCm = 20 / Math.sqrt(3);
    expect(sideCm).toBeCloseTo(11.547, 3);
    // Luas blok heksagon polos tanpa nat: 3 * sqrt(3) / 2 * s^2 (cm²)
    const areaPolosM2 = ((3 * Math.sqrt(3)) / 2) * (sideCm / 100) ** 2;
    expect(areaPolosM2).toBeCloseTo(0.03464, 4);
  });

  it("memastikan relasi modul = ukuran asli + nat per sumbu", () => {
    for (const p of Object.values(PAVING_CATALOG)) {
      expect(p.moduleLengthM).toBeCloseTo(p.actualLengthM + p.jointLengthM, 6);
      expect(p.moduleWidthM).toBeCloseTo(p.actualWidthM + p.jointWidthM, 6);
    }
  });

  it("menjaga angka publik resmi tetap sama dengan katalog lama", () => {
    expect(PAVING_CATALOG.truepave.labelPcsPerM2).toBe(44);
    expect(PAVING_CATALOG.hexagon.labelPcsPerM2).toBe(27);
    expect(PAVING_CATALOG.fp21.labelPcsPerM2).toBe(22);
    expect(PAVING_CATALOG.fp30.labelPcsPerM2).toBe(11);
    expect(PAVING_CATALOG.grass.labelPcsPerM2).toBe(7.5);
  });
});
