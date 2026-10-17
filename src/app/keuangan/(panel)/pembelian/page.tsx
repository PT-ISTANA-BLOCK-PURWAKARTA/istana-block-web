import Link from "next/link";
import { and, desc, eq, gte, like, lte, or, sql } from "drizzle-orm";
import { Ok, PageHead, payStatus, Rp, Status } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { isDate, monthStart, tgl, today } from "@/lib/erp/util";

export const metadata = { title: "Faktur pembelian" };

export default async function Pembelian({ searchParams }: { searchParams: Promise<{ ok?: string; q?: string; status?: string; from?: string; to?: string }> }) {
  await requireModule("keuangan");
  const sp = await searchParams;
  const now = today();
  const from = isDate(sp.from) ? sp.from : sp.status ? "2000-01-01" : monthStart(now);
  const to = isDate(sp.to) ? sp.to : now;
  const db = await getDb();
  const rows = await db
    .select({ b: schema.bills, c: schema.contacts })
    .from(schema.bills)
    .innerJoin(schema.contacts, eq(schema.contacts.id, schema.bills.contactId))
    .where(
      and(
        gte(schema.bills.date, from),
        lte(schema.bills.date, to),
        sp.q ? or(like(schema.bills.number, `%${sp.q}%`), like(schema.bills.supplierRef, `%${sp.q}%`), like(schema.contacts.name, `%${sp.q}%`)) : undefined,
        sp.status === "terbuka" ? sql`${schema.bills.paid} < ${schema.bills.total}` : undefined,
        sp.status === "lunas" ? sql`${schema.bills.paid} >= ${schema.bills.total}` : undefined,
      ),
    )
    .orderBy(desc(schema.bills.date), desc(schema.bills.number))
    .limit(300);
  const sum = rows.reduce((a, r) => ({ total: a.total + r.b.total, open: a.open + r.b.total - r.b.paid }), { total: 0, open: 0 });
  return (
    <>
      <PageHead title="Faktur pembelian" sub="Pembelian bahan baku, barang, dan biaya dari pemasok.">
        <Link href="/keuangan/pembelian/baru" className="btn btn-primary btn-sm">+ Pembelian</Link>
      </PageHead>
      <Ok ok={sp.ok} />
      <form className="filter-bar" method="get">
        <div className="field grow"><label htmlFor="q">Cari</label><input id="q" name="q" defaultValue={sp.q} placeholder="nomor, no. faktur pemasok, atau pemasok" /></div>
        <div className="field">
          <label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={sp.status ?? ""}>
            <option value="">Semua</option>
            <option value="terbuka">Belum lunas</option>
            <option value="lunas">Lunas</option>
          </select>
        </div>
        <div className="field"><label htmlFor="from">Dari</label><input id="from" name="from" type="date" defaultValue={from === "2000-01-01" ? "" : from} /></div>
        <div className="field"><label htmlFor="to">Sampai</label><input id="to" name="to" type="date" defaultValue={to} /></div>
        <button className="btn btn-blue btn-sm" type="submit">Tampilkan</button>
      </form>
      <div className="admin-table">
        <table>
          <thead><tr><th>Tanggal</th><th>Nomor</th><th>Pemasok</th><th>Jatuh tempo</th><th>Status</th><th className="num">Total</th><th className="num">Sisa</th></tr></thead>
          <tbody>
            {rows.map(({ b, c }) => (
              <tr key={b.id}>
                <td>{tgl(b.date)}</td>
                <td><Link href={`/keuangan/pembelian/${b.id}`}><b>{b.number}</b></Link>{b.supplierRef && <div className="small muted">{b.supplierRef}</div>}</td>
                <td>{c.name}</td>
                <td>{tgl(b.dueDate)}</td>
                <td><Status s={payStatus(b)} /></td>
                <td className="num"><Rp n={b.total} /></td>
                <td className="num"><Rp n={b.total - b.paid} /></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="muted">Tidak ada faktur pembelian pada filter ini.</td></tr>}
          </tbody>
          {rows.length > 0 && <tfoot><tr><th colSpan={5}>{rows.length} faktur</th><th className="num"><Rp n={sum.total} /></th><th className="num"><Rp n={sum.open} /></th></tr></tfoot>}
        </table>
      </div>
    </>
  );
}
