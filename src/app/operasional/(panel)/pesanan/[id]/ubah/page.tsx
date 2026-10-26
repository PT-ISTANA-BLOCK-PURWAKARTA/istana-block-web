import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { BackLink, PageHead } from "@/components/erp/ui";
import { OrderForm } from "@/components/ops/OrderForm";
import { getDb, schema } from "@/db";
import { isArchive } from "@/lib/erp/archive";
import { opsAccess } from "@/lib/erp/ops";
import { orderProgress } from "@/lib/erp/orders";
import { overdueByContact } from "@/lib/erp/insights";
import { contactsOfKind, getFinSettings, pickLists } from "@/lib/erp/server";
import { formatQty, today } from "@/lib/erp/util";

export const metadata = { title: "Ubah pesanan" };

export default async function UbahPesanan({ params }: { params: Promise<{ id: string }> }) {
  const { canOrders: canEdit } = await opsAccess();
  const { id } = await params;
  if (!canEdit || isArchive(id)) redirect(`/operasional/pesanan/${id}`);
  const db = await getDb();
  const o = await db.query.orders.findFirst({ where: eq(schema.orders.id, id) });
  if (!o) notFound();
  if (o.status === "batal" || o.status === "selesai") redirect(`/operasional/pesanan/${id}`);
  const prog = await orderProgress(db, id);
  const [fin, lists, contacts, overdue] = await Promise.all([
    getFinSettings(db),
    pickLists(db, prog.map((p) => p.itemId)),
    db
      .select({ id: schema.contacts.id, name: schema.contacts.name, company: schema.contacts.company, address: schema.contacts.address })
      .from(schema.contacts)
      .where(contactsOfKind("pelanggan", o.contactId))
      .orderBy(asc(schema.contacts.name)),
    overdueByContact(db, today()),
  ]);
  return (
    <>
      <BackLink href={`/operasional/pesanan/${id}`}>{o.number}</BackLink>
      <PageHead title={`Ubah ${o.number}`} sub="Barang yang sudah dijadwalkan kirim tidak bisa dihapus atau dikurangi di bawah qty yang dijadwalkan." />
      <OrderForm
        head={o}
        lines={prog.map((p) => ({
          ref: `item:${p.itemId}`,
          description: p.description,
          qty: formatQty(p.qty),
          unit: p.unit,
          price: String(p.price),
          orderLineId: p.id,
        }))}
        contacts={contacts}
        items={lists.items.map((i) => ({ ...i, buyPrice: 0 }))}
        taxRate={fin.ppnRate}
        overdue={Object.fromEntries(overdue)}
      />
    </>
  );
}
