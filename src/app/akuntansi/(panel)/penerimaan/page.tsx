import Link from "next/link";
import { and, desc, eq, gte, like, lte, or } from "drizzle-orm";
import { Ok, PageHead, Rp } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { isDate, monthStart, tgl, today } from "@/lib/erp/util";
import { DateField } from "@/components/ui";

export const metadata = { title: "Penerimaan" };

export default async function Daftar({ searchParams }: { searchParams: Promise<{ ok?: string; q?: string; from?: string; to?: string }> }) {
  await requireModule("keuangan");
  const sp = await searchParams;
  const now = today();
  const from = isDate(sp.from) ? sp.from : monthStart(now);
  const to = isDate(sp.to) ? sp.to : now;
  const db = await getDb();
  const rows = await db
    .select({ r: schema.receipts, c: schema.contacts, a: schema.accounts })
    .from(schema.receipts)
    .innerJoin(schema.contacts, eq(schema.contacts.id, schema.receipts.contactId))
    .innerJoin(schema.accounts, eq(schema.accounts.id, schema.receipts.accountId))
    .where(and(gte(schema.receipts.date, from), lte(schema.receipts.date, to), sp.q ? or(like(schema.receipts.number, `%${sp.q}%`), like(schema.contacts.name, `%${sp.q}%`)) : undefined))
    .orderBy(desc(schema.receipts.date), desc(schema.receipts.number))
    .limit(300);
  const total = rows.reduce((a, r) => a + r.r.amount, 0);
  return (
    <>
      <PageHead title="Penerimaan" sub="Uang masuk dari pelanggan untuk faktur atau sebagai uang muka.">
        <Link href="/akuntansi/penerimaan/baru" className="btn btn-primary btn-sm">+ Penerimaan</Link>
      </PageHead>
      <Ok ok={sp.ok} />
      <form className="filter-bar" method="get">
        <div className="field grow"><label htmlFor="q">Cari</label><input id="q" name="q" defaultValue={sp.q} placeholder="nomor atau nama" /></div>
        <div className="field"><label htmlFor="from">Dari</label><DateField id="from" name="from" defaultValue={from} /></div>
        <div className="field"><label htmlFor="to">Sampai</label><DateField id="to" name="to" defaultValue={to} /></div>
        <button className="btn btn-blue btn-sm" type="submit">Tampilkan</button>
      </form>
      <div className="admin-table">
        <table>
          <thead><tr><th>Tanggal</th><th>Nomor</th><th>Pelanggan</th><th>Akun</th><th>Keterangan</th><th className="num">Jumlah</th></tr></thead>
          <tbody>
            {rows.map(({ r, c, a }) => (
              <tr key={r.id}>
                <td>{tgl(r.date)}</td>
                <td><Link href={`/akuntansi/penerimaan/${r.id}`}><b>{r.number}</b></Link></td>
                <td>{c.name}</td>
                <td className="small">{a.name}</td>
                <td className="small">{r.memo}</td>
                <td className="num"><Rp n={r.amount} /></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="muted">Belum ada data pada rentang ini.</td></tr>}
          </tbody>
          {rows.length > 0 && <tfoot><tr><th colSpan={5}>{rows.length} transaksi</th><th className="num"><Rp n={total} /></th></tr></tfoot>}
        </table>
      </div>
    </>
  );
}
