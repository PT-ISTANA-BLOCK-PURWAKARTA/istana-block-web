import "server-only";
import { and, desc, eq, getTableColumns, gte, inArray, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { schema } from "@/db";
import type { ReceiptCategory, SandDecision, SandTestStatus } from "@/db/erp";
import { chunk, type DB } from "@/lib/erp/server";
import { suggestTier, type SandTier } from "./shared/sand";

/**
 * Kueri barang masuk (ops_goods_receipts). Dipakai halaman /barang-masuk, /uji-pasir, /bahan-baku
 * dan paket ISO (F-IB-08 vendor, F-IB-09 penerimaan) — fungsi list di sini sengaja bertipe jelas.
 */

/** Ringkasan uji lumpur terbaru milik satu barang masuk (yang selesai didahulukan). */
export type ReceiptTest = {
  id: string;
  status: SandTestStatus;
  testedAt: Date;
  siltPercent: number | null;
  maxSiltPercent: number;
  decision: SandDecision | null;
  photoKey: string | null;
  startPhotoKey: string | null;
};

type ReceiptBase = typeof schema.goodsReceipts.$inferSelect;

export type ReceiptRow = Omit<ReceiptBase, "tier"> & {
  createdByName: string | null;
  qualityByName: string | null;
  deliveryByName: string | null;
  priceByName: string | null;
  /** Nama petugas yang melewati (skip) uji lumpur. */
  testSkippedByName: string | null;
  /** Uji lumpur terbaru (selesai didahulukan), null bila belum ada. */
  test: ReceiptTest | null;
  /** Kadar lumpur (%) dari uji yang SELESAI; null bila belum diuji. */
  siltPercent: number | null;
  /** Tier efektif = penilaian QC, atau saran otomatis dari hasil uji (`row.tier ?? suggestTier(...)`). */
  tier: SandTier | null;
  /** true bila tier berasal dari penilaian QC (bukan saran sistem). */
  tierConfirmed: boolean;
};

const creator = alias(schema.users, "receipt_creator");
const qualityUser = alias(schema.users, "receipt_quality");
const deliveryUser = alias(schema.users, "receipt_delivery");
const priceUser = alias(schema.users, "receipt_price");
const skipUser = alias(schema.users, "receipt_skip");

/**
 * Daftar barang masuk pada rentang waktu (maks 2000, terbaru dulu), lengkap dengan nama pencatat/penilai
 * dan uji lumpur terakhir. Pencarian id uji dipecah 90 per kueri (batas parameter D1).
 */
export async function listReceipts(
  db: DB,
  input: { from: Date; to: Date; category?: ReceiptCategory; onlyUserId?: number },
): Promise<ReceiptRow[]> {
  const r = schema.goodsReceipts;
  const t = schema.sandTests;
  const filters = [gte(r.receivedAt, input.from), lte(r.receivedAt, input.to)];
  if (input.category) filters.push(eq(r.category, input.category));
  if (input.onlyUserId) filters.push(eq(r.createdBy, input.onlyUserId));
  const rows = await db
    .select({
      ...getTableColumns(r),
      createdByName: creator.name,
      qualityByName: qualityUser.name,
      deliveryByName: deliveryUser.name,
      priceByName: priceUser.name,
      testSkippedByName: skipUser.name,
    })
    .from(r)
    .leftJoin(creator, eq(r.createdBy, creator.id))
    .leftJoin(qualityUser, eq(r.qualityBy, qualityUser.id))
    .leftJoin(deliveryUser, eq(r.deliveryBy, deliveryUser.id))
    .leftJoin(priceUser, eq(r.priceBy, priceUser.id))
    .leftJoin(skipUser, eq(r.testSkippedBy, skipUser.id))
    .where(and(...filters))
    .orderBy(desc(r.receivedAt))
    .limit(2000);

  const ids = rows.map((row) => row.id);
  const tests = ids.length
    ? (
        await Promise.all(
          chunk(ids, 90).map((part) =>
            db
              .select({
                id: t.id,
                receiptId: t.receiptId,
                status: t.status,
                testedAt: t.testedAt,
                siltPercent: t.siltPercent,
                maxSiltPercent: t.maxSiltPercent,
                decision: t.decision,
                photoKey: t.photoKey,
                startPhotoKey: t.startPhotoKey,
              })
              .from(t)
              .where(inArray(t.receiptId, part))
              .orderBy(desc(t.testedAt)),
          ),
        )
      ).flat()
    : [];
  const byReceipt = new Map<string, ReceiptTest[]>();
  for (const test of tests) {
    if (!test.receiptId) continue;
    const { receiptId, ...rest } = test;
    byReceipt.set(receiptId, [...(byReceipt.get(receiptId) ?? []), rest]);
  }

  return rows.map((row) => {
    const own = byReceipt.get(row.id) ?? [];
    const test = own.find((x) => x.status === "selesai") ?? own[0] ?? null;
    const silt = test?.status === "selesai" ? test.siltPercent : null;
    const tier = (row.tier ?? (silt === null ? null : suggestTier(silt, row.hasBrangkal))) as SandTier | null;
    return { ...row, tier, test, siltPercent: silt, tierConfirmed: row.tier !== null };
  });
}

export type ReceiptSources = { suppliers: string[]; quarries: string[]; expeditions: string[]; tags: string[]; otherItems: string[] };

/** Nama yang pernah dipakai — saran isian (datalist) agar penulisan seragam di rekap & tier list. Satu kueri. */
export async function listReceiptSources(db: DB): Promise<ReceiptSources> {
  const rows = await db.all<{ k: string; v: string }>(sql`
    select 'supplier' as k, supplier as v from ops_goods_receipts where supplier is not null and trim(supplier) <> '' group by supplier
    union all select 'quarry', quarry from ops_goods_receipts where quarry is not null and trim(quarry) <> '' group by quarry
    union all select 'expedition', expedition_name from ops_goods_receipts where expedition_name is not null and trim(expedition_name) <> '' group by expedition_name
    union all select 'tag', tag from ops_goods_receipts where tag is not null and trim(tag) <> '' group by tag
    union all select 'item', item_name from ops_goods_receipts where category = 'lainnya' group by item_name`);
  const pick = (kind: string) =>
    [...new Set(rows.filter((row) => row.k === kind).map((row) => row.v.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "id"));
  return { suppliers: pick("supplier"), quarries: pick("quarry"), expeditions: pick("expedition"), tags: pick("tag"), otherItems: pick("item") };
}

export type ReceiptForTesting = {
  id: string;
  receivedAt: Date;
  itemName: string;
  tag: string | null;
  supplier: string | null;
  quarry: string | null;
  vehiclePlate: string | null;
  quantity: number | null;
  unit: string;
  /** Status uji yang sudah ada untuk barang ini: selesai, draft, dilewati (skip), atau belum pernah. */
  testStatus: "selesai" | "draft" | "dilewati" | null;
};

/** Bahan baku 3 hari terakhir untuk dipilih saat mulai uji lumpur. */
export async function listReceiptsForTesting(db: DB): Promise<ReceiptForTesting[]> {
  const r = schema.goodsReceipts;
  const t = schema.sandTests;
  const rows = await db
    .select({ id: r.id, receivedAt: r.receivedAt, itemName: r.itemName, tag: r.tag, supplier: r.supplier, quarry: r.quarry, vehiclePlate: r.vehiclePlate, quantity: r.quantity, unit: r.unit, skippedAt: r.testSkippedAt })
    .from(r)
    .where(and(eq(r.category, "bahan_baku"), gte(r.receivedAt, new Date(Date.now() - 3 * 24 * 3600_000))))
    .orderBy(desc(r.receivedAt))
    .limit(100);
  const ids = rows.map((row) => row.id);
  const tested = ids.length
    ? (await Promise.all(chunk(ids, 90).map((part) => db.select({ receiptId: t.receiptId, status: t.status }).from(t).where(inArray(t.receiptId, part))))).flat()
    : [];
  return rows.map((row) => {
    const own = tested.filter((x) => x.receiptId === row.id);
    const { skippedAt, ...rest } = row;
    const testStatus = own.some((x) => x.status === "selesai") ? ("selesai" as const) : own.length ? ("draft" as const) : skippedAt ? ("dilewati" as const) : null;
    return { ...rest, testStatus };
  });
}
