import "server-only";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { schema } from "@/db";
import type { DB } from "@/lib/erp/server";

/** Kueri uji lumpur pasir (qc_sand_tests). Sumber, tag, dan plat diambil dari barang masuk bila uji terhubung; bila tidak, dari isian manual. */

const t = schema.sandTests;
const r = schema.goodsReceipts;
const tester = alias(schema.users, "sand_tester");
const completer = alias(schema.users, "sand_completer");

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
};

const base = (db: DB) =>
  db.select(columns).from(t).leftJoin(r, eq(t.receiptId, r.id)).leftJoin(tester, eq(t.createdBy, tester.id)).leftJoin(completer, eq(t.completedBy, completer.id));

/** Uji pada rentang waktu (terbaru dulu, maks 2000); `onlyUserId` = hanya uji yang dimulai akun itu. */
export async function listSandTests(db: DB, input: { from: Date; to: Date; onlyUserId?: number }): Promise<SandTestRow[]> {
  const range = and(gte(t.testedAt, input.from), lte(t.testedAt, input.to));
  return base(db)
    .where(input.onlyUserId ? and(range, eq(t.createdBy, input.onlyUserId)) : range)
    .orderBy(desc(t.testedAt))
    .limit(2000);
}

/** Draft milik akun ini (sedang mengendap), berapa pun umurnya; yang paling lama dulu. */
export async function listSandDrafts(db: DB, userId: number): Promise<SandTestRow[]> {
  return base(db)
    .where(and(eq(t.status, "draft"), eq(t.createdBy, userId)))
    .orderBy(t.testedAt);
}

/** Satu uji (untuk halaman cetak label). */
export async function getSandTest(db: DB, id: string): Promise<SandTestRow | undefined> {
  const rows = await base(db).where(eq(t.id, id)).limit(1);
  return rows[0];
}
