import "server-only";
import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { CurrentUser } from "@/lib/auth";
import { UserError, type DB } from "@/lib/erp/server";
import { needsShift } from "@/lib/roles";

/** Shift yang tidak ditutup lebih dari ini dianggap basi dan ditutup otomatis. */
export const STALE_SHIFT_SECONDS = 24 * 3600;

const now = () => Math.floor(Date.now() / 1000);

/** Tutup shift piket yang lupa diakhiri (> 24 jam): selesai = mulai + 24 jam, dengan catatan otomatis. */
export async function closeStaleShifts(db: DB, userId?: number) {
  const s = schema.dutyShifts;
  await db
    .update(s)
    .set({ endedAt: sql`${s.startedAt} + ${STALE_SHIFT_SECONDS}`, handoverNote: "Ditutup otomatis: lupa selesai piket (lebih dari 24 jam)." })
    .where(and(isNull(s.endedAt), lt(s.startedAt, new Date((now() - STALE_SHIFT_SECONDS) * 1000)), userId ? eq(s.userId, userId) : undefined));
}

/** Shift yang sedang berjalan untuk akun ini (endedAt kosong), atau undefined. */
export async function currentShift(db: DB, userId: number) {
  const s = schema.dutyShifts;
  return db.query.dutyShifts.findFirst({ where: and(eq(s.userId, userId), isNull(s.endedAt)), orderBy: desc(s.startedAt) });
}

/**
 * Akun berperan satpam/mandor (dan bukan pemilik/operasional) wajib sedang piket sebelum mencatat
 * (barang masuk, uji pasir, sudah dimuat, produksi lapangan, form ISO). Lempar UserError bila belum.
 * Mengembalikan shift yang berjalan (undefined bila akun tidak diwajibkan piket).
 */
export async function requireShift(me: Pick<CurrentUser, "id" | "roles">) {
  if (!needsShift(me.roles)) return undefined;
  const db = await getDb();
  await closeStaleShifts(db, me.id);
  const shift = await currentShift(db, me.id);
  if (!shift) throw new UserError("Absen piket dulu sebelum mencatat.");
  return shift;
}
