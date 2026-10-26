import "server-only";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { schema } from "@/db";
import type { ProductLine } from "@/db/erp";
import type { DB } from "@/lib/erp/server";
import { lineOfItem } from "@/lib/ops/production-lines";

/** Barang jadi yang dilacak stoknya (aktif, atau masih punya pergerakan) beserta kelompoknya. */
export async function trackedFinishedItems(db: DB) {
  const rows = await db
    .select()
    .from(schema.items)
    .where(sql`${schema.items.trackStock} = 1 and ${schema.items.kind} = 'barang_jadi' and (${schema.items.active} = 1 or exists (select 1 from inv_stock_moves m where m.item_id = ${schema.items.id}))`)
    .orderBy(asc(schema.items.code));
  return rows.map((i) => ({ id: i.id, code: i.code, name: i.name, unit: i.unit, active: i.active, buyPrice: i.buyPrice, line: lineOfItem(i) as ProductLine }));
}
export type TrackedItem = Awaited<ReturnType<typeof trackedFinishedItems>>[number];

/** Netto konversi (cat genteng) per barang: masuk (+) dikurangi keluar (-). */
export async function conversionNet(db: DB) {
  const rows = await db.all<{ itemId: string; net: number }>(sql`select item_id as itemId, coalesce(sum(qty), 0) as net from inv_stock_moves where source = 'konversi' group by item_id`);
  return new Map(rows.map((r) => [r.itemId, Number(r.net)]));
}

/** Opname terakhir per barang (tanggal & jumlah fisik). */
export async function lastCountPerItem(db: DB) {
  const rows = await db.all<{ itemId: string; date: string; counted: number }>(sql`
    select l.item_id as itemId, c.date as date, l.counted_qty as counted
    from inv_count_lines l join inv_counts c on c.id = l.count_id
    where c.counted_at = (select max(c2.counted_at) from inv_counts c2 join inv_count_lines l2 on l2.count_id = c2.id where l2.item_id = l.item_id)`);
  return new Map(rows.map((r) => [r.itemId, { date: r.date, counted: Number(r.counted) }]));
}

/** Riwayat konversi (cat genteng) terbaru dulu, dengan nama barang & pembuat. */
export async function listConversions(db: DB, range?: { from: string; to: string }, limit = 300) {
  const from = alias(schema.items, "from_item");
  const to = alias(schema.items, "to_item");
  const c = schema.conversions;
  return db
    .select({ c, fromName: from.name, toName: to.name, unit: from.unit, by: schema.users.name })
    .from(c)
    .leftJoin(from, eq(from.id, c.fromItemId))
    .leftJoin(to, eq(to.id, c.toItemId))
    .leftJoin(schema.users, eq(schema.users.id, c.createdBy))
    .where(range ? and(gte(c.date, range.from), lte(c.date, range.to)) : undefined)
    .orderBy(desc(c.movedAt), desc(c.number))
    .limit(limit);
}
