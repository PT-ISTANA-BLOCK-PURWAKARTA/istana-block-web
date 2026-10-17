import Link from "next/link";
import { PrintButton } from "@/components/erp/PrintButton";
import { BackLink, PageHead, RangeForm } from "@/components/erp/ui";
import { getDb } from "@/db";
import { requireModule } from "@/lib/auth";
import { aging } from "@/lib/erp/reports";
import { formatAmount, isDate, tgl, tglPanjang, today } from "@/lib/erp/util";

export const metadata = { title: "Umur hutang" };
const BUCKETS = ["Belum jatuh tempo", "1–30 hari", "31–60 hari", "61–90 hari", "> 90 hari"];

export default async function Umur({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  await requireModule("keuangan");
  const sp = await searchParams;
  const to = isDate(sp.to) ? sp.to : today();
  const db = await getDb();
  const ag = await aging(db, "hutang", to);
  return (
    <>
      <BackLink href="/keuangan/laporan">Laporan</BackLink>
      <PageHead title="Umur hutang" sub={`Per ${tglPanjang(to)} · total ${formatAmount(ag.grand)}`}>
        <a className="btn btn-ghost btn-sm" href={`/keuangan/ekspor/hutang?to=${to}`}>Unduh CSV</a>
        <PrintButton />
      </PageHead>
      <RangeForm to={to} single />
      <div className="admin-table report">
        <table>
          <thead><tr><th>Pemasok</th>{BUCKETS.map((b) => <th key={b} className="num">{b}</th>)}<th className="num">Total</th></tr></thead>
          <tbody>
            {ag.contacts.map((c) => (
              <tr key={c.id}>
                <td><Link href={`/keuangan/kontak/${c.id}`}><b>{c.name}</b></Link>
                  <div className="small muted">{c.docs.map((d) => <span key={d.id} style={{ marginRight: 8 }}><Link href={`/keuangan/pembelian/${d.id}`}>{d.number}</Link> ({tgl(d.dueDate)})</span>)}</div>
                </td>
                {c.buckets.map((v, i) => <td key={i} className={`num${i >= 3 && v ? " text-bahaya" : ""}`}>{formatAmount(v, { blankZero: true })}</td>)}
                <td className="num"><b>{formatAmount(c.total)}</b></td>
              </tr>
            ))}
            {ag.contacts.length === 0 && <tr><td colSpan={7} className="muted">Tidak ada saldo terbuka.</td></tr>}
          </tbody>
          <tfoot><tr><th>Total</th>{ag.totals.map((v, i) => <th key={i} className="num">{formatAmount(v)}</th>)}<th className="num">{formatAmount(ag.grand)}</th></tr></tfoot>
        </table>
      </div>
    </>
  );
}
