import Link from "next/link";
import { Fragment } from "react";
import { PrintButton } from "@/components/erp/PrintButton";
import { PeriodBar } from "@/components/erp/report/PeriodBar";
import { ReadingNote, ReportSheet } from "@/components/erp/report/ReportSheet";
import { BackLink, PageHead } from "@/components/erp/ui";
import { GROUP_LABEL } from "@/lib/erp/accounting";
import { asOfPresets } from "@/lib/erp/periods";
import { reportContext } from "@/lib/erp/reportctx";
import { trialBalance } from "@/lib/erp/reports";
import { formatAmount, isDate, tglPanjang, today } from "@/lib/erp/util";

export const metadata = { title: "Neraca saldo" };

export default async function NeracaSaldo({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  const { me, db, acc, site, npwp } = await reportContext();
  const sp = await searchParams;
  const to = isDate(sp.to) ? sp.to : today();
  const tb = await trialBalance(db, acc.rows, to);
  const rows = tb.rows.filter((r) => r.nd || r.nc);
  const ok = tb.totalDebit === tb.totalCredit;
  let last = "";
  return (
    <>
      <div className="no-print">
        <BackLink href="/akuntansi/laporan">Laporan</BackLink>
        <PageHead title="Neraca saldo" sub="Saldo semua akun pada satu tanggal; dipakai untuk memastikan pembukuan seimbang.">
          <a className="btn btn-ghost btn-sm" href={`/akuntansi/ekspor/neraca-saldo?to=${to}`}>Unduh CSV (Excel)</a>
          <PrintButton label="Cetak / PDF" />
        </PageHead>
        <PeriodBar path="/akuntansi/laporan/neraca-saldo" presets={asOfPresets()} to={to} single />
      </div>
      <ReportSheet site={site} npwp={npwp} title="Neraca Saldo" period={`Per ${tglPanjang(to)}`} printedBy={me.name}>
        {ok ? (
          <p className="balance-ok"><span aria-hidden="true">✓</span> Seimbang: total debit sama dengan total kredit ({formatAmount(tb.totalDebit)}).</p>
        ) : (
          <p className="alert alert-error">Tidak seimbang: debit {formatAmount(tb.totalDebit)} ≠ kredit {formatAmount(tb.totalCredit)}. Hubungi pengembang.</p>
        )}
        <div className="admin-table report">
          <table>
            <thead><tr><th>Kode</th><th>Akun</th><th className="num">Debit</th><th className="num">Kredit</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const head = r.account.group !== last ? GROUP_LABEL[r.account.group] : null;
                last = r.account.group;
                return (
                  <Fragment key={r.account.id}>
                    {head && <tr className="r-sub-head"><td colSpan={4}>{head}</td></tr>}
                    <tr>
                      <td className="tabular">{r.account.code}</td>
                      <td><Link href={`/akuntansi/laporan/buku-besar?akun=${r.account.id}&to=${to}`}>{r.account.name}</Link></td>
                      <td className="num tabular">{formatAmount(r.nd, { blankZero: true })}</td>
                      <td className="num tabular">{formatAmount(r.nc, { blankZero: true })}</td>
                    </tr>
                  </Fragment>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={4} className="muted">Belum ada jurnal.</td></tr>}
            </tbody>
            <tfoot>
              <tr className={ok ? "" : "text-bahaya"}><th colSpan={2}>Total {ok ? "(seimbang)" : "(TIDAK seimbang)"}</th><th className="num">{formatAmount(tb.totalDebit)}</th><th className="num">{formatAmount(tb.totalCredit)}</th></tr>
            </tfoot>
          </table>
        </div>
        <ReadingNote>Akun aset dan biaya biasanya bersaldo debit; hutang, modal, dan pendapatan bersaldo kredit. Klik akun untuk membuka buku besarnya.</ReadingNote>
      </ReportSheet>
    </>
  );
}
