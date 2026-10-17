import { ColumnChart } from "@/components/erp/ColumnChart";
import { PrintButton } from "@/components/erp/PrintButton";
import { BarList } from "@/components/erp/report/BarList";
import { PeriodBar } from "@/components/erp/report/PeriodBar";
import { ReadingNote, ReportSheet } from "@/components/erp/report/ReportSheet";
import { BackLink, Kpis, PageHead } from "@/components/erp/ui";
import { GROUP_LABEL } from "@/lib/erp/accounting";
import { periodLabel, rangePresets, trailingMonths } from "@/lib/erp/periods";
import { CASH_LABEL, reportContext } from "@/lib/erp/reportctx";
import { cashFlow, monthlyCash, type CashFlowRow } from "@/lib/erp/reports";
import { formatAmount, isDate, monthStart, tgl, today } from "@/lib/erp/util";

export const metadata = { title: "Arus kas" };

const C_IN = "#3d63c4";
const C_OUT = "#dd6a2c";

export default async function ArusKas({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const { me, db, acc, site, npwp } = await reportContext();
  const sp = await searchParams;
  const to = isDate(sp.to) ? sp.to : today();
  const from = isDate(sp.from) && sp.from <= to ? sp.from : monthStart(to);
  const [cf, trend] = await Promise.all([cashFlow(db, acc.rows, from, to), monthlyCash(db, acc.rows, trailingMonths(to, 6))]);
  const sysKey = new Map(acc.rows.map((a) => [a.id, a.systemKey]));
  const row = (r: CashFlowRow) => {
    const friendly = CASH_LABEL[sysKey.get(r.accountId) ?? ""];
    return { label: friendly ?? r.name, value: r.amount, sub: friendly ? `${r.code} ${r.name}` : `${r.code} · ${GROUP_LABEL[r.group]}`, href: `/akuntansi/laporan/buku-besar?akun=${r.accountId}&from=${from}&to=${to}` };
  };
  const net = cf.totalIn - cf.totalOut;
  return (
    <>
      <div className="no-print">
        <BackLink href="/akuntansi/laporan">Laporan</BackLink>
        <PageHead title="Arus kas" sub="Uang masuk dari mana dan keluar untuk apa, di semua kas & rekening bank.">
          <a className="btn btn-ghost btn-sm" href={`/akuntansi/ekspor/arus-kas?from=${from}&to=${to}`}>Unduh CSV (Excel)</a>
          <PrintButton label="Cetak / PDF" />
        </PageHead>
        <PeriodBar path="/akuntansi/laporan/arus-kas" presets={rangePresets()} from={from} to={to} />
      </div>
      <ReportSheet site={site} npwp={npwp} title="Laporan Arus Kas" period={`Periode ${periodLabel(from, to)}`} printedBy={me.name} sign>
        <Kpis
          items={[
            { label: "Saldo awal kas & bank", value: formatAmount(cf.opening), sub: `per ${tgl(from)}` },
            { label: "Uang masuk", value: formatAmount(cf.totalIn), sub: `${cf.inflow.length} sumber` },
            { label: "Uang keluar", value: formatAmount(cf.totalOut), sub: `${cf.outflow.length} keperluan` },
            { label: "Saldo akhir kas & bank", value: formatAmount(cf.closing), sub: `${net >= 0 ? "bertambah" : "berkurang"} ${formatAmount(Math.abs(net))}`, tone: net < 0 ? "warn" : "ok" },
          ]}
        />
        <section className="report-chart">
          <h3>Uang masuk dan keluar, 6 bulan terakhir</h3>
          <ColumnChart
            label="Uang masuk dan keluar kas & bank per bulan, 6 bulan terakhir"
            categories={trend.map((m) => m.long)}
            short={trend.map((m) => m.label)}
            height={180}
            series={[
              { name: "Masuk", color: C_IN, values: trend.map((m) => m.in) },
              { name: "Keluar", color: C_OUT, values: trend.map((m) => m.out) },
            ]}
          />
          <ReadingNote>Transfer antar-rekening sendiri (mis. bank ke kas kecil) tidak dihitung sebagai masuk atau keluar.</ReadingNote>
        </section>
        <div className="report-two">
          <section className="report-chart">
            <h3>Uang masuk dari</h3>
            <BarList label="Sumber uang masuk" rows={cf.inflow.map(row)} total={cf.totalIn} color={C_IN} empty="Tidak ada uang masuk pada periode ini." />
          </section>
          <section className="report-chart">
            <h3>Uang keluar untuk</h3>
            <BarList label="Penggunaan uang keluar" rows={cf.outflow.map(row)} total={cf.totalOut} color={C_OUT} empty="Tidak ada uang keluar pada periode ini." />
          </section>
        </div>
        <div className="admin-table report">
          <table>
            <caption>Saldo per kas & rekening</caption>
            <thead><tr><th>Kas / rekening</th><th className="num">Saldo awal</th><th className="num">Perubahan</th><th className="num">Saldo akhir</th></tr></thead>
            <tbody>
              {cf.perAccount.map((a) => (
                <tr key={a.code}>
                  <td><span className="tabular muted">{a.code}</span> {a.name}</td>
                  <td className="num tabular">{formatAmount(a.opening)}</td>
                  <td className={`num tabular${a.closing - a.opening < 0 ? " text-bahaya" : ""}`}>{formatAmount(a.closing - a.opening)}</td>
                  <td className="num tabular">{formatAmount(a.closing)}</td>
                </tr>
              ))}
              {cf.perAccount.length === 0 && <tr><td colSpan={4} className="muted">Belum ada transaksi kas atau bank.</td></tr>}
            </tbody>
            <tfoot><tr><th>Total</th><th className="num">{formatAmount(cf.opening)}</th><th className="num">{formatAmount(cf.closing - cf.opening)}</th><th className="num">{formatAmount(cf.closing)}</th></tr></tfoot>
          </table>
        </div>
        <ReadingNote>Laba di laporan laba rugi tidak sama dengan uang di kas: penjualan yang belum dibayar pelanggan menambah laba tetapi belum menambah kas. Laporan ini menunjukkan uang yang benar-benar berpindah.</ReadingNote>
      </ReportSheet>
    </>
  );
}
