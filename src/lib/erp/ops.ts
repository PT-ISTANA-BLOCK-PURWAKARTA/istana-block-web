import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { schema } from "@/db";
import type { Delivery, OrderStatus } from "@/db/erp";
import { requirePerm } from "@/lib/auth";
import { permsOf } from "@/lib/roles";
import { deriveOrderStatus, orderProgress } from "./orders";
import { chunk, deleteJournalOps, insertMany, inventoryAccount, isStockItem, journalOps, stockLevels, unitCost, type Accounts, type DB, type JLine } from "./server";

/**
 * Akses modul operasional per izin: operasional (pesanan & pengiriman), gudang (stok & muat),
 * keuangan (hanya melihat + nilai rupiah). Pemilik mendapat semuanya.
 */
export async function opsAccess() {
  const user = await requirePerm("lihat_ops");
  const p = permsOf(user.roles);
  return {
    user,
    perms: p,
    /** Membuat/mengubah pesanan & pelanggan. */
    canOrders: p.has("pesanan"),
    /** Menjadwalkan surat jalan, armada, sopir, terkirim/batal. */
    canShip: p.has("pengiriman"),
    /** Menandai truk berangkat (barang keluar gudang). */
    canLoad: p.has("muat"),
    /** Hasil produksi & penyesuaian stok. */
    canStock: p.has("stok"),
    /** Melihat nilai rupiah (harga pokok, faktur, jurnal). */
    canFinance: p.has("keuangan"),
  };
}

export const POSTED: Delivery["status"][] = ["berangkat", "terkirim"];

/** Hapus stok keluar & jurnal HPP sebuah surat jalan. */
export function unpostDeliveryOps(db: DB, deliveryId: string) {
  return [
    db.delete(schema.stockMoves).where(and(eq(schema.stockMoves.source, "pengiriman"), eq(schema.stockMoves.sourceId, deliveryId))),
    ...deleteJournalOps(db, "pengiriman", deliveryId),
  ];
}

/**
 * Stok keluar + jurnal HPP untuk surat jalan yang berangkat/terkirim:
 * Dr Harga pokok penjualan / Cr Persediaan, dinilai dengan harga pokok rata-rata saat itu.
 */
export async function postDeliveryOps(db: DB, acc: Accounts, d: Pick<Delivery, "id" | "number" | "date" | "orderId">, createdBy: number | null) {
  const lines = await db
    .select({ qty: schema.deliveryLines.qty, item: schema.items })
    .from(schema.deliveryLines)
    .innerJoin(schema.items, eq(schema.items.id, schema.deliveryLines.itemId))
    .where(eq(schema.deliveryLines.deliveryId, d.id));
  const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, d.orderId) });
  const levels = await stockLevels(db, undefined, d.id);
  const moves: (typeof schema.stockMoves.$inferInsert)[] = [];
  const jl: JLine[] = [];
  for (const { qty, item } of lines) {
    if (!isStockItem(item) || qty <= 0) continue;
    const value = Math.round(qty * unitCost(levels.get(item.id), item));
    moves.push({ itemId: item.id, date: d.date, qty: -qty, value: -value, source: "pengiriman", sourceId: d.id, note: d.number });
    if (value) {
      jl.push({ accountId: acc.sys("hpp"), debit: value, memo: item.name, contactId: order?.contactId ?? null });
      jl.push({ accountId: inventoryAccount(acc, item), credit: value, memo: item.name });
    }
  }
  return [
    ...insertMany(db, schema.stockMoves, moves),
    ...journalOps(db, { number: d.number, date: d.date, memo: `HPP surat jalan ${d.number}${order ? ` · ${order.number}` : ""}`, source: "pengiriman", sourceId: d.id, createdBy, lines: jl }),
  ];
}

/** Hitung ulang status pesanan dari kemajuan pengirimannya. */
export async function refreshOrderStatus(db: DB, orderId: string) {
  const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, orderId) });
  if (!order) return;
  const next = deriveOrderStatus(order.status, await orderProgress(db, orderId));
  if (next !== order.status) await db.update(schema.orders).set({ status: next, updatedAt: new Date() }).where(eq(schema.orders.id, orderId));
}

/** Status yang dihitung ulang setelah pesanan dibuka kembali. */
export async function reopenStatus(db: DB, orderId: string): Promise<OrderStatus> {
  return deriveOrderStatus("dikonfirmasi", await orderProgress(db, orderId));
}

/** Barang yang dilacak stoknya, untuk validasi produksi/penyesuaian. */
export async function stockItemsById(db: DB, ids: string[]) {
  if (!ids.length) return new Map<string, typeof schema.items.$inferSelect>();
  const rows = (await Promise.all(chunk(Array.from(new Set(ids))).map((part) => db.select().from(schema.items).where(inArray(schema.items.id, part))))).flat();
  return new Map(rows.map((r) => [r.id, r]));
}

/** Ringkasan isi surat jalan (nama barang, qty, satuan) untuk daftar. */
export async function deliveryItems(db: DB, deliveryIds: string[]) {
  const out = new Map<string, { name: string; qty: number; unit: string }[]>();
  if (!deliveryIds.length) return out;
  const parts = await Promise.all(
    chunk(deliveryIds).map((part) =>
      db
        .select({ deliveryId: schema.deliveryLines.deliveryId, qty: schema.deliveryLines.qty, unit: schema.orderLines.unit, itemUnit: schema.items.unit, name: schema.items.name })
        .from(schema.deliveryLines)
        .innerJoin(schema.orderLines, eq(schema.orderLines.id, schema.deliveryLines.orderLineId))
        .leftJoin(schema.items, eq(schema.items.id, schema.deliveryLines.itemId))
        .where(inArray(schema.deliveryLines.deliveryId, part)),
    ),
  );
  const rows = parts.flat();
  for (const r of rows) {
    const list = out.get(r.deliveryId) ?? [];
    list.push({ name: r.name ?? "", qty: r.qty, unit: r.unit || r.itemUnit || "" });
    out.set(r.deliveryId, list);
  }
  return out;
}
