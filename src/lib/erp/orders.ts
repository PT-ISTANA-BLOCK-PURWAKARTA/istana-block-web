import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { schema } from "@/db";
import type { OrderStatus } from "@/db/erp";
import type { DB } from "./server";

export type LineProgress = {
  id: string;
  itemId: string;
  name: string;
  code: string;
  description: string;
  unit: string;
  qty: number;
  price: number;
  /** Sudah dijadwalkan di surat jalan yang tidak batal. */
  scheduled: number;
  /** Sudah berangkat/terkirim (stok keluar). */
  shipped: number;
  /** Sudah diterima pelanggan. */
  delivered: number;
  invoiced: number;
};

/** Kemajuan tiap baris pesanan: dijadwalkan, dikirim, diterima, difaktur. */
export async function orderProgress(db: DB, orderId: string): Promise<LineProgress[]> {
  const lines = await db
    .select({ ol: schema.orderLines, item: schema.items })
    .from(schema.orderLines)
    .leftJoin(schema.items, eq(schema.items.id, schema.orderLines.itemId))
    .where(eq(schema.orderLines.orderId, orderId))
    .orderBy(asc(schema.orderLines.sort));
  const ship = await db.all<{ id: string; scheduled: number; shipped: number; delivered: number }>(sql`
    select dl.order_line_id as id,
      sum(case when d.status <> 'batal' then dl.qty else 0 end) as scheduled,
      sum(case when d.status in ('berangkat','terkirim') then dl.qty else 0 end) as shipped,
      sum(case when d.status = 'terkirim' then dl.qty else 0 end) as delivered
    from ops_delivery_lines dl join ops_deliveries d on d.id = dl.delivery_id
    where d.order_id = ${orderId} group by dl.order_line_id`);
  const inv = await db.all<{ id: string; qty: number }>(sql`
    select il.order_line_id as id, sum(il.qty) as qty
    from fin_invoice_lines il join fin_invoices i on i.id = il.invoice_id
    where i.order_id = ${orderId} and i.void = 0 and il.order_line_id is not null group by il.order_line_id`);
  const s = new Map(ship.map((r) => [r.id, r]));
  const v = new Map(inv.map((r) => [r.id, Number(r.qty)]));
  return lines.map(({ ol, item }) => ({
    id: ol.id,
    itemId: ol.itemId,
    name: item?.name ?? ol.description,
    code: item?.code ?? "",
    description: ol.description,
    unit: ol.unit || item?.unit || "",
    qty: ol.qty,
    price: ol.price,
    scheduled: Number(s.get(ol.id)?.scheduled ?? 0),
    shipped: Number(s.get(ol.id)?.shipped ?? 0),
    delivered: Number(s.get(ol.id)?.delivered ?? 0),
    invoiced: v.get(ol.id) ?? 0,
  }));
}

const EPS = 1e-9;

/** Status pesanan dari kemajuan pengiriman (status manual "draft", "selesai", "batal" dipertahankan). */
export function deriveOrderStatus(current: OrderStatus, progress: LineProgress[]): OrderStatus {
  if (current === "batal" || current === "selesai" || current === "draft") return current;
  if (!progress.length) return "dikonfirmasi";
  const all = progress.every((l) => l.delivered + EPS >= l.qty);
  if (all) return "terkirim";
  const any = progress.some((l) => l.shipped > EPS);
  return any ? "dikirim_sebagian" : "dikonfirmasi";
}
