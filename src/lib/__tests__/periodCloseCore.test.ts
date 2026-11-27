import { describe, expect, it } from "vitest";
import { can } from "@/lib/roles";
import { addMonths, closablePeriod, isMonthEnd, isPeriod, periodLockState, periodRange, periodsBetween, summarizeChecks } from "@/lib/erp/periodCloseCore";

describe("tutup buku — periode", () => {
  it("rentang & nama bulan, termasuk Februari kabisat", () => {
    expect(periodRange("2026-11")).toEqual({ from: "2026-11-01", to: "2026-11-30", label: "November 2026" });
    expect(periodRange("2028-02").to).toBe("2028-02-29");
    expect(periodRange("2026-02").to).toBe("2026-02-28");
    expect(periodRange("2026-12").to).toBe("2026-12-31");
  });

  it("validasi & aritmetika bulan lintas tahun", () => {
    expect(isPeriod("2026-11")).toBe(true);
    expect(isPeriod("2026-13")).toBe(false);
    expect(isPeriod("2026-1")).toBe(false);
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-05", -14)).toBe("2025-03");
    expect(periodsBetween("2026-11", "2027-02")).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
    expect(isMonthEnd("2026-11-30")).toBe(true);
    expect(isMonthEnd("2026-11-29")).toBe(false);
  });

  it("periode berikutnya yang boleh ditutup harus berurutan", () => {
    expect(closablePeriod("", "2026-05")).toBe("2026-05");
    expect(closablePeriod("2026-05-31", "2026-05")).toBe("2026-06");
    expect(closablePeriod("2026-12-31", "2026-05")).toBe("2027-01");
    // kunci lama di tengah bulan → bulan itu ditutup penuh berikutnya
    expect(closablePeriod("2026-11-15", "2026-05")).toBe("2026-11");
    // kunci lebih awal dari data pertama → mulai dari periode pertama
    expect(closablePeriod("2025-12-31", "2026-05")).toBe("2026-05");
  });

  it("status periode terhadap kunci", () => {
    expect(periodLockState("2026-11", "")).toBe("terbuka");
    expect(periodLockState("2026-11", "2026-11-30")).toBe("ditutup");
    expect(periodLockState("2026-10", "2026-11-30")).toBe("ditutup");
    expect(periodLockState("2026-11", "2026-11-15")).toBe("sebagian");
    expect(periodLockState("2026-12", "2026-11-30")).toBe("terbuka");
  });

  it("hanya pemilik & peran Tutup Buku yang boleh menutup buku", () => {
    expect(can(["owner"], "tutup_buku")).toBe(true);
    expect(can(["keuangan", "tutup_buku"], "tutup_buku")).toBe(true);
    expect(can(["keuangan"], "tutup_buku")).toBe(false);
    expect(can(["pimpinan"], "tutup_buku")).toBe(false);
    // peran Tutup Buku saja tidak membuka aplikasi Keuangan (harus digabung dengan peran Keuangan)
    expect(can(["tutup_buku"], "keuangan")).toBe(false);
  });

  it("ringkasan hasil analisa", () => {
    expect(summarizeChecks([{ status: "ok" }, { status: "masalah" }, { status: "perhatian" }, { status: "perhatian" }, { status: "info" }])).toEqual({ masalah: 1, perhatian: 2, ok: 1, info: 1 });
  });
});
