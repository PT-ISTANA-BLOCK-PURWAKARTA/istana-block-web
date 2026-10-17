import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { deleteReceipt } from "@/app/akuntansi/actions/sales";
import { ConfirmAction } from "@/components/erp/ConfirmAction";
import { JournalView } from "@/components/erp/JournalView";
import { BackLink, Ok, PageHead, Rp } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { journalFor } from "@/lib/erp/server";
import { formatAmount, terbilang, tgl } from "@/lib/erp/util";

export const metadata = { title: "Penerimaan" };

export default async function Detail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  await requireModule("keuangan");
  const { id } = await params;
  const { ok } = await searchParams;
  const db = await getDb();
  const r = await db.query.receipts.findFirst({ where: eq(schema.receipts.id, id) });
  if (!r) notFound();
  const [contact, account, allocs, journal] = await Promise.all([
    db.query.contacts.findFirst({ where: eq(schema.contacts.id, r.contactId) }),
    db.query.accounts.findFirst({ where: eq(schema.accounts.id, r.accountId) }),
    db
      .select({ a: schema.receiptAllocations, d: schema.invoices })
      .from(schema.receiptAllocations)
      .innerJoin(schema.invoices, eq(schema.invoices.id, schema.receiptAllocations.invoiceId))
      .where(eq(schema.receiptAllocations.receiptId, id)),
    journalFor(db, "penerimaan", id),
  ]);
  const allocated = allocs.reduce((s, x) => s + x.a.amount, 0);
  return (
    <>
      <BackLink href="/akuntansi/penerimaan">Penerimaan</BackLink>
      <PageHead title={r.number}>
        <Link href={`/akuntansi/penerimaan/${r.id}/ubah`} className="btn btn-ghost btn-sm">Ubah</Link>
      </PageHead>
      <Ok ok={ok} />
      <div className="stack" style={{ gap: 20 }}>
        <section className="admin-card doc-head">
          <div><span className="muted small">Pelanggan</span><Link href={`/akuntansi/kontak/${contact?.id}`}><b>{contact?.name}</b></Link></div>
          <div><span className="muted small">Tanggal</span><b>{tgl(r.date)}</b></div>
          <div><span className="muted small">Akun</span><b>{account?.name}</b></div>
          <div><span className="muted small">Jumlah</span><b>Rp{formatAmount(r.amount)}</b><div className="small muted">{terbilang(r.amount)}</div></div>
          {r.memo && <div className="span-all"><span className="muted small">Keterangan</span><p style={{ margin: 0 }}>{r.memo}</p></div>}
        </section>
        <section className="admin-table">
          <table className="compact">
            <caption>Alokasi</caption>
            <thead><tr><th>Faktur</th><th>Tanggal</th><th className="num">Total faktur</th><th className="num">Dialokasikan</th></tr></thead>
            <tbody>
              {allocs.map(({ a, d }) => (
                <tr key={a.id}><td><Link href={`/akuntansi/penjualan/${d.id}`}>{d.number}</Link></td><td>{tgl(d.date)}</td><td className="num"><Rp n={d.total} /></td><td className="num"><Rp n={a.amount} /></td></tr>
              ))}
              {r.amount > allocated && <tr><td colSpan={3}>Uang muka (belum dialokasikan)</td><td className="num"><Rp n={r.amount - allocated} /></td></tr>}
            </tbody>
          </table>
        </section>
        <JournalView lines={journal} />
        <div><ConfirmAction action={deleteReceipt.bind(null, r.id)} label="Hapus" confirmText={`Hapus ${r.number}? Alokasi dan jurnalnya ikut terhapus.`} /></div>
      </div>
    </>
  );
}
