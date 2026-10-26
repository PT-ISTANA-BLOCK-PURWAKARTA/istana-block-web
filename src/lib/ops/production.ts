import "server-only";
import { and, desc, eq, gte, inArray, like, lte, sql } from "drizzle-orm";
import { schema } from "@/db";
import { productionCategories as ALL_CATEGORIES, type ProductionCategory } from "@/db/erp";
import { requirePerm } from "@/lib/auth";
import type { DB } from "@/lib/erp/server";
import { permsOf } from "@/lib/roles";
import { itemProductionCategory, productionCategories as categoriesByRole } from "@/lib/ops/categories";
import { PRECAST_PRODUCTS, batchPrefix } from "@/lib/ops/shared/goods";
import { lineOfItem } from "@/lib/ops/production-lines";
import type { ProdRow } from "@/components/ops/production/summary";

/** Pembuat dengan izin lapangan boleh mengubah/menghapus catatannya sendiri selama 7 hari. */
export const FIELD_EDIT_WINDOW_MS = 7 * 24 * 3600_000;

/**
 * Akses halaman hasil produksi. Lihat: stok, keuangan, atau produksi_lapangan.
 * Input: stok (kantor/gudang, kedua kategori) atau produksi_lapangan (mandor precast, QC paving, operasional keduanya).
 */
export async function productionAccess() {
  // Manager in charge & Pimpinan ikut melihat (menandatangani ketidaksesuaian), tanpa hak input.
  const user = await requirePerm("stok", "keuangan", "produksi_lapangan", "setujui_qc", "ttd_pimpinan");
  const p = permsOf(user.roles);
  const hasStok = p.has("stok");
  const categories: ProductionCategory[] = hasStok ? [...ALL_CATEGORIES] : p.has("produksi_lapangan") ? categoriesByRole(user.roles) : [];
  return {
    user,
    /** Pemegang stok (kantor/gudang/pemilik): boleh mengubah kapan saja. */
    hasStok,
    /** Hanya pemegang keuangan yang melihat nilai rupiah dan biaya produksi. */
    canFinance: p.has("keuangan"),
    /** TTD ketidaksesuaian: Manager in charge lalu Pimpinan. */
    canSignManager: p.has("setujui_qc"),
    canSignLeader: p.has("ttd_pimpinan"),
    categories,
    canEdit: categories.length > 0,
  };
}
export type ProductionAccess = Awaited<ReturnType<typeof productionAccess>>;

/** Boleh mengubah/menghapus catatan ini? Pemegang stok kapan saja; pembuat lapangan <= 7 hari; kategori harus yang diizinkan. */
export function canChangeProduction(acc: Pick<ProductionAccess, "user" | "hasStok" | "categories">, row: { category: ProductionCategory | null; createdBy: number | null; createdAt: Date | number; mixLogId?: string | null }) {
  // Baris paving otomatis dari Mix Desain harian: diubah lewat catatan mix desainnya.
  if (row.mixLogId) return false;
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
  // Nama penanda tangan ketidaksesuaian.
  const signerIds = [...new Set(docs.flatMap(({ p: d }) => [d.rejectManagerBy, d.rejectLeaderBy]).filter((x): x is number => x != null))];
  const signers = signerIds.length ? await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(inArray(schema.users.id, signerIds)) : [];
  const signerName = new Map(signers.map((s) => [s.id, s.name]));
  const sign = (by: number | null, at: Date | null) => (by != null && at ? { name: signerName.get(by) ?? null, at: at.getTime() } : null);
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
    gradeB: d.gradeB,
    method: d.method,
    cementKg: d.cementKg,
    batchId: d.batchId,
    mixLogId: d.mixLogId,
    rejectManager: sign(d.rejectManagerBy, d.rejectManagerAt),
    rejectLeader: sign(d.rejectLeaderBy, d.rejectLeaderAt),
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

/** Adukan cor bersama pada rentang tanggal (id, tanggal, total sak semen). */
export async function listBatches(db: DB, range: { from: string; to: string }) {
  return db.select({ id: schema.productionBatches.id, date: schema.productionBatches.date, cementBags: schema.productionBatches.cementBags }).from(schema.productionBatches).where(and(gte(schema.productionBatches.date, range.from), lte(schema.productionBatches.date, range.to)));
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
  const all = await db.select({ i: schema.items, web: schema.products.category }).from(schema.items).leftJoin(schema.products, eq(schema.products.id, schema.items.productId)).orderBy(schema.items.name);
  const k = new Set(keep);
  return all
    .filter(({ i }) => (i.kind === "barang_jadi" || i.kind === "bahan_baku") && ((i.active && i.trackStock) || k.has(i.id)))
    .map(({ i, web }) => ({ id: i.id, code: i.code, name: i.name, unit: i.unit, kind: i.kind, category: itemProductionCategory(i, web), line: i.kind === "barang_jadi" ? lineOfItem(i) : null, method: i.method ?? null }));
}

/** Spesifikasi aktif (untuk pilihan ukuran & perkiraan berat di form produksi). */
export async function activeSpecs(db: DB) {
  const rows = await db.select().from(schema.productSpecs).where(eq(schema.productSpecs.active, true)).orderBy(schema.productSpecs.line, schema.productSpecs.name);
  return rows.map((s) => ({ id: s.id, line: s.line, name: s.name, variant: s.variant, weightKg: s.weightKg, specs: s.specs ?? {}, itemId: s.itemId }));
}
export type SpecOption = Awaited<ReturnType<typeof activeSpecs>>[number];

/** Semua spesifikasi (aktif & nonaktif) lengkap dengan nama barang tertaut, untuk halaman Spesifikasi produk & cetaknya. */
export async function listSpecs(db: DB) {
  return db
    .select({ s: schema.productSpecs, itemName: schema.items.name })
    .from(schema.productSpecs)
    .leftJoin(schema.items, eq(schema.items.id, schema.productSpecs.itemId))
    .orderBy(schema.productSpecs.line, schema.productSpecs.name);
}

/** Kategori produksi tiap barang (id -> kategori), untuk memeriksa hasil yang dikirim ke server. */
export async function itemCategories(db: DB, items: { id: string; code: string; name: string; productId: number | null }[]) {
  const pids = Array.from(new Set(items.map((i) => i.productId).filter((x): x is number => x != null)));
  const web = pids.length ? await db.select({ id: schema.products.id, category: schema.products.category }).from(schema.products).where(inArray(schema.products.id, pids)) : [];
  const byId = new Map(web.map((w) => [w.id, w.category]));
  return new Map(items.map((i) => [i.id, itemProductionCategory(i, i.productId == null ? null : byId.get(i.productId))]));
}

export type MixSuggestion = {
  product: string;
  boards: number;
  squareMeters: number;
  rejects: number;
  gradeB: number;
  /** Belahan Hexagon setengah (buah). */
  halfPieces: number;
  /** Barang jadi yang cocok (nama mirip, tanpa membedakan huruf besar/kecil), atau null. */
  item: { id: string; name: string; unit: string } | null;
  /** Barang Hexagon setengah (trapesium) yang cocok untuk belahan, atau null. */
  halfItem: { id: string; name: string; unit: string } | null;
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Skor kemiripan nama: 3 sama persis, 2 salah satu memuat yang lain, 0 tidak cocok. */
export function nameScore(a: string, b: string) {
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
  // Catatan yang sudah menjadi baris produksi otomatis (mix_log_id terisi) tidak disarankan lagi: mencegah hitung ganda.
  const logs = await db.all<{ product: string; boards: number; sqm: number; rejects: number; gradeB: number; half: number }>(sql`
    select product, coalesce(sum(boards), 0) as boards, coalesce(sum(square_meters), 0) as sqm, coalesce(sum(rejects), 0) as rejects,
      coalesce(sum(grade_b), 0) as gradeB, coalesce(sum(half_pieces), 0) as half
    from qc_mix_logs l where work_date = ${date} and layer = 'badan'
      and not exists (select 1 from inv_productions p where p.mix_log_id = l.id)
    group by product order by product`);
  if (!logs.length) return [];
  const finished = await db.select({ id: schema.items.id, name: schema.items.name, unit: schema.items.unit }).from(schema.items).where(and(eq(schema.items.kind, "barang_jadi"), eq(schema.items.active, true)));
  return logs.map((l) => ({
    product: l.product,
    boards: Number(l.boards),
    squareMeters: Number(l.sqm),
    rejects: Number(l.rejects),
    gradeB: Number(l.gradeB),
    halfPieces: Number(l.half),
    item: matchFinishedItem(l.product, finished.filter((i) => !HALF_RE.test(i.name))),
    halfItem: Number(l.half) > 0 ? matchHalfHexagon(l.product, finished) : null,
  }));
}

type Finished = { id: string; name: string; unit: string };
/** Nama barang Hexagon belahan (bukan hasil utama mix desain). */
export const HALF_RE = /setengah|belah|trapes/i;

/** Barang jadi yang namanya paling mirip dengan nama produk mix desain. */
export function matchFinishedItem<T extends Finished>(product: string, finished: T[]): T | null {
  let best: T | null = null;
  let bestScore = 0;
  for (const it of finished) {
    const s = nameScore(product, it.name);
    if (s > bestScore || (s === bestScore && s > 0 && best && Math.abs(it.name.length - product.length) < Math.abs(best.name.length - product.length))) {
      best = it;
      bestScore = s;
    }
  }
  return best;
}

/** Barang "Hexagon Setengah (trapesium)" yang warnanya sama dengan produk Hexagon utuh (belahan dari cetakan yang sama). */
export function matchHalfHexagon<T extends Finished>(product: string, finished: T[]): T | null {
  const colorOf = (s: string) => (/merah/i.test(s) ? "merah" : /hitam/i.test(s) ? "hitam" : "abu");
  const color = colorOf(product);
  const halves = finished.filter((i) => /hexa|segi ?enam/i.test(i.name) && /setengah|belah|trapes/i.test(i.name));
  return halves.find((i) => colorOf(i.name) === color) ?? null;
}
