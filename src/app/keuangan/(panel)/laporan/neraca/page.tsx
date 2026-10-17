import Link from "next/link";
import { Fragment } from "react";
import { PrintButton } from "@/components/erp/PrintButton";
import { BackLink, PageHead, RangeForm, Rp } from "@/components/erp/ui";
import { getDb } from "@/db";
import { requireModule } from "@/lib/auth";
import { GROUP_LABEL } from "@/lib/erp/accounting";
import { balanceSheet, type Row } from "@/lib/erp/reports";
import { loadAccounts } from "@/lib/erp/server";
import { isDate, tglPanjang, today } from "@/lib/erp/util";

export const metadata = { title: "Neraca" };

function Lines({ rows, negateAkum }: { rows: Row[]; negateAkum?: boolean }) {
  let last = "";
  return (
    <>
      {rows.map((r) => {
        const head = r.account.group !== last ? GROUP_LABEL[r.account.group] : null;
        last = r.account.group;
        return (
          <Fragment key={r.account.id}>
            {head && <tr className="r-sub-head"><td colSpan={2}>{head}</td></tr>}
            <tr>
              <td className="r-indent"><Link href={`/keuangan/laporan/buku-besar?akun=${r.account.id}`}><span className="tabular muted">{r.account.code}</span> {r.account.name}</Link></td>
              <td className="num"><Rp n={negateAkum && r.account.group === "akum_penyusutan" ? -r.balance : r.balance} /></td>
            </tr>
          </Fragment>
        );
      })}
    </>
  );
}

export default async function Neraca({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  await requireModule("keuangan");
  const sp = await searchParams;
  const to = isDate(sp.to) ? sp.to : today();
  const db = await getDb();
  const acc = await loadAccounts(db);
  const bs = await balanceSheet(db, acc.rows, to);
  return (
    <>
      <BackLink href="/keuangan/laporan">Laporan</BackLink>
      <PageHead title="Neraca" sub={`Per ${tglPanjang(to)}`}>
        <a className="btn btn-ghost btn-sm" href={`/keuangan/ekspor/neraca?to=${to}`}>Unduh CSV</a>
        <PrintButton />
      </PageHead>
      <RangeForm to={to} single />
      {!bs.balanced && <p className="alert alert-error" style={{ marginBottom: 16 }}>Neraca tidak seimbang. Periksa neraca saldo.</p>}
      <div className="report-two">
        <div className="admin-table report">
          <table>
            <tbody>
              <tr className="r-group"><th colSpan={2}>Aset</th></tr>
              <Lines rows={bs.assets} negateAkum />
              <tr className="r-grand"><td>Total aset</td><td className="num"><Rp n={bs.assetTotal} strong /></td></tr>
            </tbody>
          </table>
        </div>
        <div className="admin-table report">
          <table>
            <tbody>
              <tr className="r-group"><th colSpan={2}>Kewajiban</th></tr>
              <Lines rows={bs.liabilities} />
              <tr className="r-sub"><td>Total kewajiban</td><td className="num"><Rp n={bs.liabTotal} strong /></td></tr>
              <tr className="r-group"><th colSpan={2}>Modal</th></tr>
              <Lines rows={bs.equity} />
              <tr><td className="r-indent">Laba ditahan tahun-tahun lalu</td><td className="num"><Rp n={bs.priorYears} /></td></tr>
              <tr><td className="r-indent">Laba tahun berjalan</td><td className="num"><Rp n={bs.currentYear} /></td></tr>
              <tr className="r-sub"><td>Total modal</td><td className="num"><Rp n={bs.equityTotal} strong /></td></tr>
              <tr className="r-grand"><td>Total kewajiban &amp; modal</td><td className="num"><Rp n={bs.liabTotal + bs.equityTotal} strong /></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
