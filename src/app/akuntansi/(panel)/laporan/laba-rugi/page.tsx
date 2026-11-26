// Laba Rugi bersekat per bulan (satu kolom per bulan + total, rata-rata, % pendapatan) dan Perbandingan 2 Kolom (bulan vs bulan).
import Link from "next/link";
import { Fragment } from "react";
import type { Account } from "@/db/erp";
import { ColumnChart } from "@/components/erp/ColumnChart";
import { PrintButton } from "@/components/erp/PrintButton";
import { MonthBar } from "@/components/erp/report/MonthBar";
import { ReadingNote, ReportSheet } from "@/components/erp/report/ReportSheet";
import { BackLink, Kpis, PageHead } from "@/components/erp/ui";
import { isYm, monthRange, monthlyPL, readMonths, ymAdd, ymLabel, type PLMonth } from "@/lib/erp/monthly";
import { reportContext } from "@/lib/erp/reportctx";
import { formatAmount, today } from "@/lib/erp/util";

export const metadata = { title: "Laba rugi" };

const C_REV = "#3d63c4";
const C_COST = "#dd6a2c";
const pct = (n: number, base: number) => (base ? `${((n / base) * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%` : "–");
const A = ({ n, strong }: { n: number; strong?: boolean }) => <span className={`tabular${n < 0 ? " text-bahaya" : ""}`}>{strong ? <b>{formatAmount(n)}</b> : formatAmount(n, { blankZero: true })}</span>;
const chg = (a: number, b: number, good: "up" | "down" = "up") => {
  if (!b) return <span className="muted">–</span>;
  const p = ((a - b) / Math.abs(b)) * 100;
  const better = good === "up" ? a >= b : a <= b;
  return <span className={`chg ${better ? "is-ok" : "is-bad"}`}>{p >= 0 ? "▲" : "▼"} {Math.abs(p).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%</span>;
};

type Sec = { title: string; group: string; total: (p: PLMonth) => number; label: string; good: "up" | "down" };
type Line = { line: string; total: (p: PLMonth) => number; grand?: boolean };
const SECTIONS: (Sec | Line)[] = [
  { title: "Pendapatan", group: "pendapatan", total: (p) => p.revenue, label: "Total pendapatan", good: "up" },
  { title: "Harga pokok penjualan", group: "hpp", total: (p) => p.cogs, label: "Total harga pokok", good: "down" },
  { line: "Laba kotor", total: (p) => p.gross },
  { title: "Beban usaha", group: "beban", total: (p) => p.opex, label: "Total beban usaha", good: "down" },
  { line: "Laba usaha", total: (p) => p.operating },
  { title: "Pendapatan lain-lain", group: "pendapatan_lain", total: (p) => p.otherIncome, label: "Total pendapatan lain", good: "up" },
  { title: "Beban lain-lain", group: "beban_lain", total: (p) => p.otherExpense, label: "Total beban lain", good: "down" },
  { line: "LABA (RUGI) BERSIH", total: (p) => p.net, grand: true },
];

export default async function LabaRugi({ searchParams }: { searchParams: Promise<{ mode?: string; dari?: string; sampai?: string; a?: string; b?: string; from?: string; to?: string }> }) {
  const { me, db, acc, site, npwp } = await reportContext();
  const sp = await searchParams;
  const mode = sp.mode === "banding" ? "banding" : "bulanan";
  const now = today().slice(0, 7);
  const { dari, sampai } = readMonths(sp, 6);
  const ma = isYm(sp.a) ? sp.a : now;
  const mb = isYm(sp.b) ? sp.b : ymAdd(ma, -1);
  const months = mode === "bulanan" ? monthRange(dari, sampai) : [...monthRange(ma, ma), ...monthRange(mb, mb)];
  const { per, rows } = await monthlyPL(db, acc.rows, months);
  const sum = (f: (p: PLMonth) => number) => per.reduce((s, p) => s + f(p), 0);
  const byGroup = (g: string) => rows.filter((r) => r.account.group === g);
  const link = (a: Account) => <Link href={`/akuntansi/laporan/buku-besar?akun=${a.id}&from=${months[0].from}&to=${months[months.length - 1].to}`}><span className="tabular muted">{a.code}</span> {a.name}</Link>;
  const period = mode === "bulanan" ? (months.length > 1 ? `${months[0].label} – ${months[months.length - 1].label}` : months[0].label) : `${ymLabel(ma)} dibanding ${ymLabel(mb)}`;
  const multi = months.length > 1;
  const cols = months.length + (multi ? 4 : 2);

  const rev = sum((p) => p.revenue), net = sum((p) => p.net), gross = sum((p) => p.gross), opex = sum((p) => p.opex);
  const best = per.reduce((bi, p, i) => (p.net > per[bi].net ? i : bi), 0);
  const worst = per.reduce((bi, p, i) => (p.net < per[bi].net ? i : bi), 0);

  return (
    <>
      <div className="no-print">
        <BackLink href="/akuntansi/laporan">Laporan</BackLink>
        <PageHead title="Laba rugi" sub="Untung atau rugi per bulan: penjualan dikurangi semua biaya. Pilih per bulan (bersekat) atau perbandingan dua bulan.">
          <PrintButton label="Cetak / PDF" />
        </PageHead>
        <MonthBar path="/akuntansi/laporan/laba-rugi" mode={mode} dari={dari} sampai={sampai} a={ma} b={mb} now={now} />
      </div>

      <ReportSheet site={site} npwp={npwp} title={mode === "bulanan" ? "Laporan Laba Rugi per Bulan" : "Laba Rugi - Perbandingan 2 Kolom"} period={period} printedBy={me.name} sign>
        {mode === "bulanan" ? (
          <>
            <Kpis
              items={[
                { label: `Pendapatan (${months.length} bln)`, value: formatAmount(rev), sub: `rata-rata ${formatAmount(Math.round(rev / months.length))}/bulan` },
                { label: "Laba kotor", value: formatAmount(gross), sub: `margin ${pct(gross, rev)}` },
                { label: "Beban usaha", value: formatAmount(opex), sub: `${pct(opex, rev)} dari pendapatan` },
                { label: net < 0 ? "Rugi bersih" : "Laba bersih", value: formatAmount(net), sub: `margin ${pct(net, rev)}`, tone: net < 0 ? "bad" : "ok" },
                ...(multi ? [{ label: "Bulan terbaik / terburuk", value: `${months[best].short} / ${months[worst].short}`, sub: `${formatAmount(per[best].net)} / ${formatAmount(per[worst].net)}` }] : []),
              ]}
            />
            {multi && (
              <section className="report-chart">
                <h3>Pendapatan dan biaya per bulan</h3>
                <ColumnChart
                  label="Pendapatan dan total biaya per bulan"
                  categories={months.map((m) => m.label)}
                  short={months.map((m) => m.short)}
                  height={190}
                  series={[
                    { name: "Pendapatan", color: C_REV, values: per.map((p) => p.revenue) },
                    { name: "Biaya (HPP + beban)", color: C_COST, values: per.map((p) => Math.max(0, p.revenue - p.net)) },
                  ]}
                />
              </section>
            )}
            <div className="admin-table report lr-wide">
              <table>
                <thead>
                  <tr><th>Akun</th>{months.map((m) => <th key={m.ym} className="num">{m.short}{m.partial ? "*" : ""}</th>)}{multi && <><th className="num">Total</th><th className="num">Rata-rata</th></>}<th className="num">% pend.</th></tr>
                </thead>
                <tbody>
                  {SECTIONS.map((s, si) => {
                    if ("line" in s) {
                      return (
                        <tr key={si} className={s.grand ? "r-grand" : "r-total"}>
                          <td>{s.line}</td>{per.map((p, i) => <td key={i} className="num"><A n={s.total(p)} strong /></td>)}
                          {multi && <><td className="num"><A n={sum(s.total)} strong /></td><td className="num"><A n={Math.round(sum(s.total) / months.length)} /></td></>}
                          <td className="num small">{pct(sum(s.total), rev)}</td>
                        </tr>
                      );
                    }
                    const list = byGroup(s.group);
                    if (!list.length && !sum(s.total)) return null;
                    return (
                      <Fragment key={si}>
                        <tr className="r-group"><th colSpan={cols}>{s.title}</th></tr>
                        {list.map((r) => {
                          const t = r.values.reduce((a, v) => a + v, 0);
                          return (
                            <tr key={r.account.id}>
                              <td className="r-indent">{link(r.account)}</td>
                              {r.values.map((v, i) => <td key={i} className="num"><A n={v} /></td>)}
                              {multi && <><td className="num"><A n={t} /></td><td className="num muted"><A n={Math.round(t / months.length)} /></td></>}
                              <td className="num muted small">{pct(t, rev)}</td>
                            </tr>
                          );
                        })}
                        <tr className="r-sub"><td>{s.label}</td>{per.map((p, i) => <td key={i} className="num"><A n={s.total(p)} strong /></td>)}{multi && <><td className="num"><A n={sum(s.total)} strong /></td><td className="num"><A n={Math.round(sum(s.total) / months.length)} /></td></>}<td className="num small">{pct(sum(s.total), rev)}</td></tr>
                      </Fragment>
                    );
                  })}
                  <tr className="r-note"><td>Margin laba bersih</td>{per.map((p, i) => <td key={i} className="num small">{pct(p.net, p.revenue)}</td>)}{multi && <><td className="num small">{pct(net, rev)}</td><td /></>}<td /></tr>
                  {multi && <tr className="r-note"><td>Laba bersih vs bulan sebelumnya</td>{per.map((p, i) => <td key={i} className="num small">{i ? chg(p.net, per[i - 1].net) : ""}</td>)}<td /><td /><td /></tr>}
                </tbody>
              </table>
            </div>
            <ReadingNote>
              Satu kolom = satu bulan (mutasi bulan itu). {months.some((m) => m.partial) && "* bulan berjalan, baru terhitung sampai hari ini. "}
              <b>% pend.</b> = bagian dari total pendapatan periode. Baris bawah menunjukkan margin dan naik/turunnya laba dibanding bulan sebelumnya. Klik nama akun untuk melihat transaksinya.
            </ReadingNote>
          </>
        ) : (
          <>
            <Kpis
              items={[
                { label: `Pendapatan ${months[0].short}`, value: formatAmount(per[0].revenue), sub: <>vs {months[1].short} {chg(per[0].revenue, per[1].revenue)}</> },
                { label: "Laba kotor", value: formatAmount(per[0].gross), sub: <>vs {months[1].short} {chg(per[0].gross, per[1].gross)}</> },
                { label: "Beban usaha", value: formatAmount(per[0].opex), sub: <>vs {months[1].short} {chg(per[0].opex, per[1].opex, "down")}</> },
                { label: per[0].net < 0 ? "Rugi bersih" : "Laba bersih", value: formatAmount(per[0].net), sub: <>vs {months[1].short} {chg(per[0].net, per[1].net)}</>, tone: per[0].net < 0 ? "bad" : "ok" },
              ]}
            />
            <div className="admin-table report">
              <table>
                <thead><tr><th>Akun</th><th className="num">{months[0].label}{months[0].partial ? "*" : ""}</th><th className="num">%</th><th className="num">{months[1].label}{months[1].partial ? "*" : ""}</th><th className="num">%</th><th className="num">Selisih</th><th className="num">Perubahan</th></tr></thead>
                <tbody>
                  {SECTIONS.map((s, si) => {
                    const a = s.total(per[0]), b = s.total(per[1]);
                    if ("line" in s) return <tr key={si} className={s.grand ? "r-grand" : "r-total"}><td>{s.line}</td><td className="num"><A n={a} strong /></td><td className="num small">{pct(a, per[0].revenue)}</td><td className="num"><A n={b} strong /></td><td className="num small">{pct(b, per[1].revenue)}</td><td className="num"><A n={a - b} strong /></td><td className="num small">{chg(a, b)}</td></tr>;
                    const list = byGroup(s.group);
                    if (!list.length && !a && !b) return null;
                    return (
                      <Fragment key={si}>
                        <tr className="r-group"><th colSpan={7}>{s.title}</th></tr>
                        {list.map((r) => <tr key={r.account.id}><td className="r-indent">{link(r.account)}</td><td className="num"><A n={r.values[0]} /></td><td className="num muted small">{pct(r.values[0], per[0].revenue)}</td><td className="num"><A n={r.values[1]} /></td><td className="num muted small">{pct(r.values[1], per[1].revenue)}</td><td className="num"><A n={r.values[0] - r.values[1]} /></td><td className="num small">{chg(r.values[0], r.values[1], s.good)}</td></tr>)}
                        <tr className="r-sub"><td>{s.label}</td><td className="num"><A n={a} strong /></td><td className="num small">{pct(a, per[0].revenue)}</td><td className="num"><A n={b} strong /></td><td className="num small">{pct(b, per[1].revenue)}</td><td className="num"><A n={a - b} strong /></td><td className="num small">{chg(a, b, s.good)}</td></tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ReadingNote>Perbandingan dua bulan. <b>Perubahan</b> hijau = membaik (pendapatan/laba naik atau biaya turun), merah = memburuk. {months.some((m) => m.partial) && "* bulan berjalan, baru sampai hari ini."}</ReadingNote>
          </>
        )}
      </ReportSheet>
    </>
  );
}
