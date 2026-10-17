import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { InvoiceForm } from "@/components/erp/InvoiceForm";
import { BackLink, PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { contactsOfKind, getFinSettings, pickLists } from "@/lib/erp/server";
import { EXPENSE_GROUPS } from "@/lib/erp/accounting";

export const metadata = { title: "Ubah pembelian" };

export default async function UbahPembelian({ params }: { params: Promise<{ id: string }> }) {
  await requireModule("keuangan");
  const { id } = await params;
  const db = await getDb();
  const b = await db.query.bills.findFirst({ where: eq(schema.bills.id, id) });
  if (!b) notFound();
  const lines = await db.select().from(schema.billLines).where(eq(schema.billLines.billId, id)).orderBy(asc(schema.billLines.sort));
  const [fin, lists, contacts] = await Promise.all([
    getFinSettings(db),
    pickLists(db, lines.flatMap((l) => [l.itemId, l.accountId])),
    db.select({ id: schema.contacts.id, name: schema.contacts.name, company: schema.contacts.company }).from(schema.contacts).where(contactsOfKind("pemasok", b.contactId)).orderBy(asc(schema.contacts.name)),
  ]);
  return (
    <>
      <BackLink href={`/keuangan/pembelian/${id}`}>{b.number}</BackLink>
      <PageHead title={`Ubah ${b.number}`} sub="Jurnal dan stok masuk dari faktur ini dibuat ulang saat disimpan." />
      <InvoiceForm
        kind="purchase"
        head={{ id: b.id, contactId: b.contactId, date: b.date, dueDate: b.dueDate, note: b.note, supplierRef: b.supplierRef, discount: b.discount, taxable: b.taxable }}
        lines={lines.map((l) => ({ ref: l.itemId ? `item:${l.itemId}` : `acc:${l.accountId}`, description: l.description, qty: String(l.qty).replace(".", ","), unit: l.unit, price: String(l.price) }))}
        contacts={contacts}
        items={lists.items}
        accounts={lists.pick((a) => EXPENSE_GROUPS.includes(a.group) && !a.systemKey?.startsWith("persediaan"))}
        taxRate={b.taxable ? b.taxRate : fin.ppnRate}
      />
    </>
  );
}
