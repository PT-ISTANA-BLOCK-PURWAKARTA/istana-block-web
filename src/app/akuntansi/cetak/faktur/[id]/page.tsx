import { notFound } from "next/navigation";
import { and, asc, eq, ne } from "drizzle-orm";
import { PrintDoc, Sign } from "@/components/erp/PrintDoc";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { getFinSettings } from "@/lib/erp/server";
import { formatAmount, formatQty, terbilang, tglPanjang } from "@/lib/erp/util";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Cetak faktur", robots: { index: false } };

export default async function CetakFaktur({ params }: { params: Promise<{ id: string }> }) {
  await requireModule("keuangan");
  const { id } = await params;
  const db = await getDb();
  const inv = await db.query.invoices.findFirst({ where: eq(schema.invoices.id, id) });
  if (!inv) notFound();
  const [site, fin, contact, lines, order, deliveries] = await Promise.all([
    getSettings(),
    getFinSettings(db),
    db.query.contacts.findFirst({ where: eq(schema.contacts.id, inv.contactId) }),
    db.select().from(schema.invoiceLines).where(eq(schema.invoiceLines.invoiceId, id)).orderBy(asc(schema.invoiceLines.sort)),
    inv.orderId ? db.query.orders.findFirst({ where: eq(schema.orders.id, inv.orderId) }) : undefined,
    inv.orderId
      ? db.select({ number: schema.deliveries.number }).from(schema.deliveries).where(and(eq(schema.deliveries.orderId, inv.orderId), ne(schema.deliveries.status, "batal"))).orderBy(asc(schema.deliveries.date))
      : [],
  ]);
  const left = inv.total - inv.paid;
  return (
    <PrintDoc site={site} npwp={fin.npwp} title="FAKTUR" subtitle={inv.number} back={`/akuntansi/penjualan/${inv.id}`}>
      <section className="print-meta">
        <div>
          <span className="pm-label">Kepada</span>
          <b>{contact?.company || contact?.name}</b>
          {contact?.company && contact.name !== contact.company && <div>u.p. {contact.name}</div>}
          {contact?.address && <div className="pre">{contact.address}</div>}
          {contact?.phone && <div>Telp. {contact.phone}</div>}
          {contact?.npwp && <div>NPWP {contact.npwp}</div>}
        </div>
        <dl>
          <dt>Tanggal</dt><dd>{tglPanjang(inv.date)}</dd>
          <dt>Jatuh tempo</dt><dd>{tglPanjang(inv.dueDate)}</dd>
          {order?.customerRef && (<><dt>No. PO pelanggan</dt><dd>{order.customerRef}</dd></>)}
          {order && (<><dt>No. pesanan</dt><dd>{order.number}</dd></>)}
          {deliveries.length > 0 && (<><dt>Surat jalan</dt><dd>{deliveries.map((d) => d.number).join(", ")}</dd></>)}
          {order?.project && (<><dt>Proyek</dt><dd>{order.project}</dd></>)}
        </dl>
      </section>
      <table className="print-lines">
        <thead><tr><th style={{ width: 32 }}>No</th><th>Uraian</th><th className="num">Qty</th><th>Sat.</th><th className="num">Harga</th><th className="num">Jumlah</th></tr></thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={l.id}><td>{i + 1}</td><td>{l.description}</td><td className="num">{formatQty(l.qty)}</td><td>{l.unit}</td><td className="num">{formatAmount(l.price)}</td><td className="num">{formatAmount(l.amount)}</td></tr>
          ))}
        </tbody>
      </table>
      <div className="print-foot">
        <div className="print-words">
          <span className="pm-label">Terbilang</span>
          <i>{terbilang(inv.total)}</i>
          {fin.bankInfo && (<><span className="pm-label" style={{ marginTop: 12 }}>Pembayaran ke</span><div className="pre">{fin.bankInfo}</div></>)}
        </div>
        <dl className="print-totals">
          <dt>Subtotal</dt><dd>{formatAmount(inv.subtotal)}</dd>
          {inv.discount > 0 && (<><dt>Diskon</dt><dd>({formatAmount(inv.discount)})</dd></>)}
          {inv.ongkir > 0 && (<><dt>Ongkos kirim</dt><dd>{formatAmount(inv.ongkir)}</dd></>)}
          {inv.taxable && (<><dt>DPP</dt><dd>{formatAmount(inv.subtotal - inv.discount + inv.ongkir)}</dd><dt>PPN {formatQty(inv.taxRate)}%</dt><dd>{formatAmount(inv.tax)}</dd></>)}
          <dt className="grand">Total</dt><dd className="grand">Rp {formatAmount(inv.total)}</dd>
          {inv.paid > 0 && (<><dt>Sudah dibayar</dt><dd>({formatAmount(inv.paid)})</dd><dt className="grand">Sisa tagihan</dt><dd className="grand">Rp {formatAmount(left)}</dd></>)}
        </dl>
      </div>
      {(inv.note || fin.invoiceNote) && <p className="print-note pre">{[inv.note, fin.invoiceNote].filter(Boolean).join("\n")}</p>}
      <Sign labels={["Penerima,", `Hormat kami,\n${site.legal_name || site.company_name}`]} />
    </PrintDoc>
  );
}
