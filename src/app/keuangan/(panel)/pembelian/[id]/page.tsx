import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { deleteBill } from "@/app/keuangan/actions/purchases";
import { ConfirmAction } from "@/components/erp/ConfirmAction";
import { JournalView } from "@/components/erp/JournalView";
import { BackLink, Ok, PageHead, payStatus, Rp, Status } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { journalFor } from "@/lib/erp/server";
import { formatQty, tgl } from "@/lib/erp/util";

export const metadata = { title: "Faktur pembelian" };

export default async function PembelianDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  await requireModule("keuangan");
  const { id } = await params;
  const { ok } = await searchParams;
  const db = await getDb();
  const b = await db.query.bills.findFirst({ where: eq(schema.bills.id, id) });
  if (!b) notFound();
  const [contact, lines, pays, journal] = await Promise.all([
    db.query.contacts.findFirst({ where: eq(schema.contacts.id, b.contactId) }),
    db.select().from(schema.billLines).where(eq(schema.billLines.billId, id)).orderBy(asc(schema.billLines.sort)),
    db
      .select({ a: schema.paymentAllocations, p: schema.payments })
      .from(schema.paymentAllocations)
      .innerJoin(schema.payments, eq(schema.payments.id, schema.paymentAllocations.paymentId))
      .where(eq(schema.paymentAllocations.billId, id))
      .orderBy(asc(schema.payments.date)),
    journalFor(db, "pembelian", id),
  ]);
  return (
    <>
      <BackLink href="/keuangan/pembelian">Faktur pembelian</BackLink>
      <PageHead title={b.number} sub={<Status s={payStatus(b)} />}>
        <Link href={`/keuangan/pembelian/${b.id}/ubah`} className="btn btn-ghost btn-sm">Ubah</Link>
        {b.paid < b.total && <Link href={`/keuangan/pembayaran/baru?kontak=${b.contactId}&tagihan=${b.id}`} className="btn btn-primary btn-sm">+ Bayar</Link>}
      </PageHead>
      <Ok ok={ok} />
      <div className="stack" style={{ gap: 20 }}>
        <section className="admin-card doc-head">
          <div><span className="muted small">Pemasok</span><Link href={`/keuangan/kontak/${contact?.id}`}><b>{contact?.name}</b></Link></div>
          <div><span className="muted small">Tanggal</span><b>{tgl(b.date)}</b></div>
          <div><span className="muted small">Jatuh tempo</span><b>{tgl(b.dueDate)}</b></div>
          {b.supplierRef && <div><span className="muted small">No. faktur pemasok</span><b>{b.supplierRef}</b></div>}
        </section>
        <section className="admin-table">
          <table>
            <thead><tr><th>Rincian</th><th className="num">Qty</th><th className="num">Harga</th><th className="num">Jumlah</th></tr></thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id}><td>{l.description}</td><td className="num">{formatQty(l.qty)} {l.unit}</td><td className="num"><Rp n={l.price} /></td><td className="num"><Rp n={l.amount} /></td></tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={3} className="num">Subtotal</td><td className="num"><Rp n={b.subtotal} /></td></tr>
              {b.discount > 0 && <tr><td colSpan={3} className="num">Diskon</td><td className="num"><Rp n={-b.discount} /></td></tr>}
              {b.taxable && <tr><td colSpan={3} className="num">PPN masukan {formatQty(b.taxRate)}%</td><td className="num"><Rp n={b.tax} /></td></tr>}
              <tr><th colSpan={3} className="num">Total</th><th className="num"><Rp n={b.total} strong /></th></tr>
              <tr><th colSpan={3} className="num">Sisa hutang</th><th className="num"><Rp n={b.total - b.paid} strong /></th></tr>
            </tfoot>
          </table>
        </section>
        {b.note && <section className="admin-card"><span className="muted small">Catatan</span><p style={{ whiteSpace: "pre-line", margin: "4px 0 0" }}>{b.note}</p></section>}
        {pays.length > 0 && (
          <section className="admin-table">
            <table className="compact">
              <caption>Pembayaran</caption>
              <thead><tr><th>Tanggal</th><th>Nomor</th><th className="num">Dialokasikan</th></tr></thead>
              <tbody>{pays.map(({ a, p }) => <tr key={a.id}><td>{tgl(p.date)}</td><td><Link href={`/keuangan/pembayaran/${p.id}`}>{p.number}</Link></td><td className="num"><Rp n={a.amount} /></td></tr>)}</tbody>
            </table>
          </section>
        )}
        <JournalView lines={journal} />
        <div><ConfirmAction action={deleteBill.bind(null, b.id)} label="Hapus faktur pembelian" confirmText={`Hapus ${b.number}? Jurnal dan stok masuknya ikut terhapus.`} /></div>
      </div>
    </>
  );
}
