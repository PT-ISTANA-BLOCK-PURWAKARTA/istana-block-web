import Link from "next/link";
import { and, desc, eq, gte, like, lte, or, sql } from "drizzle-orm";
import { Ok, PageHead, payStatus, Rp, Status } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { isDate, monthStart, tgl, today } from "@/lib/erp/util";

export const metadata = { title: "Faktur penjualan" };

export default async function Penjualan({ searchParams }: { searchParams: Promise<{ ok?: string; q?: string; status?: string; from?: string; to?: string }> }) {
  await requireModule("keuangan");
  const sp = await searchParams;
  const now = today();
  const from = isDate(sp.from) ? sp.from : sp.status ? "2000-01-01" : monthStart(now);
  const to = isDate(sp.to) ? sp.to : now;
  const db = await getDb();
  const rows = await db
    .select({ i: schema.invoices, c: schema.contacts })
    .from(schema.invoices)
    .innerJoin(schema.contacts, eq(schema.contacts.id, schema.invoices.contactId))
    .where(
      and(
        gte(schema.invoices.date, from),
        lte(schema.invoices.date, to),
        sp.q ? or(like(schema.invoices.number, `%${sp.q}%`), like(schema.contacts.name, `%${sp.q}%`)) : undefined,
        sp.status === "terbuka" ? sql`${schema.invoices.paid} < ${schema.invoices.total}` : undefined,
        sp.status === "jatuh-tempo" ? sql`${schema.invoices.paid} < ${schema.invoices.total} and ${schema.invoices.dueDate} < ${now}` : undefined,
        sp.status === "lunas" ? sql`${schema.invoices.paid} >= ${schema.invoices.total}` : undefined,
      ),
    )
    .orderBy(desc(schema.invoices.date), desc(schema.invoices.number))
    .limit(300);
  const sum = rows.reduce((a, r) => ({ total: a.total + r.i.total, open: a.open + r.i.total - r.i.paid }), { total: 0, open: 0 });
  return (
    <>
      <PageHead title="Faktur penjualan">
        <Link href="/keuangan/penjualan/baru" className="btn btn-primary btn-sm">+ Faktur</Link>
      </PageHead>
      <Ok ok={sp.ok} />
      <form className="filter-bar" method="get">
        <div className="field grow"><label htmlFor="q">Cari</label><input id="q" name="q" defaultValue={sp.q} placeholder="nomor atau pelanggan" /></div>
        <div className="field">
          <label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={sp.status ?? ""}>
            <option value="">Semua</option>
            <option value="terbuka">Belum lunas</option>
            <option value="jatuh-tempo">Jatuh tempo</option>
            <option value="lunas">Lunas</option>
          </select>
        </div>
        <div className="field"><label htmlFor="from">Dari</label><input id="from" name="from" type="date" defaultValue={from === "2000-01-01" ? "" : from} /></div>
        <div className="field"><label htmlFor="to">Sampai</label><input id="to" name="to" type="date" defaultValue={to} /></div>
        <button className="btn btn-blue btn-sm" type="submit">Tampilkan</button>
      </form>
      <div className="admin-table">
        <table>
          <thead><tr><th>Tanggal</th><th>Nomor</th><th>Pelanggan</th><th>Jatuh tempo</th><th>Status</th><th className="num">Total</th><th className="num">Sisa</th></tr></thead>
          <tbody>
            {rows.map(({ i, c }) => (
              <tr key={i.id}>
                <td>{tgl(i.date)}</td>
                <td><Link href={`/keuangan/penjualan/${i.id}`}><b>{i.number}</b></Link>{i.taxable && <div className="small muted">PPN</div>}</td>
                <td>{c.name}</td>
                <td>{tgl(i.dueDate)}</td>
                <td><Status s={payStatus(i)} /></td>
                <td className="num"><Rp n={i.total} /></td>
                <td className="num"><Rp n={i.total - i.paid} /></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="muted">Tidak ada faktur pada filter ini.</td></tr>}
          </tbody>
          {rows.length > 0 && (
            <tfoot><tr><th colSpan={5}>{rows.length} faktur</th><th className="num"><Rp n={sum.total} /></th><th className="num"><Rp n={sum.open} /></th></tr></tfoot>
          )}
        </table>
      </div>
    </>
  );
}
