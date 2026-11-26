// Buat surat jalan dari invoice (Keuangan). Alur: invoice → surat jalan (barang keluar per mobil) → penugasan sopir (Operasional).
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { DeliveryFromInvoiceForm, type DeliveryRow } from "@/components/erp/DeliveryFromInvoiceForm";
import { BackLink, PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { orderProgress } from "@/lib/erp/orders";
import type { InvoiceLine } from "@/lib/erp/salesInvoice";
import { today } from "@/lib/erp/util";

export const metadata = { title: "Surat jalan dari invoice" };
export const dynamic = "force-dynamic";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export default async function KirimDariInvoice({ params }: { params: Promise<{ id: string }> }) {
  await requireModule("keuangan");
  const { id } = await params;
  const db = await getDb();
  const inv = await db.query.salesInvoices.findFirst({ where: eq(schema.salesInvoices.id, id) });
  if (!inv) notFound();
  const items = inv.items as unknown as InvoiceLine[];
  const order = inv.orderId ? await db.query.orders.findFirst({ where: eq(schema.orders.id, inv.orderId) }) : undefined;
  const live = order && order.status !== "batal" && order.status !== "selesai" ? order : undefined;
  const catalog = await db.select({ id: schema.items.id, code: schema.items.code, name: schema.items.name, unit: schema.items.unit }).from(schema.items).where(eq(schema.items.active, true)).orderBy(asc(schema.items.name));
  const prog = live ? await orderProgress(db, live.id) : [];
  const lines = live ? await db.select().from(schema.orderLines).where(eq(schema.orderLines.orderId, live.id)) : [];
  const guess = (name: string) => {
    const n = norm(name);
    return (catalog.find((c) => norm(c.name) === n) ?? catalog.find((c) => n.includes(norm(c.name)) && norm(c.name).length > 3) ?? catalog.find((c) => norm(c.name).includes(n) && n.length > 3))?.id ?? "";
  };
  const rows: DeliveryRow[] = items.map((it, index) => {
    const ol = lines.find((l) => l.sort === index);
    const p = ol ? prog.find((x) => x.id === ol.id) : undefined;
    return { index, name: it.name, unit: it.unit, quantity: Number(it.quantity) || 0, scheduled: p?.scheduled ?? 0, itemId: ol?.itemId ?? guess(it.name), fixedItem: ol ? (catalog.find((c) => c.id === ol.itemId)?.name ?? p?.name ?? "-") : null };
  });
  return (
    <>
      <BackLink href={`/akuntansi/dokumen/invoice/${inv.id}`}>{inv.number}</BackLink>
      <PageHead title="Buat surat jalan" sub={`${inv.customerName} · invoice ${inv.number}${live ? ` · PO pengiriman ${live.number}` : ""}`} />
      <p className="small muted">Setelah disimpan, surat jalan masuk ke Operasional untuk <b>penugasan sopir &amp; armada</b>. Stok barang keluar sesuai isi surat jalan ini.</p>
      <DeliveryFromInvoiceForm
        invoiceId={inv.id}
        rows={rows}
        items={catalog.map((c) => ({ value: c.id, label: `${c.code ? `${c.code} · ` : ""}${c.name}${c.unit ? ` (${c.unit})` : ""}` }))}
        unpaid={!(inv.paidAmount ?? 0)}
        defaults={{ date: today(), address: live?.address || inv.customerAddress || "", mapsUrl: live?.mapsUrl ?? "", siteContact: live?.siteContact || inv.customerPhone || "" }}
      />
    </>
  );
}
