import "server-only";
import { and, count, desc, eq, gte, lt, or, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { DB } from "@/lib/erp/server";

/** Batas baris log yang dikembalikan (halaman menampilkan lebih sedikit; Excel memakai batas ini). */
export const ACTIVITY_LIMIT = 2000;
/** Backup lebih tua dari ini (atau belum pernah) dianggap terlambat. */
export const BACKUP_OVERDUE_DAYS = 7;

const a = schema.activityLogs;

export type ActivityFilter = {
  /** Awal (inklusif) dan akhir (EKSKLUSIF), keduanya sebagai Date. */
  from: Date;
  to: Date;
  userId?: number;
  /** Awalan kode aksi sebelum titik, mis. "produksi". */
  module?: string;
  search?: string;
  failedOnly?: boolean;
};

/** Rentang tanggal WIB (inklusif, YYYY-MM-DD) → [awal, akhir) sebagai Date. */
export function wibRange(from: string, to: string) {
  const f = Date.parse(`${from}T00:00:00Z`) - 7 * 3600_000;
  const t = Date.parse(`${to}T00:00:00Z`) + 86_400_000 - 7 * 3600_000;
  return { from: new Date(f), to: new Date(t) };
}

/** Escape karakter khusus LIKE (dipakai dengan `escape '!'`). */
const escapeLike = (text: string) => text.replace(/[!%_]/g, (m) => `!${m}`);

function conditions(f: ActivityFilter) {
  const c: (SQL | undefined)[] = [gte(a.at, f.from), lt(a.at, f.to)];
  if (f.userId) c.push(eq(a.userId, f.userId));
  if (f.module && /^[a-z_]+$/.test(f.module)) c.push(sql`substr(${a.action}, 1, ${f.module.length + 1}) = ${`${f.module}.`}`);
  if (f.failedOnly) c.push(eq(a.success, false));
  if (f.search) {
    const term = `%${escapeLike(f.search)}%`;
    c.push(or(...[a.summary, a.label, a.userName, a.details].map((col) => sql`${col} like ${term} escape '!'`)));
  }
  return and(...c);
}

/** Log aktivitas terbaru dulu (maks `limit`, paling banyak ACTIVITY_LIMIT). */
export function listActivity(db: DB, f: ActivityFilter, limit = ACTIVITY_LIMIT) {
  return db
    .select({
      id: a.id, at: a.at, userId: a.userId, userName: a.userName, role: a.role, action: a.action, label: a.label,
      summary: a.summary, details: a.details, success: a.success, ip: a.ip, device: a.device,
    })
    .from(a)
    .where(conditions(f))
    .orderBy(desc(a.at), desc(a.id))
    .limit(Math.min(limit, ACTIVITY_LIMIT));
}

/** Jumlah total, yang gagal/ditolak, dan jumlah pengguna berbeda untuk filter ini (tanpa batas baris). */
export async function activityStats(db: DB, f: ActivityFilter) {
  const [row] = await db
    .select({
      total: count(),
      failed: sql<number>`coalesce(sum(case when ${a.success} = 0 then 1 else 0 end), 0)`,
      people: sql<number>`count(distinct ${a.userId})`,
    })
    .from(a)
    .where(conditions(f));
  return { total: Number(row?.total ?? 0), failed: Number(row?.failed ?? 0), people: Number(row?.people ?? 0) };
}

/** Modul (awalan kode aksi) yang ada di rentang ini, untuk chip filter. */
export async function activityModules(db: DB, from: Date, to: Date) {
  const f = Math.floor(from.getTime() / 1000);
  const t = Math.floor(to.getTime() / 1000);
  const rows = await db.all<{ m: string }>(sql`
    select distinct substr(action, 1, instr(action, '.') - 1) as m from ops_activity_logs
    where at >= ${f} and at < ${t} and instr(action, '.') > 1 order by m`);
  return rows.map((r) => r.m);
}

/** 30 backup terakhir. */
export function backupHistory(db: DB) {
  return db.select().from(schema.backupRuns).orderBy(desc(schema.backupRuns.at)).limit(30);
}

/** Selisih hari (dibulatkan ke bawah) sejak waktu itu. */
export const daysSince = (at: Date) => Math.floor((Date.now() - at.getTime()) / 86_400_000);

/**
 * True bila backup terakhir sudah >= 7 hari atau belum pernah ada: dipakai lencana "!" pada menu Keamanan.
 * Beri `db` bila sudah punya koneksi; tanpa argumen membuka sendiri.
 */
export async function backupOverdue(db?: DB): Promise<boolean> {
  const d = db ?? (await getDb());
  const [last] = await d.select({ at: schema.backupRuns.at }).from(schema.backupRuns).orderBy(desc(schema.backupRuns.at)).limit(1);
  return !last || daysSince(last.at) >= BACKUP_OVERDUE_DAYS;
}
