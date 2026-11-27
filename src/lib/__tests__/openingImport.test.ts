import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { agingBucket, normName, openingNumber, openingTotal, parseAmount, parseDay, readOpeningTable } from "@/lib/erp/openingImport";

const csv = (file: string) => readFileSync(path.resolve(__dirname, "../../../scripts/impor-zahir/data", file), "utf8").trim().split(/\r?\n/).map((l) => l.split(","));

describe("parseAmount", () => {
  it("membaca format Indonesia & Inggris", () => {
    expect(parseAmount("1.234.567,50")).toBe(1234567.5);
    expect(parseAmount("1,234,567.50")).toBe(1234567.5);
    expect(parseAmount("432,737,454.75")).toBe(432737454.75);
    expect(parseAmount("1.000")).toBe(1000);
    expect(parseAmount("Rp 87.000")).toBe(87000);
    expect(parseAmount("-76,50")).toBe(-76.5);
    expect(parseAmount("(1.000)")).toBe(-1000);
    expect(parseAmount(250)).toBe(250);
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("")).toBeNull();
  });
});

describe("parseDay", () => {
  it("dd/mm/yyyy, ISO, nomor seri Excel", () => {
    expect(parseDay("27/11/2026")).toBe("2026-11-27");
    expect(parseDay("2026-11-27")).toBe("2026-11-27");
    expect(parseDay("2/4/2021")).toBe("2021-04-02");
    expect(parseDay(46353)).toBe("2026-11-27");
    expect(parseDay("31/13/2026")).toBeNull();
  });
});

describe("agingBucket", () => {
  const asOf = "2026-11-27";
  it("0 = belum jatuh tempo, lalu 1–30, 31–60, 61–90, > 90 hari", () => {
    expect(agingBucket("2026-12-21", asOf)).toBe(0);
    expect(agingBucket("2026-11-27", asOf)).toBe(0);
    expect(agingBucket("2026-11-26", asOf)).toBe(1);
    expect(agingBucket("2026-10-28", asOf)).toBe(1);
    expect(agingBucket("2026-10-27", asOf)).toBe(2);
    expect(agingBucket("2026-09-28", asOf)).toBe(2);
    expect(agingBucket("2026-09-27", asOf)).toBe(3);
    expect(agingBucket("2026-08-29", asOf)).toBe(3);
    expect(agingBucket("2026-08-28", asOf)).toBe(4);
  });
});

describe("readOpeningTable", () => {
  it("membaca rincian piutang Zahir 27 Nov 2026 dan totalnya sama dengan laporan", () => {
    const { rows, errors } = readOpeningTable(csv("piutang-rincian-2026-11-27.csv"));
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(71);
    // Grand total laporan Zahir: 69.717.400 + 107.670.600 + 307.130.670 + 921.171.833,50
    expect(rows.reduce((s, r) => s + r.balance, 0)).toBeCloseTo(1405690503.5, 2);
    expect(openingTotal(rows)).toBe(1405690504); // dua faktur ,75 dibulatkan ke atas (+0,50)
    expect(openingNumber(rows[0])).toBe("SJ/00000378");
  });
  it("membaca rincian hutang, termasuk saldo minus (lebih bayar)", () => {
    const { rows, errors } = readOpeningTable(csv("hutang-rincian-2026-11-27.csv"));
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(57);
    expect(rows.reduce((s, r) => s + r.balance, 0)).toBeCloseTo(428781501.94, 2);
    expect(rows.some((r) => r.balance < 0)).toBe(true);
  });
  it("judul di baris mana saja, melewati baris saldo/total, menolak dobel & data rusak", () => {
    const { rows, errors } = readOpeningTable([
      ["Piutang Usaha Per Pelanggan - Rincian"],
      [],
      ["Kode", "Nama Pelanggan", "Tanggal", "Jatuh Tempo", "Tp", "No. Ref", "Sisa"],
      ["CUST-1", "BPK. A", "01/11/2026", "01/11/2026", "SJ", "001", "1.000.000"],
      ["", "Saldo :", "", "", "", "", "1.000.000"],
      ["CUST-1", "Bpk A", "02/11/2026", "", "SJ", "001", "5"],
      ["CUST-2", "B", "xx", "", "SJ", "002", "5"],
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].balance).toBe(1000000);
    expect(rows[1].dueDate).toBe("2026-11-02");
    expect(errors.some((e) => e.includes("tanggal tidak terbaca"))).toBe(true);
    expect(errors.some((e) => e.includes("dua kali"))).toBe(true);
  });
  it("tanpa kolom wajib → kesalahan jelas", () => {
    expect(readOpeningTable([["Nama", "Tanggal"], ["A", "01/01/2026"]]).errors[0]).toMatch(/Judul kolom/);
  });
  it("normName menyamakan tanda baca & huruf", () => {
    expect(normName("BPK. PI`I")).toBe(normName("Bpk Pi I"));
  });
});

describe("umur piutang dari file = kolom laporan Zahir 27 Nov 2026", () => {
  it("0–30 (termasuk belum jatuh tempo), 31–60, 61–90, > 90", () => {
    const { rows } = readOpeningTable(csv("piutang-rincian-2026-11-27.csv"));
    const b = [0, 0, 0, 0, 0];
    for (const r of rows) b[agingBucket(r.dueDate, "2026-11-27")] += r.balance;
    expect(b[0] + b[1]).toBeCloseTo(69717400, 2);
    expect(b[2]).toBeCloseTo(107670600, 2);
    expect(b[3]).toBeCloseTo(307130670, 2);
    expect(b[4]).toBeCloseTo(921171833.5, 2);
  });
});
