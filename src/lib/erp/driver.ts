import "server-only";
import { sql } from "drizzle-orm";
import { deliveryItems } from "./ops";
import type { DB } from "./server";
import { addDays, today } from "./util";

export type DriverTrip = {
  id: string;
  number: string;
  date: string;
  status: string;
  receivedBy: string;
  proofKey: string | null;
  deliveredAt: number | null;
  note: string;
  orderNumber: string;
  contactName: string;
  contactPhone: string;
  project: string;
  address: string;
  mapsUrl: string;
  siteContact: string;
  orderNote: string;
  plate: string | null;
  lines: { name: string; qty: number; unit: string }[];
};

/** Surat jalan milik seorang sopir: yang belum selesai, plus yang terkirim kemarin & hari ini. */
export async function driverTrips(db: DB, driverId: string, onlyId?: string): Promise<DriverTrip[]> {
  const since = addDays(today(), -1);
  const rows = await db.all<Omit<DriverTrip, "lines">>(sql`
    select d.id, d.number, d.date, d.status, d.received_by receivedBy, d.proof_key proofKey, d.delivered_at deliveredAt, d.note,
      o.number orderNumber, c.name contactName, c.phone contactPhone, o.project, o.address, o.maps_url mapsUrl, o.site_contact siteContact, o.note orderNote,
      v.plate
    from ops_deliveries d
    join ops_orders o on o.id = d.order_id
    join fin_contacts c on c.id = o.contact_id
    left join ops_vehicles v on v.id = d.vehicle_id
    where d.driver_id = ${driverId}
      and ${onlyId ? sql`d.id = ${onlyId}` : sql`(d.status in ('dijadwalkan','berangkat') or (d.status = 'terkirim' and d.date >= ${since}))`}
    order by case d.status when 'berangkat' then 0 when 'dijadwalkan' then 1 else 2 end, d.date, d.number
    limit 60`);
  const items = await deliveryItems(db, rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, deliveredAt: r.deliveredAt == null ? null : Number(r.deliveredAt), lines: items.get(r.id) ?? [] }));
}

/** Nomor telepon pertama di teks bebas (mis. "Pak Udin (mandor) 0811 0000 2201") → tel:. */
export function phoneIn(text: string | null | undefined) {
  const m = String(text ?? "").match(/(\+?62|0)8[\d\s.-]{7,15}\d/);
  if (!m) return null;
  const digits = m[0].replace(/[^\d+]/g, "");
  return digits.startsWith("+") ? digits : digits;
}

/** Tautan navigasi Google Maps: pakai tautan dari pesanan, atau cari alamatnya. */
export function navUrl(t: { mapsUrl: string; address: string; project: string }) {
  if (/^https?:\/\//.test(t.mapsUrl)) return t.mapsUrl;
  const q = [t.address, t.project].filter(Boolean).join(", ");
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
}
