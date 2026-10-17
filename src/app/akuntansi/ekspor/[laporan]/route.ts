import { getDb } from "@/db";
import { getCurrentAdmin } from "@/lib/auth";
import { GROUP_LABEL } from "@/lib/erp/accounting";
import { SOURCE_LABEL } from "@/lib/erp/links";
import { aging, balanceSheet, cashFlow, ledger, profitLoss, salesSummary, trialBalance } from "@/lib/erp/reports";
import { loadAccounts } from "@/lib/erp/server";
import { isDate, monthStart, today } from "@/lib/erp/util";
import { canOpen } from "@/lib/roles";

type Cell = string | number | null | undefined;

/** CSV bertanda titik koma + BOM agar langsung rapi di Excel berbahasa Indonesia. */
function csv(rows: Cell[][]) {
  const esc = (v: Cell) => {
    if (v === null || v === undefined) return "";
    if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(v).replace(".", ",");
    const s = String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(esc).join(";")).join("\r\n") + "\r\n";
}

export async function GET(req: Request, { params }: { params: Promise<{ laporan: string }> }) {
  const me = await getCurrentAdmin();
  if (!me || !canOpen(me.roles, "keuangan")) return new Response("Tidak diizinkan", { status: 403 });
  const { laporan } = await params;
  const q = new URL(req.url).searchParams;
  const to = isDate(q.get("to")) ? (q.get("to") as string) : today();
  const from = isDate(q.get("from")) ? (q.get("from") as string) : monthStart(to);
  const db = await getDb();
  const acc = await loadAccounts(db);
  let rows: Cell[][] = [];
  let name = laporan;

  switch (laporan) {
    case "laba-rugi": {
      const pl = await profitLoss(db, acc.rows, from, to);
      name = `laba-rugi_${from}_${to}`;
      rows = [["Kode", "Akun", "Kelompok", "Jumlah"], ...pl.rows.map((r) => [r.account.code, r.account.name, GROUP_LABEL[r.account.group], r.balance])];
      rows.push([], ["", "Total pendapatan", "", pl.revenue], ["", "Total HPP", "", pl.cogs], ["", "Laba kotor", "", pl.gross], ["", "Total beban usaha", "", pl.opex], ["", "Laba usaha", "", pl.operating], ["", "Pendapatan lain", "", pl.otherIncome], ["", "Beban lain", "", pl.otherExpense], ["", "Laba bersih", "", pl.net]);
      break;
    }
    case "neraca": {
      const bs = await balanceSheet(db, acc.rows, to);
      name = `neraca_${to}`;
      const line = (r: (typeof bs.assets)[number], sec: string) => [sec, r.account.code, r.account.name, GROUP_LABEL[r.account.group], r.account.group === "akum_penyusutan" ? -r.balance : r.balance];
      rows = [["Bagian", "Kode", "Akun", "Kelompok", "Saldo"], ...bs.assets.map((r) => line(r, "Aset")), ...bs.liabilities.map((r) => line(r, "Kewajiban")), ...bs.equity.map((r) => line(r, "Modal"))];
      rows.push(["Modal", "", "Laba ditahan tahun-tahun lalu", "", bs.priorYears], ["Modal", "", "Laba tahun berjalan", "", bs.currentYear], [], ["", "", "Total aset", "", bs.assetTotal], ["", "", "Total kewajiban", "", bs.liabTotal], ["", "", "Total modal", "", bs.equityTotal]);
      break;
    }
    case "neraca-saldo": {
      const tb = await trialBalance(db, acc.rows, to);
      name = `neraca-saldo_${to}`;
      rows = [["Kode", "Akun", "Debit", "Kredit"], ...tb.rows.filter((r) => r.nd || r.nc).map((r) => [r.account.code, r.account.name, r.nd, r.nc]), ["", "Total", tb.totalDebit, tb.totalCredit]];
      break;
    }
    case "buku-besar": {
      const account = acc.byId.get(q.get("akun") ?? "");
      if (!account) return new Response("Akun tidak ditemukan", { status: 404 });
      const lg = await ledger(db, account, from, to);
      name = `buku-besar_${account.code}_${from}_${to}`;
      rows = [["Tanggal", "Nomor", "Sumber", "Keterangan", "Kontak", "Debit", "Kredit", "Saldo"], ["", "", "", "Saldo awal", "", "", "", lg.opening]];
      for (const r of lg.rows) rows.push([r.date, r.number, SOURCE_LABEL[r.source] ?? r.source, r.lineMemo || r.memo, r.contactName, r.debit, r.credit, r.balance]);
      rows.push(["", "", "", "Total & saldo akhir", "", lg.totalDebit, lg.totalCredit, lg.closing]);
      break;
    }
    case "piutang":
    case "hutang": {
      const ag = await aging(db, laporan, to);
      name = `umur-${laporan}_${to}`;
      rows = [[laporan === "piutang" ? "Pelanggan" : "Pemasok", "Nomor", "Tanggal", "Jatuh tempo", "Total", "Dibayar", "Sisa", "Hari lewat"]];
      for (const d of ag.docs) rows.push([d.contactName, d.number, d.date, d.dueDate, d.total, d.paid, d.open, d.overdue]);
      rows.push(["Total", "", "", "", "", "", ag.grand, ""]);
      break;
    }
    case "penjualan": {
      const s = await salesSummary(db, from, to);
      name = `penjualan_${from}_${to}`;
      rows = [["Barang", "Satuan", "Qty", "Nilai"], ...s.byItem.map((r) => [r.name, r.unit, r.qty, r.amount]), [], ["Pelanggan", "Jumlah faktur", "Penjualan", "Belum dibayar"], ...s.byCustomer.map((r) => [r.name, r.count, r.amount, r.total - r.paid])];
      break;
    }
    case "arus-kas": {
      const cf = await cashFlow(db, acc.rows, from, to);
      name = `arus-kas_${from}_${to}`;
      rows = [["Bagian", "Kode", "Akun lawan", "Jumlah"], ["Saldo awal kas & bank", "", "", cf.opening]];
      for (const r of cf.inflow) rows.push(["Uang masuk", r.code, r.name, r.amount]);
      rows.push(["Total uang masuk", "", "", cf.totalIn]);
      for (const r of cf.outflow) rows.push(["Uang keluar", r.code, r.name, r.amount]);
      rows.push(["Total uang keluar", "", "", cf.totalOut], ["Saldo akhir kas & bank", "", "", cf.closing], [], ["Kas / rekening", "Kode", "Saldo awal", "Saldo akhir"]);
      for (const a of cf.perAccount) rows.push([a.name, a.code, a.opening, a.closing]);
      break;
    }
    default:
      return new Response("Laporan tidak dikenal", { status: 404 });
  }

  return new Response(csv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}.csv"`,
      "cache-control": "no-store",
    },
  });
}
