import "server-only";
import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { schema } from "@/db";
import type { PositionSource } from "@/db/erp";
import { chunk, type DB } from "./server";

/* ------------------------------------------------------------------ kunci penerima data GPS */

const KEY_HASH = "gps_ingest_key_hash";
const KEY_HINT = "gps_ingest_key_hint";

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Kunci baru (32 karakter acak). Yang disimpan hanya hash-nya; kunci asli ditampilkan sekali. */
export async function rotateGpsKey(db: DB) {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  const key = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const hash = await sha256Hex(key);
  for (const [k, v] of [[KEY_HASH, hash], [KEY_HINT, key.slice(-4)]] as const) {
    await db.insert(schema.settings).values({ key: k, value: v }).onConflictDoUpdate({ target: schema.settings.key, set: { value: v } });
  }
  return key;
}

export async function gpsKeyHint(db: DB) {
  const row = await db.query.settings.findFirst({ where: eq(schema.settings.key, KEY_HINT) });
  return row?.value ?? null;
}

export async function checkGpsKey(db: DB, key: string | null | undefined) {
  if (!key || key.length < 16) return false;
  const row = await db.query.settings.findFirst({ where: eq(schema.settings.key, KEY_HASH) });
  if (!row) return false;
  const got = await sha256Hex(key);
  // Bandingkan dengan waktu tetap.
  let diff = got.length ^ row.value.length;
  for (let i = 0; i < Math.min(got.length, row.value.length); i++) diff |= got.charCodeAt(i) ^ row.value.charCodeAt(i);
  return diff === 0;
}

/* ------------------------------------------------------------------ menyimpan posisi */

export type Fix = { lat: number; lng: number; at: number; speed?: number | null; heading?: number | null; accuracy?: number | null };

export function validFix(f: Partial<Fix>): f is Fix {
  const { lat, lng, at } = f;
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || (Math.abs(lat) < 1e-6 && Math.abs(lng) < 1e-6)) return false;
  return typeof at === "number" && Number.isFinite(at);
}

const KEEP_DAYS = 120;

/** Simpan beberapa posisi sekaligus; titik dengan waktu yang sama untuk truk yang sama dilewati. */
export async function recordFixes(db: DB, vehicleId: string, fixes: Fix[], source: PositionSource, userId: number | null = null) {
  const now = Math.floor(Date.now() / 1000);
  const rows = fixes
    // Jam perangkat yang ngawur: maju > 5 menit dipotong ke sekarang, lebih tua dari 30 hari dibuang.
    .map((f) => ({ ...f, at: Math.min(Math.round(f.at), now + 300) }))
    .filter((f) => f.at > now - 30 * 86400);
  if (!rows.length) return 0;
  const existing = new Set(
    (
      await db
        .select({ at: schema.positions.at })
        .from(schema.positions)
        .where(and(eq(schema.positions.vehicleId, vehicleId), gte(schema.positions.at, Math.min(...rows.map((r) => r.at))), lte(schema.positions.at, Math.max(...rows.map((r) => r.at)))))
    ).map((r) => r.at),
  );
  const fresh = rows.filter((r, i) => !existing.has(r.at) && rows.findIndex((x) => x.at === r.at) === i);
  for (const part of chunk(fresh, 8)) {
    await db.insert(schema.positions).values(
      part.map((f) => ({
        vehicleId,
        lat: Number(f.lat.toFixed(6)),
        lng: Number(f.lng.toFixed(6)),
        speed: f.speed == null || !Number.isFinite(f.speed) ? null : Math.max(0, Math.round(f.speed * 10) / 10),
        heading: f.heading == null || !Number.isFinite(f.heading) ? null : Math.round(f.heading),
        accuracy: f.accuracy == null || !Number.isFinite(f.accuracy) ? null : Math.round(f.accuracy),
        at: f.at,
        receivedAt: now,
        source,
        userId,
      })),
    );
  }
  // Sesekali buang riwayat yang sudah sangat lama.
  if (Math.random() < 0.01) await db.delete(schema.positions).where(lte(schema.positions.at, now - KEEP_DAYS * 86400));
  return fresh.length;
}

/* ------------------------------------------------------------------ membaca posisi */

export type TruckState = "bergerak" | "berhenti" | "tanpa_sinyal" | "belum_ada";

export type TruckView = {
  id: string;
  plate: string;
  name: string;
  hasDevice: boolean;
  lat: number | null;
  lng: number | null;
  speed: number | null;
  heading: number | null;
  at: number | null;
  source: PositionSource | null;
  state: TruckState;
  /** Sejak kapan berhenti (unix detik), bila berhenti. */
  stoppedSince: number | null;
  trip: { id: string; number: string; contactName: string; destination: string; driver: string | null; status: string; dest: [number, number] | null } | null;
  /** Jarak lurus ke tujuan (km), bila koordinat tujuan diketahui dari tautan peta. */
  distanceKm: number | null;
};

const MOVING_KMH = 5;
const STALE_SEC = 30 * 60;

/** Ambil koordinat dari tautan Google Maps (…@-6.55,107.44… / q=-6.55,107.44 / ll=…). */
export function coordsFromMapsUrl(url: string | null | undefined): [number, number] | null {
  if (!url) return null;
  const m = url.match(/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/) ?? url.match(/[?&](?:q|ll|query|destination)=(-?\d{1,2}\.\d+)(?:,|%2C)\s*(-?\d{1,3}\.\d+)/i) ?? url.match(/!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? [lat, lng] : null;
}

export function haversineKm(a: [number, number], b: [number, number]) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Posisi terakhir setiap truk aktif, status gerak, dan surat jalan yang sedang diantar. */
export async function truckBoard(db: DB): Promise<TruckView[]> {
  const now = Math.floor(Date.now() / 1000);
  const [vehicles, last, trips] = await Promise.all([
    db.select().from(schema.vehicles).where(eq(schema.vehicles.active, true)).orderBy(asc(schema.vehicles.plate)),
    db.all<{ vehicleId: string; lat: number; lng: number; speed: number | null; heading: number | null; at: number; source: PositionSource }>(sql`
      select p.vehicle_id vehicleId, p.lat, p.lng, p.speed, p.heading, p.at, p.source
      from ops_positions p
      join (select vehicle_id, max(at) at from ops_positions group by vehicle_id) m on m.vehicle_id = p.vehicle_id and m.at = p.at
      group by p.vehicle_id`),
    db.all<{ id: string; number: string; vehicleId: string; status: string; contactName: string; project: string; address: string; mapsUrl: string; driver: string | null }>(sql`
      select d.id, d.number, d.vehicle_id vehicleId, d.status, c.name contactName, o.project, o.address, o.maps_url mapsUrl, dr.name driver
      from ops_deliveries d join ops_orders o on o.id = d.order_id join fin_contacts c on c.id = o.contact_id
      left join ops_drivers dr on dr.id = d.driver_id
      where d.status = 'berangkat' and d.vehicle_id is not null
      order by d.departed_at desc`),
  ]);
  // Untuk truk yang berhenti: cari titik bergerak terakhir supaya bisa menulis "berhenti sejak …".
  const stoppedIds = last.filter((p) => now - p.at <= STALE_SEC && (p.speed ?? 0) < MOVING_KMH).map((p) => p.vehicleId);
  const lastMoving = new Map<string, number>();
  for (const part of chunk(stoppedIds, 50)) {
    if (!part.length) continue;
    const rows = await db.all<{ vehicleId: string; at: number }>(sql`
      select vehicle_id vehicleId, max(at) at from ops_positions
      where vehicle_id in (${sql.join(part.map((v) => sql`${v}`), sql`, `)}) and speed >= ${MOVING_KMH} and at >= ${now - 86400}
      group by vehicle_id`);
    for (const r of rows) lastMoving.set(r.vehicleId, Number(r.at));
  }
  const lastBy = new Map(last.map((p) => [p.vehicleId, p]));
  const tripBy = new Map<string, (typeof trips)[number]>();
  for (const t of trips) if (!tripBy.has(t.vehicleId)) tripBy.set(t.vehicleId, t);

  return vehicles.map((v) => {
    const p = lastBy.get(v.id);
    const t = tripBy.get(v.id);
    const at = p ? Number(p.at) : null;
    const state: TruckState = !p ? "belum_ada" : now - Number(p.at) > STALE_SEC ? "tanpa_sinyal" : (p.speed ?? 0) >= MOVING_KMH ? "bergerak" : "berhenti";
    const dest = t ? coordsFromMapsUrl(t.mapsUrl) : null;
    return {
      id: v.id,
      plate: v.plate,
      name: v.name,
      hasDevice: !!v.gpsDeviceId,
      lat: p ? Number(p.lat) : null,
      lng: p ? Number(p.lng) : null,
      speed: p?.speed == null ? null : Number(p.speed),
      heading: p?.heading == null ? null : Number(p.heading),
      at,
      source: p?.source ?? null,
      state,
      stoppedSince: state === "berhenti" ? (lastMoving.get(v.id) ?? null) : null,
      trip: t ? { id: t.id, number: t.number, contactName: t.contactName, destination: t.project || t.address.split("\n")[0] || "", driver: t.driver, status: t.status, dest } : null,
      distanceKm: p && dest ? Math.round(haversineKm([Number(p.lat), Number(p.lng)], dest) * 10) / 10 : null,
    };
  });
}

/** Rute satu truk pada satu tanggal (WIB). */
export async function routeOf(db: DB, vehicleId: string, date: string) {
  // Tanggal WIB (UTC+7) → rentang unix detik.
  const start = Math.floor(Date.parse(`${date}T00:00:00+07:00`) / 1000);
  const end = start + 86400;
  const rows = await db
    .select({ lat: schema.positions.lat, lng: schema.positions.lng, at: schema.positions.at, speed: schema.positions.speed })
    .from(schema.positions)
    .where(and(eq(schema.positions.vehicleId, vehicleId), gte(schema.positions.at, start), lte(schema.positions.at, end)))
    .orderBy(asc(schema.positions.at))
    .limit(5000);
  let km = 0;
  for (let i = 1; i < rows.length; i++) km += haversineKm([rows[i - 1].lat, rows[i - 1].lng], [rows[i].lat, rows[i].lng]);
  return { points: rows.map((r) => [r.lat, r.lng, r.at, r.speed ?? 0] as [number, number, number, number]), km: Math.round(km * 10) / 10 };
}

/** Surat jalan yang sedang diantar seorang sopir (untuk lokasi dari HP). */
export async function activeTripOfDriver(db: DB, driverId: string) {
  return db.query.deliveries.findFirst({
    where: and(eq(schema.deliveries.driverId, driverId), eq(schema.deliveries.status, "berangkat")),
    orderBy: (d, { desc }) => [desc(d.departedAt)],
  });
}
