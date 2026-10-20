import { getDb, schema } from "@/db";
import { logActivity } from "@/lib/ops/activity";
import { forbidden, json, owner, sameOrigin } from "../guard";

/** Catat satu backup yang selesai dijalankan di komputer kantor (tampil di riwayat dan menghentikan pengingat). */
export async function POST(req: Request) {
  const me = await owner();
  if (!me) return forbidden();
  if (!sameOrigin(req)) return json({ error: "Asal permintaan tidak dikenal." }, 403);
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Data tidak terbaca." }, 400);
  }
  const count = (v: unknown) => Math.min(10_000_000, Math.max(0, Math.floor(Number(v) || 0)));
  const run = {
    userId: me.id,
    userName: me.name,
    folder: String(body.folder ?? "").slice(0, 120) || null,
    tables: count(body.tables),
    rows: count(body.rows),
    photos: count(body.photos),
    newPhotos: count(body.newPhotos),
  };
  const db = await getDb();
  await db.insert(schema.backupRuns).values(run);
  await logActivity(me, { action: "backup.catat", label: "Backup data", summary: `${run.rows} baris, ${run.newPhotos} berkas baru${run.folder ? ` · ${run.folder}` : ""}` });
  return json({ ok: true });
}
