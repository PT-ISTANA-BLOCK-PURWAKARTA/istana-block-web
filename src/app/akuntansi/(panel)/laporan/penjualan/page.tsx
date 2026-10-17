import { ColumnChart } from "@/components/erp/ColumnChart";
import { PrintButton } from "@/components/erp/PrintButton";
import { BarList } from "@/components/erp/report/BarList";
import { changeText } from "@/components/erp/report/Change";
import { PeriodBar } from "@/components/erp/report/PeriodBar";
import { ReadingNote, ReportSheet } from "@/components/erp/report/ReportSheet";
import { BackLink, Kpis, PageHead } from "@/components/erp/ui";
import { periodLabel, previousPeriod, rangePresets, trailingMonths } from "@/lib/erp/periods";
import { reportContext } from "@/lib/erp/reportctx";
import { monthlySales, salesSummary } from "@/lib/erp/reports";
import { formatAmount, formatQty, isDate, monthStart, today } from "@/lib/erp/util";

export const metadata = { title: "Laporan penjualan" };

export default async function LaporanPenjualan({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const { me, db, site, npwp } = await reportContext();
  const sp = await searchParams;
  const to = isDate(sp.to) ? sp.to : today();
  const from = isDate(sp.from) && sp.from <= to ? sp.from : monthStart(to);
  const prevP = previousPeriod(from, to);
  const [s, ps, trend] = await Promise.all([salesSummary(db, from, to), salesSummary(db, prevP.from, prevP.to), monthlySales(db, trailingMonths(to, 6))]);
  const total = s.byCustomer.reduce((a, r) => a + r.amount, 0);
  const prevTotal = ps.byCustomer.reduce((a, r) => a + r.amount, 0);
  const invoices = s.byCustomer.reduce((a, r) => a + r.count, 0);
  const unpaid = s.byCustomer.reduce((a, r) => a + (r.total - r.paid), 0);
  const ch = changeText(total, prevTotal);
  const itemTotal = s.byItem.reduce((a, r) => a + r.amount, 0);
  return (
    <>
      <div className="no-print">
        <BackLink href="/akuntansi/laporan">Laporan</BackLink>
        <PageHead title="Penjualan" sub="Apa yang paling laku dan siapa pembeli terbesar, dari faktur yang diterbitkan.">
          <a className="btn btn-ghost btn-sm" href={`/akuntansi/ekspor/penjualan?from=${from}&to=${to}`}>Unduh CSV (Excel)</a>
          <PrintButton label="Cetak / PDF" />
        </PageHead>
        <PeriodBar path="/akuntansi/laporan/penjualan" presets={rangePresets()} from={from} to={to} />
      </div>
      <ReportSheet site={site} npwp={npwp} title="Laporan Penjualan" period={`Periode ${periodLabel(from, to)}`} unit="Dalam Rupiah, sebelum PPN" printedBy={me.name}>
        <Kpis
          items={[
            { label: "Penjualan", value: formatAmount(total), sub: <span className={`chg${ch.tone ? ` is-${ch.tone}` : ""}`}>{ch.text}</span> },
            { label: "Faktur terbit", value: invoices.toLocaleString("id-ID"), sub: `${s.byCustomer.length} pelanggan` },
            { label: "Rata-rata per faktur", value: invoices ? formatAmount(Math.round(total / invoices)) : "–", sub: "sebelum PPN" },
            { label: "Belum dibayar", value: formatAmount(unpaid), sub: "dari faktur periode ini, termasuk PPN", tone: unpaid ? "warn" : "ok" },
          ]}
        />
        <section className="report-chart">
          <h3>Penjualan per bulan, 6 bulan terakhir</h3>
          <ColumnChart
            label="Nilai penjualan per bulan, 6 bulan terakhir"
            categories={trend.map((m) => m.long)}
            short={trend.map((m) => m.label)}
            height={170}
            series={[{ name: "Penjualan", color: "#3d63c4", values: trend.map((m) => m.amount) }]}
          />
        </section>
        <div className="report-two">
          <section className="report-chart">
            <h3>Barang terlaris (nilai)</h3>
            <BarList label="Barang terlaris" rows={s.byItem.map((r) => ({ label: r.name, value: r.amount, sub: `${formatQty(r.qty)} ${r.unit}` }))} total={itemTotal} empty="Belum ada penjualan pada periode ini." />
          </section>
          <section className="report-chart">
            <h3>Pelanggan terbesar</h3>
            <BarList
              label="Pelanggan terbesar"
              color="#dd6a2c"
              rows={s.byCustomer.map((r) => ({ label: r.name, value: r.amount, sub: `${r.count} faktur${r.total - r.paid > 0 ? ` · belum dibayar ${formatAmount(r.total - r.paid)}` : " · lunas"}` }))}
              total={total}
              empty="Belum ada penjualan pada periode ini."
            />
          </section>
        </div>
        <div className="report-two">
          <div className="admin-table report">
            <table>
              <caption>Rincian per barang</caption>
              <thead><tr><th>Barang</th><th className="num">Qty</th><th className="num">Nilai</th></tr></thead>
              <tbody>
                {s.byItem.map((r, i) => <tr key={i}><td>{r.name}</td><td className="num tabular nowrap">{formatQty(r.qty)} {r.unit}</td><td className="num tabular">{formatAmount(r.amount)}</td></tr>)}
                {s.byItem.length === 0 && <tr><td colSpan={3} className="muted">Belum ada penjualan.</td></tr>}
              </tbody>
              <tfoot><tr><th colSpan={2}>Total</th><th className="num">{formatAmount(itemTotal)}</th></tr></tfoot>
            </table>
          </div>
          <div className="admin-table report">
            <table>
              <caption>Rincian per pelanggan</caption>
              <thead><tr><th>Pelanggan</th><th className="num">Faktur</th><th className="num">Penjualan</th><th className="num">Belum dibayar</th></tr></thead>
              <tbody>
                {s.byCustomer.map((r, i) => <tr key={i}><td>{r.name}</td><td className="num">{r.count}</td><td className="num tabular">{formatAmount(r.amount)}</td><td className="num tabular">{formatAmount(r.total - r.paid, { blankZero: true })}</td></tr>)}
              </tbody>
              <tfoot><tr><th colSpan={2}>Total</th><th className="num">{formatAmount(total)}</th><th className="num">{formatAmount(unpaid)}</th></tr></tfoot>
            </table>
          </div>
        </div>
        <ReadingNote>Penjualan dihitung dari faktur: setelah diskon, termasuk ongkir, sebelum PPN. Rincian per barang memakai harga baris faktur (belum termasuk ongkir dan diskon faktur), jadi totalnya bisa sedikit berbeda. Barang yang sudah dikirim tapi belum difaktur belum masuk di sini.</ReadingNote>
      </ReportSheet>
    </>
  );
}
