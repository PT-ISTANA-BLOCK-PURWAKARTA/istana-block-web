import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { InvoiceForm } from "@/components/erp/InvoiceForm";
import { BackLink, PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { contactsOfKind, getFinSettings, pickLists } from "@/lib/erp/server";

export const metadata = { title: "Ubah faktur" };

export default async function UbahFaktur({ params }: { params: Promise<{ id: string }> }) {
  await requireModule("keuangan");
  const { id } = await params;
  const db = await getDb();
  const inv = await db.query.invoices.findFirst({ where: eq(schema.invoices.id, id) });
  if (!inv) notFound();
  const lines = await db.select().from(schema.invoiceLines).where(eq(schema.invoiceLines.invoiceId, id)).orderBy(asc(schema.invoiceLines.sort));
  const [fin, lists, contacts, order] = await Promise.all([
    getFinSettings(db),
    pickLists(db, lines.map((l) => l.itemId)),
    db.select({ id: schema.contacts.id, name: schema.contacts.name, company: schema.contacts.company }).from(schema.contacts).where(contactsOfKind("pelanggan", inv.contactId)).orderBy(asc(schema.contacts.name)),
    inv.orderId ? db.query.orders.findFirst({ where: eq(schema.orders.id, inv.orderId) }) : undefined,
  ]);
  return (
    <>
      <BackLink href={`/akuntansi/penjualan/${id}`}>{inv.number}</BackLink>
      <PageHead title={`Ubah ${inv.number}`} sub="Jurnal faktur ini dibuat ulang saat disimpan." />
      <InvoiceForm
        kind="sales"
        head={{ id: inv.id, contactId: inv.contactId, date: inv.date, dueDate: inv.dueDate, note: inv.note, orderId: inv.orderId, discount: inv.discount, ongkir: inv.ongkir, taxable: inv.taxable }}
        lines={lines.map((l) => ({ ref: l.itemId ? `item:${l.itemId}` : "", description: l.description, qty: String(l.qty).replace(".", ","), unit: l.unit, price: String(l.price), orderLineId: l.orderLineId }))}
        contacts={contacts}
        items={lists.items}
        taxRate={inv.taxable ? inv.taxRate : fin.ppnRate}
        orderLabel={order?.number}
      />
    </>
  );
}
