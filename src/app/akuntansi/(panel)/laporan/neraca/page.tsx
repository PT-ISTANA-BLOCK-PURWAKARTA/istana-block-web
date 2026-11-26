// Neraca per akhir bulan (bersekat: satu kolom per bulan) dan Perbandingan 2 Kolom (akhir bulan vs akhir bulan).
import Link from "next/link";
import { Fragment } from "react";
import type { Account } from "@/db/erp";
import { PrintButton } from "@/components/erp/PrintButton";
import { MonthBar } from "@/components/erp/report/MonthBar";
import { ReadingNote, ReportSheet } from "@/components/erp/report/ReportSheet";
import { StackBar } from "@/components/erp/report/StackBar";
import { BackLink, Kpis, PageHead } from "@/components/erp/ui";
import { GROUP_LABEL } from "@/lib/erp/accounting";
import { isYm, monthRange, monthlyBS, readMonths, ymAdd, ymLabel } from "@/lib/erp/monthly";
import { reportContext } from "@/lib/erp/reportctx";
import { formatAmount, today } from "@/lib/erp/util";

export const metadata = { title: "Neraca" };

const C = ["#3d63c4", "#dd6a2c", "#1baf7a", "#eda100", "#6250d6"];
const A = ({ n, strong }: { n: number; strong?: boolean }) => <span className={`tabular${n < 0 ? " text-bahaya" : ""}`}>{strong ? <b>{formatAmount(n)}</b> : formatAmount(n, { blankZero: true })}</span>;
const chg = (a: number, b: number) => (!b ? <span className="muted">–</span> : <span className={`chg ${a >= b ? "is-ok" : "is-bad"}`}>{a >= b ? "▲" : "▼"} {Math.abs(((a - b) / Math.abs(b)) * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%</span>);
type R = { account: Account; values: number[] };

export default async function Neraca({ searchParams }: { searchParams: Promise<{ mode?: string; dari?: string; sampai?: string; a?: string; b?: string; to?: string }> }) {
  const { me, db, acc, site, npwp } = await reportContext();
  const sp = await searchParams;
  const mode = sp.mode === "banding" ? "banding" : "bulanan";
  const now = today().slice(0, 7);
  const { dari, sampai } = readMonths({ dari: sp.dari, sampai: sp.sampai, to: sp.to }, 3);
  const ma = isYm(sp.a) ? sp.a : now;
  const mb = isYm(sp.b) ? sp.b : ymAdd(ma, -1);
  const months = mode === "bulanan" ? monthRange(dari, sampai) : [...monthRange(ma, ma), ...monthRange(mb, mb)];
  const bs = await monthlyBS(db, acc.rows, months);
  const banding = mode === "banding";
  const last = bs.per[banding ? 0 : months.length - 1];
  const sumG = (groups: string[]) => last.assets.filter((r) => groups.includes(r.account.group)).reduce((a, r) => a + (r.account.group === "akum_penyusutan" ? -r.balance : r.balance), 0);
  const cash = sumG(["kas_bank"]), recv = sumG(["piutang"]), stock = sumG(["persediaan"]), otherCur = sumG(["aset_lancar_lain"]), fixed = sumG(["aset_tetap", "akum_penyusutan"]);
  const curLiab = last.liabilities.filter((r) => ["hutang_usaha", "hutang_lain"].includes(r.account.group)).reduce((a, r) => a + r.balance, 0);
  const currentRatio = curLiab > 0 ? (cash + recv + stock + otherCur) / curLiab : null;
  const link = (a: Account) => <Link href={`/akuntansi/laporan/buku-besar?akun=${a.id}`}><span className="tabular muted">{a.code}</span> {a.name}</Link>;
  const cols = banding ? 5 : months.length + 1;
  const period = banding ? `Akhir ${ymLabel(ma)} dibanding akhir ${ymLabel(mb)}` : months.length > 1 ? `Akhir bulan, ${months[0].label} – ${months[months.length - 1].label}` : `Per akhir ${months[0].label}`;

  const cells = (vals: number[], strong?: boolean) => banding
    ? <><td className="num"><A n={vals[0]} strong={strong} /></td><td className="num"><A n={vals[1]} strong={strong} /></td><td className="num"><A n={vals[0] - vals[1]} strong={strong} /></td><td className="num small">{chg(vals[0], vals[1])}</td></>
    : vals.map((v, i) => <td key={i} className="num"><A n={v} strong={strong} /></td>);
  const lines = (rows: R[]) => {
    let lastG = "";
    return rows.map((r) => {
      const head = r.account.group !== lastG ? GROUP_LABEL[r.account.group] : null;
      lastG = r.account.group;
      return <Fragment key={r.account.id}>{head && <tr className="r-sub-head"><td colSpan={cols}>{head}</td></tr>}<tr><td className="r-indent">{link(r.account)}</td>{cells(r.values)}</tr></Fragment>;
    });
  };
  const tot = (f: (b: (typeof bs.per)[number]) => number) => bs.per.map(f);

  return (
    <>
      <div className="no-print">
        <BackLink href="/akuntansi/laporan">Laporan</BackLink>
        <PageHead title="Neraca" sub="Apa yang dimiliki usaha dan dari mana asalnya, per akhir bulan. Pilih per bulan (bersekat) atau perbandingan dua bulan.">
          <PrintButton label="Cetak / PDF" />
        </PageHead>
        <MonthBar path="/akuntansi/laporan/neraca" mode={mode} dari={dari} sampai={sampai} a={ma} b={mb} now={now} />
      </div>

      <ReportSheet site={site} npwp={npwp} title={banding ? "Neraca - Perbandingan 2 Kolom" : "Neraca per Akhir Bulan"} period={period} printedBy={me.name} sign>
        {!last.balanced ? <p className="alert alert-error">Neraca tidak seimbang. Periksa neraca saldo.</p> : <p className="balance-ok"><span aria-hidden="true">✓</span> Seimbang: total aset = kewajiban + modal ({formatAmount(last.assetTotal)}).</p>}
        <Kpis
          items={[
            { label: "Total aset", value: formatAmount(last.assetTotal), sub: banding ? <>vs {months[1].short} {chg(bs.per[0].assetTotal, bs.per[1].assetTotal)}</> : `akhir ${months[months.length - 1].short}` },
            { label: "Kas & bank", value: formatAmount(cash), sub: "uang yang siap dipakai" },
            { label: "Piutang", value: formatAmount(recv), sub: "tagihan ke pelanggan" },
            { label: "Kewajiban", value: formatAmount(last.liabTotal), sub: `modal ${formatAmount(last.equityTotal)}` },
            currentRatio != null ? { label: "Kemampuan bayar jangka pendek", value: `${currentRatio.toLocaleString("id-ID", { maximumFractionDigits: 1 })}×`, sub: "aset lancar ÷ kewajiban lancar" } : { label: "Modal", value: formatAmount(last.equityTotal) },
          ]}
        />
        <div className="report-two composition">
          <StackBar title="Aset dimiliki dalam bentuk" label="Komposisi aset" segments={[
            { label: "Kas & bank", value: cash, color: C[0] }, { label: "Piutang", value: recv, color: C[1] }, { label: "Persediaan", value: stock, color: C[2] },
            { label: "Aset tetap (setelah penyusutan)", value: fixed, color: C[3] }, { label: "Aset lancar lain", value: otherCur, color: C[4] },
          ]} />
          <StackBar title="Dibiayai oleh" label="Sumber dana" segments={[{ label: "Kewajiban (hutang)", value: last.liabTotal, color: C[1] }, { label: "Modal pemilik", value: last.equityTotal, color: C[0] }]} />
        </div>
        <div className="admin-table report lr-wide">
          <table>
            <thead><tr><th>Akun</th>{banding ? <><th className="num">Akhir {months[0].short}</th><th className="num">Akhir {months[1].short}</th><th className="num">Selisih</th><th className="num">Perubahan</th></> : months.map((m) => <th key={m.ym} className="num">{m.short}{m.partial ? "*" : ""}</th>)}</tr></thead>
            <tbody>
              <tr className="r-group"><th colSpan={cols}>ASET</th></tr>
              {lines(bs.assets)}
              <tr className="r-grand"><td>Total aset</td>{cells(tot((b) => b.assetTotal), true)}</tr>
              <tr className="r-group"><th colSpan={cols}>KEWAJIBAN</th></tr>
              {lines(bs.liabilities)}
              <tr className="r-sub"><td>Total kewajiban</td>{cells(tot((b) => b.liabTotal), true)}</tr>
              <tr className="r-group"><th colSpan={cols}>MODAL</th></tr>
              {lines(bs.equity)}
              <tr><td className="r-indent">Laba ditahan tahun-tahun lalu</td>{cells(tot((b) => b.priorYears))}</tr>
              <tr><td className="r-indent">Laba tahun berjalan</td>{cells(tot((b) => b.currentYear))}</tr>
              <tr className="r-sub"><td>Total modal</td>{cells(tot((b) => b.equityTotal), true)}</tr>
              <tr className="r-grand"><td>Total kewajiban &amp; modal</td>{cells(tot((b) => b.liabTotal + b.equityTotal), true)}</tr>
            </tbody>
          </table>
        </div>
        <ReadingNote>
          Satu kolom = saldo per akhir bulan itu. {months.some((m) => m.partial) && "* bulan berjalan: saldo sampai hari ini. "}Aset selalu sama dengan kewajiban + modal. Klik nama akun untuk melihat rinciannya.
        </ReadingNote>
      </ReportSheet>
    </>
  );
}
