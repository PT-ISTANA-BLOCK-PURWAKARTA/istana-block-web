import "server-only";
import { sql } from "drizzle-orm";
import type { DB } from "./server";

/*
 * Kueri lintas bagian untuk ringkasan: menyambungkan pesanan, gudang, dan keuangan.
 */

/** Pesanan yang barangnya sudah diterima pelanggan tapi belum (seluruhnya) difaktur. */
export async function unbilledOrders(db: DB) {
  const rows = await db.all<{ id: string; number: string; contactName: string; project: string; last: string; unbilled: number }>(sql`
    select o.id, o.number, c.name as contactName, o.project, max(x.last) as last,
      sum(max(x.delivered - x.invoiced, 0) * x.price) as unbilled
    from (
      select ol.id, ol.order_id, ol.price,
        coalesce((select sum(dl.qty) from ops_delivery_lines dl join ops_deliveries d on d.id = dl.delivery_id
                  where dl.order_line_id = ol.id and d.status = 'terkirim'), 0) as delivered,
        coalesce((select sum(il.qty) from fin_invoice_lines il join fin_invoices i on i.id = il.invoice_id
                  where il.order_line_id = ol.id and i.void = 0), 0) as invoiced,
        (select max(d.date) from ops_delivery_lines dl join ops_deliveries d on d.id = dl.delivery_id
                  where dl.order_line_id = ol.id and d.status = 'terkirim') as last
      from ops_order_lines ol
    ) x
    join ops_orders o on o.id = x.order_id
    join fin_contacts c on c.id = o.contact_id
    where o.status <> 'batal'
    group by o.id
    having unbilled > 0.5
    order by last`);
  return rows.map((r) => ({ ...r, unbilled: Math.round(Number(r.unbilled)) }));
}

export type StockRow = { id: string; code: string; name: string; unit: string; kind: string; minStock: number; onHand: number; scheduled: number; free: number };

/** Stok per barang yang dilacak: di gudang, sudah dijadwalkan kirim (belum berangkat), dan bebas. */
export async function stockPosition(db: DB, kind?: "barang_jadi" | "bahan_baku") {
  const rows = await db.all<{ id: string; code: string; name: string; unit: string; kind: string; minStock: number; onHand: number; scheduled: number }>(sql`
    select i.id, i.code, i.name, i.unit, i.kind, i.min_stock as minStock,
      coalesce((select sum(qty) from inv_stock_moves m where m.item_id = i.id), 0) as onHand,
      coalesce((select sum(dl.qty) from ops_delivery_lines dl join ops_deliveries d on d.id = dl.delivery_id
                where dl.item_id = i.id and d.status = 'dijadwalkan'), 0) as scheduled
    from fin_items i
    where i.track_stock = 1 and i.active = 1 ${kind ? sql`and i.kind = ${kind}` : sql``}
    order by i.code`);
  return rows.map((r) => {
    const onHand = Number(r.onHand);
    const scheduled = Number(r.scheduled);
    return { ...r, minStock: Number(r.minStock), onHand, scheduled, free: onHand - scheduled } as StockRow;
  });
}

export type LoadingTrip = {
  id: string;
  number: string;
  date: string;
  status: string;
  orderId: string;
  orderNumber: string;
  contactName: string;
  destination: string;
  plate: string | null;
  driver: string | null;
  lines: { itemId: string; name: string; unit: string; qty: number; onHand: number }[];
  short: boolean;
};

/**
 * Surat jalan yang harus dimuat sampai tanggal tertentu (dijadwalkan) + yang sedang di jalan.
 * Ketersediaan dihitung berurutan: muatan lebih awal "memakai" stok lebih dulu.
 */
export async function loadingPlan(db: DB, upTo: string): Promise<LoadingTrip[]> {
  const trips = await db.all<Omit<LoadingTrip, "lines" | "short">>(sql`
    select d.id, d.number, d.date, d.status, o.id as orderId, o.number as orderNumber, c.name as contactName,
      coalesce(nullif(o.project, ''), o.address) as destination, v.plate, dr.name as driver
    from ops_deliveries d join ops_orders o on o.id = d.order_id join fin_contacts c on c.id = o.contact_id
      left join ops_vehicles v on v.id = d.vehicle_id left join ops_drivers dr on dr.id = d.driver_id
    where d.status = 'berangkat' or (d.status = 'dijadwalkan' and d.date <= ${upTo})
    order by d.status = 'berangkat' desc, d.date, d.number`);
  if (!trips.length) return [];
  const lines = await db.all<{ deliveryId: string; itemId: string; name: string; unit: string; qty: number; track: number; onHand: number }>(sql`
    select dl.delivery_id as deliveryId, dl.item_id as itemId, i.name, coalesce(nullif(ol.unit, ''), i.unit) as unit, dl.qty, i.track_stock as track,
      coalesce((select sum(qty) from inv_stock_moves m where m.item_id = i.id), 0) as onHand
    from ops_delivery_lines dl join ops_order_lines ol on ol.id = dl.order_line_id join fin_items i on i.id = dl.item_id
    join ops_deliveries d on d.id = dl.delivery_id
    where d.status = 'berangkat' or (d.status = 'dijadwalkan' and d.date <= ${upTo})`);
  const remaining = new Map<string, number>();
  for (const l of lines) remaining.set(l.itemId, Number(l.onHand));
  return trips.map((t) => {
    const own = lines.filter((l) => l.deliveryId === t.id);
    let short = false;
    const out = own.map((l) => {
      const qty = Number(l.qty);
      const avail = remaining.get(l.itemId) ?? 0;
      // Yang sudah berangkat sudah mengurangi stok; yang dijadwalkan memakai sisa.
      if (t.status === "dijadwalkan" && l.track) {
        if (qty > avail + 1e-9) short = true;
        remaining.set(l.itemId, avail - qty);
      }
      return { itemId: l.itemId, name: l.name, unit: l.unit, qty, onHand: avail };
    });
    return { ...t, lines: out, short };
  });
}

/** Pelanggan yang punya faktur lewat jatuh tempo (untuk peringatan saat membuat/menjadwalkan pesanan). */
export async function overdueByContact(db: DB, asOf: string) {
  const rows = await db.all<{ contactId: string; n: number; oldest: string }>(sql`
    select contact_id as contactId, count(*) as n, min(due_date) as oldest from fin_invoices
    where void = 0 and paid < total and due_date < ${asOf} group by contact_id`);
  return new Map(rows.map((r) => [r.contactId, { n: Number(r.n), oldest: r.oldest }]));
}

/** Nama bulan pendek untuk grafik. */
export const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** Daftar n bulan terakhir (termasuk bulan berjalan) dalam format "YYYY-MM". */
export function lastMonths(today: string, n: number) {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7)) - 1;
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - (n - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}
