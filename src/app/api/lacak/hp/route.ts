import { getDb } from "@/db";
import { getCurrentAdmin } from "@/lib/auth";
import { activeTripOfDriver, recordFixes, validFix } from "@/lib/erp/tracking";
import { can } from "@/lib/roles";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

/**
 * Lokasi dari HP sopir (halaman Tugas, saat "Bagikan lokasi" aktif). Hanya diterima selama sopir
 * punya surat jalan di jalan (berangkat, tiba, atau tertunda setelah berangkat); posisi dicatat untuk truk di surat jalan itu.
 */
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) return json(403, { ok: false, error: "Asal permintaan tidak dikenal." });
  const me = await getCurrentAdmin();
  if (!me || !can(me.roles, "antar") || !me.driverId) return json(401, { ok: false, error: "Masuk sebagai sopir dulu." });
  const db = await getDb();
  const trip = await activeTripOfDriver(db, me.driverId);
  if (!trip?.vehicleId) return json(409, { ok: false, error: "Tidak ada surat jalan yang sedang diantar.", stop: true });
  let body: { lat?: number; lng?: number; speed?: number | null; heading?: number | null; accuracy?: number | null; at?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json(400, { ok: false, error: "Data lokasi tidak terbaca." });
  }
  const fix = {
    lat: Number(body.lat),
    lng: Number(body.lng),
    at: Math.floor(Number(body.at ?? Date.now()) / 1000),
    // Browser memberi kecepatan dalam m/s.
    speed: body.speed == null ? null : Number(body.speed) * 3.6,
    heading: body.heading == null ? null : Number(body.heading),
    accuracy: body.accuracy == null ? null : Number(body.accuracy),
  };
  if (!validFix(fix)) return json(400, { ok: false, error: "Koordinat tidak sah." });
  // Akurasi sangat buruk (> 300 m, mis. dari jaringan seluler saja) tidak dicatat.
  if (fix.accuracy != null && fix.accuracy > 300) return json(200, { ok: true, saved: 0, note: "Akurasi rendah, menunggu sinyal GPS." });
  const saved = await recordFixes(db, trip.vehicleId, [fix], "hp", me.id);
  return json(200, { ok: true, saved, trip: trip.number });
}
