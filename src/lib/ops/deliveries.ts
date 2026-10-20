import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { schema } from "@/db";
import type { NotificationKind } from "@/db/erp";
import { SQL_OPEN } from "@/components/ops/delivery/status";
import { deliveryItems } from "@/lib/erp/ops";
import type { DB } from "@/lib/erp/server";
import { addDays, today } from "@/lib/erp/util";
import { coordsFromMapsUrl, haversineKm } from "@/lib/erp/tracking";

/* ------------------------------------------------------------------ token tautan lacak */

/** Token tautan lacak: 24 byte acak dalam heksadesimal (48 huruf). Yang disimpan hanya SHA-256-nya. */
export const TOKEN_RE = /^[0-9a-f]{48}$/;

export async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function newToken() {
  return [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ------------------------------------------------------------------ foto bukti & riwayat */

/** Kunci foto bukti sebuah surat jalan: kolom lama proof_key (bila ada) lalu ops_delivery_proofs, terlama dulu. */
export async function deliveryProofKeys(db: DB, deliveryId: string, legacy?: string | null) {
  const rows = await db
    .select({ key: schema.deliveryProofs.fileKey })
    .from(schema.deliveryProofs)
    .where(and(eq(schema.deliveryProofs.deliveryId, deliveryId), eq(schema.deliveryProofs.kind, "photo")))
    .orderBy(asc(schema.deliveryProofs.createdAt), asc(schema.deliveryProofs.id));
  const keys = rows.map((r) => r.key);
  let old = legacy;
  if (old === undefined) old = (await db.query.deliveries.findFirst({ where: eq(schema.deliveries.id, deliveryId), columns: { proofKey: true } }))?.proofKey;
  if (old && !keys.includes(old)) keys.unshift(old);
  return keys;
}

/** Jumlah foto di ops_delivery_proofs (dipakai batas MAX_DELIVERY_PROOFS). */
export async function proofRowCount(db: DB, deliveryId: string) {
  const r = await db.get<{ n: number }>(sql`select count(*) n from ops_delivery_proofs where delivery_id = ${deliveryId}`);
  return Number(r?.n ?? 0);
}

export type HistoryRow = { id: string; fromStatus: string | null; toStatus: string; note: string; at: number; who: string };

/** Riwayat status sebuah surat jalan, terlama dulu, dengan nama pengubahnya. */
export async function deliveryHistoryRows(db: DB, deliveryId: string): Promise<HistoryRow[]> {
  const rows = await db.all<{ id: string; fromStatus: string | null; toStatus: string; note: string; at: number; userName: string | null; driverName: string | null }>(sql`
    select h.id, h.from_status fromStatus, h.to_status toStatus, h.note, h.created_at at, u.name userName, dr.name driverName
    from ops_delivery_history h
      left join users u on u.id = h.changed_by
      left join ops_drivers dr on dr.id = h.changed_by_driver
    where h.delivery_id = ${deliveryId}
    order by h.created_at, h.rowid`);
  return rows.map((r) => ({ id: r.id, fromStatus: r.fromStatus, toStatus: r.toStatus, note: r.note, at: Number(r.at), who: r.driverName ? `Sopir: ${r.driverName}` : r.userName ? `Kantor: ${r.userName}` : "—" }));
}

/** Ringkasan tautan lacak sebuah surat jalan (jumlah & kapan terakhir dibuka pelanggan). */
export async function trackingSummary(db: DB, deliveryId: string) {
  const r = await db.get<{ n: number; last: number | null }>(sql`select count(*) n, max(last_accessed_at) last from ops_tracking_links where delivery_id = ${deliveryId}`);
  return { count: Number(r?.n ?? 0), lastAccessedAt: r?.last == null ? null : Number(r.last) };
}

/* ------------------------------------------------------------------ papan muatan */

export type BoardRange = "hari-ini" | "besok" | "semua";
export type BoardJob = {
  id: string;
  number: string;
  date: string;
  status: string;
  orderId: string;
  orderNumber: string;
  contactName: string;
  project: string;
  address: string;
  mapsUrl: string;
  plate: string | null;
  driver: string | null;
  delayReason: string;
  lines: { name: string; qty: number; unit: string }[];
};

/** Tugas untuk papan muatan: yang belum selesai + terkirim/batal dalam 24 jam terakhir. */
export async function boardJobs(db: DB, o: { range: BoardRange; status: string; q: string }): Promise<BoardJob[]> {
  const now = today();
  const since = Math.floor(Date.now() / 1000) - 86400;
  const like = `%${o.q}%`;
  const statusSql =
    o.status === "dijadwalkan" || o.status === "dimuat" || o.status === "berangkat" || o.status === "tiba" || o.status === "tertunda" || o.status === "terkirim" || o.status === "batal" ? sql`d.status = ${o.status}` : sql`1 = 1`;
  const rangeSql = o.range === "hari-ini" ? sql`d.date <= ${now}` : o.range === "besok" ? sql`d.date = ${addDays(now, 1)}` : sql`1 = 1`;
  const rows = await db.all<Omit<BoardJob, "lines">>(sql`
    select d.id, d.number, d.date, d.status, o.id orderId, o.number orderNumber, c.name contactName, o.project, o.address, o.maps_url mapsUrl,
      v.plate, dr.name driver, coalesce(d.delay_reason, '') delayReason
    from ops_deliveries d join ops_orders o on o.id = d.order_id join fin_contacts c on c.id = o.contact_id
      left join ops_vehicles v on v.id = d.vehicle_id left join ops_drivers dr on dr.id = d.driver_id
    where (${sql.raw(SQL_OPEN)} or (d.status in ('terkirim','batal') and d.updated_at >= ${since}))
      and ${rangeSql} and ${statusSql}
      ${o.q ? sql`and (d.number like ${like} or o.number like ${like} or c.name like ${like} or o.project like ${like} or o.address like ${like} or v.plate like ${like} or dr.name like ${like})` : sql``}
    order by case d.status when 'dijadwalkan' then 0 when 'dimuat' then 1 when 'berangkat' then 2 when 'tiba' then 2 when 'tertunda' then 2 else 3 end, d.date, d.number
    limit 200`);
  const items = await deliveryItems(db, rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, lines: items.get(r.id) ?? [] }));
}

export type BoardNotification = { id: string; kind: NotificationKind; refId: string; title: string; message: string; createdAt: number };

/** Notifikasi belum dibaca untuk papan muatan / kantor. */
export async function unreadNotifications(db: DB, kinds: NotificationKind[], limit = 30): Promise<BoardNotification[]> {
  if (!kinds.length) return [];
  const rows = await db.all<BoardNotification>(sql`
    select id, kind, ref_id refId, title, message, created_at createdAt from ops_notifications
    where read_at is null and kind in (${sql.join(kinds.map((k) => sql`${k}`), sql`, `)})
    order by created_at desc limit ${limit}`);
  return rows.map((r) => ({ ...r, createdAt: Number(r.createdAt) }));
}

/* ------------------------------------------------------------------ halaman lacak publik */

export type TrackData = {
  id: string;
  number: string;
  status: string;
  date: string;
  contactName: string;
  project: string;
  address: string;
  items: { name: string; qty: number; unit: string }[];
  driver: { name: string; phone: string } | null;
  vehicle: { plate: string; name: string } | null;
  loadedAt: number | null;
  departedAt: number | null;
  arrivedAt: number | null;
  deliveredAt: number | null;
  delayReason: string;
  receivedBy: string;
  proofCount: number;
  position: { lat: number; lng: number; at: number } | null;
  dest: [number, number] | null;
  mapsUrl: string;
};

const secs = (v: unknown) => (v instanceof Date ? Math.floor(v.getTime() / 1000) : v == null ? null : Number(v));

/**
 * Data halaman lacak publik dari token. null bila token tidak dikenal. TANPA nomor HP pelanggan dan tanpa harga.
 * Posisi terakhir hanya dibagikan selama truk di jalan (berangkat, tiba, atau tertunda setelah berangkat).
 */
export async function trackingData(db: DB, token: string): Promise<TrackData | null> {
  const link = await db.query.trackingLinks.findFirst({ where: eq(schema.trackingLinks.tokenHash, await sha256Hex(token)) });
  if (!link) return null;
  const d = await db.query.deliveries.findFirst({ where: eq(schema.deliveries.id, link.deliveryId) });
  if (!d) return null;
  const nowSec = Math.floor(Date.now() / 1000);
  // Catat kunjungan paling sering sekali per menit (halaman memuat ulang sendiri tiap 30 detik).
  const last = secs(link.lastAccessedAt);
  if (last == null || nowSec - last >= 60) await db.update(schema.trackingLinks).set({ lastAccessedAt: new Date() }).where(eq(schema.trackingLinks.id, link.id));

  const [order, driver, vehicle, items, proofs] = await Promise.all([
    db.query.orders.findFirst({ where: eq(schema.orders.id, d.orderId) }),
    d.driverId ? db.query.drivers.findFirst({ where: eq(schema.drivers.id, d.driverId) }) : undefined,
    d.vehicleId ? db.query.vehicles.findFirst({ where: eq(schema.vehicles.id, d.vehicleId) }) : undefined,
    deliveryItems(db, [d.id]),
    deliveryProofKeys(db, d.id, d.proofKey),
  ]);
  const contact = order ? await db.query.contacts.findFirst({ where: eq(schema.contacts.id, order.contactId) }) : undefined;
  const onRoad = (d.status === "berangkat" || d.status === "tiba" || d.status === "tertunda") && !!d.departedAt;
  let position: TrackData["position"] = null;
  if (onRoad && d.vehicleId) {
    const p = await db.get<{ lat: number; lng: number; at: number }>(sql`select lat, lng, at from ops_positions where vehicle_id = ${d.vehicleId} order by at desc limit 1`);
    if (p) position = { lat: Number(p.lat), lng: Number(p.lng), at: Number(p.at) };
  }
  return {
    id: d.id,
    number: d.number,
    status: d.status,
    date: d.date,
    contactName: contact?.name ?? "",
    project: order?.project ?? "",
    address: order?.address ?? "",
    items: items.get(d.id) ?? [],
    driver: driver ? { name: driver.name, phone: driver.phone } : null,
    vehicle: vehicle ? { plate: vehicle.plate, name: vehicle.name } : null,
    loadedAt: secs(d.loadedAt),
    departedAt: secs(d.departedAt),
    arrivedAt: secs(d.arrivedAt),
    deliveredAt: secs(d.deliveredAt),
    delayReason: d.delayReason ?? "",
    receivedBy: d.receivedBy,
    proofCount: proofs.length,
    position,
    dest: coordsFromMapsUrl(order?.mapsUrl),
    mapsUrl: order?.mapsUrl ?? "",
  };
}

/** Kunci foto ke-n (0-based) dari surat jalan di balik token, atau null. Untuk route foto publik. */
export async function trackingProofKey(db: DB, token: string, n: number) {
  const link = await db.query.trackingLinks.findFirst({ where: eq(schema.trackingLinks.tokenHash, await sha256Hex(token)) });
  if (!link) return null;
  const keys = await deliveryProofKeys(db, link.deliveryId);
  return keys[n] ?? null;
}

/* ------------------------------------------------------------------ laporan pengiriman (ekspor Excel) */

export type ReportRow = {
  id: string;
  number: string;
  date: string;
  status: string;
  orderNumber: string;
  contactName: string;
  project: string;
  address: string;
  plate: string;
  driver: string;
  items: string;
  loadedAt: number | null;
  departedAt: number | null;
  arrivedAt: number | null;
  deliveredAt: number | null;
  delayReason: string;
  receivedBy: string;
  completedBy: string;
  gpsPoints: number;
  gpsKm: number;
  photoCount: number;
};
export type ReportHistory = { number: string; at: number; fromStatus: string; toStatus: string; who: string; note: string };

/**
 * Data ekspor Excel laporan pengiriman pada rentang tanggal surat jalan: tiap SJ + jarak GPS (haversine antar titik
 * ops_positions kendaraan selama berangkat sampai terkirim) + jumlah foto + riwayat status. Empat kueri, apa pun jumlah SJ.
 */
export async function deliveryReport(db: DB, from: string, to: string) {
  const MAX_POINTS = 50000;
  const [rows, lines, history, points] = await Promise.all([
    db.all<Omit<ReportRow, "items" | "completedBy" | "gpsPoints" | "gpsKm">>(sql`
      select d.id, d.number, d.date, d.status, o.number orderNumber, c.name contactName, o.project, o.address,
        coalesce(v.plate, '') plate, coalesce(dr.name, '') driver,
        d.loaded_at loadedAt, d.departed_at departedAt, d.arrived_at arrivedAt, d.delivered_at deliveredAt,
        coalesce(d.delay_reason, '') delayReason, d.received_by receivedBy,
        (select count(*) from ops_delivery_proofs p where p.delivery_id = d.id and p.kind = 'photo')
          + (case when coalesce(d.proof_key, '') <> '' and not exists (select 1 from ops_delivery_proofs p where p.delivery_id = d.id and p.file_key = d.proof_key) then 1 else 0 end) photoCount
      from ops_deliveries d join ops_orders o on o.id = d.order_id join fin_contacts c on c.id = o.contact_id
        left join ops_vehicles v on v.id = d.vehicle_id left join ops_drivers dr on dr.id = d.driver_id
      where d.date >= ${from} and d.date <= ${to}
      order by d.date, d.number limit 2000`),
    db.all<{ deliveryId: string; name: string | null; qty: number; unit: string }>(sql`
      select dl.delivery_id deliveryId, i.name, dl.qty, coalesce(nullif(ol.unit, ''), i.unit) unit
      from ops_delivery_lines dl join ops_deliveries d on d.id = dl.delivery_id
        join ops_order_lines ol on ol.id = dl.order_line_id left join fin_items i on i.id = dl.item_id
      where d.date >= ${from} and d.date <= ${to}`),
    db.all<{ deliveryId: string; number: string; fromStatus: string | null; toStatus: string; note: string; at: number; userName: string | null; driverName: string | null }>(sql`
      select h.delivery_id deliveryId, d.number, h.from_status fromStatus, h.to_status toStatus, h.note, h.created_at at, u.name userName, dr.name driverName
      from ops_delivery_history h join ops_deliveries d on d.id = h.delivery_id
        left join users u on u.id = h.changed_by left join ops_drivers dr on dr.id = h.changed_by_driver
      where d.date >= ${from} and d.date <= ${to}
      order by d.date, d.number, h.created_at, h.rowid limit 20000`),
    db.all<{ deliveryId: string; lat: number; lng: number }>(sql`
      select d.id deliveryId, p.lat, p.lng
      from ops_deliveries d join ops_positions p on p.vehicle_id = d.vehicle_id
        and p.at >= d.departed_at and p.at <= coalesce(d.delivered_at, d.arrived_at, cast(strftime('%s', 'now') as integer))
      where d.date >= ${from} and d.date <= ${to} and d.vehicle_id is not null and d.departed_at is not null
      order by d.id, p.at limit ${MAX_POINTS + 1}`),
  ]);
  const gpsTruncated = points.length > MAX_POINTS;
  const byLines = new Map<string, string[]>();
  for (const l of lines) (byLines.get(l.deliveryId) ?? byLines.set(l.deliveryId, []).get(l.deliveryId)!).push(`${l.name ?? ""} ${l.qty} ${l.unit ?? ""}`.trim());
  const gps = new Map<string, { n: number; km: number; last: [number, number] | null }>();
  for (const p of points.slice(0, MAX_POINTS)) {
    const g = gps.get(p.deliveryId) ?? { n: 0, km: 0, last: null };
    const cur: [number, number] = [Number(p.lat), Number(p.lng)];
    if (g.last) g.km += haversineKm(g.last, cur);
    g.last = cur;
    g.n++;
    gps.set(p.deliveryId, g);
  }
  const doneBy = new Map<string, string>();
  for (const h of history) if (h.toStatus === "terkirim") doneBy.set(h.deliveryId, h.driverName ? `Sopir: ${h.driverName}` : h.userName ? `Kantor: ${h.userName}` : "");
  const out: ReportRow[] = rows.map((r) => ({
    ...r,
    loadedAt: r.loadedAt == null ? null : Number(r.loadedAt),
    departedAt: r.departedAt == null ? null : Number(r.departedAt),
    arrivedAt: r.arrivedAt == null ? null : Number(r.arrivedAt),
    deliveredAt: r.deliveredAt == null ? null : Number(r.deliveredAt),
    photoCount: Number(r.photoCount),
    items: (byLines.get(r.id) ?? []).join("; "),
    completedBy: doneBy.get(r.id) ?? "",
    gpsPoints: gps.get(r.id)?.n ?? 0,
    gpsKm: Math.round((gps.get(r.id)?.km ?? 0) * 10) / 10,
  }));
  const hist: ReportHistory[] = history.map((h) => ({
    number: h.number,
    at: Number(h.at),
    fromStatus: h.fromStatus ?? "",
    toStatus: h.toStatus,
    who: h.driverName ? `Sopir: ${h.driverName}` : h.userName ? `Kantor: ${h.userName}` : "",
    note: h.note,
  }));
  return { rows: out, history: hist, gpsTruncated };
}
