import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { buildAuditWorkbook } from "@/lib/erp/auditWorkbook";
import type { AuditData } from "@/lib/erp/periodClose";

const summary = {
  revenue: 10_000_000, cogs: 6_000_000, gross: 4_000_000, opex: 1_500_000, net: 2_500_000,
  assets: 50_000_000, liabilities: 20_000_000, equity: 30_000_000, balanced: true,
  cashOpening: 5_000_000, cashIn: 12_000_000, cashOut: 9_000_000, cashClosing: 8_000_000,
  stockFinished: 7_000_000, stockRaw: 3_000_000, glFinished: 7_000_000, glRaw: 3_200_000,
  receivable: 15_000_000, payable: 4_000_000, glReceivable: 15_000_000, glPayable: 4_000_000,
};

const line = (o: Partial<AuditData["lines"][number]>) => ({
  code: "1101", account: "Kas", date: "2026-10-05", number: "BKM/001", source: "kas", memo: "Setoran", lineMemo: "", contact: null, project: null,
  debit: 0, credit: 0, createdBy: "Rina", createdAt: 1_791_000_000, journalId: "j1", ...o,
});

const data = {
  company: "PT. Istana Block Purwakarta",
  lineCount: 3,
  analysis: {
    period: "2026-10", from: "2026-10-01", to: "2026-10-31", label: "Oktober 2026", generatedAt: "2026-11-27T08:00:00.000Z", lockDate: "2026-10-31",
    summary,
    counts: { masalah: 1, perhatian: 1, ok: 1, info: 0 },
    checks: [
      { key: "neraca_seimbang", area: "neraca", label: "Neraca seimbang", status: "ok", value: "Cocok." },
      { key: "bahan_nilai", area: "bahan_baku", label: "Nilai bahan baku", status: "perhatian", value: "Selisih Rp200.000", hint: "Opname bahan baku." },
      { key: "stok_minus", area: "stok", label: "Stok minus", status: "masalah", value: "1 barang minus." },
    ],
  },
  worksheet: [
    { code: "1101", name: "Kas", group: "kas_bank", section: "aset", open: 5_000_000, debit: 12_000_000, credit: 9_000_000, close: 8_000_000 },
    { code: "4101", name: "Penjualan", group: "pendapatan", section: "pendapatan", open: 0, debit: 0, credit: 10_000_000, close: -10_000_000 },
  ],
  lines: [
    line({ number: "BKM/001", debit: 12_000_000, journalId: "j1" }),
    line({ number: "BKK/001", date: "2026-10-09", memo: "Bayar solar", credit: 9_000_000, journalId: "j2", createdAt: 1_791_100_000 }),
    line({ code: "4101", account: "Penjualan", number: "FJ/001", source: "faktur", memo: "Faktur", credit: 10_000_000, contact: "CV Maju", journalId: "j3" }),
  ],
  stock: [
    { code: "PV-01", name: "Paving K300", unit: "m2", kind: "barang_jadi", openQty: 100, openValue: 5_000_000, inQty: 80, inValue: 4_000_000, outQty: 40, outValue: 2_000_000, closeQty: 140, closeValue: 7_000_000 },
    { code: "BB-01", name: "Pasir", unit: "m3", kind: "bahan_baku", openQty: 10, openValue: 2_000_000, inQty: 10, inValue: 2_000_000, outQty: 5, outValue: 1_000_000, closeQty: 15, closeValue: 3_000_000 },
  ],
  profitLoss: { rows: [{ code: "4101", name: "Penjualan", group: "pendapatan", balance: 10_000_000 }], revenue: 10_000_000, cogs: 6_000_000, gross: 4_000_000, opex: 1_500_000, otherIncome: 0, otherExpense: 0, net: 2_500_000 },
  profitLossYtd: { rows: [{ code: "4101", balance: 80_000_000 }, { code: "5101", balance: 5_000_000 }], net: 20_000_000 },
  balanceSheet: {
    assets: [{ code: "1101", name: "Kas", group: "kas_bank", balance: 8_000_000 }, { code: "1701", name: "Akum. penyusutan", group: "akum_penyusutan", balance: -2_000_000 }],
    liabilities: [{ code: "2101", name: "Hutang usaha", group: "hutang_usaha", balance: 4_000_000 }],
    equity: [{ code: "3101", name: "Modal", group: "modal", balance: 2_000_000 }],
    assetTotal: 6_000_000, liabTotal: 4_000_000, equityTotal: 2_000_000, priorYears: 0, currentYear: 0, balanced: true,
  },
  cashFlow: { opening: 5_000_000, closing: 8_000_000, totalIn: 12_000_000, totalOut: 9_000_000, inflow: [{ code: "1201", name: "Piutang", amount: 12_000_000 }], outflow: [{ code: "6101", name: "Solar", amount: 9_000_000 }], perAccount: [{ code: "1101", name: "Kas", opening: 5_000_000, closing: 8_000_000 }] },
  receivables: [
    { contact: "CV Maju", number: "FJ/001", date: "2026-10-01", dueDate: "2026-11-15", total: 10_000_000, paid: 0, open: 10_000_000, overdue: -15 },
    { contact: "PT Lama", number: "FJ/090", date: "2026-06-01", dueDate: "2026-07-28", total: 5_000_000, paid: 0, open: 5_000_000, overdue: 95 },
  ],
  payables: [{ contact: "Toko Solar", number: "FB/001", date: "2026-10-02", dueDate: "2026-10-20", total: 4_000_000, paid: 0, open: 4_000_000, overdue: 11 }],
  assets: [{ code: "AT-01", name: "Truk", acquired: "2025-01-10", cost: 300_000_000, openingAccum: 50_000_000, dep: 10_000_000, disposed: null, accum: 60_000_000 }],
  activity: [{ at: 1_791_000_100, userName: "Rina", action: "keuangan.kas", label: "Kas keluar", summary: "BKK/001", success: 1 }],
  closes: [{ status: "ditutup", closedByName: "Rina", closedAt: 1_793_000_000, note: "Selisih pasir menunggu opname", issues: 1, warnings: 1, reopenedByName: null, reopenedAt: null, reopenReason: null }],
} as unknown as AuditData;

const meta = { printedBy: "Rina", printedAt: "2026-11-27T08:00:00.000Z" };
type Row = (string | number | null)[];
const rows = (wb: XLSX.WorkBook, name: string): Row[] => XLSX.utils.sheet_to_json<Row>(wb.Sheets[name], { header: 1, range: 6, defval: null });
const find = (rs: Row[], pred: (r: Row) => boolean) => {
  const r = rs.find(pred);
  if (!r) throw new Error("baris tidak ditemukan");
  return r;
};

describe("paket audit Excel", () => {
  const wb = buildAuditWorkbook(XLSX, data, meta);

  it("berisi 15 sheet dengan nama unik ≤ 31 huruf", () => {
    expect(wb.SheetNames).toEqual([
      "Ringkasan", "Hasil Analisa", "Neraca", "Laba Rugi", "Arus Kas", "Neraca Lajur", "Buku Besar", "Jurnal",
      "Persediaan Barang Jadi", "Bahan Baku", "Umur Piutang", "Umur Hutang", "Aset Tetap", "Jejak Audit", "Riwayat Tutup Buku",
    ]);
    expect(new Set(wb.SheetNames).size).toBe(wb.SheetNames.length);
    for (const n of wb.SheetNames) expect(n.length).toBeLessThanOrEqual(31);
  });

  it("kop perusahaan, judul, periode di setiap sheet", () => {
    for (const n of wb.SheetNames) {
      const ws = wb.Sheets[n];
      expect(ws.A1.v).toBe("PT. Istana Block Purwakarta");
      expect(String(ws.A4.v)).toContain("oleh Rina");
      expect(ws["!merges"]?.length).toBe(4);
    }
    expect(String(wb.Sheets.Ringkasan.A3.v)).toContain("Oktober 2026");
    const status = find(rows(wb, "Ringkasan"), (r) => r[0] === "Status tutup buku");
    expect(String(status[1])).toContain("Ditutup oleh Rina");
  });

  it("buku besar: saldo berjalan dari saldo awal sampai saldo akhir", () => {
    const gl = rows(wb, "Buku Besar").filter((r) => r[0] === "1101");
    expect(gl[0][4]).toBe("Saldo awal");
    expect(gl[0][9]).toBe(5_000_000);
    expect(gl[1][9]).toBe(17_000_000);
    expect(gl[2][9]).toBe(8_000_000);
    const end = find(gl, (r) => r[4] === "Saldo akhir");
    expect([end[7], end[8], end[9]]).toEqual([12_000_000, 9_000_000, 8_000_000]);
    const sales = find(rows(wb, "Buku Besar"), (r) => r[0] === "4101" && r[4] === "Saldo akhir");
    expect(sales[9]).toBe(-10_000_000);
  });

  it("neraca lajur & jurnal: total debit/kredit", () => {
    const total = find(rows(wb, "Neraca Lajur"), (r) => r[1] === "TOTAL");
    expect([total[3], total[4], total[5], total[6]]).toEqual([5_000_000, 12_000_000, 19_000_000, -2_000_000]);
    const j = rows(wb, "Jurnal");
    const jt = find(j, (r) => r[3] === "TOTAL");
    expect([jt[9], jt[10]]).toEqual([12_000_000, 19_000_000]);
    expect(j[0][2]).toBe("Kas & bank");
    expect(j[0][11]).toBe("Rina");
  });

  it("persediaan: selisih akun − kartu stok, umur piutang per kelompok", () => {
    const diff = find(rows(wb, "Bahan Baku"), (r) => String(r[1]).startsWith("Selisih"));
    expect(diff[10]).toBe(200_000);
    const fin = find(rows(wb, "Persediaan Barang Jadi"), (r) => String(r[1]).startsWith("Selisih"));
    expect(fin[10]).toBe(0);
    const ar = rows(wb, "Umur Piutang");
    expect(find(ar, (r) => r[1] === "FJ/001")[8]).toBe("Belum jatuh tempo");
    expect(find(ar, (r) => r[1] === "FJ/090")[8]).toBe("> 90 hari");
    expect(find(ar, (r) => r[1] === "TOTAL")[6]).toBe(15_000_000);
  });

  it("laba rugi tahun berjalan ikut rekening tanpa mutasi bulan ini; akumulasi penyusutan mengurangi aset", () => {
    const pl = rows(wb, "Laba Rugi");
    expect(find(pl, (r) => r[0] === "5101")[4]).toBe(5_000_000);
    expect(find(pl, (r) => r[1] === "LABA BERSIH").slice(3, 5)).toEqual([2_500_000, 20_000_000]);
    expect(find(rows(wb, "Neraca"), (r) => r[0] === "1701")[3]).toBe(-2_000_000);
  });

  it("format ribuan pada kolom rupiah & berkas bisa ditulis ulang", () => {
    expect(wb.Sheets.Neraca.D8.z).toBe("#,##0;(#,##0);-");
    expect(wb.Sheets["Buku Besar"].J7.z).toBe("#,##0;(#,##0);-");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx", compression: true });
    const back = XLSX.read(buf, { type: "buffer" });
    expect(back.SheetNames).toEqual(wb.SheetNames);
  });
});
