// Buat Surat Jalan U-Ditch (SJ-UD/…) dari Invoice U-Ditch. Penugasan sopir & armada tetap di Operasional;
// stok U-Ditch keluar dari gudang saat truk berangkat, tanpa jurnal HPP di buku IB.
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { DeliveryFromInvoiceForm, type DeliveryRow } from "@/components/erp/DeliveryFromInvoiceForm";
import { ZahirPage } from "@/components/erp/ZahirPage";
import { getDb, schema } from "@/db";
import { requireAnak } from "@/lib/auth";
import { orderProgress } from "@/lib/erp/orders";
import type { InvoiceLine } from "@/lib/erp/salesInvoice";
import { today } from "@/lib/erp/util";

export const metadata = { title: "Surat jalan U-Ditch" };
export const dynamic = "force-dynamic";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export default async function KirimUditch({ params }: { params: Promise<{ id: string }> }) {
  await requireAnak("uditch", "keuangan");
  const { id } = await params;
  const db = await getDb();
  const inv = await db.query.salesInvoices.findFirst({ where: eq(schema.salesInvoices.id, id) });
  if (!inv || inv.issuer !== "ud") notFound();
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
    <ZahirPage title="Buat Surat Jalan U-Ditch" sub={`${inv.customerName} · ${inv.number}${live ? ` · PO pengiriman ${live.number}` : ""}`} hub={`/anak-usaha/invoice-uditch/${inv.id}`}>
      <p className="small muted">Nomor SJ-UD/… otomatis. Setelah disimpan, surat jalan masuk ke Operasional untuk <b>penugasan sopir &amp; armada</b>. Stok U-Ditch keluar dari gudang saat truk berangkat, tanpa jurnal di buku IB.</p>
      <DeliveryFromInvoiceForm
        invoiceId={inv.id}
        rows={rows}
        items={catalog.map((c) => ({ value: c.id, label: `${c.code ? `${c.code} · ` : ""}${c.name}${c.unit ? ` (${c.unit})` : ""}` }))}
        unpaid={!(inv.paidAmount ?? 0)}
        defaults={{ date: today(), address: live?.address || inv.customerAddress || "", mapsUrl: live?.mapsUrl ?? "", siteContact: live?.siteContact || inv.customerPhone || "" }}
      />
    </ZahirPage>
  );
}
