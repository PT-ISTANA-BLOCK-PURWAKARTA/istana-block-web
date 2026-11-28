import { describe, expect, it } from "vitest";
import { productionCategories } from "../ops/categories";
import { can, canOpen, effectiveRoles, normalizeRoles } from "../roles";

describe("peran ekspedisi, absensi, qcbeton (setara app live)", () => {
  it("dikenali normalizeRoles", () => {
    expect(normalizeRoles(["ekspedisi", "absensi", "qcbeton", "x"])).toEqual(["ekspedisi", "absensi", "qcbeton"]);
  });

  it("PIC Kendaraan hanya area Ekspedisi di Anak Perusahaan (keputusan pemilik 28/11)", () => {
    expect(can(["ekspedisi"], "ekspedisi")).toBe(true);
    expect(can(["ekspedisi"], "keuangan")).toBe(false);
    expect(can(["ekspedisi"], "pengiriman")).toBe(false);
    expect(can(["ekspedisi"], "uditch")).toBe(false);
    expect(canOpen(["ekspedisi"], "anak")).toBe(true);
    expect(canOpen(["ekspedisi"], "operasional")).toBe(false);
    expect(canOpen(["ekspedisi"], "keuangan")).toBe(false);
  });

  it("PIC U-Ditch (Lina) hanya area Proyek U-Ditch di Anak Perusahaan, terpisah dari keuangan IB", () => {
    expect(can(["uditch"], "uditch")).toBe(true);
    expect(can(["uditch"], "ekspedisi")).toBe(false);
    expect(can(["uditch"], "keuangan")).toBe(false);
    expect(canOpen(["uditch"], "anak")).toBe(true);
    expect(canOpen(["uditch"], "operasional")).toBe(false);
    expect(canOpen(["uditch"], "keuangan")).toBe(false);
    expect(canOpen(["uditch"], "web")).toBe(false);
  });

  it("absensi hanya melihat produksi", () => {
    expect(can(["absensi"], "lihat_produksi")).toBe(true);
    expect(can(["absensi"], "produksi_lapangan")).toBe(false);
    expect(productionCategories(["absensi"])).toEqual([]);
  });

  it("QC Beton mengisi produksi precast saja", () => {
    expect(can(["qcbeton"], "produksi_lapangan")).toBe(true);
    expect(can(["qcbeton"], "qc")).toBe(false);
    expect(can(["qcbeton"], "qc_beton")).toBe(true);
    expect(can(["qc"], "qc_beton")).toBe(false);
    expect(can(["operasional"], "qc_beton")).toBe(true);
    expect(can(["owner"], "qc_beton")).toBe(true);
    expect(productionCategories(["qcbeton"])).toEqual(["precast"]);
  });

  it("sesi PIN membawa absensi & qcbeton, tidak ekspedisi", () => {
    expect(effectiveRoles(["absensi", "qcbeton", "ekspedisi"], "pin")).toEqual(["absensi", "qcbeton"]);
  });
});
