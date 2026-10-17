import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { deleteInvoice } from "@/app/akuntansi/actions/sales";
import { ConfirmAction } from "@/components/erp/ConfirmAction";
import { JournalView } from "@/components/erp/JournalView";
import { BackLink, Ok, PageHead, payStatus, Rp, Status } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { journalFor } from "@/lib/erp/server";
import { formatQty, tgl } from "@/lib/erp/util";

export const metadata = { title: "Faktur penjualan" };

export default async function FakturDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  await requireModule("keuangan");
  const { id } = await params;
  const { ok } = await searchParams;
  const db = await getDb();
  const inv = await db.query.invoices.findFirst({ where: eq(schema.invoices.id, id) });
  if (!inv) notFound();
  const [contact, lines, pays, journal, order] = await Promise.all([
    db.query.contacts.findFirst({ where: eq(schema.contacts.id, inv.contactId) }),
    db.select().from(schema.invoiceLines).where(eq(schema.invoiceLines.invoiceId, id)).orderBy(asc(schema.invoiceLines.sort)),
    db
      .select({ a: schema.receiptAllocations, r: schema.receipts })
      .from(schema.receiptAllocations)
      .innerJoin(schema.receipts, eq(schema.receipts.id, schema.receiptAllocations.receiptId))
      .where(eq(schema.receiptAllocations.invoiceId, id))
      .orderBy(asc(schema.receipts.date)),
    journalFor(db, "faktur", id),
    inv.orderId ? db.query.orders.findFirst({ where: eq(schema.orders.id, inv.orderId) }) : undefined,
  ]);
  const status = payStatus(inv);
  return (
    <>
      <BackLink href="/akuntansi/penjualan">Faktur penjualan</BackLink>
      <PageHead title={inv.number} sub={<Status s={status} />}>
        <Link href={`/akuntansi/cetak/faktur/${inv.id}`} target="_blank" className="btn btn-ghost btn-sm">Cetak</Link>
        <Link href={`/akuntansi/penjualan/${inv.id}/ubah`} className="btn btn-ghost btn-sm">Ubah</Link>
        {inv.paid < inv.total && <Link href={`/akuntansi/penerimaan/baru?kontak=${inv.contactId}&faktur=${inv.id}`} className="btn btn-primary btn-sm">+ Terima pembayaran</Link>}
      </PageHead>
      <Ok ok={ok} />
      <div className="stack" style={{ gap: 20 }}>
        <section className="admin-card doc-head">
          <div><span className="muted small">Pelanggan</span><Link href={`/akuntansi/kontak/${contact?.id}`}><b>{contact?.name}</b></Link>{contact?.company && <div className="small">{contact.company}</div>}</div>
          <div><span className="muted small">Tanggal</span><b>{tgl(inv.date)}</b></div>
          <div><span className="muted small">Jatuh tempo</span><b>{tgl(inv.dueDate)}</b></div>
          {order && <div><span className="muted small">Pesanan</span><Link href={`/operasional/pesanan/${order.id}`}><b>{order.number}</b></Link>{order.customerRef && <div className="small">PO {order.customerRef}</div>}</div>}
        </section>
        <section className="admin-table">
          <table>
            <thead><tr><th>Barang / jasa</th><th className="num">Qty</th><th className="num">Harga</th><th className="num">Jumlah</th></tr></thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id}><td>{l.description}</td><td className="num">{formatQty(l.qty)} {l.unit}</td><td className="num"><Rp n={l.price} /></td><td className="num"><Rp n={l.amount} /></td></tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={3} className="num">Subtotal</td><td className="num"><Rp n={inv.subtotal} /></td></tr>
              {inv.discount > 0 && <tr><td colSpan={3} className="num">Diskon</td><td className="num"><Rp n={-inv.discount} /></td></tr>}
              {inv.ongkir > 0 && <tr><td colSpan={3} className="num">Ongkos kirim</td><td className="num"><Rp n={inv.ongkir} /></td></tr>}
              {inv.taxable && <tr><td colSpan={3} className="num">PPN {formatQty(inv.taxRate)}%</td><td className="num"><Rp n={inv.tax} /></td></tr>}
              <tr><th colSpan={3} className="num">Total</th><th className="num"><Rp n={inv.total} strong /></th></tr>
              <tr><td colSpan={3} className="num">Sudah dibayar</td><td className="num"><Rp n={inv.paid} /></td></tr>
              <tr><th colSpan={3} className="num">Sisa tagihan</th><th className="num"><Rp n={inv.total - inv.paid} strong /></th></tr>
            </tfoot>
          </table>
        </section>
        {inv.note && <section className="admin-card"><span className="muted small">Catatan</span><p style={{ whiteSpace: "pre-line", margin: "4px 0 0" }}>{inv.note}</p></section>}
        {pays.length > 0 && (
          <section className="admin-table">
            <table className="compact">
              <caption>Pembayaran</caption>
              <thead><tr><th>Tanggal</th><th>Nomor</th><th className="num">Dialokasikan</th></tr></thead>
              <tbody>
                {pays.map(({ a, r }) => (
                  <tr key={a.id}><td>{tgl(r.date)}</td><td><Link href={`/akuntansi/penerimaan/${r.id}`}>{r.number}</Link></td><td className="num"><Rp n={a.amount} /></td></tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
        <JournalView lines={journal} />
        <div><ConfirmAction action={deleteInvoice.bind(null, inv.id)} label="Hapus faktur" confirmText={`Hapus faktur ${inv.number}? Jurnalnya ikut terhapus.`} /></div>
      </div>
    </>
  );
}
