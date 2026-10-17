import Link from "next/link";
import { ColumnChart } from "@/components/erp/ColumnChart";
import { PrintButton } from "@/components/erp/PrintButton";
import { changeText } from "@/components/erp/report/Change";
import { PeriodBar } from "@/components/erp/report/PeriodBar";
import { ReadingNote, ReportSheet } from "@/components/erp/report/ReportSheet";
import { BackLink, Kpis, PageHead } from "@/components/erp/ui";
import { periodLabel, previousPeriod, rangePresets, trailingMonths } from "@/lib/erp/periods";
import { reportContext } from "@/lib/erp/reportctx";
import { monthlyProfit, profitLoss, type Row } from "@/lib/erp/reports";
import { formatAmount, isDate, monthStart, today } from "@/lib/erp/util";

export const metadata = { title: "Laba rugi" };

const C_REV = "#3d63c4";
const C_COST = "#dd6a2c";

const pct = (n: number, base: number) => (base ? `${((n / base) * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%` : "–");

function Amount({ n, strong }: { n: number; strong?: boolean }) {
  const s = formatAmount(n);
  return <span className={`tabular${n < 0 ? " text-bahaya" : ""}`}>{strong ? <b>{s}</b> : s}</span>;
}

function Group({ title, rows, total, label, prev, revenue }: { title: string; rows: Row[]; total: number; label: string; prev: Map<string, number> & { total?: number }; revenue: number }) {
  if (!rows.length && !total) return null;
  return (
    <>
      <tr className="r-group"><th colSpan={4}>{title}</th></tr>
      {rows.map((r) => (
        <tr key={r.account.id}>
          <td className="r-indent"><Link href={`/akuntansi/laporan/buku-besar?akun=${r.account.id}`}><span className="tabular muted">{r.account.code}</span> {r.account.name}</Link></td>
          <td className="num"><Amount n={r.balance} /></td>
          <td className="num muted small">{pct(r.balance, revenue)}</td>
          <td className="num muted"><Amount n={prev.get(r.account.id) ?? 0} /></td>
        </tr>
      ))}
      <tr className="r-sub"><td>{label}</td><td className="num"><Amount n={total} strong /></td><td className="num small">{pct(total, revenue)}</td><td className="num"><Amount n={prev.total ?? 0} /></td></tr>
    </>
  );
}

export default async function LabaRugi({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const { me, db, acc, site, npwp } = await reportContext();
  const sp = await searchParams;
  const to = isDate(sp.to) ? sp.to : today();
  const from = isDate(sp.from) && sp.from <= to ? sp.from : monthStart(to);
  const prevP = previousPeriod(from, to);
  const [pl, pp, trend] = await Promise.all([profitLoss(db, acc.rows, from, to), profitLoss(db, acc.rows, prevP.from, prevP.to), monthlyProfit(db, acc.rows, trailingMonths(to, 6))]);
  const g = (k: string) => pl.rows.filter((r) => r.account.group === k);
  const prevBy = new Map(pp.rows.map((r) => [r.account.id, r.balance]));
  const withTotal = (t: number) => Object.assign(new Map(prevBy), { total: t });
  const label = periodLabel(from, to);
  const prevLabel = periodLabel(prevP.from, prevP.to);
  const k = (n: number, p: number, good: "up" | "down" = "up") => {
    const c = changeText(n, p, good);
    return <span className={`chg${c.tone ? ` is-${c.tone}` : ""}`}>{c.text}</span>;
  };

  return (
    <>
      <div className="no-print">
        <BackLink href="/akuntansi/laporan">Laporan</BackLink>
        <PageHead title="Laba rugi" sub="Untung atau rugi dalam satu periode: penjualan dikurangi semua biaya.">
          <a className="btn btn-ghost btn-sm" href={`/akuntansi/ekspor/laba-rugi?from=${from}&to=${to}`}>Unduh CSV (Excel)</a>
          <PrintButton label="Cetak / PDF" />
        </PageHead>
        <PeriodBar path="/akuntansi/laporan/laba-rugi" presets={rangePresets()} from={from} to={to} />
      </div>

      <ReportSheet site={site} npwp={npwp} title="Laporan Laba Rugi" period={`Periode ${label}`} printedBy={me.name} sign>
        <Kpis
          items={[
            { label: "Pendapatan", value: formatAmount(pl.revenue), sub: k(pl.revenue, pp.revenue) },
            { label: "Laba kotor", value: formatAmount(pl.gross), sub: <>margin {pct(pl.gross, pl.revenue)} · {k(pl.gross, pp.gross)}</> },
            { label: "Beban usaha", value: formatAmount(pl.opex), sub: k(pl.opex, pp.opex, "down") },
            { label: pl.net < 0 ? "Rugi bersih" : "Laba bersih", value: formatAmount(pl.net), sub: <>margin {pct(pl.net, pl.revenue)} · {k(pl.net, pp.net)}</>, tone: pl.net < 0 ? "bad" : "ok" },
          ]}
        />

        <section className="report-chart">
          <h3>Pendapatan dan biaya, 6 bulan terakhir</h3>
          <ColumnChart
            label="Pendapatan dan total biaya per bulan, 6 bulan terakhir"
            categories={trend.map((m) => m.long)}
            short={trend.map((m) => m.label)}
            height={190}
            series={[
              { name: "Pendapatan", color: C_REV, values: trend.map((m) => m.revenue) },
              { name: "Biaya (HPP + beban)", color: C_COST, values: trend.map((m) => Math.max(0, m.cost)) },
            ]}
          />
          <table className="trend-table">
            <caption className="sr-only">Laba bersih per bulan</caption>
            <tbody>
              <tr>
                <th scope="row">Laba bersih</th>
                {trend.map((m) => (
                  <td key={m.from} className="num"><span className="muted small">{m.label}</span><Amount n={m.net} /></td>
                ))}
              </tr>
            </tbody>
          </table>
          <ReadingNote>Selisih antara batang biru dan oranye adalah laba bulan itu. Bulan berjalan baru terhitung sampai hari ini.</ReadingNote>
        </section>

        <div className="admin-table report">
          <table>
            <thead>
              <tr><th>Akun</th><th className="num">{label}</th><th className="num">% dari pendapatan</th><th className="num">Pembanding: {prevLabel}</th></tr>
            </thead>
            <tbody>
              <Group title="Pendapatan" rows={g("pendapatan")} total={pl.revenue} label="Total pendapatan" prev={withTotal(pp.revenue)} revenue={pl.revenue} />
              <Group title="Harga pokok penjualan" rows={g("hpp")} total={pl.cogs} label="Total harga pokok" prev={withTotal(pp.cogs)} revenue={pl.revenue} />
              <tr className="r-total"><td>Laba kotor</td><td className="num"><Amount n={pl.gross} strong /></td><td className="num small">{pct(pl.gross, pl.revenue)}</td><td className="num"><Amount n={pp.gross} /></td></tr>
              <Group title="Beban usaha" rows={g("beban")} total={pl.opex} label="Total beban usaha" prev={withTotal(pp.opex)} revenue={pl.revenue} />
              <tr className="r-total"><td>Laba usaha</td><td className="num"><Amount n={pl.operating} strong /></td><td className="num small">{pct(pl.operating, pl.revenue)}</td><td className="num"><Amount n={pp.operating} /></td></tr>
              <Group title="Pendapatan lain-lain" rows={g("pendapatan_lain")} total={pl.otherIncome} label="Total pendapatan lain" prev={withTotal(pp.otherIncome)} revenue={pl.revenue} />
              <Group title="Beban lain-lain" rows={g("beban_lain")} total={pl.otherExpense} label="Total beban lain" prev={withTotal(pp.otherExpense)} revenue={pl.revenue} />
              <tr className="r-grand"><td>{pl.net < 0 ? "Rugi bersih" : "Laba bersih"}</td><td className="num"><Amount n={pl.net} strong /></td><td className="num small">{pct(pl.net, pl.revenue)}</td><td className="num"><Amount n={pp.net} /></td></tr>
            </tbody>
          </table>
        </div>
        <ReadingNote>
          <b>Laba kotor</b> = pendapatan dikurangi harga pokok barang yang terjual. <b>Laba usaha</b> = laba kotor dikurangi biaya operasional (gaji, solar, listrik, penyusutan, …).
          Klik nama akun untuk melihat transaksinya.
        </ReadingNote>
      </ReportSheet>
    </>
  );
}
