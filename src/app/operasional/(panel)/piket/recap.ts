import "server-only";
import { and, desc, eq, gte, isNull, lt, ne, notLike, sql } from "drizzle-orm";
import { schema } from "@/db";
import type { DB } from "@/lib/erp/server";

const s = schema.dutyShifts;
const WIB = 7 * 3600;

/** Rentang tanggal WIB (inklusif) → detik unix [from, to). */
export function dayWindow(from: string, to: string) {
  const f = Date.parse(`${from}T00:00:00Z`) / 1000 - WIB;
  const t = Date.parse(`${to}T00:00:00Z`) / 1000 + 86400 - WIB;
  return { from: f, to: t };
}

export type ShiftRow = { id: string; userId: number; userName: string; startedAt: Date; endedAt: Date | null; handoverNote: string };

/** Riwayat shift (terbaru dulu) pada rentang; userId untuk membatasi ke satu akun. */
export function listShifts(db: DB, w: { from: number; to: number }, limit = 500): Promise<ShiftRow[]> {
  return db
    .select({ id: s.id, userId: s.userId, userName: s.userName, startedAt: s.startedAt, endedAt: s.endedAt, handoverNote: s.handoverNote })
    .from(s)
    .where(and(gte(s.startedAt, new Date(w.from * 1000)), lt(s.startedAt, new Date(w.to * 1000))))
    .orderBy(desc(s.startedAt))
    .limit(limit);
}

export function myShifts(db: DB, userId: number, limit = 10): Promise<ShiftRow[]> {
  return db
    .select({ id: s.id, userId: s.userId, userName: s.userName, startedAt: s.startedAt, endedAt: s.endedAt, handoverNote: s.handoverNote })
    .from(s)
    .where(eq(s.userId, userId))
    .orderBy(desc(s.startedAt))
    .limit(limit);
}

/** Semua yang sedang piket sekarang. */
export function openShifts(db: DB): Promise<ShiftRow[]> {
  return db
    .select({ id: s.id, userId: s.userId, userName: s.userName, startedAt: s.startedAt, endedAt: s.endedAt, handoverNote: s.handoverNote })
    .from(s)
    .where(isNull(s.endedAt))
    .orderBy(desc(s.startedAt));
}

/** Catatan serah terima terakhir yang ditulis orang (bukan penutupan otomatis). */
export async function lastHandover(db: DB) {
  const rows = await db
    .select({ userName: s.userName, endedAt: s.endedAt, handoverNote: s.handoverNote })
    .from(s)
    .where(and(ne(s.handoverNote, ""), notLike(s.handoverNote, "Ditutup otomatis%")))
    .orderBy(desc(s.endedAt))
    .limit(1);
  return rows[0] ?? null;
}

export type PersonRecap = { userId: number; shifts: number; secs: number; receipts: number; tests: number; loads: number; production: number };

/**
 * Rekap per akun pada rentang: jumlah shift & jam piket, lalu pekerjaan yang dicatat akun itu — barang masuk,
 * uji pasir (diselesaikan/dimulai olehnya), "Sudah dimuat" (riwayat surat jalan ke status dimuat), hasil produksi.
 */
export async function personRecap(db: DB, range: { from: string; to: string }, nowSec: number): Promise<Map<number, PersonRecap>> {
  const w = dayWindow(range.from, range.to);
  const [shiftRows, counts] = await Promise.all([
    db.all<{ uid: number; shifts: number; secs: number }>(sql`
      select user_id as uid, count(*) as shifts, sum(min(coalesce(ended_at, ${nowSec}), started_at + 86400) - started_at) as secs
      from ops_duty_shifts where started_at >= ${w.from} and started_at < ${w.to} group by user_id`),
    db.all<{ k: string; uid: number; n: number }>(sql`
      select 'receipts' as k, created_by as uid, count(*) as n from ops_goods_receipts
        where created_by is not null and received_at >= ${w.from} and received_at < ${w.to} group by created_by
      union all
      select 'tests', coalesce(completed_by, created_by), count(*) from qc_sand_tests
        where coalesce(completed_by, created_by) is not null and tested_at >= ${w.from} and tested_at < ${w.to} group by coalesce(completed_by, created_by)
      union all
      select 'loads', changed_by, count(*) from ops_delivery_history
        where to_status = 'dimuat' and changed_by is not null and created_at >= ${w.from} and created_at < ${w.to} group by changed_by
      union all
      select 'production', created_by, count(*) from inv_productions
        where created_by is not null and date >= ${range.from} and date <= ${range.to} group by created_by`),
  ]);
  const map = new Map<number, PersonRecap>();
  const get = (uid: number) => {
    let r = map.get(uid);
    if (!r) map.set(uid, (r = { userId: uid, shifts: 0, secs: 0, receipts: 0, tests: 0, loads: 0, production: 0 }));
    return r;
  };
  for (const r of shiftRows) {
    const x = get(Number(r.uid));
    x.shifts = Number(r.shifts);
    x.secs = Number(r.secs ?? 0);
  }
  for (const r of counts) {
    const x = get(Number(r.uid));
    const n = Number(r.n);
    if (r.k === "receipts") x.receipts = n;
    else if (r.k === "tests") x.tests = n;
    else if (r.k === "loads") x.loads = n;
    else if (r.k === "production") x.production = n;
  }
  return map;
}
