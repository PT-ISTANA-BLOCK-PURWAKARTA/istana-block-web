import "server-only";
import { and, desc, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { schema } from "@/db";
import type { SandEdit, SkipLevel } from "@/db/erp";
import { chunk, type DB } from "@/lib/erp/server";

/** Kueri uji lumpur pasir (qc_sand_tests). Sumber, tag, dan plat diambil dari barang masuk bila uji terhubung; bila tidak, dari isian manual. */

const t = schema.sandTests;
const r = schema.goodsReceipts;
const tester = alias(schema.users, "sand_tester");
const completer = alias(schema.users, "sand_completer");
const secretary = alias(schema.users, "sand_secretary");
const manager = alias(schema.users, "sand_manager");
const leader = alias(schema.users, "sand_leader");

const columns = {
  id: t.id,
  receiptId: t.receiptId,
  status: t.status,
  testedAt: t.testedAt,
  completedAt: t.completedAt,
  supplier: sql<string | null>`coalesce(${r.supplier}, ${t.supplier})`,
  quarry: sql<string | null>`coalesce(${r.quarry}, ${t.quarry})`,
  sandType: t.sandType,
  tag: r.tag,
  vehiclePlate: r.vehiclePlate,
  quantity: r.quantity,
  unit: r.unit,
  readingUnit: t.readingUnit,
  sandHeight: t.sandHeight,
  siltHeight: t.siltHeight,
  siltPercent: t.siltPercent,
  maxSiltPercent: t.maxSiltPercent,
  decision: t.decision,
  startPhotoKey: t.startPhotoKey,
  photoKey: t.photoKey,
  notes: t.notes,
  createdBy: t.createdBy,
  createdByName: tester.name,
  completedByName: completer.name,
  secretaryAckName: secretary.name,
  secretaryAckAt: t.secretaryAckAt,
  secretarySignatureKey: secretary.signatureKey,
  managerAckName: manager.name,
  managerAckAt: t.managerAckAt,
  managerSignatureKey: manager.signatureKey,
  leaderAckName: leader.name,
  leaderAckAt: t.leaderAckAt,
  leaderSignatureKey: leader.signatureKey,
  editHistory: t.editHistory,
};

export type SandTestRow = {
  id: string;
  receiptId: string | null;
  status: (typeof t.$inferSelect)["status"];
  testedAt: Date;
  completedAt: Date | null;
  supplier: string | null;
  quarry: string | null;
  sandType: string;
  tag: string | null;
  vehiclePlate: string | null;
  quantity: number | null;
  unit: string | null;
  readingUnit: (typeof t.$inferSelect)["readingUnit"];
  /** Tinggi endapan pasir & lumpur, dalam satuan `readingUnit`. */
  sandHeight: number | null;
  siltHeight: number | null;
  siltPercent: number | null;
  maxSiltPercent: number;
  decision: (typeof t.$inferSelect)["decision"];
  startPhotoKey: string | null;
  photoKey: string | null;
  notes: string;
  createdBy: number | null;
  createdByName: string | null;
  completedByName: string | null;
  /** TTD bertingkat Sekretaris -> Manager in charge -> Pimpinan (nama, waktu, gambar TTD dari profil). */
  secretaryAckName: string | null;
  secretaryAckAt: Date | null;
  secretarySignatureKey: string | null;
  managerAckName: string | null;
  managerAckAt: Date | null;
  managerSignatureKey: string | null;
  leaderAckName: string | null;
  leaderAckAt: Date | null;
  leaderSignatureKey: string | null;
  /** Riwayat "Ubah hasil" (nilai lama + alasan); `byName` = nama pengubah. */
  editHistory: (SandEdit & { byName: string | null })[];
};

type RawSand = Omit<SandTestRow, "editHistory"> & { editHistory: SandEdit[] };

const baseRaw = (db: DB) =>
  db
    .select(columns)
    .from(t)
    .leftJoin(r, eq(t.receiptId, r.id))
    .leftJoin(tester, eq(t.createdBy, tester.id))
    .leftJoin(completer, eq(t.completedBy, completer.id))
    .leftJoin(secretary, eq(t.secretaryAckBy, secretary.id))
    .leftJoin(manager, eq(t.managerAckBy, manager.id))
    .leftJoin(leader, eq(t.leaderAckBy, leader.id));

/** Tambahkan nama pengubah ke riwayat "Ubah hasil" (satu kueri untuk semua id pengubah). */
async function withEditors(db: DB, rows: RawSand[]): Promise<SandTestRow[]> {
  const ids = [...new Set(rows.flatMap((row) => (row.editHistory ?? []).flatMap((e) => (e.by ? [e.by] : []))))];
  const names = new Map<number, string>();
  for (const part of chunk(ids, 90)) for (const u of await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(inArray(schema.users.id, part))) names.set(u.id, u.name);
  return rows.map((row) => ({ ...row, editHistory: (row.editHistory ?? []).map((e) => ({ ...e, byName: e.by ? names.get(e.by) ?? null : null })) }));
}

/** Uji pada rentang waktu (terbaru dulu, maks 2000); `onlyUserId` = hanya uji yang dimulai akun itu. */
export async function listSandTests(db: DB, input: { from: Date; to: Date; onlyUserId?: number }): Promise<SandTestRow[]> {
  const range = and(gte(t.testedAt, input.from), lte(t.testedAt, input.to));
  const rows = await baseRaw(db)
    .where(input.onlyUserId ? and(range, eq(t.createdBy, input.onlyUserId)) : range)
    .orderBy(desc(t.testedAt))
    .limit(2000);
  return withEditors(db, rows as RawSand[]);
}

/** Draft milik akun ini (sedang mengendap), berapa pun umurnya; yang paling lama dulu. */
export async function listSandDrafts(db: DB, userId: number): Promise<SandTestRow[]> {
  const rows = await baseRaw(db)
    .where(and(eq(t.status, "draft"), eq(t.createdBy, userId)))
    .orderBy(t.testedAt);
  return withEditors(db, rows as RawSand[]);
}

/** Satu uji (untuk halaman cetak label). */
export async function getSandTest(db: DB, id: string): Promise<SandTestRow | undefined> {
  const rows = await baseRaw(db).where(eq(t.id, id)).limit(1);
  return (await withEditors(db, rows as RawSand[]))[0];
}

export type SkippedReceipt = {
  id: string;
  receivedAt: Date;
  itemName: string;
  tag: string | null;
  supplier: string | null;
  quarry: string | null;
  vehiclePlate: string | null;
  quantity: number | null;
  unit: string;
  skippedAt: Date;
  level: SkipLevel | null;
  reason: string | null;
  skippedByName: string | null;
};

/** Bahan baku yang uji lumpurnya dilewati (skip) pada rentang waktu skip. */
export async function listSkippedReceipts(db: DB, input: { from: Date; to: Date }): Promise<SkippedReceipt[]> {
  const skipper = alias(schema.users, "sand_skipper");
  return db
    .select({
      id: r.id, receivedAt: r.receivedAt, itemName: r.itemName, tag: r.tag, supplier: r.supplier, quarry: r.quarry, vehiclePlate: r.vehiclePlate, quantity: r.quantity, unit: r.unit,
      skippedAt: r.testSkippedAt, level: r.testSkipLevel, reason: r.testSkipReason, skippedByName: skipper.name,
    })
    .from(r)
    .leftJoin(skipper, eq(r.testSkippedBy, skipper.id))
    .where(and(isNotNull(r.testSkippedAt), gte(r.testSkippedAt, input.from), lte(r.testSkippedAt, input.to)))
    .orderBy(desc(r.testSkippedAt))
    .limit(500) as unknown as Promise<SkippedReceipt[]>;
}
