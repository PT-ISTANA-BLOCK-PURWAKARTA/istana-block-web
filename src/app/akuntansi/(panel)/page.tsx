import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { ColumnChart } from "@/components/erp/ColumnChart";
import { Kpis, payStatus, PageHead, Rp, Status } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { BULAN, lastMonths, stockPosition, unbilledOrders } from "@/lib/erp/insights";
import { SOURCE_LABEL, sourceHref } from "@/lib/erp/links";
import { cashBalances, profitLoss } from "@/lib/erp/reports";
import { loadAccounts } from "@/lib/erp/server";
import { addDays, formatAmount, formatQty, monthStart, tgl, today } from "@/lib/erp/util";

export const metadata = { title: "Ringkasan" };

const C_BILLED = "#3d63c4";
const C_RECEIVED = "#dd6a2c";

export default async function KeuanganHome() {
  await requireModule("keuangan");
  const db = await getDb();
  const now = today();
  const acc = await loadAccounts(db);
  const months = lastMonths(now, 6);
  const deposit = acc.sys("uang_muka_pelanggan");
  const [cash, pl, ar, ap, dueSoon, overdueList, recent, billed, received, unbilled, materials] = await Promise.all([
    cashBalances(db, acc.rows, now),
    profitLoss(db, acc.rows, monthStart(now), now),
    db.get<{ n: number; s: number; late: number; lateSum: number }>(sql`
      select count(*) n, coalesce(sum(total - paid),0) s,
        sum(case when due_date < ${now} then 1 else 0 end) late, coalesce(sum(case when due_date < ${now} then total - paid else 0 end),0) lateSum
      from fin_invoices where void = 0 and paid < total`),
    db.get<{ n: number; s: number; soon: number }>(sql`
      select count(*) n, coalesce(sum(total - paid),0) s, coalesce(sum(case when due_date <= ${addDays(now, 7)} then total - paid else 0 end),0) soon
      from fin_bills where void = 0 and paid < total`),
    db.all<{ id: string; number: string; dueDate: string; total: number; paid: number; name: string }>(sql`
      select b.id, b.number, b.due_date as dueDate, b.total, b.paid, c.name from fin_bills b join fin_contacts c on c.id = b.contact_id
      where b.void = 0 and b.paid < b.total and b.due_date <= ${addDays(now, 14)} order by b.due_date limit 6`),
    db.all<{ id: string; number: string; dueDate: string; total: number; paid: number; name: string }>(sql`
      select i.id, i.number, i.due_date as dueDate, i.total, i.paid, c.name from fin_invoices i join fin_contacts c on c.id = i.contact_id
      where i.void = 0 and i.paid < i.total order by i.due_date limit 7`),
    db.select().from(schema.journals).orderBy(desc(schema.journals.date), desc(schema.journals.createdAt)).limit(7),
    db.all<{ ym: string; v: number }>(sql`select substr(date,1,7) ym, sum(total) v from fin_invoices where void = 0 and date >= ${`${months[0]}-01`} group by ym`),
    db.all<{ ym: string; v: number }>(sql`select substr(date,1,7) ym, sum(amount) v from fin_receipts where account_id <> ${deposit} and date >= ${`${months[0]}-01`} group by ym`),
    unbilledOrders(db),
    stockPosition(db, "bahan_baku"),
  ]);
  const cashTotal = cash.reduce((a, r) => a + r.balance, 0);
  const byMonth = (rows: { ym: string; v: number }[]) => months.map((m) => Number(rows.find((r) => r.ym === m)?.v ?? 0));
  const lowMaterials = materials.filter((m) => m.minStock > 0 && m.onHand < m.minStock);
  const unbilledTotal = unbilled.reduce((a, r) => a + r.unbilled, 0);
  const late = Number(ar?.late ?? 0);

  return (
    <>
      <PageHead title="Ringkasan keuangan" sub={`Per ${tgl(now)}`}>
        <Link href="/akuntansi/penjualan/baru" className="btn btn-primary btn-sm">+ Faktur penjualan</Link>
        <Link href="/akuntansi/penerimaan/baru" className="btn btn-blue btn-sm">+ Penerimaan</Link>
        <Link href="/akuntansi/kas/baru?jenis=keluar" className="btn btn-ghost btn-sm">+ Kas keluar</Link>
      </PageHead>

      <Kpis
        items={[
          { label: "Kas & bank", value: formatAmount(cashTotal), sub: `${cash.filter((c) => c.balance).length} rekening`, href: "/akuntansi/kas" },
          {
            label: "Piutang pelanggan",
            value: formatAmount(Number(ar?.s ?? 0)),
            sub: late ? `${late} faktur lewat jatuh tempo (${formatAmount(Number(ar?.lateSum ?? 0))})` : `${Number(ar?.n ?? 0)} faktur terbuka`,
            href: "/akuntansi/laporan/piutang",
            tone: late ? "warn" : undefined,
          },
          { label: "Belum difaktur", value: formatAmount(unbilledTotal), sub: `${unbilled.length} pesanan sudah diterima pelanggan`, tone: unbilled.length ? "warn" : undefined },
          { label: "Hutang ke pemasok", value: formatAmount(Number(ap?.s ?? 0)), sub: Number(ap?.soon ?? 0) ? `${formatAmount(Number(ap?.soon))} jatuh tempo ≤ 7 hari` : `${Number(ap?.n ?? 0)} faktur terbuka`, href: "/akuntansi/laporan/hutang" },
          { label: "Laba bersih bulan ini", value: formatAmount(pl.net), sub: `Pendapatan ${formatAmount(pl.revenue)}`, href: "/akuntansi/laporan/laba-rugi", tone: pl.net < 0 ? "bad" : undefined },
        ]}
      />

      <div className="dash-grid dash-3" style={{ marginBottom: 16 }}>
        <section className="admin-card">
          <div className="card-head"><h2>Ditagih & diterima, 6 bulan terakhir</h2><Link href="/akuntansi/laporan/penjualan">Laporan penjualan</Link></div>
          <ColumnChart
            label="Grafik nilai faktur penjualan dan uang diterima per bulan"
            categories={months.map((m) => BULAN[Number(m.slice(5, 7)) - 1])}
            series={[
              { name: "Ditagih (faktur, termasuk PPN)", color: C_BILLED, values: byMonth(billed) },
              { name: "Diterima (kas & bank)", color: C_RECEIVED, values: byMonth(received) },
            ]}
          />
          <p className="reading-note" style={{ marginTop: 8 }}>Biru: nilai faktur yang diterbitkan. Oranye: uang pelanggan yang benar-benar masuk. Biru yang jauh lebih tinggi berarti banyak tagihan belum dibayar; lihat <Link href="/akuntansi/laporan/piutang">umur piutang</Link>.</p>
        </section>
        <section className="admin-card">
          <div className="card-head"><h2>Saldo kas & bank</h2><Link href="/akuntansi/kas">Mutasi</Link></div>
          <table className="compact">
            <tbody>
              {cash.map((r) => (
                <tr key={r.account.id}>
                  <td><Link href={`/akuntansi/laporan/buku-besar?akun=${r.account.id}`}>{r.account.name}</Link><div className="small muted">{r.account.code}</div></td>
                  <td className="num"><Rp n={r.balance} /></td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><th>Total</th><th className="num"><Rp n={cashTotal} /></th></tr></tfoot>
          </table>
        </section>
      </div>

      <div className="dash-grid" style={{ marginBottom: 16 }}>
        <section className="admin-card">
          <div className="card-head"><h2>Siap difaktur</h2><span className="small muted">dari surat jalan yang sudah terkirim</span></div>
          <table className="compact">
            <tbody>
              {unbilled.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/operasional/pesanan/${o.id}`}>{o.number}</Link><div className="small muted">{o.contactName}{o.project ? ` · ${o.project}` : ""}</div></td>
                  <td className="small">terkirim {tgl(o.last)}</td>
                  <td className="num"><Rp n={o.unbilled} /><div><Link href={`/akuntansi/penjualan/baru?pesanan=${o.id}`} className="small">Buat faktur</Link></div></td>
                </tr>
              ))}
              {unbilled.length === 0 && <tr><td className="muted">Semua barang yang sudah terkirim sudah difaktur.</td></tr>}
            </tbody>
          </table>
        </section>
        <section className="admin-card">
          <div className="card-head"><h2>Tagihan ke pelanggan</h2><Link href="/akuntansi/laporan/piutang">Umur piutang</Link></div>
          <table className="compact">
            <tbody>
              {overdueList.map((d) => (
                <tr key={d.id}>
                  <td><Link href={`/akuntansi/penjualan/${d.id}`}>{d.number}</Link><div className="small muted">{d.name}</div></td>
                  <td className="small">jatuh tempo {tgl(d.dueDate)}<div><Status s={payStatus({ total: d.total, paid: d.paid, dueDate: d.dueDate })} /></div></td>
                  <td className="num"><Rp n={d.total - d.paid} /></td>
                </tr>
              ))}
              {overdueList.length === 0 && <tr><td className="muted">Tidak ada tagihan terbuka.</td></tr>}
            </tbody>
          </table>
        </section>
        <section className="admin-card">
          <div className="card-head"><h2>Hutang jatuh tempo 14 hari</h2><Link href="/akuntansi/laporan/hutang">Umur hutang</Link></div>
          <table className="compact">
            <tbody>
              {dueSoon.map((b) => (
                <tr key={b.id}>
                  <td><Link href={`/akuntansi/pembelian/${b.id}`}>{b.number}</Link><div className="small muted">{b.name}</div></td>
                  <td className="small">{b.dueDate < now ? <span className="text-bahaya">lewat {tgl(b.dueDate)}</span> : <>jatuh tempo {tgl(b.dueDate)}</>}</td>
                  <td className="num"><Rp n={b.total - b.paid} /></td>
                </tr>
              ))}
              {dueSoon.length === 0 && <tr><td className="muted">Tidak ada hutang yang jatuh tempo dalam 14 hari.</td></tr>}
            </tbody>
          </table>
        </section>
        <section className="admin-card">
          <div className="card-head"><h2>Bahan baku perlu dibeli</h2><Link href="/operasional/stok?jenis=bahan_baku">Stok bahan</Link></div>
          <table className="compact">
            <tbody>
              {lowMaterials.map((m) => (
                <tr key={m.id}>
                  <td><Link href={`/operasional/stok/${m.id}`}>{m.name}</Link><div className="small muted">{m.code}</div></td>
                  <td className="num text-warn">{formatQty(m.onHand)} {m.unit}<div className="small muted">min. {formatQty(m.minStock)}</div></td>
                  <td className="num"><Link href="/akuntansi/pembelian/baru" className="small">Catat pembelian</Link></td>
                </tr>
              ))}
              {lowMaterials.length === 0 && <tr><td className="muted">Stok bahan baku masih di atas batas minimum.</td></tr>}
            </tbody>
          </table>
        </section>
        <section className="admin-card span-2">
          <div className="card-head"><h2>Transaksi terakhir</h2><Link href="/akuntansi/jurnal?semua=1">Semua jurnal</Link></div>
          <table className="compact">
            <tbody>
              {recent.map((j) => (
                <tr key={j.id}>
                  <td className="small" style={{ width: 110 }}>{tgl(j.date)}</td>
                  <td style={{ width: 170 }}><Link href={sourceHref(j.source, j.sourceId, j.id)}>{j.number}</Link><div className="small muted">{SOURCE_LABEL[j.source]}</div></td>
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
