import Link from "next/link";
import { PrintButton } from "@/components/erp/PrintButton";
import { BackLink, PageHead, RangeForm } from "@/components/erp/ui";
import { getDb } from "@/db";
import { requireModule } from "@/lib/auth";
import { trialBalance } from "@/lib/erp/reports";
import { loadAccounts } from "@/lib/erp/server";
import { formatAmount, isDate, tglPanjang, today } from "@/lib/erp/util";

export const metadata = { title: "Neraca saldo" };

export default async function NeracaSaldo({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  await requireModule("keuangan");
  const sp = await searchParams;
  const to = isDate(sp.to) ? sp.to : today();
  const db = await getDb();
  const acc = await loadAccounts(db);
  const tb = await trialBalance(db, acc.rows, to);
  const rows = tb.rows.filter((r) => r.nd || r.nc);
  return (
    <>
      <BackLink href="/keuangan/laporan">Laporan</BackLink>
      <PageHead title="Neraca saldo" sub={`Per ${tglPanjang(to)}`}>
        <a className="btn btn-ghost btn-sm" href={`/keuangan/ekspor/neraca-saldo?to=${to}`}>Unduh CSV</a>
        <PrintButton />
      </PageHead>
      <RangeForm to={to} single />
      <div className="admin-table report">
        <table>
          <thead><tr><th>Kode</th><th>Akun</th><th className="num">Debit</th><th className="num">Kredit</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.account.id}>
                <td className="tabular">{r.account.code}</td>
                <td><Link href={`/keuangan/laporan/buku-besar?akun=${r.account.id}&to=${to}`}>{r.account.name}</Link></td>
                <td className="num">{formatAmount(r.nd, { blankZero: true })}</td>
                <td className="num">{formatAmount(r.nc, { blankZero: true })}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="muted">Belum ada jurnal.</td></tr>}
          </tbody>
          <tfoot>
            <tr className={tb.totalDebit === tb.totalCredit ? "" : "text-bahaya"}><th colSpan={2}>Total {tb.totalDebit === tb.totalCredit ? "(seimbang)" : "(TIDAK seimbang)"}</th><th className="num">{formatAmount(tb.totalDebit)}</th><th className="num">{formatAmount(tb.totalCredit)}</th></tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
