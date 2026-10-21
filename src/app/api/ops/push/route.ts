import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb, getEnv, schema } from "@/db";
import { getCurrentAdmin } from "@/lib/auth";
import { isPushEndpoint, pushConfigured, pushToUsers } from "@/lib/ops/push";
import { canOpen } from "@/lib/roles";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

/** Sesi aplikasi operasional (kantor maupun lapangan) + permintaan dari situs ini sendiri untuk yang mengubah data. */
async function guard(req: Request, mutating: boolean) {
  if (mutating) {
    const origin = req.headers.get("origin");
    if (origin && origin !== new URL(req.url).origin) return { error: json(403, { ok: false, error: "Asal permintaan tidak dikenal." }) };
  }
  const me = await getCurrentAdmin();
  if (!me || !canOpen(me.roles, "operasional")) return { error: json(401, { ok: false, error: "Masuk dulu ke aplikasi operasional." }) };
  return { me };
}

/** Maksimal perangkat berlangganan per akun. */
const MAX_SUBSCRIPTIONS_PER_USER = 10;

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Kunci publik VAPID untuk mendaftar langganan; null bila push belum dikonfigurasi di server. */
export async function GET(req: Request) {
  const g = await guard(req, false);
  if (g.error) return g.error;
  const env = await getEnv();
  return json(200, { ok: true, publicKey: pushConfigured(env) ? env.VAPID_PUBLIC_KEY : null });
}

/** Daftarkan perangkat ini (upsert menurut endpoint), atau kirim tes bila ?test=1. */
export async function POST(req: Request) {
  const g = await guard(req, true);
  if (g.error) return g.error;
  const me = g.me;
  const env = await getEnv();
  const db = await getDb();

  if (new URL(req.url).searchParams.get("test") === "1") {
    if (!pushConfigured(env)) return json(409, { ok: false, error: "Notifikasi belum dikonfigurasi di server." });
    const { sent } = await pushToUsers(db, env, [me.id], { title: "Tes notifikasi", body: "Notifikasi Istana Block aktif di perangkat ini.", url: "/operasional", tag: "tes" });
    return json(200, { ok: true, sent });
  }

  let body: { endpoint?: unknown; p256dh?: unknown; auth?: unknown; userAgent?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json(400, { ok: false, error: "Data langganan tidak terbaca." });
  }
  const endpoint = text(body.endpoint, 1000);
  const p256dh = text(body.p256dh, 200);
  const auth = text(body.auth, 100);
  if (!pushConfigured(env)) return json(409, { ok: false, error: "Notifikasi belum dikonfigurasi di server." });
  if (!isPushEndpoint(endpoint) || !p256dh || !auth) return json(400, { ok: false, error: "Langganan notifikasi tidak sah atau dari layanan yang tidak dikenal." });
  const userAgent = text(body.userAgent, 200) || (req.headers.get("user-agent") ?? "").slice(0, 200);
  const now = new Date();
  await db
    .insert(schema.pushSubscriptions)
    .values({ userId: me.id, endpoint, p256dh, auth, userAgent })
    .onConflictDoUpdate({ target: schema.pushSubscriptions.endpoint, set: { userId: me.id, p256dh, auth, userAgent, updatedAt: now } });
  // Batasi langganan per akun: yang paling lama dihapus (langganan yang baru didaftarkan tidak pernah ikut terhapus).
  const mine = await db
    .select({ id: schema.pushSubscriptions.id, endpoint: schema.pushSubscriptions.endpoint })
    .from(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.userId, me.id))
    .orderBy(asc(schema.pushSubscriptions.updatedAt), asc(schema.pushSubscriptions.id));
  if (mine.length > MAX_SUBSCRIPTIONS_PER_USER) {
    const stale = mine.filter((row) => row.endpoint !== endpoint).slice(0, mine.length - MAX_SUBSCRIPTIONS_PER_USER).map((row) => row.id);
    if (stale.length) await db.delete(schema.pushSubscriptions).where(inArray(schema.pushSubscriptions.id, stale));
  }
  return json(200, { ok: true });
}

/** Cabut langganan perangkat ini (hanya milik sendiri). */
export async function DELETE(req: Request) {
  const g = await guard(req, true);
  if (g.error) return g.error;
  let body: { endpoint?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json(400, { ok: false, error: "Data langganan tidak terbaca." });
  }
  const endpoint = text(body.endpoint, 1000);
  if (!endpoint) return json(400, { ok: false, error: "Alamat langganan kosong." });
  const db = await getDb();
  await db.delete(schema.pushSubscriptions).where(and(eq(schema.pushSubscriptions.endpoint, endpoint), eq(schema.pushSubscriptions.userId, g.me.id)));
  return json(200, { ok: true });
}
