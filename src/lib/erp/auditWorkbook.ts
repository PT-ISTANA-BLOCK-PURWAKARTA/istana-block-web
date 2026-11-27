// Paket audit tutup buku → satu berkas Excel (SheetJS, dirangkai di browser; tanpa server-only).
// Tiap sheet berkop "PT. Istana Block Purwakarta", judul, periode, dan waktu cetak; angka rupiah berformat ribuan.
import type { XLSXModule } from "@/lib/ops/excel";
import type { AuditData } from "./periodClose";
import { AREA_LABEL, periodRange, STATUS_LABEL } from "./periodCloseCore";

type Cell = string | number | null;
type Sheet = import("xlsx").WorkSheet;
export type AuditMeta = { printedBy: string; printedAt: string };

const MONEY = "#,##0;(#,##0);-";
const QTY = "#,##0.##;(#,##0.##);-";
const GROUP: Record<string, string> = {
  kas_bank: "Kas & bank", piutang: "Piutang", persediaan: "Persediaan", aset_lancar_lain: "Aset lancar lainnya", aset_tetap: "Aset tetap",
  akum_penyusutan: "Akumulasi penyusutan", hutang_usaha: "Hutang usaha", hutang_lain: "Kewajiban lancar lainnya", modal: "Modal",
  pendapatan: "Pendapatan", hpp: "Harga pokok penjualan", beban: "Beban usaha", pendapatan_lain: "Pendapatan lain-lain", beban_lain: "Beban lain-lain",
};
const dmy = (d: string | null | undefined) => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : d ?? "");
const wib = (sec: number | null | undefined) =>
  sec ? new Date(Number(sec) * 1000).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
const SOURCE: Record<string, string> = { manual: "Jurnal umum", faktur: "Faktur penjualan", penerimaan: "Penerimaan", pembelian: "Faktur pembelian", pembayaran: "Pembayaran", kas: "Kas & bank", pengiriman: "Surat jalan (HPP)", produksi: "Produksi", penyesuaian: "Penyesuaian stok", zahir: "Impor Zahir", penyusutan: "Penyusutan", retur: "Retur", giro: "Giro" };

/** Satu sheet berkop: baris 1-4 kop & judul, baris 6 judul kolom, data mulai baris 7. */
function sheet(XLSX: XLSXModule, o: { company: string; title: string; sub: string; meta: AuditMeta; head: string[]; rows: Cell[][]; widths: number[]; money?: number[]; qty?: number[] }): Sheet {
  const aoa: Cell[][] = [
    [o.company],
    [o.title],
    [o.sub],
    [`Dicetak ${new Date(o.meta.printedAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "long", timeStyle: "short" })} oleh ${o.meta.printedBy}`],
    [],
    o.head,
    ...o.rows,
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const width = o.head.length;
  ws["!merges"] = [0, 1, 2, 3].map((r) => ({ s: { r, c: 0 }, e: { r, c: Math.max(0, width - 1) } }));
  ws["!cols"] = o.widths.map((wch) => ({ wch }));
  const fmt = (cols: number[] | undefined, z: string) => {
    for (const c of cols ?? []) {
      for (let r = 6; r < aoa.length; r++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (cell && cell.t === "n") cell.z = z;
      }
    }
  };
  fmt(o.money, MONEY);
  fmt(o.qty, QTY);
  if (o.rows.length) ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 5, c: 0 }, e: { r: 5 + o.rows.length, c: width - 1 } }) };
  return ws;
}

export function buildAuditWorkbook(XLSX: XLSXModule, d: AuditData, meta: AuditMeta) {
  const a = d.analysis;
  const s = a.summary;
  const { label } = periodRange(a.period);
  const sub = `Periode ${label} (${dmy(a.from)} s.d. ${dmy(a.to)})`;
  const base = { company: d.company, meta };
  const wb = XLSX.utils.book_new();
  const add = (name: string, ws: Sheet) => XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  const closed = d.closes.filter((c) => c.status === "ditutup").at(-1);

  /* 1. Ringkasan */
  const sumRows: Cell[][] = [
    ["Periode", label],
    ["Status tutup buku", closed ? `Ditutup oleh ${closed.closedByName} pada ${wib(closed.closedAt)}` : "Belum ditutup — hasil analisa sementara"],
    ["Kunci transaksi s.d.", a.lockDate ? dmy(a.lockDate) : "-"],
    ["Hasil analisa", `${a.counts.masalah} masalah · ${a.counts.perhatian} perhatian · ${a.counts.ok} sesuai · ${a.counts.info} info`],
    ...(closed?.note ? [["Catatan saat tutup", closed.note] as Cell[]] : []),
    [],
    ["LABA RUGI", null],
    ["Pendapatan", s.revenue], ["Harga pokok penjualan", s.cogs], ["Laba kotor", s.gross], ["Beban usaha", s.opex], ["Laba bersih", s.net],
    [],
    ["NERACA (akhir periode)", null],
    ["Total aset", s.assets], ["Total kewajiban", s.liabilities], ["Total modal (termasuk laba)", s.equity], ["Neraca seimbang", s.balanced ? "Ya" : "TIDAK"],
    [],
    ["ARUS KAS", null],
    ["Saldo awal kas & bank", s.cashOpening], ["Uang masuk", s.cashIn], ["Uang keluar", s.cashOut], ["Saldo akhir kas & bank", s.cashClosing],
    [],
    ["REKONSILIASI BUKU PEMBANTU", null],
    ["Persediaan barang jadi — kartu stok", s.stockFinished], ["Persediaan barang jadi — saldo akun", s.glFinished], ["Selisih barang jadi", s.glFinished - s.stockFinished],
    ["Bahan baku — kartu stok", s.stockRaw], ["Bahan baku — saldo akun", s.glRaw], ["Selisih bahan baku", s.glRaw - s.stockRaw],
    ["Piutang — rincian faktur", s.receivable], ["Piutang — saldo akun", s.glReceivable], ["Selisih piutang", s.glReceivable - s.receivable],
    ["Hutang — rincian faktur", s.payable], ["Hutang — saldo akun", s.glPayable], ["Selisih hutang", s.glPayable - s.payable],
    [],
    ["PENGESAHAN", null],
    ["Disiapkan oleh (Keuangan)", "Nama:                              Tanda tangan:                              Tanggal:"],
    ["Diperiksa oleh", "Nama:                              Tanda tangan:                              Tanggal:"],
    ["Disetujui oleh (Pimpinan)", "Nama:                              Tanda tangan:                              Tanggal:"],
  ];
  add("Ringkasan", sheet(XLSX, { ...base, title: "PAKET AUDIT — RINGKASAN TUTUP BUKU", sub, head: ["Pos", "Nilai"], rows: sumRows, widths: [42, 70], money: [1] }));

  /* 2. Hasil analisa */
  add("Hasil Analisa", sheet(XLSX, {
    ...base, title: "HASIL ANALISA SEBELUM TUTUP BUKU", sub,
    head: ["Bidang", "Pemeriksaan", "Status", "Hasil", "Saran / keterangan"],
    rows: a.checks.map((c) => [AREA_LABEL[c.area], c.label, STATUS_LABEL[c.status], c.value, c.hint ?? ""]),
    widths: [24, 52, 12, 80, 70],
  }));

  /* 3. Neraca */
  const bs = d.balanceSheet;
  const bsRows: Cell[][] = [
    ["ASET", null, null, null],
    ...bs.assets.map((r) => [r.code, r.name, GROUP[r.group] ?? r.group, r.balance] as Cell[]),
    [null, "Total aset", null, bs.assetTotal],
    [],
    ["KEWAJIBAN", null, null, null],
    ...bs.liabilities.map((r) => [r.code, r.name, GROUP[r.group] ?? r.group, r.balance] as Cell[]),
    [null, "Total kewajiban", null, bs.liabTotal],
    [],
    ["MODAL", null, null, null],
    ...bs.equity.map((r) => [r.code, r.name, GROUP[r.group] ?? r.group, r.balance] as Cell[]),
    [null, "Laba ditahan (tahun-tahun lalu)", null, bs.priorYears],
    [null, "Laba tahun berjalan", null, bs.currentYear],
    [null, "Total modal", null, bs.equityTotal],
    [],
    [null, "Total kewajiban + modal", null, bs.liabTotal + bs.equityTotal],
    [null, bs.balanced ? "Neraca seimbang" : "NERACA TIDAK SEIMBANG", null, bs.assetTotal - bs.liabTotal - bs.equityTotal],
  ];
  add("Neraca", sheet(XLSX, { ...base, title: "NERACA", sub: `Per ${dmy(a.to)}`, head: ["Kode", "Rekening", "Kelompok", "Saldo"], rows: bsRows, widths: [12, 46, 26, 20], money: [3] }));

  /* 4. Laba rugi */
  const ytd = new Map(d.profitLossYtd.rows.map((r) => [r.code, r.balance]));
  const plRows: Cell[][] = d.profitLoss.rows.map((r) => [r.code, r.name, GROUP[r.group] ?? r.group, r.balance, ytd.get(r.code) ?? 0]);
  for (const code of ytd.keys()) if (!d.profitLoss.rows.some((r) => r.code === code)) plRows.push([code, "(tidak ada mutasi bulan ini)", null, 0, ytd.get(code) ?? 0]);
  const pl = d.profitLoss;
  plRows.push([], [null, "Pendapatan", null, pl.revenue, null], [null, "Harga pokok penjualan", null, pl.cogs, null], [null, "Laba kotor", null, pl.gross, null], [null, "Beban usaha", null, pl.opex, null], [null, "Pendapatan lain-lain", null, pl.otherIncome, null], [null, "Beban lain-lain", null, pl.otherExpense, null], [null, "LABA BERSIH", null, pl.net, d.profitLossYtd.net]);
  add("Laba Rugi", sheet(XLSX, { ...base, title: "LAPORAN LABA RUGI", sub, head: ["Kode", "Rekening", "Kelompok", `Periode ${label}`, `1 Jan s.d. ${dmy(a.to)}`], rows: plRows, widths: [12, 46, 26, 20, 20], money: [3, 4] }));

  /* 5. Arus kas */
  const cf = d.cashFlow;
  const cfRows: Cell[][] = [
    [null, "Saldo awal kas & bank", cf.opening],
    [],
    ["UANG MASUK", null, null],
    ...cf.inflow.map((r) => [r.code, r.name, r.amount] as Cell[]),
    [null, "Total uang masuk", cf.totalIn],
    [],
    ["UANG KELUAR", null, null],
    ...cf.outflow.map((r) => [r.code, r.name, r.amount] as Cell[]),
    [null, "Total uang keluar", cf.totalOut],
    [],
    [null, "Saldo akhir kas & bank", cf.closing],
    [],
    ["PER REKENING", "Saldo awal → saldo akhir", null],
    ...cf.perAccount.flatMap((p) => [[p.code, `${p.name} — saldo awal`, p.opening], [p.code, `${p.name} — saldo akhir`, p.closing]] as Cell[][]),
  ];
  add("Arus Kas", sheet(XLSX, { ...base, title: "LAPORAN ARUS KAS (METODE LANGSUNG)", sub, head: ["Kode", "Uraian", "Jumlah"], rows: cfRows, widths: [12, 60, 20], money: [2] }));

  /* 6. Neraca lajur */
  const wsRows: Cell[][] = d.worksheet.map((r) => [r.code, r.name, GROUP[r.group] ?? r.group, r.open, r.debit, r.credit, r.close]);
  wsRows.push([null, "TOTAL", null, d.worksheet.reduce((x, r) => x + r.open, 0), d.worksheet.reduce((x, r) => x + r.debit, 0), d.worksheet.reduce((x, r) => x + r.credit, 0), d.worksheet.reduce((x, r) => x + r.close, 0)]);
  add("Neraca Lajur", sheet(XLSX, { ...base, title: "NERACA LAJUR (NERACA SALDO)", sub: `${sub} · saldo bertanda: + debit, − kredit`, head: ["Kode", "Rekening", "Kelompok", "Saldo awal", "Mutasi debit", "Mutasi kredit", "Saldo akhir"], rows: wsRows, widths: [12, 44, 24, 18, 18, 18, 18], money: [3, 4, 5, 6] }));

  /* 7. Buku besar per rekening */
  const opening = new Map(d.worksheet.map((r) => [r.code, r.open]));
  const byAcc = new Map<string, typeof d.lines>();
  for (const l of d.lines) { const arr = byAcc.get(l.code); if (arr) arr.push(l); else byAcc.set(l.code, [l]); }
  const gl: Cell[][] = [];
  for (const w of d.worksheet) {
    const ls = byAcc.get(w.code) ?? [];
    let bal = opening.get(w.code) ?? 0;
    gl.push([w.code, w.name, null, null, "Saldo awal", null, null, null, null, bal]);
    for (const l of ls) {
      bal += l.debit - l.credit;
      gl.push([w.code, w.name, dmy(l.date), l.number, [l.memo, l.lineMemo].filter(Boolean).join(" — "), l.contact ?? "", l.project ?? "", l.debit, l.credit, bal]);
    }
    gl.push([w.code, w.name, null, null, "Saldo akhir", null, null, ls.reduce((x, l) => x + l.debit, 0), ls.reduce((x, l) => x + l.credit, 0), bal]);
  }
  add("Buku Besar", sheet(XLSX, { ...base, title: "BUKU BESAR", sub: `${sub} · saldo bertanda: + debit, − kredit`, head: ["Kode", "Rekening", "Tanggal", "No. bukti", "Keterangan", "Kontak", "Proyek", "Debit", "Kredit", "Saldo"], rows: gl, widths: [10, 30, 12, 18, 60, 26, 14, 16, 16, 18], money: [7, 8, 9] }));

  /* 8. Jurnal (urut waktu, dengan pembuat & waktu input) */
  const jr: Cell[][] = [...d.lines]
    .sort((x, y) => x.date.localeCompare(y.date) || x.createdAt - y.createdAt || x.number.localeCompare(y.number))
    .map((l) => [dmy(l.date), l.number, SOURCE[l.source] ?? l.source, l.memo, l.code, l.account, l.lineMemo, l.contact ?? "", l.project ?? "", l.debit, l.credit, l.createdBy ?? "", wib(l.createdAt)]);
  jr.push([null, null, null, "TOTAL", null, null, null, null, null, d.lines.reduce((x, l) => x + l.debit, 0), d.lines.reduce((x, l) => x + l.credit, 0), null, null]);
  add("Jurnal", sheet(XLSX, { ...base, title: "DAFTAR JURNAL", sub, head: ["Tanggal", "No. bukti", "Sumber", "Keterangan bukti", "Kode", "Rekening", "Keterangan baris", "Kontak", "Proyek", "Debit", "Kredit", "Dicatat oleh", "Waktu input"], rows: jr, widths: [12, 18, 18, 50, 10, 30, 36, 26, 14, 16, 16, 18, 18], money: [9, 10] }));

  /* 9-10. Persediaan barang jadi & bahan baku */
  for (const [kind, title, name, gl0] of [["barang_jadi", "PERSEDIAAN BARANG JADI", "Persediaan Barang Jadi", s.glFinished], ["bahan_baku", "PERSEDIAAN BAHAN BAKU", "Bahan Baku", s.glRaw]] as const) {
    const items = d.stock.filter((x) => x.kind === kind);
    const rows: Cell[][] = items.map((x) => [x.code, x.name, x.unit, x.openQty, x.openValue, x.inQty, x.inValue, x.outQty, x.outValue, x.closeQty, x.closeValue]);
    const sum = (f: (x: (typeof items)[number]) => number) => items.reduce((t, x) => t + f(x), 0);
    rows.push([null, "TOTAL", null, null, sum((x) => x.openValue), null, sum((x) => x.inValue), null, sum((x) => x.outValue), null, sum((x) => x.closeValue)]);
    rows.push([null, "Saldo akun persediaan (buku besar)", null, null, null, null, null, null, null, null, gl0]);
    rows.push([null, "Selisih (akun − kartu stok)", null, null, null, null, null, null, null, null, gl0 - sum((x) => x.closeValue)]);
    add(name, sheet(XLSX, { ...base, title, sub: `${sub} · kartu stok (kuantitas & nilai rata-rata)`, head: ["Kode", "Barang", "Satuan", "Awal qty", "Awal nilai", "Masuk qty", "Masuk nilai", "Keluar qty", "Keluar nilai", "Akhir qty", "Akhir nilai"], rows, widths: [12, 40, 8, 12, 16, 12, 16, 12, 16, 12, 16], money: [4, 6, 8, 10], qty: [3, 5, 7, 9] }));
  }

  /* 11-12. Umur piutang & hutang */
  const bucket = (o: number) => (o <= 0 ? "Belum jatuh tempo" : o <= 30 ? "1–30 hari" : o <= 60 ? "31–60 hari" : o <= 90 ? "61–90 hari" : "> 90 hari");
  for (const [rowsSrc, title, name, who] of [[d.receivables, "UMUR PIUTANG", "Umur Piutang", "Pelanggan"], [d.payables, "UMUR HUTANG", "Umur Hutang", "Pemasok"]] as const) {
    const rows: Cell[][] = rowsSrc.map((x) => [x.contact, x.number, dmy(x.date), dmy(x.dueDate), x.total, x.paid, x.open, Math.max(0, x.overdue), bucket(x.overdue)]);
    rows.push([null, "TOTAL", null, null, rowsSrc.reduce((t, x) => t + x.total, 0), rowsSrc.reduce((t, x) => t + x.paid, 0), rowsSrc.reduce((t, x) => t + x.open, 0), null, null]);
    add(name, sheet(XLSX, { ...base, title, sub: `Per ${dmy(a.to)}`, head: [who, "No. faktur", "Tanggal", "Jatuh tempo", "Total", "Dibayar", "Sisa", "Hari lewat", "Umur"], rows, widths: [34, 20, 12, 12, 16, 16, 16, 10, 18], money: [4, 5, 6] }));
  }

  /* 13. Aset tetap */
  add("Aset Tetap", sheet(XLSX, {
    ...base, title: "DAFTAR HARTA TETAP", sub: `Per ${dmy(a.to)}`,
    head: ["Kode", "Aset", "Tgl perolehan", "Harga perolehan", "Akum. penyusutan", "Nilai buku", "Dilepas"],
    rows: d.assets.map((x) => [x.code, x.name, dmy(x.acquired), x.cost, x.accum, x.cost - x.accum, x.disposed ? dmy(x.disposed) : ""]),
    widths: [12, 40, 14, 18, 18, 18, 12], money: [3, 4, 5],
  }));

  /* 14. Jejak audit & riwayat tutup buku */
  add("Jejak Audit", sheet(XLSX, {
    ...base, title: "JEJAK AUDIT (AKTIVITAS KEUANGAN)", sub,
    head: ["Waktu", "Pengguna", "Aksi", "Keterangan", "Ringkasan", "Berhasil"],
    rows: d.activity.map((x) => [wib(x.at), x.userName ?? "", x.action, x.label, x.summary ?? "", x.success ? "Ya" : "Tidak"]),
    widths: [18, 22, 30, 36, 70, 10],
  }));
  add("Riwayat Tutup Buku", sheet(XLSX, {
    ...base, title: "RIWAYAT TUTUP BUKU PERIODE INI", sub,
    head: ["Status", "Ditutup oleh", "Waktu tutup", "Masalah", "Perhatian", "Catatan", "Dibuka oleh", "Waktu buka", "Alasan buka"],
    rows: d.closes.map((c) => [c.status === "ditutup" ? "Ditutup" : "Dibuka kembali", c.closedByName, wib(c.closedAt), c.issues, c.warnings, c.note, c.reopenedByName ?? "", wib(c.reopenedAt), c.reopenReason ?? ""]),
    widths: [16, 22, 18, 10, 10, 50, 22, 18, 50],
  }));
  return wb;
}
