import Link from "next/link";
import { PrintButton } from "@/components/erp/PrintButton";
import { BackLink, PageHead, RangeForm } from "@/components/erp/ui";
import { getDb } from "@/db";
import { requireModule } from "@/lib/auth";
import { GROUP_LABEL } from "@/lib/erp/accounting";
import { SOURCE_LABEL, sourceHref } from "@/lib/erp/links";
import { ledger } from "@/lib/erp/reports";
import { loadAccounts } from "@/lib/erp/server";
import { formatAmount, isDate, monthStart, tgl, tglPanjang, today } from "@/lib/erp/util";

export const metadata = { title: "Buku besar" };

export default async function BukuBesar({ searchParams }: { searchParams: Promise<{ akun?: string; from?: string; to?: string }> }) {
  await requireModule("keuangan");
  const sp = await searchParams;
  const to = isDate(sp.to) ? sp.to : today();
  const from = isDate(sp.from) ? sp.from : monthStart(to);
  const db = await getDb();
  const acc = await loadAccounts(db);
  const account = acc.byId.get(sp.akun ?? "") ?? acc.byId.get(acc.sys("kas"));
  if (!account) return null;
  const lg = await ledger(db, account, from, to);
  const sorted = [...acc.rows].sort((a, b) => a.code.localeCompare(b.code));
  return (
    <>
      <BackLink href="/keuangan/laporan">Laporan</BackLink>
      <PageHead title={`Buku besar · ${account.name}`} sub={`${account.code} · ${GROUP_LABEL[account.group]} · ${tglPanjang(from)} – ${tglPanjang(to)}`}>
        <a className="btn btn-ghost btn-sm" href={`/keuangan/ekspor/buku-besar?akun=${account.id}&from=${from}&to=${to}`}>Unduh CSV</a>
        <PrintButton />
      </PageHead>
      <RangeForm
        from={from}
        to={to}
        extra={
          <div className="field grow">
            <label htmlFor="akun">Akun</label>
            <select id="akun" name="akun" defaultValue={account.id}>
              {sorted.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
            </select>
          </div>
        }
      />
      <div className="admin-table report">
        <table>
          <thead><tr><th>Tanggal</th><th>Nomor</th><th>Keterangan</th><th className="num">Debit</th><th className="num">Kredit</th><th className="num">Saldo</th></tr></thead>
          <tbody>
            <tr className="r-sub"><td colSpan={5}>Saldo awal</td><td className="num">{formatAmount(lg.opening)}</td></tr>
            {lg.rows.map((r, i) => (
              <tr key={i}>
                <td>{tgl(r.date)}</td>
                <td><Link href={sourceHref(r.source, r.sourceId, r.journalId)}>{r.number}</Link><div className="small muted">{SOURCE_LABEL[r.source]}</div></td>
                <td className="small">{r.lineMemo || r.memo}{r.contactName && <div className="muted">{r.contactName}</div>}</td>
                <td className="num">{formatAmount(r.debit, { blankZero: true })}</td>
                <td className="num">{formatAmount(r.credit, { blankZero: true })}</td>
                <td className="num">{formatAmount(r.balance)}</td>
              </tr>
            ))}
            {lg.rows.length === 0 && <tr><td colSpan={6} className="muted">Tidak ada mutasi pada periode ini.</td></tr>}
          </tbody>
          <tfoot><tr><th colSpan={3}>Mutasi &amp; saldo akhir</th><th className="num">{formatAmount(lg.totalDebit)}</th><th className="num">{formatAmount(lg.totalCredit)}</th><th className="num">{formatAmount(lg.closing)}</th></tr></tfoot>
        </table>
      </div>
    </>
  );
}
