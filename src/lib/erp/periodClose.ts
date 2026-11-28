import "server-only";
// Tutup buku: analisa sebelum tutup (buku besar, neraca, laba rugi, arus kas, piutang/hutang, stok barang jadi,
// bahan baku, dokumen), potret angka saat ditutup, dan data paket audit per periode (bulan).
// Kunci transaksi tetap memakai fin_lock_date (assertOpen); riwayat tutup/buka di fin_period_closes.
import { sql } from "drizzle-orm";
import type { Account } from "@/db/erp";
import { SQL_POSTED } from "@/components/ops/delivery/status";
import { GROUP_LABEL, normalBalance, sectionOf } from "./accounting";
import { addMonths, closablePeriod, periodOf, periodRange, summarizeChecks, type Check, type CheckSummary, type CheckTable } from "./periodCloseCore";
import { aging, balanceSheet, cashFlow, profitLoss, sumsByAccount, trialBalance } from "./reports";
import { getFinSettings, loadAccounts, type DB } from "./server";
import { formatAmount, formatQty, today } from "./util";

const rp = (n: number) => `Rp${formatAmount(Math.round(n))}`;
const EMPTY_CARD_HINT = "Sampai kartu stok web dipakai, lampirkan berita acara stok opname fisik per akhir bulan beserta nilainya, lalu cocokkan dengan saldo akun ini.";
const MAX_ROWS = 40;
/** Detik epoch awal & akhir periode (WIB) untuk kolom bertipe waktu. */
const wibTs = (day: string, end = false) => Math.floor(Date.parse(`${day}T${end ? "23:59:59" : "00:00:00"}+07:00`) / 1000);

function table(cols: string[], rows: (string | number)[][]): CheckTable {
  return { cols, rows: rows.slice(0, MAX_ROWS), ...(rows.length > MAX_ROWS ? { more: rows.length - MAX_ROWS } : {}) };
}

type CheckBody = Omit<Check, "key" | "area" | "label">;

async function run(key: string, area: Check["area"], label: string, fn: () => Promise<CheckBody | null>): Promise<Check | null> {
  try {
    const body = await fn();
    return body ? { key, area, label, ...body } : null;
  } catch (e) {
    return { key, area, label, status: "perhatian", value: "Tidak bisa diperiksa otomatis.", hint: (e instanceof Error ? e.message : String(e)).slice(0, 240) };
  }
}

/** Periode pertama yang punya jurnal (biasanya bulan saldo awal). */
export async function firstPeriod(db: DB) {
  const r = await db.get<{ d: string | null }>(sql`select min(date) d from fin_journal_lines`);
  return r?.d ? periodOf(r.d) : periodOf(today());
}

export async function closeState(db: DB) {
  const [fin, first, records] = await Promise.all([
    getFinSettings(db),
    firstPeriod(db),
    db.all<{ id: string; period: string; status: string; issues: number; warnings: number; note: string; closedByName: string; closedAt: number; reopenedByName: string | null; reopenedAt: number | null; reopenReason: string | null; lockBefore: string; periodEnd: string }>(sql`
      select id, period, status, issues, warnings, note, closed_by_name closedByName, closed_at closedAt, reopened_by_name reopenedByName, reopened_at reopenedAt,
             reopen_reason reopenReason, lock_before lockBefore, period_end periodEnd
        from fin_period_closes order by closed_at desc`),
  ]);
  const active = records.filter((r) => r.status === "ditutup");
  // Catatan aktif terakhir yang menjadi kunci sekarang (boleh dibuka kembali).
  const latest = active.find((r) => r.periodEnd === fin.lockDate) ?? null;
  return { lockDate: fin.lockDate, first, next: closablePeriod(fin.lockDate, first), records, latest, legacyLock: !!fin.lockDate && !latest };
}

/* ======================================================================== analisa */

export type PeriodSummary = {
  revenue: number; cogs: number; gross: number; opex: number; net: number;
  assets: number; liabilities: number; equity: number; balanced: boolean;
  cashOpening: number; cashIn: number; cashOut: number; cashClosing: number;
  stockFinished: number; stockRaw: number; glFinished: number; glRaw: number;
  receivable: number; payable: number; glReceivable: number; glPayable: number;
};

export type PeriodAnalysis = { period: string; from: string; to: string; label: string; generatedAt: string; lockDate: string; summary: PeriodSummary; counts: CheckSummary; checks: Check[] };

export async function analyzePeriod(db: DB, period: string): Promise<PeriodAnalysis> {
  const { from, to, label } = periodRange(period);
  const fromTs = wibTs(from);
  const toTs = wibTs(to, true);
  const [acc, fin] = await Promise.all([loadAccounts(db), getFinSettings(db)]);
  const accounts: Account[] = acc.rows;
  const sysId = (k: string) => accounts.find((a) => a.systemKey === k)?.id ?? null;
  const [sumsTo, pl, bs, cf, agP, agH, stockByKind] = await Promise.all([
    sumsByAccount(db, { to }),
    profitLoss(db, accounts, from, to),
    balanceSheet(db, accounts, to),
    cashFlow(db, accounts, from, to),
    aging(db, "piutang", to),
    aging(db, "hutang", to),
    db.all<{ kind: string; value: number; qty: number; n: number }>(sql`
      select i.kind, coalesce(sum(m.value), 0) value, coalesce(sum(m.qty), 0) qty, count(*) n
        from inv_stock_moves m join fin_items i on i.id = m.item_id where m.date <= ${to} group by i.kind`),
  ]);
  const glBal = (id: string | null) => {
    if (!id) return 0;
    const a = accounts.find((x) => x.id === id);
    const s = sumsTo.get(id);
    return a && s ? normalBalance(a.group, s.debit, s.credit) : 0;
  };
  const stockValue = (kind: string) => Number(stockByKind.find((s) => s.kind === kind)?.value ?? 0);
  /** Banyaknya pergerakan di kartu stok web s.d. akhir periode; 0 = kartu stok belum dipakai untuk jenis ini. */
  const stockMoves = (kind: string) => Number(stockByKind.find((s) => s.kind === kind)?.n ?? 0);
  const summary: PeriodSummary = {
    revenue: pl.revenue, cogs: pl.cogs, gross: pl.gross, opex: pl.opex, net: pl.net,
    assets: bs.assetTotal, liabilities: bs.liabTotal, equity: bs.equityTotal, balanced: bs.balanced,
    cashOpening: cf.opening, cashIn: cf.totalIn, cashOut: cf.totalOut, cashClosing: cf.closing,
    stockFinished: stockValue("barang_jadi"), stockRaw: stockValue("bahan_baku"),
    glFinished: glBal(sysId("persediaan_jadi")), glRaw: glBal(sysId("persediaan_bahan")),
    receivable: agP.grand, payable: agH.grand, glReceivable: glBal(sysId("piutang")), glPayable: glBal(sysId("hutang")),
  };

  const checks = await Promise.all([
    /* ---------------- buku besar */
    run("jurnal_seimbang", "buku_besar", "Setiap jurnal seimbang (debit = kredit)", async () => {
      const rows = await db.all<{ number: string; date: string; d: number; c: number }>(sql`
        select j.number, min(l.date) date, sum(l.debit) d, sum(l.credit) c from fin_journal_lines l join fin_journals j on j.id = l.journal_id
         where l.date >= ${from} and l.date <= ${to} group by l.journal_id having sum(l.debit) <> sum(l.credit) order by date limit 200`);
      return rows.length
        ? { status: "masalah", value: `${rows.length} jurnal tidak seimbang.`, hint: "Buka jurnalnya dan perbaiki baris debit/kredit sebelum tutup buku.", table: table(["No. bukti", "Tanggal", "Debit", "Kredit"], rows.map((r) => [r.number, r.date, Number(r.d), Number(r.c)])) }
        : { status: "ok", value: "Semua jurnal periode ini seimbang." };
    }),
    run("jurnal_tanggal", "buku_besar", "Tanggal baris jurnal sama dengan tanggal bukti", async () => {
      const rows = await db.all<{ number: string; jd: string; ld: string }>(sql`
        select j.number, j.date jd, l.date ld from fin_journal_lines l join fin_journals j on j.id = l.journal_id
         where ((l.date >= ${from} and l.date <= ${to}) or (j.date >= ${from} and j.date <= ${to})) and l.date <> j.date group by j.id limit 200`);
      return rows.length
        ? { status: "masalah", value: `${rows.length} bukti punya baris dengan tanggal berbeda.`, hint: "Laporan memakai tanggal baris; ubah & simpan ulang dokumennya agar tanggalnya sama.", table: table(["No. bukti", "Tgl bukti", "Tgl baris"], rows.map((r) => [r.number, r.jd, r.ld])) }
        : { status: "ok", value: "Tanggal baris dan bukti cocok." };
    }),
    run("jurnal_akun", "buku_besar", "Semua baris jurnal memakai rekening yang ada", async () => {
      const r = await db.get<{ n: number }>(sql`select count(*) n from fin_journal_lines l left join fin_accounts a on a.id = l.account_id where a.id is null and l.date <= ${to}`);
      const n = Number(r?.n ?? 0);
      return n ? { status: "masalah", value: `${n} baris jurnal menunjuk rekening yang sudah tidak ada.`, hint: "Pulihkan rekeningnya di Daftar Rekening atau perbaiki jurnalnya." } : { status: "ok", value: "Semua rekening jurnal ditemukan." };
    }),
    run("neraca_saldo", "buku_besar", "Neraca saldo seimbang", async () => {
      const tb = await trialBalance(db, accounts, to);
      const diff = tb.totalDebit - tb.totalCredit;
      return diff ? { status: "masalah", value: `Debit ${rp(tb.totalDebit)} ≠ kredit ${rp(tb.totalCredit)} (selisih ${rp(diff)}).`, href: `/akuntansi/laporan/neraca-saldo?to=${to}` } : { status: "ok", value: `Debit = kredit = ${rp(tb.totalDebit)}.`, href: `/akuntansi/laporan/neraca-saldo?to=${to}` };
    }),
    run("jurnal_kosong", "buku_besar", "Tidak ada bukti jurnal tanpa baris", async () => {
      const rows = await db.all<{ number: string; date: string }>(sql`
        select j.number, j.date from fin_journals j where j.date >= ${from} and j.date <= ${to} and not exists (select 1 from fin_journal_lines l where l.journal_id = j.id) limit 100`);
      return rows.length ? { status: "perhatian", value: `${rows.length} bukti jurnal tanpa baris.`, table: table(["No. bukti", "Tanggal"], rows.map((r) => [r.number, r.date])) } : { status: "ok", value: "Tidak ada." };
    }),
    run("jurnal_manual", "buku_besar", "Jurnal umum (manual) periode ini", async () => {
      const r = await db.get<{ n: number; t: number }>(sql`
        select count(distinct j.id) n, coalesce(sum(l.debit), 0) t from fin_journals j join fin_journal_lines l on l.journal_id = j.id where j.source = 'manual' and l.date >= ${from} and l.date <= ${to}`);
      const n = Number(r?.n ?? 0);
      return { status: "info", value: n ? `${n} jurnal umum, total debit ${rp(Number(r?.t ?? 0))}. Pastikan ada dokumen pendukungnya.` : "Tidak ada jurnal umum manual.", href: `/akuntansi/jurnal` };
    }),

    /* ---------------- neraca */
    run("neraca_seimbang", "neraca", "Neraca seimbang (aset = kewajiban + modal)", async () => {
      const diff = bs.assetTotal - (bs.liabTotal + bs.equityTotal);
      return bs.balanced
        ? { status: "ok", value: `Aset ${rp(bs.assetTotal)} = kewajiban ${rp(bs.liabTotal)} + modal ${rp(bs.equityTotal)}.`, href: `/akuntansi/laporan/neraca?to=${to}` }
        : { status: "masalah", value: `Aset ${rp(bs.assetTotal)} ≠ kewajiban + modal ${rp(bs.liabTotal + bs.equityTotal)} (selisih ${rp(diff)}).`, href: `/akuntansi/laporan/neraca?to=${to}` };
    }),
    run("kas_negatif", "neraca", "Saldo kas & bank tidak minus", async () => {
      const rows = accounts.filter((a) => a.group === "kas_bank").map((a) => ({ a, bal: glBal(a.id) })).filter((x) => x.bal < 0);
      return rows.length
        ? { status: "masalah", value: `${rows.length} rekening kas/bank bersaldo minus per ${to}.`, hint: "Kas tidak mungkin minus: biasanya ada penerimaan yang belum dicatat atau pengeluaran tercatat dobel. Cocokkan dengan rekening koran/kas fisik.", table: table(["Kode", "Rekening", "Saldo"], rows.map((x) => [x.a.code, x.a.name, x.bal])) }
        : { status: "ok", value: "Semua saldo kas & bank tidak minus." };
    }),
    run("saldo_terbalik", "neraca", "Saldo piutang, persediaan & hutang tidak terbalik", async () => {
      const groups = ["piutang", "persediaan", "aset_lancar_lain", "hutang_usaha", "hutang_lain"];
      const rows = accounts.filter((a) => groups.includes(a.group)).map((a) => ({ a, bal: glBal(a.id) })).filter((x) => x.bal < -1);
      return rows.length
        ? { status: "perhatian", value: `${rows.length} rekening bersaldo terbalik (minus).`, hint: "Saldo minus pada piutang/persediaan/hutang biasanya tanda pembayaran tanpa faktur, uang muka belum dipakai, atau salah rekening.", table: table(["Kode", "Rekening", "Kelompok", "Saldo"], rows.map((x) => [x.a.code, x.a.name, GROUP_LABEL[x.a.group], x.bal])) }
        : { status: "ok", value: "Tidak ada saldo terbalik." };
    }),

    /* ---------------- laba rugi */
    run("laba_rugi", "laba_rugi", "Ringkasan laba rugi & perbandingan 3 bulan sebelumnya", async () => {
      const prev = await Promise.all([1, 2, 3].map((i) => { const r = periodRange(addMonths(period, -i)); return profitLoss(db, accounts, r.from, r.to); }));
      const avgRev = prev.reduce((a, p) => a + p.revenue, 0) / 3;
      const avgNet = prev.reduce((a, p) => a + p.net, 0) / 3;
      const swing = avgRev > 0 ? (pl.revenue - avgRev) / avgRev : 0;
      const rows: (string | number)[][] = [
        ["Pendapatan", pl.revenue, Math.round(avgRev)],
        ["Harga pokok penjualan", pl.cogs, Math.round(prev.reduce((a, p) => a + p.cogs, 0) / 3)],
        ["Laba kotor", pl.gross, Math.round(prev.reduce((a, p) => a + p.gross, 0) / 3)],
        ["Beban usaha", pl.opex, Math.round(prev.reduce((a, p) => a + p.opex, 0) / 3)],
        ["Laba bersih", pl.net, Math.round(avgNet)],
      ];
      const status = pl.gross < 0 || (avgRev > 0 && Math.abs(swing) > 0.6) ? "perhatian" : "info";
      return {
        status,
        value: `Pendapatan ${rp(pl.revenue)}, laba bersih ${rp(pl.net)}${avgRev > 0 ? ` (pendapatan ${swing >= 0 ? "+" : ""}${Math.round(swing * 100)}% dari rata-rata 3 bulan)` : ""}.`,
        hint: status === "perhatian" ? "Perubahan besar atau laba kotor minus: periksa faktur/HPP yang belum dicatat atau tercatat dobel." : undefined,
        table: table(["Pos", "Periode ini", "Rata-rata 3 bln"], rows),
        href: `/akuntansi/laporan/laba-rugi?dari=${period}&sampai=${period}`,
      };
    }),
    run("hpp", "laba_rugi", "Penjualan sudah dibebani HPP", async () => {
      if (pl.revenue <= 0) return { status: "ok", value: "Tidak ada pendapatan penjualan periode ini." };
      if (pl.cogs <= 0) return { status: "perhatian", value: `Pendapatan ${rp(pl.revenue)} tanpa HPP.`, hint: "HPP terbentuk saat truk berangkat (surat jalan) atau dari jurnal Zahir. Periksa pengiriman & harga pokok barang." };
      const margin = pl.gross / pl.revenue;
      return { status: margin < 0 ? "perhatian" : "ok", value: `HPP ${rp(pl.cogs)} (margin kotor ${Math.round(margin * 1000) / 10}%).` };
    }),
    run("penyusutan", "laba_rugi", "Penyusutan harta tetap sudah dibukukan", async () => {
      const assets = await db.all<{ code: string; name: string; startDate: string; life: number; disposed: string | null; cost: number; salvage: number; method: string; done: number }>(sql`
        select a.code, a.name, a.start_date startDate, a.life_months life, a.disposed_date disposed, a.cost, a.salvage, a.method,
               (select count(*) from fin_depreciation_lines d where d.asset_id = a.id and d.period = ${period}) done
          from fin_fixed_assets a`);
      const due = assets.filter((a) => {
        const start = periodOf(a.startDate);
        return Number(a.life) > 0 && a.method !== "tidak_disusutkan" && Number(a.cost) > Number(a.salvage) && start <= period && period <= addMonths(start, Number(a.life) - 1) && (!a.disposed || a.disposed > to);
      });
      const missing = due.filter((a) => !Number(a.done));
      if (!assets.length) return { status: "info", value: "Belum ada data harta tetap.", href: "/akuntansi/harta-tetap" };
      return missing.length
        ? { status: "perhatian", value: `${missing.length} dari ${due.length} aset belum disusutkan untuk ${label}.`, hint: "Bukukan lewat Penyusutan Bulanan sebelum tutup buku.", href: "/akuntansi/harta-tetap/penyusutan", table: table(["Kode", "Aset", "Mulai"], missing.map((a) => [a.code, a.name, a.startDate])) }
        : { status: "ok", value: due.length ? `Penyusutan ${due.length} aset sudah dibukukan.` : "Tidak ada aset yang perlu disusutkan bulan ini.", href: "/akuntansi/harta-tetap/penyusutan" };
    }),

    /* ---------------- arus kas */
    run("arus_kas", "arus_kas", "Arus kas cocok dengan saldo kas & bank", async () => {
      const diff = cf.opening + cf.totalIn - cf.totalOut - cf.closing;
      const rows = cf.perAccount.map((a) => [a.code, a.name, a.opening, a.closing] as (string | number)[]);
      return {
        status: Math.abs(diff) > 1 ? "masalah" : "ok",
        value: `Saldo awal ${rp(cf.opening)} + masuk ${rp(cf.totalIn)} − keluar ${rp(cf.totalOut)} = ${rp(cf.opening + cf.totalIn - cf.totalOut)}; saldo akhir ${rp(cf.closing)}${Math.abs(diff) > 1 ? ` (selisih ${rp(diff)})` : ""}.`,
        table: table(["Kode", "Kas/Bank", "Saldo awal", "Saldo akhir"], rows),
        href: `/akuntansi/laporan/arus-kas?from=${from}&to=${to}`,
      };
    }),
    run("rekonsiliasi", "arus_kas", "Rekonsiliasi bank sampai akhir periode", async () => {
      const banks = await db.all<{ code: string; name: string; last: string | null; lines: number; unmatched: number }>(sql`
        select a.code, a.name, (select max(period_end) from fin_bank_recons r where r.account_id = a.id) last,
               (select count(*) from fin_bank_lines b where b.account_id = a.id and b.date >= ${from} and b.date <= ${to}) lines,
               (select count(*) from fin_bank_lines b where b.account_id = a.id and b.date >= ${from} and b.date <= ${to} and b.matched_line_id is null) unmatched
          from fin_accounts a where a.grp = 'kas_bank' and a.active = 1 and (a.code like '120%' or lower(a.name) like '%bank%')`);
      const late = banks.filter((b) => !b.last || b.last < to);
      return late.length
        ? { status: "perhatian", value: `${late.length} rekening bank belum direkonsiliasi s.d. ${to}.`, hint: "Impor rekening koran lalu selesaikan rekonsiliasi supaya saldo buku = saldo bank.", href: "/akuntansi/kas/rekonsiliasi", table: table(["Kode", "Rekening", "Rekonsiliasi terakhir", "Mutasi koran", "Belum cocok"], late.map((b) => [b.code, b.name, b.last ?? "belum pernah", Number(b.lines), Number(b.unmatched)])) }
        : { status: "ok", value: banks.length ? "Semua rekening bank sudah direkonsiliasi." : "Tidak ada rekening bank aktif.", href: "/akuntansi/kas/rekonsiliasi" };
    }),

    /* ---------------- piutang & hutang */
    run("piutang_rinci", "piutang_hutang", "Rincian faktur piutang = saldo akun Piutang Usaha", async () => {
      const diff = summary.glReceivable - agP.grand;
      return Math.abs(diff) < 1
        ? { status: "ok", value: `Cocok: ${rp(agP.grand)}.`, href: `/akuntansi/laporan/piutang?to=${to}` }
        : { status: "perhatian", value: `Rincian faktur ${rp(agP.grand)} vs saldo akun ${rp(summary.glReceivable)} (selisih ${rp(diff)}).`, hint: "Selisih biasanya dari saldo awal Zahir yang belum dirinci per faktur, uang muka langsung ke akun piutang, atau jurnal manual ke akun piutang.", href: "/akuntansi/penjualan/impor-saldo-piutang" };
    }),
    run("hutang_rinci", "piutang_hutang", "Rincian faktur hutang = saldo akun Hutang Usaha", async () => {
      const diff = summary.glPayable - agH.grand;
      return Math.abs(diff) < 1
        ? { status: "ok", value: `Cocok: ${rp(agH.grand)}.`, href: `/akuntansi/laporan/hutang?to=${to}` }
        : { status: "perhatian", value: `Rincian faktur ${rp(agH.grand)} vs saldo akun ${rp(summary.glPayable)} (selisih ${rp(diff)}).`, hint: "Rinci saldo awal hutang per faktur (Impor Saldo Awal Hutang) atau telusuri jurnal manual ke akun hutang.", href: "/akuntansi/pembelian/impor-saldo-hutang" };
    }),
    run("piutang_umur", "piutang_hutang", "Piutang lewat jatuh tempo lebih dari 90 hari", async () => {
      const old = agP.totals[4] ?? 0;
      const rows = agP.contacts.filter((c) => c.buckets[4] > 0).sort((a, b) => b.buckets[4] - a.buckets[4]).map((c) => [c.name, c.buckets[4]] as (string | number)[]);
      return old > 0
        ? { status: "perhatian", value: `${rp(old)} dari ${rows.length} pelanggan lewat > 90 hari.`, hint: "Pertimbangkan penagihan atau cadangan/penghapusan piutang (dengan persetujuan pimpinan).", table: table(["Pelanggan", "> 90 hari"], rows), href: `/akuntansi/laporan/piutang?to=${to}` }
        : { status: "ok", value: "Tidak ada piutang > 90 hari." };
    }),

    /* ---------------- stok barang jadi */
    run("stok_nilai", "stok", "Nilai stok barang jadi = saldo akun Persediaan Barang Jadi", async () => {
      const diff = summary.glFinished - summary.stockFinished;
      if (Math.abs(diff) < 1000) return { status: "ok", value: `Cocok: ${rp(summary.stockFinished)}.` };
      if (!stockMoves("barang_jadi")) return { status: "perhatian", value: `Kartu stok web belum berisi pergerakan bernilai untuk barang jadi; saldo akun persediaan ${rp(summary.glFinished)} berasal dari jurnal (Zahir).`, hint: EMPTY_CARD_HINT };
      return { status: "perhatian", value: `Kartu stok ${rp(summary.stockFinished)} vs akun persediaan ${rp(summary.glFinished)} (selisih ${rp(diff)}).`, hint: "Lakukan stok opname lalu jurnal penyesuaian supaya nilai buku = nilai stok.", href: "/operasional/stok" };
    }),
    run("stok_minus", "stok", "Tidak ada stok barang jadi minus", async () => {
      const rows = await negativeStock(db, to, "barang_jadi");
      return rows.length ? { status: "masalah", value: `${rows.length} barang jadi stoknya minus per ${to}.`, hint: "Stok minus = barang keluar tercatat sebelum hasil produksinya dicatat. Lengkapi hasil produksi atau opname.", table: table(["Kode", "Barang", "Stok"], rows.map((r) => [r.code, r.name, `${formatQty(r.qty)} ${r.unit}`])), href: "/operasional/stok" } : { status: "ok", value: "Tidak ada stok minus." };
    }),
    run("stok_kirim", "stok", "Surat jalan yang berangkat sudah mengurangi stok & membentuk HPP", async () => {
      const rows = await db.all<{ number: string; date: string; moves: number; journal: number }>(sql`
        select d.number, d.date,
               (select count(*) from inv_stock_moves m where m.source = 'pengiriman' and m.source_id = d.id) moves,
               (select count(*) from fin_journals j where j.source = 'pengiriman' and j.source_id = d.id) journal
          from ops_deliveries d
         where ${sql.raw(SQL_POSTED)} and d.date >= ${from} and d.date <= ${to} and d.id not like 'iops-%'
           and exists (select 1 from ops_delivery_lines dl join fin_items i on i.id = dl.item_id where dl.delivery_id = d.id and i.track_stock = 1 and dl.qty > 0)
         order by d.date`);
      const noStock = rows.filter((r) => !Number(r.moves));
      const noJournal = rows.filter((r) => Number(r.moves) && !Number(r.journal));
      if (noStock.length) return { status: "masalah", value: `${noStock.length} surat jalan berangkat belum mengurangi stok.`, hint: "Buka surat jalannya dan simpan ulang status berangkat/terkirim.", table: table(["Surat jalan", "Tanggal"], noStock.map((r) => [r.number, r.date])) };
      if (noJournal.length) return { status: "perhatian", value: `${noJournal.length} surat jalan tanpa jurnal HPP (harga pokok barang 0?).`, table: table(["Surat jalan", "Tanggal"], noJournal.map((r) => [r.number, r.date])) };
      return { status: "ok", value: rows.length ? `${rows.length} surat jalan berangkat sudah tercatat di stok & HPP.` : "Tidak ada surat jalan berangkat yang dicatat di aplikasi ini pada periode ini." };
    }),
    run("stok_faktur", "stok", "Barang terkirim sudah dibuatkan faktur/invoice", async () => {
      const rows = await db.all<{ number: string; name: string; last: string }>(sql`
        select o.number, c.name, max(d.date) last from ops_deliveries d join ops_orders o on o.id = d.order_id join fin_contacts c on c.id = o.contact_id
         where d.status = 'terkirim' and d.date >= ${from} and d.date <= ${to} and d.id not like 'iops-%' and coalesce(o.external_ref, '') = ''
           and not exists (select 1 from fin_invoices f where f.order_id = o.id and f.void = 0)
           and not exists (select 1 from ops_sales_invoices s where s.status <> 'batal' and (s.order_id = o.id or s.shipments like '%' || o.id || '%'))
         group by o.id order by last`);
      return rows.length
        ? { status: "perhatian", value: `${rows.length} PO sudah terkirim tetapi belum ada faktur/invoice.`, hint: "Pendapatan periode ini bisa kurang tercatat.", table: table(["PO", "Pelanggan", "Kirim terakhir"], rows.map((r) => [r.number, r.name, r.last])) }
        : { status: "ok", value: "Semua pengiriman periode ini sudah difaktur/di-invoice." };
    }),
    run("stok_opname", "stok", "Stok opname dilakukan di periode ini", async () => {
      const r = await db.get<{ n: number; last: string | null }>(sql`select count(*) n, max(date) last from inv_counts where date >= ${from} and date <= ${to}`);
      const n = Number(r?.n ?? 0);
      return n ? { status: "ok", value: `${n} dokumen opname (terakhir ${r?.last}).` } : { status: "perhatian", value: "Belum ada stok opname di periode ini.", hint: "Auditor biasanya meminta berita acara opname per akhir periode (barang jadi & bahan baku).", href: "/operasional/stok" };
    }),
    run("produksi", "stok", "Hasil produksi periode ini", async () => {
      // Catatan produksi (inv_productions) bisa ada tanpa masuk kartu stok bernilai (inv_stock_moves).
      const [r, v] = await Promise.all([
        db.get<{ n: number; posted: number; items: number }>(sql`
          select count(*) n,
                 coalesce(sum(case when exists (select 1 from inv_stock_moves m where m.source = 'produksi' and m.source_id = p.id) then 1 else 0 end), 0) posted,
                 (select count(distinct l.item_id) from inv_production_lines l join inv_productions q on q.id = l.production_id
                   where l.role = 'hasil' and q.date >= ${from} and q.date <= ${to}) items
            from inv_productions p where p.date >= ${from} and p.date <= ${to}`),
        db.get<{ v: number }>(sql`
          select coalesce(sum(m.value), 0) v from inv_stock_moves m join fin_items i on i.id = m.item_id
           where m.source = 'produksi' and m.qty > 0 and i.kind = 'barang_jadi' and m.date >= ${from} and m.date <= ${to}`),
      ]);
      const n = Number(r?.n ?? 0);
      const posted = Number(r?.posted ?? 0);
      if (!n) return { status: "info", value: "Tidak ada catatan produksi di periode ini." };
      return {
        status: "info",
        value: `${n} catatan produksi (${Number(r?.items ?? 0)} jenis barang); ${posted} sudah masuk kartu stok${posted ? ` senilai ${rp(Number(v?.v ?? 0))}` : ""}.`,
        hint: posted < n ? "Produksi yang belum masuk kartu stok tidak menambah nilai persediaan di buku web; untuk audit, nilai persediaan diambil dari opname fisik dan saldo akun." : undefined,
      };
    }),

    /* ---------------- bahan baku */
    run("bahan_nilai", "bahan_baku", "Nilai stok bahan baku = saldo akun Persediaan Bahan Baku", async () => {
      const diff = summary.glRaw - summary.stockRaw;
      if (Math.abs(diff) < 1000) return { status: "ok", value: `Cocok: ${rp(summary.stockRaw)}.` };
      if (!stockMoves("bahan_baku")) return { status: "perhatian", value: `Kartu stok web belum berisi pergerakan bernilai untuk bahan baku; saldo akun persediaan bahan ${rp(summary.glRaw)} berasal dari jurnal (Zahir).`, hint: EMPTY_CARD_HINT };
      return { status: "perhatian", value: `Kartu stok ${rp(summary.stockRaw)} vs akun persediaan bahan ${rp(summary.glRaw)} (selisih ${rp(diff)}).`, hint: "Pastikan pembelian bahan baku memakai barang bertipe Bahan baku, pemakaian produksi tercatat, lalu opname & sesuaikan." };
    }),
    run("bahan_minus", "bahan_baku", "Tidak ada stok bahan baku minus", async () => {
      const rows = await negativeStock(db, to, "bahan_baku");
      return rows.length ? { status: "masalah", value: `${rows.length} bahan baku stoknya minus per ${to}.`, hint: "Pemakaian produksi tercatat melebihi pembelian/penerimaan. Lengkapi faktur pembelian atau opname.", table: table(["Kode", "Bahan", "Stok"], rows.map((r) => [r.code, r.name, `${formatQty(r.qty)} ${r.unit}`])) } : { status: "ok", value: "Tidak ada stok bahan baku minus." };
    }),
    run("bahan_masuk", "bahan_baku", "Bahan baku yang datang sudah ada faktur pembeliannya", async () => {
      const [rc, bl] = await Promise.all([
        db.get<{ n: number }>(sql`select count(*) n from ops_goods_receipts where category = 'bahan_baku' and status = 'diterima' and received_at >= ${fromTs} and received_at <= ${toTs}`),
        db.get<{ n: number; t: number }>(sql`
          select count(distinct b.id) n, coalesce(sum(bl.amount), 0) t from fin_bills b join fin_bill_lines bl on bl.bill_id = b.id join fin_items i on i.id = bl.item_id
           where b.void = 0 and b.date >= ${from} and b.date <= ${to} and i.kind = 'bahan_baku'`),
      ]);
      const arrivals = Number(rc?.n ?? 0);
      const bills = Number(bl?.n ?? 0);
      return {
        status: arrivals > 0 && bills === 0 ? "perhatian" : "info",
        value: `${arrivals} kedatangan bahan baku (barang masuk) · ${bills} faktur pembelian bahan baku senilai ${rp(Number(bl?.t ?? 0))}.`,
        hint: arrivals > 0 && bills === 0 ? "Bahan datang tetapi belum ada faktur pembelian: hutang & persediaan bahan kurang tercatat." : undefined,
        href: "/akuntansi/ops/barang-masuk",
      };
    }),
    run("bahan_pakai", "bahan_baku", "Pemakaian bahan baku untuk produksi", async () => {
      const [r, l] = await Promise.all([
        db.get<{ v: number; n: number }>(sql`
          select coalesce(sum(-m.value), 0) v, count(distinct m.item_id) n from inv_stock_moves m join fin_items i on i.id = m.item_id
           where m.qty < 0 and i.kind = 'bahan_baku' and m.source in ('produksi', 'konversi') and m.date >= ${from} and m.date <= ${to}`),
        db.get<{ n: number; items: number }>(sql`
          select count(*) n, count(distinct l.item_id) items from inv_production_lines l join inv_productions p on p.id = l.production_id
           where l.role = 'bahan' and p.date >= ${from} and p.date <= ${to}`),
      ]);
      const inCard = Number(r?.n ?? 0);
      const lines = Number(l?.n ?? 0);
      if (inCard) return { status: "info", value: `${inCard} jenis bahan terpakai di kartu stok, nilai ${rp(Number(r?.v ?? 0))}.` };
      return { status: "info", value: lines ? `${lines} baris pemakaian bahan (${Number(l?.items ?? 0)} jenis) di catatan produksi, belum masuk kartu stok bernilai.` : "Tidak ada pemakaian bahan baku tercatat." };
    }),

    /* ---------------- dokumen & pencatatan */
    run("invoice_draft", "dokumen", "Invoice penjualan masih draft", async () => {
      const rows = await db.all<{ number: string; name: string }>(sql`
        select number, customer_name name from ops_sales_invoices where status = 'draft' and issuer <> 'ibn' and invoice_date >= ${fromTs} and invoice_date <= ${toTs} order by invoice_date`);
      return rows.length ? { status: "perhatian", value: `${rows.length} invoice periode ini masih draft.`, href: "/akuntansi/dokumen/invoice?status=draft", table: table(["Invoice", "Pelanggan"], rows.map((r) => [r.number, r.name])) } : { status: "ok", value: "Tidak ada invoice draft." };
    }),
    run("kas_draft", "dokumen", "Kas masuk/keluar masih draft", async () => {
      try {
        const r = await db.get<{ n: number }>(sql`select count(*) n from fin_cash_txns where status = 'draft' and date >= ${from} and date <= ${to}`);
        const n = Number(r?.n ?? 0);
        return n ? { status: "perhatian", value: `${n} transaksi kas masih draft (belum direkam ke jurnal).`, href: "/akuntansi/kas" } : { status: "ok", value: "Tidak ada kas draft." };
      } catch {
        return null; // fitur draft kas belum ada di database ini
      }
    }),
    run("ppn", "dokumen", "PPN keluaran & masukan periode ini", async () => {
      const k = sysId("ppn_keluaran");
      const m = sysId("ppn_masukan");
      const sums = await sumsByAccount(db, { from, to });
      const out = k ? (sums.get(k)?.credit ?? 0) - (sums.get(k)?.debit ?? 0) : 0;
      const inp = m ? (sums.get(m)?.debit ?? 0) - (sums.get(m)?.credit ?? 0) : 0;
      return { status: "info", value: `PPN keluaran ${rp(out)} · PPN masukan ${rp(inp)} · ${out - inp >= 0 ? "kurang bayar" : "lebih bayar"} ${rp(Math.abs(out - inp))}.`, href: "/akuntansi/laporan/efaktur" };
    }),
    run("terlambat", "dokumen", "Jurnal yang dicatat lebih dari 7 hari setelah akhir periode", async () => {
      const rows = await db.all<{ number: string; date: string; at: number; userName: string | null }>(sql`
        select j.number, j.date, j.created_at at, u.name userName from fin_journals j left join users u on u.id = j.created_by
         where j.date >= ${from} and j.date <= ${to} and j.source <> 'zahir' and j.created_at > ${toTs + 7 * 86400} order by j.created_at desc limit 200`);
      return rows.length
        ? { status: "info", value: `${rows.length} bukti dicatat terlambat (mundur tanggal).`, hint: "Wajar untuk koreksi, tetapi auditor akan menanyakan dasarnya.", table: table(["No. bukti", "Tanggal", "Dicatat", "Oleh"], rows.map((r) => [r.number, r.date, new Date(Number(r.at) * 1000).toISOString().slice(0, 10), r.userName ?? "-"])) }
        : { status: "ok", value: "Tidak ada pencatatan mundur tanggal." };
    }),
    run("aktivitas", "dokumen", "Perubahan data keuangan selama periode (jejak audit)", async () => {
      const r = await db.get<{ n: number; u: number; f: number }>(sql`
        select count(*) n, count(distinct user_id) u, sum(case when success = 0 then 1 else 0 end) f from ops_activity_logs
         where at >= ${fromTs} and at <= ${toTs} and (action like 'keuangan.%' or action like 'akuntansi.%' or action like 'gaji.%' or action like 'kasbon.%')`);
      return { status: "info", value: `${Number(r?.n ?? 0)} aktivitas oleh ${Number(r?.u ?? 0)} pengguna${Number(r?.f ?? 0) ? ` (${Number(r?.f)} gagal)` : ""}.`, href: "/akuntansi/laporan/jejak-audit" };
    }),
  ]);
  const list = checks.filter((c): c is Check => !!c);
  return { period, from, to, label, generatedAt: new Date().toISOString(), lockDate: fin.lockDate, summary, counts: summarizeChecks(list), checks: list };
}

async function negativeStock(db: DB, to: string, kind: string) {
  const rows = await db.all<{ code: string; name: string; unit: string; qty: number }>(sql`
    select i.code, i.name, i.unit, sum(m.qty) qty from inv_stock_moves m join fin_items i on i.id = m.item_id
     where m.date <= ${to} and i.kind = ${kind} group by i.id having sum(m.qty) < -0.0005 order by i.code`);
  return rows.map((r) => ({ ...r, qty: Number(r.qty) }));
}

/* ======================================================================== potret & paket audit */

/** Saldo stok per barang: awal, masuk, keluar, akhir (qty & nilai). */
export async function stockMovement(db: DB, from: string, to: string) {
  const rows = await db.all<{ code: string; name: string; unit: string; kind: string; oq: number; ov: number; iq: number; iv: number; xq: number; xv: number }>(sql`
    select i.code, i.name, i.unit, i.kind,
      coalesce(sum(case when m.date < ${from} then m.qty end), 0) oq, coalesce(sum(case when m.date < ${from} then m.value end), 0) ov,
      coalesce(sum(case when m.date >= ${from} and m.qty > 0 then m.qty end), 0) iq, coalesce(sum(case when m.date >= ${from} and m.qty > 0 then m.value end), 0) iv,
      coalesce(sum(case when m.date >= ${from} and m.qty < 0 then -m.qty end), 0) xq, coalesce(sum(case when m.date >= ${from} and m.qty < 0 then -m.value end), 0) xv
    from fin_items i join inv_stock_moves m on m.item_id = i.id and m.date <= ${to}
    group by i.id order by i.kind, i.code`);
  return rows.map((r) => {
    const n = (v: unknown) => Number(v ?? 0);
    return { code: r.code, name: r.name, unit: r.unit, kind: r.kind, openQty: n(r.oq), openValue: n(r.ov), inQty: n(r.iq), inValue: n(r.iv), outQty: n(r.xq), outValue: n(r.xv), closeQty: n(r.oq) + n(r.iq) - n(r.xq), closeValue: n(r.ov) + n(r.iv) - n(r.xv) };
  });
}

/** Neraca lajur: saldo awal, mutasi debit/kredit periode, saldo akhir per rekening (saldo bertanda: + debit, − kredit). */
export async function worksheet(db: DB, accounts: Account[], from: string, to: string) {
  const [before, during] = await Promise.all([sumsByAccount(db, { to: prevDay(from) }), sumsByAccount(db, { from, to })]);
  return accounts
    .map((a) => {
      const b = before.get(a.id);
      const d = during.get(a.id);
      const open = (b?.debit ?? 0) - (b?.credit ?? 0);
      const debit = d?.debit ?? 0;
      const credit = d?.credit ?? 0;
      return { code: a.code, name: a.name, group: a.group, section: sectionOf(a.group), open, debit, credit, close: open + debit - credit };
    })
    .filter((r) => r.open || r.debit || r.credit)
    .sort((x, y) => x.code.localeCompare(y.code));
}

const prevDay = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

/** Potret angka saat tutup buku (disimpan JSON di fin_period_closes.snapshot). */
export async function buildSnapshot(db: DB, a: PeriodAnalysis) {
  const accounts = (await loadAccounts(db)).rows;
  const [ws, stock] = await Promise.all([worksheet(db, accounts, a.from, a.to), stockMovement(db, a.from, a.to)]);
  return {
    version: 1,
    period: a.period,
    generatedAt: a.generatedAt,
    summary: a.summary,
    counts: a.counts,
    checks: a.checks.map((c) => ({ key: c.key, area: c.area, label: c.label, status: c.status, value: c.value })),
    worksheet: ws.map((r) => [r.code, r.name, r.open, r.debit, r.credit, r.close]),
    stock: stock.map((s) => [s.code, s.name, s.kind, s.closeQty, s.closeValue]),
  };
}

export type AuditLine = { code: string; account: string; date: string; number: string; source: string; memo: string; lineMemo: string; contact: string | null; project: string | null; debit: number; credit: number; createdBy: string | null; createdAt: number; journalId: string };

/** Semua data paket audit satu periode (dirangkai jadi Excel di browser). */
export async function auditData(db: DB, period: string) {
  const a = await analyzePeriod(db, period);
  const accounts = (await loadAccounts(db)).rows;
  const fromTs = wibTs(a.from);
  const toTs = wibTs(a.to, true);
  const [ws, stock, pl, ytd, bs, cf, agP, agH, lineCount, activity, closes, assets] = await Promise.all([
    worksheet(db, accounts, a.from, a.to),
    stockMovement(db, a.from, a.to),
    profitLoss(db, accounts, a.from, a.to),
    profitLoss(db, accounts, `${a.period.slice(0, 4)}-01-01`, a.to),
    balanceSheet(db, accounts, a.to),
    cashFlow(db, accounts, a.from, a.to),
    aging(db, "piutang", a.to),
    aging(db, "hutang", a.to),
    db.get<{ n: number }>(sql`select count(*) n from fin_journal_lines where date >= ${a.from} and date <= ${a.to}`),
    db.all<{ at: number; userName: string | null; action: string; label: string; summary: string | null; success: number }>(sql`
      select at, user_name userName, action, label, summary, success from ops_activity_logs
       where at >= ${fromTs} and at <= ${toTs} and (action like 'keuangan.%' or action like 'akuntansi.%' or action like 'gaji.%' or action like 'kasbon.%')
       order by at`),
    db.all<{ status: string; closedByName: string; closedAt: number; note: string; issues: number; warnings: number; reopenedByName: string | null; reopenedAt: number | null; reopenReason: string | null }>(sql`
      select status, closed_by_name closedByName, closed_at closedAt, note, issues, warnings, reopened_by_name reopenedByName, reopened_at reopenedAt, reopen_reason reopenReason
        from fin_period_closes where period = ${period} order by closed_at`),
    db.all<{ code: string; name: string; acquired: string; cost: number; openingAccum: number; dep: number; disposed: string | null }>(sql`
      select a.code, a.name, a.acquired_date acquired, a.cost, a.opening_accum openingAccum, a.disposed_date disposed,
             coalesce((select sum(d.amount) from fin_depreciation_lines d where d.asset_id = a.id and d.period <= ${period}), 0) dep
        from fin_fixed_assets a order by a.code`),
  ]);
  return {
    company: "PT. Istana Block Purwakarta",
    analysis: a,
    worksheet: ws,
    stock,
    profitLoss: { rows: pl.rows.map((r) => ({ code: r.account.code, name: r.account.name, group: r.account.group, balance: r.balance })), revenue: pl.revenue, cogs: pl.cogs, gross: pl.gross, opex: pl.opex, otherIncome: pl.otherIncome, otherExpense: pl.otherExpense, net: pl.net },
    profitLossYtd: { rows: ytd.rows.map((r) => ({ code: r.account.code, balance: r.balance })), net: ytd.net },
    balanceSheet: {
      assets: bs.assets.map((r) => ({ code: r.account.code, name: r.account.name, group: r.account.group, balance: r.account.group === "akum_penyusutan" ? -r.balance : r.balance })),
      liabilities: bs.liabilities.map((r) => ({ code: r.account.code, name: r.account.name, group: r.account.group, balance: r.balance })),
      equity: bs.equity.map((r) => ({ code: r.account.code, name: r.account.name, group: r.account.group, balance: r.balance })),
      assetTotal: bs.assetTotal, liabTotal: bs.liabTotal, equityTotal: bs.equityTotal, priorYears: bs.priorYears, currentYear: bs.currentYear, balanced: bs.balanced,
    },
    cashFlow: { opening: cf.opening, closing: cf.closing, totalIn: cf.totalIn, totalOut: cf.totalOut, inflow: cf.inflow.map((r) => ({ code: r.code, name: r.name, amount: r.amount })), outflow: cf.outflow.map((r) => ({ code: r.code, name: r.name, amount: r.amount })), perAccount: cf.perAccount },
    receivables: agP.docs.map((d) => ({ contact: d.contactName, number: d.number, date: d.date, dueDate: d.dueDate, total: d.total, paid: d.paid, open: d.open, overdue: d.overdue })),
    payables: agH.docs.map((d) => ({ contact: d.contactName, number: d.number, date: d.date, dueDate: d.dueDate, total: d.total, paid: d.paid, open: d.open, overdue: d.overdue })),
    lineCount: Number(lineCount?.n ?? 0),
    activity,
    closes,
    assets: assets.map((x) => ({ ...x, cost: Number(x.cost), accum: Number(x.openingAccum) + Number(x.dep) })),
  };
}
/** Baris jurnal periode per halaman (paket audit diunduh bertahap supaya ringan untuk Worker). */
export async function auditLines(db: DB, period: string, offset: number, limit: number): Promise<AuditLine[]> {
  const { from, to } = periodRange(period);
  const rows = await db.all<AuditLine>(sql`
    select ac.code, ac.name account, l.date, j.number, j.source, j.memo, l.memo lineMemo, c.name contact, p.code project, l.debit, l.credit,
           u.name createdBy, j.created_at createdAt, j.id journalId
      from fin_journal_lines l join fin_journals j on j.id = l.journal_id join fin_accounts ac on ac.id = l.account_id
      left join fin_contacts c on c.id = l.contact_id left join fin_projects p on p.id = l.project_id left join users u on u.id = j.created_by
     where l.date >= ${from} and l.date <= ${to}
     order by l.date, j.created_at, j.number, l.sort, l.id
     limit ${limit} offset ${offset}`);
  return rows.map((l) => ({ ...l, debit: Number(l.debit), credit: Number(l.credit), createdAt: Number(l.createdAt) }));
}
export type AuditData = Awaited<ReturnType<typeof auditData>> & { lines: AuditLine[] };
