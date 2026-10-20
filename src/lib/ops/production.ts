import "server-only";
import { and, desc, eq, gte, like, lte, sql } from "drizzle-orm";
import { schema } from "@/db";
import { productionCategories as ALL_CATEGORIES, type ProductionCategory } from "@/db/erp";
import { requirePerm } from "@/lib/auth";
import type { DB } from "@/lib/erp/server";
import { permsOf } from "@/lib/roles";
import { productionCategories as categoriesByRole } from "@/lib/ops/categories";
import { PRECAST_PRODUCTS, batchPrefix } from "@/lib/ops/shared/goods";
import type { ProdRow } from "@/components/ops/production/summary";

/** Pembuat dengan izin lapangan boleh mengubah/menghapus catatannya sendiri selama 7 hari. */
export const FIELD_EDIT_WINDOW_MS = 7 * 24 * 3600_000;

/**
 * Akses halaman hasil produksi. Lihat: stok, keuangan, atau produksi_lapangan.
 * Input: stok (kantor/gudang, kedua kategori) atau produksi_lapangan (mandor precast, QC paving, operasional keduanya).
 */
export async function productionAccess() {
  const user = await requirePerm("stok", "keuangan", "produksi_lapangan");
  const p = permsOf(user.roles);
  const hasStok = p.has("stok");
  const categories: ProductionCategory[] = hasStok ? [...ALL_CATEGORIES] : p.has("produksi_lapangan") ? categoriesByRole(user.roles) : [];
  return {
    user,
    /** Pemegang stok (kantor/gudang/pemilik): boleh mengubah kapan saja. */
    hasStok,
    /** Hanya pemegang keuangan yang melihat nilai rupiah dan biaya produksi. */
    canFinance: p.has("keuangan"),
    categories,
    canEdit: categories.length > 0,
  };
}
export type ProductionAccess = Awaited<ReturnType<typeof productionAccess>>;

/** Boleh mengubah/menghapus catatan ini? Pemegang stok kapan saja; pembuat lapangan <= 7 hari; kategori harus yang diizinkan. */
export function canChangeProduction(acc: Pick<ProductionAccess, "user" | "hasStok" | "categories">, row: { category: ProductionCategory | null; createdBy: number | null; createdAt: Date | number }) {
  if (row.category && !acc.categories.includes(row.category)) return false;
  if (!acc.categories.length) return false;
  if (acc.hasStok) return true;
  const at = row.createdAt instanceof Date ? row.createdAt.getTime() : row.createdAt;
  return row.createdBy === acc.user.id && Date.now() - at <= FIELD_EDIT_WINDOW_MS;
}

/** Awalan kode batch dari nama barang hasil (mis. "U-Ditch 40x40" -> UD). Tidak dikenal: PC (precast) / PB (paving). */
export function batchPrefixFor(category: ProductionCategory, productName: string | null | undefined) {
  const name = (productName ?? "").toLowerCase();
  const known = PRECAST_PRODUCTS.filter((p) => p !== "Lainnya").find((p) => name.includes(p.toLowerCase()));
  return batchPrefix(category, known ?? "Lainnya");
}

/** Kode batch berikutnya: <prefix>-<yymmdd>-<nn>, nn = nomor terbesar yang sudah ada pada hari itu + 1. */
export async function nextBatchCode(db: DB, prefix: string, date: string) {
  const base = `${prefix}-${date.slice(2).replaceAll("-", "")}-`;
  const rows = await db.select({ code: schema.productions.batchCode }).from(schema.productions).where(like(schema.productions.batchCode, `${base}%`));
  const last = Math.max(0, ...rows.map((r) => Number(r.code?.slice(base.length)) || 0));
  return `${base}${String(last + 1).padStart(2, "0")}`;
}

/** Daftar hasil produksi pada rentang tanggal (maks 1500 dokumen) lengkap dengan barang hasilnya. */
export async function listProductions(db: DB, acc: Pick<ProductionAccess, "user" | "hasStok" | "categories">, range: { from: string; to: string; category?: ProductionCategory | null }): Promise<ProdRow[]> {
  const p = schema.productions;
  const docs = await db
    .select({ p, createdByName: schema.users.name })
    .from(p)
    .leftJoin(schema.users, eq(schema.users.id, p.createdBy))
    .where(and(gte(p.date, range.from), lte(p.date, range.to), range.category ? eq(p.category, range.category) : undefined))
    .orderBy(desc(p.date), desc(p.number))
    .limit(1500);
  if (!docs.length) return [];
  const pl = schema.productionLines;
  const lines = await db
    .select({ productionId: pl.productionId, itemId: pl.itemId, qty: pl.qty, name: schema.items.name, unit: schema.items.unit })
    .from(pl)
    .innerJoin(p, eq(p.id, pl.productionId))
    .leftJoin(schema.items, eq(schema.items.id, pl.itemId))
    .where(and(eq(pl.role, "hasil"), gte(p.date, range.from), lte(p.date, range.to)));
  const by = new Map<string, ProdRow["hasil"]>();
  for (const l of lines) by.set(l.productionId, [...(by.get(l.productionId) ?? []), { itemId: l.itemId, name: l.name ?? "(barang dihapus)", unit: l.unit ?? "", qty: l.qty }]);
  return docs.map(({ p: d, createdByName }) => ({
    id: d.id,
    number: d.number,
    date: d.date,
    category: d.category,
    batchCode: d.batchCode,
    leader: d.leader,
    target: d.target,
    cementBags: d.cementBags,
    boards: d.boards,
    rejects: d.rejects,
    issues: Array.isArray(d.issues) ? d.issues : [],
    note: d.note,
    photoKey: d.photoKey,
    createdBy: d.createdBy,
    createdByName: createdByName ?? null,
    createdAt: d.createdAt.getTime(),
    hasil: by.get(d.id) ?? [],
    canChange: canChangeProduction(acc, d),
  }));
}

/** Nilai rupiah barang jadi yang masuk per dokumen (hanya untuk pemegang keuangan). */
export async function productionValues(db: DB, range: { from: string; to: string }) {
  const rows = await db.all<{ id: string; value: number }>(sql`
    select m.source_id as id, coalesce(sum(m.value), 0) as value
    from inv_stock_moves m join inv_productions p on p.id = m.source_id
    where m.source = 'produksi' and m.qty > 0 and p.date >= ${range.from} and p.date <= ${range.to}
    group by m.source_id`);
  return new Map(rows.map((r) => [r.id, Number(r.value)]));
}

/** Nama ketua regu yang pernah dipakai (untuk saran isian). */
export async function recentLeaders(db: DB) {
  const rows = await db.all<{ leader: string }>(sql`select distinct leader from inv_productions where leader is not null and leader <> '' order by leader limit 40`);
  return rows.map((r) => r.leader);
}

/** Barang yang bisa dipilih di form: hasil = barang jadi, bahan = bahan baku; hanya yang dilacak stoknya (+ yang sudah dipakai dokumen ini). */
export async function productionItems(db: DB, keep: string[] = []) {
  const all = await db.select().from(schema.items).orderBy(schema.items.name);
  const k = new Set(keep);
  return all
    .filter((i) => (i.kind === "barang_jadi" || i.kind === "bahan_baku") && ((i.active && i.trackStock) || k.has(i.id)))
    .map(({ id, code, name, unit, kind }) => ({ id, code, name, unit, kind }));
}

export type MixSuggestion = {
  product: string;
  boards: number;
  squareMeters: number;
  rejects: number;
  /** Barang jadi yang cocok (nama mirip, tanpa membedakan huruf besar/kecil), atau null. */
  item: { id: string; name: string; unit: string } | null;
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Skor kemiripan nama: 3 sama persis, 2 salah satu memuat yang lain, 0 tidak cocok. */
function nameScore(a: string, b: string) {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return 0;
  if (x === y) return 3;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 3 && long.includes(short) ? 2 : 0;
}

/**
 * Agregasi catatan mix desain harian (lapisan badan) pada satu tanggal per produk: papan, m2, reject,
 * dicocokkan ke barang jadi. Dipakai tombol "Isi dari catatan mix desain" pada form paving.
 */
export async function mixSuggestions(db: DB, date: string): Promise<MixSuggestion[]> {
  const logs = await db.all<{ product: string; boards: number; sqm: number; rejects: number }>(sql`
    select product, coalesce(sum(boards), 0) as boards, coalesce(sum(square_meters), 0) as sqm, coalesce(sum(rejects), 0) as rejects
    from qc_mix_logs where work_date = ${date} and layer = 'badan' group by product order by product`);
  if (!logs.length) return [];
  const finished = await db.select({ id: schema.items.id, name: schema.items.name, unit: schema.items.unit }).from(schema.items).where(and(eq(schema.items.kind, "barang_jadi"), eq(schema.items.active, true)));
  return logs.map((l) => {
    let best: (typeof finished)[number] | null = null;
    let bestScore = 0;
    for (const it of finished) {
      const s = nameScore(l.product, it.name);
      if (s > bestScore || (s === bestScore && s > 0 && best && Math.abs(it.name.length - l.product.length) < Math.abs(best.name.length - l.product.length))) {
        best = it;
        bestScore = s;
      }
    }
    return { product: l.product, boards: Number(l.boards), squareMeters: Number(l.sqm), rejects: Number(l.rejects), item: best };
  });
}
