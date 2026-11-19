import { describe, expect, it } from "vitest";
import {
  DAFTAR_KONSTANTA_SEMENTARA,
  TAMPILKAN_BIAYA,
  PASIR_ALAS_CM,
  TEBAL_MIN_CM,
  beratPcsKg,
  daftarBelanjaLines,
  daftarBelanjaWA,
  hitungArea,
  hitungBiaya,
  hitungLogistik,
  hitungMaterialPendukung,
  hitungMultiArea,
  hitungProyek,
  luasBersih,
  ongkirPerTrip,
  pcsPerPalet,
  rekomendasiBeban,
  sisaPotongPersen,
  tebalBawaan,
} from "../index";

describe("rekomendasiBeban", () => {
  it("pejalan: tebal 6, semua produk katalog", () => {
    const r = rekomendasiBeban("pejalan");
    expect(r.tebalMinCm).toBe(6);
    expect(r.produk.map((p) => p.id).sort()).toEqual(["fp21", "fp30", "grass", "hexagon", "truepave"]);
    expect(r.peringatan).toEqual([]);
  });
  it("mobil: tebal 8, hanya produk bertebal 8", () => {
    const r = rekomendasiBeban("mobil");
    expect(r.tebalMinCm).toBe(8);
    expect(r.produk.map((p) => p.id).sort()).toEqual(["grass", "hexagon", "truepave"]);
    expect(r.produk.every((p) => p.tebalCm.every((t) => t >= 8))).toBe(true);
  });
  it("truk berat: katalog belum punya 10 cm -> alternatif + peringatan", () => {
    const r = rekomendasiBeban("truk-berat");
    expect(r.tebalMinCm).toBe(10);
    expect(r.produk).toEqual([]);
    expect(r.produkAlternatif.length).toBeGreaterThan(0);
    expect(r.peringatan.length).toBe(1);
  });
  it("tebalBawaan", () => {
    expect(tebalBawaan("truepave", "pejalan")).toBe(6);
    expect(tebalBawaan("truepave", "mobil")).toBe(8);
    expect(tebalBawaan("fp21", "mobil")).toBe(6); // tak ada yang cukup -> terbesar
  });
});

describe("hitungMaterialPendukung", () => {
  it("volume dari luas, tebal, faktor padat", () => {
    const m = hitungMaterialPendukung(100, "mobil");
    expect(m.pasirAlas).toEqual({ tebalCm: 5, m3: 6 }); // 100*0.05*1.2
    expect(m.sirtu).toEqual({ tebalCm: 15, m3: 18 }); // 100*0.15*1.2
    expect(m.abuNat.m3).toBe(0.22); // 100*0.002*1.1
    expect(m.kanstin).toBeUndefined();
  });
  it("luas 0 -> semua 0", () => {
    const m = hitungMaterialPendukung(0, "pejalan");
    expect([m.pasirAlas.m3, m.sirtu.m3, m.abuNat.m3]).toEqual([0, 0, 0]);
  });
  it("kanstin dibulatkan ke atas dari keliling", () => {
    expect(hitungMaterialPendukung(10, "pejalan", { kelilingM: 12 }).kanstin?.pcs).toBe(20);
    expect(hitungMaterialPendukung(10, "pejalan", { kelilingM: 12.1 }).kanstin?.pcs).toBe(21);
    expect(hitungMaterialPendukung(10, "pejalan", { kelilingM: 0 }).kanstin?.pcs).toBe(0);
    expect(hitungMaterialPendukung(10, "pejalan", { kelilingM: 10, kanstinPanjangCm: 40 }).kanstin?.pcs).toBe(25);
  });
  it("input tidak sah -> error", () => {
    expect(() => hitungMaterialPendukung(-1, "pejalan")).toThrow(RangeError);
    expect(() => hitungMaterialPendukung(Number.NaN, "pejalan")).toThrow(RangeError);
    expect(() => hitungMaterialPendukung(1, "pejalan", { kelilingM: 5, kanstinPanjangCm: 0 })).toThrow(RangeError);
  });
});

describe("lahan", () => {
  it("luasBersih mengurangi lubang", () => {
    expect(luasBersih(50, [5, 2.5])).toBe(42.5);
    expect(luasBersih(0)).toBe(0);
    expect(luasBersih(10, [10])).toBe(0);
  });
  it("lubang > luas -> error", () => {
    expect(() => luasBersih(10, [6, 5])).toThrow(RangeError);
  });
  it("sisa potong sederhana < tak simetris", () => {
    expect(sisaPotongPersen("sederhana")).toBeLessThan(sisaPotongPersen("tak-simetris"));
    expect(sisaPotongPersen()).toBe(sisaPotongPersen("sederhana"));
  });
  it("hitungArea: truepave 10 m² = 440 pcs + 5% = 462", () => {
    const r = hitungArea({ id: "a", produkId: "truepave", luasKotorM2: 10 });
    expect(r.pcsDasar).toBe(440);
    expect(r.pcsBeli).toBe(462);
  });
  it("hitungArea: lubang mengurangi pcs, tak simetris 10%", () => {
    const r = hitungArea({ id: "a", produkId: "truepave", luasKotorM2: 12, lubangM2: [2], bentuk: "tak-simetris" });
    expect(r.luasBersihM2).toBe(10);
    expect(r.luasLubangM2).toBe(2);
    expect(r.pcsBeli).toBe(484);
  });
  it("hitungArea memakai pcsLayout bila ada", () => {
    expect(hitungArea({ id: "a", produkId: "fp30", luasKotorM2: 10, pcsLayout: 100 }).pcsBeli).toBe(105);
  });
  it("hitungArea luas 0 -> 0 pcs", () => {
    expect(hitungArea({ id: "a", produkId: "hexagon", luasKotorM2: 0 }).pcsBeli).toBe(0);
  });
  it("multi-area dengan produk berbeda", () => {
    const m = hitungMultiArea([
      { id: "a", produkId: "truepave", luasKotorM2: 10 },
      { id: "b", produkId: "truepave", luasKotorM2: 10 },
      { id: "c", produkId: "fp30", luasKotorM2: 20, lubangM2: [10] },
    ]);
    expect(m.totalLuasBersihM2).toBe(30);
    expect(m.perProduk.truepave).toBe(924);
    expect(m.perProduk.fp30).toBe(116); // ceil(110)=110 + ceil(5.5)=6
    expect(m.totalPcsBeli).toBe(924 + 116);
  });
  it("multi-area kosong -> nol", () => {
    const m = hitungMultiArea([]);
    expect([m.rows.length, m.totalLuasBersihM2, m.totalPcsBeli]).toEqual([0, 0, 0]);
  });
});

describe("logistik", () => {
  it("pcs per palet dan berat berasal dari katalog", () => {
    expect(pcsPerPalet("truepave")).toBe(352);
    expect(beratPcsKg("truepave", 6)).toBeCloseTo(0.21 * 0.105 * 0.06 * 2300, 6);
  });
  it("palet dibulatkan ke atas", () => {
    const l = hitungLogistik([{ produkId: "truepave", tebalCm: 6, pcs: 353 }]);
    expect(l.paletTotal).toBe(2);
    expect(l.trip).toBe(1);
  });
  it("tepat satu palet -> 1 palet", () => {
    expect(hitungLogistik([{ produkId: "truepave", tebalCm: 6, pcs: 352 }]).paletTotal).toBe(1);
  });
  it("trip naik berdasar batas palet atau berat, dibulatkan ke atas", () => {
    // 5 palet truepave: lewat batas 4 palet engkel -> 2 trip
    const l = hitungLogistik([{ produkId: "truepave", tebalCm: 6, pcs: 352 * 5 }]);
    expect(l.paletTotal).toBe(5);
    expect(l.trip).toBe(2);
    expect(hitungLogistik([{ produkId: "truepave", tebalCm: 6, pcs: 352 * 5 }], "fuso").trip).toBe(1);
  });
  it("berat memicu trip tambahan", () => {
    // hexagon 8 cm: berat besar, 4 palet penuh > 4000 kg
    const l = hitungLogistik([{ produkId: "hexagon", tebalCm: 8, pcs: pcsPerPalet("hexagon") * 4 }]);
    expect(l.paletTotal).toBe(4);
    expect(l.beratTotalKg).toBeGreaterThan(4000);
    expect(l.trip).toBe(2);
  });
  it("kosong atau 0 pcs -> 0 trip", () => {
    expect(hitungLogistik([]).trip).toBe(0);
    expect(hitungLogistik([{ produkId: "fp21", tebalCm: 6, pcs: 0 }])).toMatchObject({ paletTotal: 0, trip: 0 });
  });
});

describe("biaya", () => {
  it("ongkir menurut zona jarak", () => {
    expect(ongkirPerTrip(0)).toBe(250_000);
    expect(ongkirPerTrip(10)).toBe(250_000);
    expect(ongkirPerTrip(10.1)).toBe(450_000);
    expect(ongkirPerTrip(100)).toBe(1_400_000);
    expect(ongkirPerTrip(100.5)).toBe(1_412_000);
    expect(() => ongkirPerTrip(-1)).toThrow(RangeError);
  });
  it("rincian baris dan total", () => {
    const b = hitungBiaya({
      trip: 2,
      jarakKm: 20,
      pasang: [{ kelas: "mobil", luasM2: 10 }, { kelas: "pejalan", luasM2: 0 }],
      material: { pcs: 100, hargaPerPcs: 3000 },
    });
    expect(b.baris.map((x) => x.kode)).toEqual(["material", "ongkir", "pasang"]);
    expect(b.baris[1].subtotal).toBe(900_000);
    expect(b.baris[2].subtotal).toBe(500_000);
    expect(b.total).toBe(300_000 + 900_000 + 500_000);
    expect(b.baris.find((x) => x.kode === "material")?.sementara).toBe(false);
  });
  it("tanpa trip -> tanpa ongkir", () => {
    expect(hitungBiaya({ trip: 0, jarakKm: 5, pasang: [] })).toEqual({ baris: [], total: 0 });
  });
});

describe("hitungProyek + daftar belanja", () => {
  const h = hitungProyek(
    [
      { id: "a1", label: "Carport", produkId: "truepave", luasKotorM2: 30, lubangM2: [2], kelas: "mobil", kelilingM: 24 },
      { id: "a2", label: "Taman", produkId: "grass", luasKotorM2: 10, bentuk: "tak-simetris" },
    ],
    { jarakKm: 15, sertakanKanstin: true },
  );
  it("menggabungkan semuanya", () => {
    expect(h.totalLuasBersihM2).toBe(38);
    expect(h.areas[0].tebalCm).toBe(8);
    expect(h.areas[1].kelas).toBe("pejalan");
    expect(h.material.kanstinPcs).toBe(40);
    expect(h.logistik.trip).toBeGreaterThan(0);
    expect(h.biaya?.total).toBeGreaterThan(0);
  });
  it("tebal di bawah minimum diberi peringatan", () => {
    const x = hitungProyek([{ id: "z", produkId: "fp21", luasKotorM2: 5, kelas: "mobil", tebalCm: 6 }]);
    expect(x.peringatan.length).toBe(1);
  });
  it("tanpa jarak tidak ada biaya", () => {
    expect(hitungProyek([{ id: "a", produkId: "fp21", luasKotorM2: 5 }]).biaya).toBeUndefined();
  });
  it("lubang > luas menggagalkan proyek", () => {
    expect(() => hitungProyek([{ id: "a", produkId: "fp21", luasKotorM2: 5, lubangM2: [6] }])).toThrow(RangeError);
  });
  it("baris WA hanya menambah: tanpa paving, kanstin, abu batu, dan biaya", () => {
    const lines = daftarBelanjaLines(h);
    expect(lines.every((l) => typeof l === "string")).toBe(true);
    expect(lines[0]).toMatch(/^• Beban mobil \/ carport: tebal minimal 8 cm/);
    expect(lines.some((l) => l.startsWith("• Pasir alas*"))).toBe(true);
    expect(lines.some((l) => l.startsWith("• Sirtu / base course*"))).toBe(true);
    expect(lines.some((l) => l.startsWith("• Pengiriman*"))).toBe(true);
    expect(lines.join("\n")).not.toMatch(/Total paving|Total luas|Kanstin|Abu batu|Ongkir|Jasa pasang|Perkiraan total|Rp/);
    expect(lines[lines.length - 1]).toMatch(/^\* Perkiraan sementara/);
  });
  it("tanpaSirtu membuang baris sirtu", () => {
    expect(daftarBelanjaLines(h, { tanpaSirtu: true }).some((l) => l.includes("Sirtu"))).toBe(false);
  });
  it("tanpaPasir membuang pasir alas; catatan tebal hanya bila beda dari 5 cm", () => {
    const sama = daftarBelanjaLines(h, { tanpaPasir: true });
    expect(sama.some((l) => l.includes("Pasir alas"))).toBe(false);
    expect(sama.some((l) => l.includes("Tebal alas disarankan"))).toBe(false); // mobil: 5 cm
    const beda = hitungProyek([{ id: "p", produkId: "truepave", luasKotorM2: 10, kelas: "pejalan" }]);
    expect(daftarBelanjaLines(beda, { tanpaPasir: true }).some((l) => l.startsWith("• Tebal alas disarankan 3 cm"))).toBe(true);
    expect(daftarBelanjaLines(h).some((l) => l.startsWith("• Pasir alas*"))).toBe(true);
  });
  it("TAMPILKAN_BIAYA mati secara bawaan", () => {
    expect(TAMPILKAN_BIAYA).toBe(false);
  });
  it("pcsLayout + sisaPersen 0: pcs total dipakai apa adanya untuk palet dan trip", () => {
    const x = hitungProyek([{ id: "a", produkId: "truepave", luasKotorM2: 10, kelas: "mobil", pcsLayout: 353, sisaPersen: 0 }]);
    expect(x.totalPcsBeli).toBe(353);
    expect(x.logistik.paletTotal).toBe(2);
  });
  it("jarak di label ongkir memakai koma desimal", () => {
    expect(hitungBiaya({ trip: 1, jarakKm: 12.5, pasang: [] }).baris[0].label).toBe("Ongkir (12,5 km)");
  });
  it("proyek kosong -> tanpa baris", () => {
    expect(daftarBelanjaLines(hitungProyek([]))).toEqual([]);
  });
  it("daftarBelanjaWA memakai salam waMessage", () => {
    const t = daftarBelanjaWA(h, "https://x.test/p");
    expect(t.startsWith("Halo Istana Block")).toBe(true);
    expect(t).toContain("Lihat pola: https://x.test/p");
  });
});

describe("konstanta sementara", () => {
  it("setiap konstanta bertanda sementara", () => {
    expect(TEBAL_MIN_CM.pejalan.sementara).toBe(true);
    expect(PASIR_ALAS_CM.mobil.sementara).toBe(true);
    expect(DAFTAR_KONSTANTA_SEMENTARA.length).toBeGreaterThan(10);
  });
});
