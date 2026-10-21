import "server-only";
import { sql } from "drizzle-orm";
import { hidePrices } from "@/lib/ops/shared/prices";
import { deliveryProofKeys } from "@/lib/ops/deliveries";
import { deliveryItems } from "./ops";
import type { DB } from "./server";
import { addDays, today } from "./util";

export type DriverTrip = {
  id: string;
  number: string;
  date: string;
  status: string;
  receivedBy: string;
  /** Kunci foto bukti (kolom lama proof_key + ops_delivery_proofs), terlama dulu. Hanya diisi di halaman detail. */
  proofKeys: string[];
  deliveredAt: number | null;
  loadedAt: number | null;
  departedAt: number | null;
  arrivedAt: number | null;
  delayReason: string;
  /** Catatan surat jalan & pesanan: nominal harga sudah disamarkan (hidePrices). */
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

const num = (v: unknown) => (v == null ? null : Number(v));

/**
 * Surat jalan milik seorang sopir: yang belum selesai, plus yang terkirim kemarin & hari ini.
 * Catatan dilewatkan hidePrices di sini, jadi layar mana pun di /operasional/tugas tidak pernah menerima nominal harga.
 */
export async function driverTrips(db: DB, driverId: string, onlyId?: string): Promise<DriverTrip[]> {
  const since = addDays(today(), -1);
  const rows = await db.all<Omit<DriverTrip, "lines" | "proofKeys"> & { legacyProof: string | null }>(sql`
    select d.id, d.number, d.date, d.status, d.received_by receivedBy, d.proof_key legacyProof,
      d.delivered_at deliveredAt, d.loaded_at loadedAt, d.departed_at departedAt, d.arrived_at arrivedAt, coalesce(d.delay_reason, '') delayReason, d.note,
      o.number orderNumber, c.name contactName, c.phone contactPhone, o.project, o.address, o.maps_url mapsUrl, o.site_contact siteContact, o.note orderNote,
      v.plate
    from ops_deliveries d
    join ops_orders o on o.id = d.order_id
    join fin_contacts c on c.id = o.contact_id
    left join ops_vehicles v on v.id = d.vehicle_id
    where d.driver_id = ${driverId}
      and ${onlyId ? sql`d.id = ${onlyId}` : sql`(d.status in ('dijadwalkan','dimuat','berangkat','tiba','tertunda') or (d.status = 'terkirim' and d.date >= ${since}))`}
    order by case d.status when 'berangkat' then 0 when 'tiba' then 0 when 'tertunda' then 0 when 'dimuat' then 1 when 'dijadwalkan' then 2 else 3 end, d.date, d.number
    limit 60`);
  const items = await deliveryItems(db, rows.map((r) => r.id));
  const proofs = onlyId && rows[0] ? await deliveryProofKeys(db, rows[0].id, rows[0].legacyProof) : [];
  return rows.map(({ legacyProof, ...r }) => ({
    ...r,
    note: hidePrices(r.note) ?? "",
    orderNote: hidePrices(r.orderNote) ?? "",
    delayReason: hidePrices(r.delayReason) ?? "",
    deliveredAt: num(r.deliveredAt),
    loadedAt: num(r.loadedAt),
    departedAt: num(r.departedAt),
    arrivedAt: num(r.arrivedAt),
    proofKeys: onlyId ? proofs : legacyProof ? [legacyProof] : [],
    lines: items.get(r.id) ?? [],
  }));
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
