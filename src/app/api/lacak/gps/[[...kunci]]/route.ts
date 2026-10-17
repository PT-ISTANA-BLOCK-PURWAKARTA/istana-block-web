import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { checkGpsKey, recordFixes, validFix, type Fix } from "@/lib/erp/tracking";

/**
 * Penerima posisi dari perangkat GPS truk, gateway/server pelacak (mis. Traccar), atau aplikasi
 * Traccar Client di HP. Kunci dikirim lewat ?key=…, /api/lacak/gps/<kunci>, atau header Authorization: Bearer.
 *
 * Format yang diterima:
 * 1. OsmAnd/Traccar (GET atau POST form): id, lat, lon, timestamp, speed (knot), bearing, accuracy
 * 2. JSON Traccar Client: { device_id, location: { timestamp, coords: { latitude, longitude, speed (m/s), heading, accuracy } } }
 * 3. JSON umum (satu objek atau array): { id | device_id | imei, lat | latitude, lng | lon | longitude, speed_kmh | speed (km/jam), heading | course, time | timestamp }
 */

type Parsed = { device: string; fix: Partial<Fix> };

const num = (v: unknown) => (v === null || v === undefined || v === "" ? undefined : Number(v));

/** unix detik / milidetik / ISO → unix detik. */
function toUnix(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return Math.floor(Date.now() / 1000);
  const n = Number(v);
  if (Number.isFinite(n)) return n > 1e12 ? Math.floor(n / 1000) : Math.floor(n);
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? Math.floor(t / 1000) : undefined;
}

function fromParams(p: URLSearchParams): Parsed | null {
  const device = p.get("id") ?? p.get("deviceid") ?? p.get("device_id") ?? p.get("imei");
  if (!device) return null;
  const knots = num(p.get("speed"));
  return {
    device,
    fix: {
      lat: num(p.get("lat")),
      lng: num(p.get("lon") ?? p.get("lng")),
      at: toUnix(p.get("timestamp") ?? p.get("time")),
      speed: knots === undefined ? (num(p.get("speed_kmh")) ?? null) : knots * 1.852,
      heading: num(p.get("bearing") ?? p.get("heading") ?? p.get("course")) ?? null,
      accuracy: num(p.get("accuracy") ?? p.get("hdop")) ?? null,
    },
  };
}

function fromJson(o: Record<string, unknown>): Parsed | null {
  // Traccar Client versi baru.
  if (o.location && typeof o.location === "object") {
    const loc = o.location as { timestamp?: unknown; coords?: Record<string, unknown> };
    const c = loc.coords ?? {};
    const ms = num(c.speed);
    const device = String(o.device_id ?? o.id ?? "");
    if (!device) return null;
    return {
      device,
      fix: { lat: num(c.latitude), lng: num(c.longitude), at: toUnix(loc.timestamp), speed: ms === undefined || ms < 0 ? null : ms * 3.6, heading: num(c.heading) ?? null, accuracy: num(c.accuracy) ?? null },
    };
  }
  const device = String(o.id ?? o.device_id ?? o.deviceId ?? o.imei ?? "");
  if (!device) return null;
  return {
    device,
    fix: {
      lat: num(o.lat ?? o.latitude),
      lng: num(o.lng ?? o.lon ?? o.longitude),
      at: toUnix(o.time ?? o.timestamp ?? o.fixTime),
      speed: num(o.speed_kmh ?? o.speed) ?? null,
      heading: num(o.heading ?? o.course ?? o.bearing) ?? null,
      accuracy: num(o.accuracy) ?? null,
    },
  };
}

async function readBody(req: Request, url: URL): Promise<Parsed[]> {
  const out: Parsed[] = [];
  const q = fromParams(url.searchParams);
  if (q) out.push(q);
  if (req.method !== "POST") return out;
  const type = req.headers.get("content-type") ?? "";
  const text = (await req.text()).slice(0, 200_000);
  if (!text.trim()) return out;
  if (type.includes("json") || /^\s*[[{]/.test(text)) {
    try {
      const data = JSON.parse(text) as unknown;
      for (const o of Array.isArray(data) ? data : [data]) if (o && typeof o === "object") {
        const p = fromJson(o as Record<string, unknown>);
        if (p) out.push(p);
      }
    } catch {
      /* bukan JSON yang sah */
    }
  } else {
    const p = fromParams(new URLSearchParams(text));
    if (p) out.push(p);
  }
  return out;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

async function handle(req: Request, ctx: { params: Promise<{ kunci?: string[] }> }) {
  const url = new URL(req.url);
  const { kunci } = await ctx.params;
  const auth = req.headers.get("authorization");
  const key = url.searchParams.get("key") ?? kunci?.[0] ?? (auth?.startsWith("Bearer ") ? auth.slice(7) : null) ?? req.headers.get("x-api-key");
  const db = await getDb();
  if (!(await checkGpsKey(db, key))) return json(401, { ok: false, error: "Kunci GPS salah atau belum dibuat." });

  url.searchParams.delete("key");
  const parsed = await readBody(req, url);
  if (!parsed.length) return json(400, { ok: false, error: "Tidak ada posisi yang terbaca. Kirim id, lat, lon (lihat dokumentasi)." });

  const byDevice = new Map<string, Fix[]>();
  let invalid = 0;
  for (const p of parsed) {
    if (!validFix(p.fix)) {
      invalid++;
      continue;
    }
    const list = byDevice.get(p.device.trim()) ?? [];
    list.push(p.fix);
    byDevice.set(p.device.trim(), list);
  }
  let saved = 0;
  const unknown: string[] = [];
  for (const [device, fixes] of byDevice) {
    const v = await db.query.vehicles.findFirst({ where: eq(schema.vehicles.gpsDeviceId, device) });
    if (!v) {
      unknown.push(device);
      continue;
    }
    saved += await recordFixes(db, v.id, fixes, "gps");
  }
  if (unknown.length && !saved) return json(404, { ok: false, error: `ID perangkat belum terdaftar di armada: ${unknown.slice(0, 5).join(", ")}` });
  return json(200, { ok: true, saved, invalid, unknown });
}

export const GET = handle;
export const POST = handle;
