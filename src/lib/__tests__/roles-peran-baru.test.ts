import { describe, expect, it } from "vitest";
import { productionCategories } from "../ops/categories";
import { can, canOpen, effectiveRoles, normalizeRoles } from "../roles";

describe("peran ekspedisi, absensi, qcbeton (setara app live)", () => {
  it("dikenali normalizeRoles", () => {
    expect(normalizeRoles(["ekspedisi", "absensi", "qcbeton", "x"])).toEqual(["ekspedisi", "absensi", "qcbeton"]);
  });

  it("PIC Kendaraan boleh mencatat biaya armada tanpa akses keuangan/pengiriman", () => {
    expect(can(["ekspedisi"], "ekspedisi")).toBe(true);
    expect(can(["ekspedisi"], "keuangan")).toBe(false);
    expect(can(["ekspedisi"], "pengiriman")).toBe(false);
    expect(canOpen(["ekspedisi"], "operasional")).toBe(true);
    expect(canOpen(["ekspedisi"], "keuangan")).toBe(false);
  });

  it("absensi hanya melihat produksi", () => {
    expect(can(["absensi"], "lihat_produksi")).toBe(true);
    expect(can(["absensi"], "produksi_lapangan")).toBe(false);
    expect(productionCategories(["absensi"])).toEqual([]);
  });

  it("QC Beton mengisi produksi precast saja", () => {
    expect(can(["qcbeton"], "produksi_lapangan")).toBe(true);
    expect(can(["qcbeton"], "qc")).toBe(false);
    expect(productionCategories(["qcbeton"])).toEqual(["precast"]);
  });

  it("sesi PIN membawa absensi & qcbeton, tidak ekspedisi", () => {
    expect(effectiveRoles(["absensi", "qcbeton", "ekspedisi"], "pin")).toEqual(["absensi", "qcbeton"]);
  });
});
