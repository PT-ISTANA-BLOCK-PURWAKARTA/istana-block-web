import Link from "next/link";
import { Fragment } from "react";
import { PrintButton } from "@/components/erp/PrintButton";
import { PeriodBar } from "@/components/erp/report/PeriodBar";
import { ReadingNote, ReportSheet } from "@/components/erp/report/ReportSheet";
import { StackBar } from "@/components/erp/report/StackBar";
import { BackLink, Kpis, PageHead } from "@/components/erp/ui";
import { GROUP_LABEL } from "@/lib/erp/accounting";
import { asOfPresets } from "@/lib/erp/periods";
import { reportContext } from "@/lib/erp/reportctx";
import { balanceSheet, type Row } from "@/lib/erp/reports";
import { addDays, formatAmount, isDate, monthStart, tgl, tglPanjang, today } from "@/lib/erp/util";

export const metadata = { title: "Neraca" };

// Palet kategori yang sudah diuji (beda jelas juga bagi buta warna); urutan tetap.
const C = ["#3d63c4", "#dd6a2c", "#1baf7a", "#eda100", "#6250d6"];

const shown = (r: Row) => (r.account.group === "akum_penyusutan" ? -r.balance : r.balance);

function Lines({ rows, prev }: { rows: Row[]; prev: Map<string, number> }) {
  let last = "";
  return (
    <>
      {rows.map((r) => {
        const head = r.account.group !== last ? GROUP_LABEL[r.account.group] : null;
        last = r.account.group;
        return (
          <Fragment key={r.account.id}>
            {head && <tr className="r-sub-head"><td colSpan={3}>{head}</td></tr>}
            <tr>
              <td className="r-indent"><Link href={`/akuntansi/laporan/buku-besar?akun=${r.account.id}`}><span className="tabular muted">{r.account.code}</span> {r.account.name}</Link></td>
              <td className="num tabular">{formatAmount(shown(r))}</td>
              <td className="num tabular muted">{formatAmount(prev.get(r.account.id) ?? 0, { blankZero: true })}</td>
            </tr>
          </Fragment>
        );
      })}
    </>
  );
}

export default async function Neraca({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  const { me, db, acc, site, npwp } = await reportContext();
  const sp = await searchParams;
  const to = isDate(sp.to) ? sp.to : today();
  // Pembanding: akhir bulan sebelumnya.
  const prevTo = addDays(monthStart(to), -1);
  const [bs, pb] = await Promise.all([balanceSheet(db, acc.rows, to), balanceSheet(db, acc.rows, prevTo)]);
  const prev = new Map([...pb.assets, ...pb.liabilities, ...pb.equity].map((r) => [r.account.id, shown(r)]));
  const sum = (rows: Row[], groups: string[]) => rows.filter((r) => groups.includes(r.account.group)).reduce((a, r) => a + shown(r), 0);
  const cash = sum(bs.assets, ["kas_bank"]);
  const recv = sum(bs.assets, ["piutang"]);
  const stock = sum(bs.assets, ["persediaan"]);
  const otherCur = sum(bs.assets, ["aset_lancar_lain"]);
  const fixed = sum(bs.assets, ["aset_tetap", "akum_penyusutan"]);
  const curLiab = sum(bs.liabilities, ["hutang_usaha", "hutang_lain"]);
  const currentRatio = curLiab > 0 ? (cash + recv + stock + otherCur) / curLiab : null;
  const prevLabel = `Per ${tgl(prevTo)}`;

  return (
    <>
      <div className="no-print">
        <BackLink href="/akuntansi/laporan">Laporan</BackLink>
        <PageHead title="Neraca" sub="Apa yang dimiliki usaha, dan dari mana asalnya, pada satu tanggal.">
          <a className="btn btn-ghost btn-sm" href={`/akuntansi/ekspor/neraca?to=${to}`}>Unduh CSV (Excel)</a>
          <PrintButton label="Cetak / PDF" />
        </PageHead>
        <PeriodBar path="/akuntansi/laporan/neraca" presets={asOfPresets()} to={to} single />
      </div>

      <ReportSheet site={site} npwp={npwp} title="Neraca" period={`Per ${tglPanjang(to)}`} printedBy={me.name} sign>
        {!bs.balanced ? (
          <p className="alert alert-error">Neraca tidak seimbang. Periksa neraca saldo.</p>
        ) : (
          <p className="balance-ok"><span aria-hidden="true">✓</span> Seimbang: total aset sama dengan kewajiban + modal ({formatAmount(bs.assetTotal)}).</p>
        )}
        <Kpis
          items={[
            { label: "Total aset", value: formatAmount(bs.assetTotal), sub: `akhir bulan lalu ${formatAmount(pb.assetTotal)}` },
            { label: "Kas & bank", value: formatAmount(cash), sub: "uang yang siap dipakai" },
            { label: "Piutang", value: formatAmount(recv), sub: "tagihan ke pelanggan" },
            { label: "Kewajiban", value: formatAmount(bs.liabTotal), sub: `modal pemilik ${formatAmount(bs.equityTotal)}` },
            currentRatio != null
              ? { label: "Kemampuan bayar jangka pendek", value: `${currentRatio.toLocaleString("id-ID", { maximumFractionDigits: 1 })}×`, sub: "aset lancar ÷ kewajiban lancar; makin besar makin longgar" }
              : { label: "Modal pemilik", value: formatAmount(bs.equityTotal), sub: `termasuk laba tahun ini ${formatAmount(bs.currentYear)}` },
          ]}
        />
        <div className="report-two composition">
          <StackBar
            title="Aset dimiliki dalam bentuk"
            label="Komposisi aset"
            segments={[
              { label: "Kas & bank", value: cash, color: C[0] },
              { label: "Piutang", value: recv, color: C[1] },
              { label: "Persediaan", value: stock, color: C[2] },
              { label: "Aset tetap (setelah penyusutan)", value: fixed, color: C[3] },
              { label: "Aset lancar lain", value: otherCur, color: C[4] },
            ]}
          />
          <StackBar
            title="Dibiayai oleh"
            label="Sumber dana"
            segments={[
              { label: "Kewajiban (hutang)", value: bs.liabTotal, color: C[1] },
              { label: "Modal pemilik", value: bs.equityTotal, color: C[0] },
            ]}
          />
        </div>

        <div className="report-two">
          <div className="admin-table report">
            <table>
              <thead><tr><th>Aset</th><th className="num">{tgl(to)}</th><th className="num">{prevLabel}</th></tr></thead>
              <tbody>
                <Lines rows={bs.assets} prev={prev} />
                <tr className="r-grand"><td>Total aset</td><td className="num"><b className="tabular">{formatAmount(bs.assetTotal)}</b></td><td className="num tabular">{formatAmount(pb.assetTotal)}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="admin-table report">
            <table>
              <thead><tr><th>Kewajiban &amp; modal</th><th className="num">{tgl(to)}</th><th className="num">{prevLabel}</th></tr></thead>
              <tbody>
                <tr className="r-group"><th colSpan={3}>Kewajiban</th></tr>
                <Lines rows={bs.liabilities} prev={prev} />
                <tr className="r-sub"><td>Total kewajiban</td><td className="num"><b className="tabular">{formatAmount(bs.liabTotal)}</b></td><td className="num tabular">{formatAmount(pb.liabTotal)}</td></tr>
                <tr className="r-group"><th colSpan={3}>Modal</th></tr>
                <Lines rows={bs.equity} prev={prev} />
                <tr><td className="r-indent">Laba ditahan tahun-tahun lalu</td><td className="num tabular">{formatAmount(bs.priorYears)}</td><td className="num tabular muted">{formatAmount(pb.priorYears)}</td></tr>
                <tr><td className="r-indent">Laba tahun berjalan</td><td className="num tabular">{formatAmount(bs.currentYear)}</td><td className="num tabular muted">{formatAmount(pb.currentYear)}</td></tr>
                <tr className="r-sub"><td>Total modal</td><td className="num"><b className="tabular">{formatAmount(bs.equityTotal)}</b></td><td className="num tabular">{formatAmount(pb.equityTotal)}</td></tr>
                <tr className="r-grand"><td>Total kewajiban &amp; modal</td><td className="num"><b className="tabular">{formatAmount(bs.liabTotal + bs.equityTotal)}</b></td><td className="num tabular">{formatAmount(pb.liabTotal + pb.equityTotal)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <ReadingNote>
          Kiri: semua yang dimiliki usaha. Kanan: dari mana asalnya, yaitu hutang ke pihak lain dan modal pemilik (termasuk laba yang belum dibagi). Kedua sisi
          selalu sama besar. Klik nama akun untuk melihat rinciannya.
        </ReadingNote>
      </ReportSheet>
    </>
  );
}
