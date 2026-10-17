import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { payStatus, PageHead, Rp, Status } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { cashBalances, profitLoss } from "@/lib/erp/reports";
import { SOURCE_LABEL, sourceHref } from "@/lib/erp/links";
import { loadAccounts } from "@/lib/erp/server";
import { formatAmount, monthStart, tgl, today } from "@/lib/erp/util";

export const metadata = { title: "Ringkasan" };

export default async function KeuanganHome() {
  await requireModule("keuangan");
  const db = await getDb();
  const now = today();
  const acc = await loadAccounts(db);
  const [cash, pl, ar, ap, overdue, recent] = await Promise.all([
    cashBalances(db, acc.rows, now),
    profitLoss(db, acc.rows, monthStart(now), now),
    db.get<{ n: number; s: number }>(sql`select count(*) n, coalesce(sum(total - paid),0) s from fin_invoices where void = 0 and paid < total`),
    db.get<{ n: number; s: number }>(sql`select count(*) n, coalesce(sum(total - paid),0) s from fin_bills where void = 0 and paid < total`),
    db.all<{ id: string; number: string; dueDate: string; total: number; paid: number; name: string }>(sql`
      select i.id, i.number, i.due_date as dueDate, i.total, i.paid, c.name from fin_invoices i join fin_contacts c on c.id = i.contact_id
      where i.void = 0 and i.paid < i.total order by i.due_date limit 8`),
    db.select().from(schema.journals).orderBy(desc(schema.journals.createdAt)).limit(8),
  ]);
  const cashTotal = cash.reduce((a, r) => a + r.balance, 0);
  return (
    <>
      <PageHead title="Ringkasan keuangan" sub={`Per ${tgl(now)}`}>
        <Link href="/keuangan/penjualan/baru" className="btn btn-primary btn-sm">+ Faktur penjualan</Link>
        <Link href="/keuangan/penerimaan/baru" className="btn btn-blue btn-sm">+ Penerimaan</Link>
        <Link href="/keuangan/kas/baru?jenis=keluar" className="btn btn-ghost btn-sm">+ Kas keluar</Link>
      </PageHead>
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat"><span className="muted small">Kas &amp; bank</span><b>{formatAmount(cashTotal)}</b></div>
        <div className="stat"><span className="muted small">Piutang belum dibayar · {Number(ar?.n ?? 0)} faktur</span><b>{formatAmount(Number(ar?.s ?? 0))}</b></div>
        <div className="stat"><span className="muted small">Hutang belum dibayar · {Number(ap?.n ?? 0)} faktur</span><b>{formatAmount(Number(ap?.s ?? 0))}</b></div>
        <div className="stat"><span className="muted small">Pendapatan bulan ini</span><b>{formatAmount(pl.revenue)}</b></div>
        <div className="stat"><span className="muted small">Laba bersih bulan ini</span><b className={pl.net < 0 ? "text-bahaya" : ""}>{formatAmount(pl.net)}</b></div>
      </div>
      <div className="dash-grid">
        <section className="admin-card">
          <div className="card-head"><h2>Tagihan terdekat</h2><Link href="/keuangan/laporan/piutang">Umur piutang →</Link></div>
          <table className="compact">
            <tbody>
              {overdue.map((d) => (
                <tr key={d.id}>
                  <td><Link href={`/keuangan/penjualan/${d.id}`}><b>{d.number}</b></Link><div className="small muted">{d.name}</div></td>
                  <td className="small">jatuh tempo {tgl(d.dueDate)}<div><Status s={payStatus({ total: d.total, paid: d.paid, dueDate: d.dueDate })} /></div></td>
                  <td className="num"><Rp n={d.total - d.paid} /></td>
                </tr>
              ))}
              {overdue.length === 0 && <tr><td className="muted">Tidak ada tagihan terbuka.</td></tr>}
            </tbody>
          </table>
        </section>
        <section className="admin-card">
          <div className="card-head"><h2>Saldo kas &amp; bank</h2><Link href="/keuangan/kas">Mutasi →</Link></div>
          <table className="compact">
            <tbody>
              {cash.map((r) => (
                <tr key={r.account.id}>
                  <td><Link href={`/keuangan/laporan/buku-besar?akun=${r.account.id}`}>{r.account.name}</Link><div className="small muted">{r.account.code}</div></td>
                  <td className="num"><Rp n={r.balance} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="admin-card span-2">
          <div className="card-head"><h2>Transaksi terakhir</h2><Link href="/keuangan/jurnal?semua=1">Semua jurnal →</Link></div>
          <table className="compact">
            <tbody>
              {recent.map((j) => (
                <tr key={j.id}>
                  <td className="small">{tgl(j.date)}</td>
                  <td><Link href={sourceHref(j.source, j.sourceId, j.id)}><b>{j.number}</b></Link><div className="small muted">{SOURCE_LABEL[j.source]}</div></td>
                  <td className="small">{j.memo}</td>
                </tr>
              ))}
              {recent.length === 0 && <tr><td className="muted">Belum ada transaksi. Mulai dengan memasukkan saldo awal lewat Jurnal umum, lalu buat faktur penjualan.</td></tr>}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
