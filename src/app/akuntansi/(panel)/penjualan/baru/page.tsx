import { asc, eq } from "drizzle-orm";
import { InvoiceForm } from "@/components/erp/InvoiceForm";
import type { EditorLine } from "@/components/erp/LinesEditor";
import { BackLink, PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { orderProgress } from "@/lib/erp/orders";
import { contactsOfKind, getFinSettings, pickLists } from "@/lib/erp/server";
import { today } from "@/lib/erp/util";

export const metadata = { title: "Faktur baru" };

export default async function FakturBaru({ searchParams }: { searchParams: Promise<{ kontak?: string; pesanan?: string }> }) {
  await requireModule("keuangan");
  const sp = await searchParams;
  const db = await getDb();
  const [fin, lists, contacts] = await Promise.all([
    getFinSettings(db),
    pickLists(db),
    db.select({ id: schema.contacts.id, name: schema.contacts.name, company: schema.contacts.company }).from(schema.contacts).where(contactsOfKind("pelanggan")).orderBy(asc(schema.contacts.name)),
  ]);
  let lines: EditorLine[] = [];
  let contactId = sp.kontak;
  let orderId: string | null = null;
  let orderLabel: string | undefined;
  let ongkir = 0;
  let discount = 0;
  let taxable = false;
  if (sp.pesanan) {
    const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, sp.pesanan) });
    if (order) {
      orderId = order.id;
      orderLabel = `${order.number}${order.customerRef ? ` · PO pelanggan ${order.customerRef}` : ""}`;
      contactId = order.contactId;
      taxable = order.taxable;
      const prog = await orderProgress(db, order.id);
      const anyDelivered = prog.some((l) => l.delivered > 0);
      lines = prog
        .map((l) => {
          const base = anyDelivered ? l.delivered : l.qty;
          const left = Math.max(0, Math.round((base - l.invoiced) * 1000) / 1000);
          return { ref: `item:${l.itemId}`, description: l.description, qty: String(left).replace(".", ","), unit: l.unit, price: String(l.price), orderLineId: l.id, maxQty: Math.max(0, l.qty - l.invoiced) };
        })
        .filter((l) => Number(l.qty.replace(",", ".")) > 0);
      // Ongkir & diskon pesanan hanya ditagihkan di faktur pertama.
      const first = !(await db.query.invoices.findFirst({ where: eq(schema.invoices.orderId, order.id) }));
      if (first) {
        ongkir = order.ongkir;
        discount = order.discount;
      }
    }
  }
  return (
    <>
      <BackLink href="/akuntansi/penjualan">Faktur penjualan</BackLink>
      <PageHead title="Faktur penjualan baru" sub={orderLabel ? "Baris diisi dari barang yang sudah diterima pelanggan dan belum difaktur." : undefined} />
      <InvoiceForm
        kind="sales"
        head={{ contactId, date: today(), orderId, discount, ongkir, taxable }}
        lines={lines}
        contacts={contacts}
        items={lists.items}
        taxRate={fin.ppnRate}
        orderLabel={orderLabel}
      />
    </>
  );
}
