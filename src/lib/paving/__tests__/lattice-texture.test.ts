import { describe, expect, it } from "vitest";
import { MAX_3D_BLOCKS, latticeCell, latticeUv } from "../render/lattice-texture";

describe("lattice-texture", () => {
  it("satu sel penuh sepanjang sumbu lattice = 1 satuan UV", () => {
    const c = latticeCell("truepave", "bata");
    const [u0, v0] = latticeUv(0, 0, 0, c.wCm, c.hCm);
    const [u1, v1] = latticeUv(c.wCm / 100, 0, 0, c.wCm, c.hCm);
    const [u2, v2] = latticeUv(0, c.hCm / 100, 0, c.wCm, c.hCm);
    expect(u1 - u0).toBeCloseTo(1, 9);
    expect(v1 - v0).toBeCloseTo(0, 9);
    expect(u2 - u0).toBeCloseTo(0, 9);
    expect(v2 - v0).toBeCloseTo(1, 9);
  });
  it("rotasi 90 derajat memutar sumbu lattice ke plan +y", () => {
    const c = latticeCell("truepave", "bata");
    const [u, v] = latticeUv(0, c.wCm / 100, 90, c.wCm, c.hCm);
    expect(u).toBeCloseTo(1, 9);
    expect(v).toBeCloseTo(0, 9);
  });
  it("sel berisi keping bertipe sesuai produk", () => {
    const r = latticeCell("truepave", "bata");
    expect(r.tiles.length).toBeGreaterThan(0);
    expect(r.wCm).toBeGreaterThan(0);
    expect(r.tiles.every((t) => t.shape === "rect")).toBe(true);
    expect(latticeCell("hexagon", "polos").tiles.every((t) => t.shape === "hex")).toBe(true);
  });
  it("batas keping per keping tetap 10.000", () => {
    expect(MAX_3D_BLOCKS).toBe(10000);
  });
});
