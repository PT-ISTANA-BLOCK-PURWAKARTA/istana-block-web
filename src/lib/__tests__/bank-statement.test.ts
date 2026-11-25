import { describe, expect, it } from "vitest";
import { fingerprints, parseAmount, parseDate, parseStatement } from "@/lib/erp/bankStatement";

describe("parseAmount", () => {
  it("format KlikBCA (koma ribuan, titik desimal)", () => {
    expect(parseAmount("1,500,000.00")).toBe(1500000);
    expect(parseAmount("'1,500,000.00 DB")).toBe(-1500000);
    expect(parseAmount("250,000.00 CR")).toBe(250000);
  });
  it("format Indonesia & tanda minus", () => {
    expect(parseAmount("1.500.000,00")).toBe(1500000);
    expect(parseAmount("-75.000")).toBe(-75000);
    expect(parseAmount("(12.500)")).toBe(-12500);
    expect(parseAmount("")).toBeNull();
  });
});

describe("parseDate", () => {
  it("tanggal tanpa tahun memakai tahun periode; PEND dilewati", () => {
    expect(parseDate("'05/11", 2026)).toBe("2026-11-05");
    expect(parseDate("PEND", 2026)).toBeNull();
    expect(parseDate("5/11/26", null)).toBe("2026-11-05");
    expect(parseDate("2026-11-05", null)).toBe("2026-11-05");
  });
});

describe("parseStatement", () => {
  it("CSV KlikBCA individu: periode, DB/CR di kolom terpisah, PEND & saldo akhir dilewati", () => {
    const table = [
      ["No. rekening : '1234567890"],
      ["Nama : PT ISTANA BLOCK"],
      ["Periode : 01/11/2026 - 25/11/2026"],
      ["Kode Mata Uang : Rp"],
      [],
      ["Tanggal Transaksi", "Keterangan", "Cabang", "Jumlah", "", "Saldo"],
      ["'01/11", "TRSF E-BANKING CR 0111/FTSCY PELANGGAN A", "'0000", "5,000,000.00", "CR", "15,000,000.00"],
      ["'03/11", "BIAYA ADM", "'0000", "17,000.00", "DB", "14,983,000.00"],
      ["PEND", "TRSF PENDING", "'0000", "1,000.00", "DB", "14,982,000.00"],
      ["Saldo Akhir", "", "", "", "", "14,983,000.00"],
    ];
    const p = parseStatement(table);
    expect(p.accountNo).toBe("1234567890");
    expect(p.period).toEqual({ from: "2026-11-01", to: "2026-11-25" });
    expect(p.lines).toEqual([
      { date: "2026-11-01", description: "TRSF E-BANKING CR 0111/FTSCY PELANGGAN A", amount: 5000000, balance: 15000000 },
      { date: "2026-11-03", description: "BIAYA ADM", amount: -17000, balance: 14983000 },
    ]);
  });
  it("kolom Debet & Kredit terpisah", () => {
    const p = parseStatement([
      ["Tanggal", "Keterangan", "Debet", "Kredit", "Saldo"],
      ["02/11/2026", "Setoran tunai", "", "1.000.000,00", "2.000.000,00"],
      ["04/11/2026", "Bayar pemasok", "250.000,00", "", "1.750.000,00"],
    ]);
    expect(p.lines.map((l) => l.amount)).toEqual([1000000, -250000]);
  });
  it("sidik jari membedakan transaksi kembar di file yang sama", () => {
    const l = { date: "2026-11-01", description: "BIAYA ADM", amount: -17000, balance: null };
    const [a, b] = fingerprints([l, l]);
    expect(a).not.toBe(b);
  });
});
