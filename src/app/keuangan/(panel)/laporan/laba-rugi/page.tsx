import Link from "next/link";
import { PrintButton } from "@/components/erp/PrintButton";
import { BackLink, PageHead, RangeForm, Rp } from "@/components/erp/ui";
import { getDb } from "@/db";
import { requireModule } from "@/lib/auth";
import { profitLoss, type Row } from "@/lib/erp/reports";
import { loadAccounts } from "@/lib/erp/server";
import { isDate, monthStart, tglPanjang, today } from "@/lib/erp/util";

export const metadata = { title: "Laba rugi" };

function Group({ title, rows, total, label }: { title: string; rows: Row[]; total: number; label: string }) {
  return (
    <>
      <tr className="r-group"><th colSpan={2}>{title}</th></tr>
      {rows.map((r) => (
        <tr key={r.account.id}>
          <td className="r-indent"><Link href={`/keuangan/laporan/buku-besar?akun=${r.account.id}`}><span className="tabular muted">{r.account.code}</span> {r.account.name}</Link></td>
          <td className="num"><Rp n={r.balance} /></td>
        </tr>
      ))}
      <tr className="r-sub"><td>{label}</td><td className="num"><Rp n={total} strong /></td></tr>
    </>
  );
}

export default async function LabaRugi({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requireModule("keuangan");
  const sp = await searchParams;
  const to = isDate(sp.to) ? sp.to : today();
  const from = isDate(sp.from) ? sp.from : monthStart(to);
  const db = await getDb();
  const acc = await loadAccounts(db);
  const pl = await profitLoss(db, acc.rows, from, to);
  const g = (k: string) => pl.rows.filter((r) => r.account.group === k);
  return (
    <>
      <BackLink href="/keuangan/laporan">Laporan</BackLink>
      <PageHead title="Laba rugi" sub={`${tglPanjang(from)} – ${tglPanjang(to)}`}>
        <a className="btn btn-ghost btn-sm" href={`/keuangan/ekspor/laba-rugi?from=${from}&to=${to}`}>Unduh CSV</a>
        <PrintButton />
      </PageHead>
      <RangeForm from={from} to={to} />
      <div className="admin-table report">
        <table>
          <tbody>
            <Group title="Pendapatan" rows={g("pendapatan")} total={pl.revenue} label="Total pendapatan" />
            <Group title="Harga pokok penjualan" rows={g("hpp")} total={pl.cogs} label="Total HPP" />
            <tr className="r-total"><td>Laba kotor</td><td className="num"><Rp n={pl.gross} strong /></td></tr>
            <Group title="Beban usaha" rows={g("beban")} total={pl.opex} label="Total beban usaha" />
            <tr className="r-total"><td>Laba usaha</td><td className="num"><Rp n={pl.operating} strong /></td></tr>
            {(g("pendapatan_lain").length > 0 || g("beban_lain").length > 0) && (
              <>
                <Group title="Pendapatan lain-lain" rows={g("pendapatan_lain")} total={pl.otherIncome} label="Total pendapatan lain" />
                <Group title="Beban lain-lain" rows={g("beban_lain")} total={pl.otherExpense} label="Total beban lain" />
              </>
            )}
            <tr className="r-grand"><td>Laba (rugi) bersih</td><td className="num"><Rp n={pl.net} strong /></td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
