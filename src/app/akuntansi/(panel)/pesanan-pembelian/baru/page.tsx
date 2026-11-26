// Permintaan Penawaran / Pesanan Pembelian baru atau ubah (?id=).
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PurchaseOrderForm } from "@/components/erp/PurchaseOrderForm";
import { BackLink, PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { contactsOfKind, getFinSettings } from "@/lib/erp/server";
import { today } from "@/lib/erp/util";
import { PO_STATUS } from "@/lib/erp/masterData";

export const metadata = { title: "Pesanan Pembelian" };
export const dynamic = "force-dynamic";

export default async function PesananBaru({ searchParams }: { searchParams: Promise<{ jenis?: string; id?: string; kontak?: string }> }) {
  await requireModule("keuangan");
  const sp = await searchParams;
  const db = await getDb();
  const existing = sp.id ? await db.query.purchaseOrders.findFirst({ where: eq(schema.purchaseOrders.id, sp.id) }) : undefined;
  if (sp.id && !existing) notFound();
  const kind = existing?.kind ?? (sp.jenis === "rfq" ? "rfq" : "po");
  const [contacts, items, fin, lines] = await Promise.all([
    db.select().from(schema.contacts).where(contactsOfKind("pemasok", existing?.contactId)).orderBy(asc(schema.contacts.name)),
    db.select({ id: schema.items.id, name: schema.items.name, unit: schema.items.unit, buyPrice: schema.items.buyPrice }).from(schema.items).where(eq(schema.items.active, true)).orderBy(asc(schema.items.name)),
    getFinSettings(db),
    existing ? db.select().from(schema.purchaseOrderLines).where(eq(schema.purchaseOrderLines.orderId, existing.id)).orderBy(schema.purchaseOrderLines.sort) : Promise.resolve([]),
  ]);
  const title = kind === "rfq" ? "Permintaan Penawaran" : "Pesanan Pembelian";
  return (
    <>
      <BackLink href={`/akuntansi/pesanan-pembelian${kind === "rfq" ? "?jenis=rfq" : ""}`}>{title}</BackLink>
      <PageHead title={existing ? `Ubah ${existing.number}` : `${title} baru`} />
      <PurchaseOrderForm
        kind={kind}
        value={{ id: existing?.id, date: existing?.date ?? today(), contactId: existing?.contactId ?? sp.kontak, expectedDate: existing?.expectedDate, status: existing?.status, memo: existing?.memo, ppn: existing ? existing.tax > 0 : false, lines: lines.map((l) => ({ itemId: l.itemId, description: l.description, qty: l.qty, unit: l.unit, price: l.price })) }}
        contacts={contacts.map((c) => ({ value: c.id, label: c.name }))}
        items={items.map((i) => ({ ...i, buyPrice: Number(i.buyPrice ?? 0) }))}
        ppnRate={fin.ppnRate}
        statuses={Object.entries(PO_STATUS).map(([value, label]) => ({ value, label }))}
      />
    </>
  );
}
