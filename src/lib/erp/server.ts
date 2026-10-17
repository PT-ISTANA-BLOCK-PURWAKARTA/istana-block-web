import "server-only";
import { and, eq, getTableColumns, inArray, or, sql } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { getDb, schema } from "@/db";
import type { Item, JournalSource } from "@/db/erp";
import { isDate } from "./util";

export type DB = Awaited<ReturnType<typeof getDb>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Op = any;

/** Kesalahan yang aman ditampilkan ke pengguna (validasi bisnis). */
export class UserError extends Error {}

/* ------------------------------------------------------------ batch & insert */

/** Pecah daftar (mis. id untuk IN (...)) agar satu perintah D1 tidak melewati ±100 parameter. */
export function chunk<T>(arr: T[], size = 90): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Jalankan beberapa perintah sebagai satu transaksi D1. */
export async function runBatch(db: DB, ops: Op[]) {
  const list = ops.flat().filter(Boolean);
  if (!list.length) return;
  await db.batch(list as [Op, ...Op[]]);
}

/** Insert banyak baris dalam beberapa perintah (D1 membatasi ±100 parameter per perintah). */
export function insertMany<T extends SQLiteTable>(db: DB, table: T, rows: T["$inferInsert"][]): Op[] {
  if (!rows.length) return [];
  const cols = Object.keys(getTableColumns(table)).length;
  const per = Math.max(1, Math.floor(99 / cols));
  const out: Op[] = [];
  for (let i = 0; i < rows.length; i += per) out.push(db.insert(table).values(rows.slice(i, i + per)));
  return out;
}

/* ------------------------------------------------------------ penomoran */

/** Nomor dokumen berurutan per awalan & bulan: "INV/2610/0001". */
export async function nextNumber(db: DB, prefix: string, date: string) {
  const ym = `${date.slice(2, 4)}${date.slice(5, 7)}`;
  const key = `${prefix}/${ym}`;
  const r = await db
    .insert(schema.sequences)
    .values({ key, value: 1 })
    .onConflictDoUpdate({ target: schema.sequences.key, set: { value: sql`${schema.sequences.value} + 1` } })
    .returning({ value: schema.sequences.value });
  return `${key}/${String(r[0]?.value ?? 1).padStart(4, "0")}`;
}

/* ------------------------------------------------------------ akun */

export async function loadAccounts(db: DB) {
  const rows = await db.select().from(schema.accounts);
  const byId = new Map(rows.map((a) => [a.id, a]));
  const bySys = new Map(rows.filter((a) => a.systemKey).map((a) => [a.systemKey as string, a]));
  return {
    rows,
    byId,
    sys(key: string) {
      const a = bySys.get(key);
      if (!a) throw new UserError(`Akun sistem "${key}" tidak ditemukan. Periksa bagan akun.`);
      return a.id;
    },
  };
}
export type Accounts = Awaited<ReturnType<typeof loadAccounts>>;

export function revenueAccount(acc: Accounts, item: Pick<Item, "kind" | "revenueAccountId"> | null | undefined) {
  if (item?.revenueAccountId && acc.byId.has(item.revenueAccountId)) return item.revenueAccountId;
  return item?.kind === "jasa" ? acc.sys("pendapatan_jasa") : acc.sys("penjualan");
}

export function inventoryAccount(acc: Accounts, item: Pick<Item, "kind">) {
  return item.kind === "bahan_baku" ? acc.sys("persediaan_bahan") : acc.sys("persediaan_jadi");
}

export function isStockItem(item: Pick<Item, "kind" | "trackStock">) {
  return item.trackStock && (item.kind === "barang_jadi" || item.kind === "bahan_baku");
}

/* ------------------------------------------------------------ jurnal */

export type JLine = { accountId: string; debit?: number; credit?: number; memo?: string; contactId?: string | null };

/** Susun perintah insert jurnal. Melempar UserError bila debit ≠ kredit. */
export function journalOps(
  db: DB,
  j: { id?: string; number: string; date: string; memo: string; source: JournalSource; sourceId: string | null; createdBy?: number | null; lines: JLine[] },
): Op[] {
  // Nilai negatif dipindah ke sisi seberang; baris nol dibuang.
  const lines = j.lines
    .map((l) => {
      let d = Math.round(l.debit ?? 0);
      let c = Math.round(l.credit ?? 0);
      if (d < 0) [c, d] = [c - d, 0];
      if (c < 0) [d, c] = [d - c, 0];
      return { ...l, debit: d, credit: c };
    })
    .filter((l) => l.debit !== 0 || l.credit !== 0);
  if (!lines.length) return [];
  const d = lines.reduce((a, l) => a + l.debit, 0);
  const c = lines.reduce((a, l) => a + l.credit, 0);
  if (d !== c) throw new UserError(`Jurnal tidak seimbang: debit ${d} ≠ kredit ${c}.`);
  const journalId = j.id ?? crypto.randomUUID();
  return [
    db.insert(schema.journals).values({ id: journalId, number: j.number, date: j.date, memo: j.memo, source: j.source, sourceId: j.sourceId, createdBy: j.createdBy ?? null }),
    ...insertMany(
      db,
      schema.journalLines,
      lines.map((l, i) => ({ journalId, date: j.date, accountId: l.accountId, debit: l.debit, credit: l.credit, memo: l.memo ?? "", contactId: l.contactId ?? null, sort: i })),
    ),
  ];
}

/** Hapus jurnal otomatis milik sebuah dokumen (dipakai saat dokumen diubah/dihapus). */
export function deleteJournalOps(db: DB, source: JournalSource, sourceId: string): Op[] {
  const where = and(eq(schema.journals.source, source), eq(schema.journals.sourceId, sourceId));
  return [
    db.delete(schema.journalLines).where(inArray(schema.journalLines.journalId, db.select({ id: schema.journals.id }).from(schema.journals).where(where))),
    db.delete(schema.journals).where(where),
  ];
}

/* ------------------------------------------------------------ persediaan */

/** Saldo kuantitas & nilai per barang (opsional sampai tanggal tertentu, inklusif). */
export async function stockLevels(db: DB, upTo?: string, excludeSourceId?: string) {
  const rows = await db
    .select({ itemId: schema.stockMoves.itemId, qty: sql<number>`coalesce(sum(${schema.stockMoves.qty}),0)`, value: sql<number>`coalesce(sum(${schema.stockMoves.value}),0)` })
    .from(schema.stockMoves)
    .where(
      and(
        upTo ? sql`${schema.stockMoves.date} <= ${upTo}` : undefined,
        // Saat dokumen diubah, pergerakan lamanya tidak ikut menentukan harga pokok baru.
        excludeSourceId ? sql`coalesce(${schema.stockMoves.sourceId}, '') <> ${excludeSourceId}` : undefined,
      ),
    )
    .groupBy(schema.stockMoves.itemId);
  return new Map(rows.map((r) => [r.itemId, { qty: Number(r.qty), value: Number(r.value) }]));
}

/** Harga pokok rata-rata per satuan; bila stok kosong pakai harga pokok standar barang. */
export function unitCost(level: { qty: number; value: number } | undefined, item: Pick<Item, "buyPrice">) {
  if (level && level.qty > 0.0005 && level.value > 0) return level.value / level.qty;
  return item.buyPrice;
}

/* ------------------------------------------------------------ pengaturan keuangan */

export const FIN_DEFAULTS = {
  fin_ppn_rate: "11",
  fin_lock_date: "",
  fin_term_days: "14",
  fin_bank_info: "",
  fin_invoice_note: "Pembayaran dianggap sah setelah dana masuk ke rekening perusahaan.",
  fin_npwp: "",
};
export type FinKey = keyof typeof FIN_DEFAULTS;

export async function getFinSettings(db: DB) {
  const rows = await db.select().from(schema.settings).where(inArray(schema.settings.key, Object.keys(FIN_DEFAULTS)));
  const s = { ...FIN_DEFAULTS };
  for (const r of rows) if (r.key in s) s[r.key as FinKey] = r.value;
  return {
    ppnRate: Number(s.fin_ppn_rate) || 0,
    lockDate: isDate(s.fin_lock_date) ? s.fin_lock_date : "",
    termDays: Math.max(0, Number(s.fin_term_days) || 0),
    bankInfo: s.fin_bank_info,
    invoiceNote: s.fin_invoice_note,
    npwp: s.fin_npwp,
    raw: s,
  };
}

/** Tolak perubahan transaksi pada periode yang sudah ditutup. */
export function assertOpen(date: string, lockDate: string, label = "Transaksi") {
  if (lockDate && date <= lockDate) throw new UserError(`${label} bertanggal ${date} berada di periode yang sudah ditutup (s.d. ${lockDate}). Ubah tanggal tutup buku di Pengaturan keuangan bila memang perlu.`);
}

export function requireDate(v: unknown, label = "Tanggal") {
  const s = String(v ?? "");
  if (!isDate(s)) throw new UserError(`${label} tidak valid.`);
  return s;
}

/** JSON dari input tersembunyi editor baris. */
export const MAX_ROWS = 80;

export function parseRows(v: FormDataEntryValue | null): Record<string, unknown>[] {
  let rows: Record<string, unknown>[] = [];
  try {
    const x = JSON.parse(String(v ?? "[]"));
    rows = Array.isArray(x) ? x.filter((r) => r && typeof r === "object") : [];
  } catch {
    rows = [];
  }
  if (rows.length > MAX_ROWS) throw new UserError(`Maksimal ${MAX_ROWS} baris per dokumen. Pecah menjadi beberapa dokumen.`);
  return rows;
}

/** Bungkus server action: UserError → { error }, selain itu dilempar ulang (redirect, dll.). */
export async function guard<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    throw e;
  }
}

/** Filter kontak per jenis (termasuk "keduanya"); kontak nonaktif hanya ikut bila dipakai dokumen yang sedang diubah (keepId). */
export function contactsOfKind(kind: "pelanggan" | "pemasok", keepId?: string | null) {
  const active = keepId ? or(eq(schema.contacts.active, true), eq(schema.contacts.id, keepId)) : eq(schema.contacts.active, true);
  return and(or(eq(schema.contacts.kind, kind), eq(schema.contacts.kind, "keduanya")), active);
}

/**
 * Daftar barang & akun untuk dropdown formulir. Yang nonaktif disembunyikan, kecuali id-nya ada di `keep`
 * (dipakai dokumen yang sedang diubah, supaya pilihannya tidak hilang).
 */
export async function pickLists(db: DB, keep: Iterable<string | null | undefined> = []) {
  const k = new Set([...keep].filter(Boolean) as string[]);
  const [allItems, allAccounts] = await Promise.all([
    db.select().from(schema.items).orderBy(schema.items.code),
    db.select().from(schema.accounts).orderBy(schema.accounts.code),
  ]);
  const items = allItems.filter((i) => i.active || k.has(i.id));
  const accounts = allAccounts.filter((a) => a.active || k.has(a.id));
  return {
    items: items.map((i) => ({ id: i.id, code: i.code, name: i.name, unit: i.unit, sellPrice: i.sellPrice, buyPrice: i.buyPrice, kind: i.kind })),
    accounts,
    pick: (filter?: (a: (typeof accounts)[number]) => boolean) => accounts.filter(filter ?? (() => true)).map((a) => ({ id: a.id, code: a.code, name: a.name })),
  };
}

/** Saldo uang muka per kontak (dari buku besar akun uang muka). Positif = tersedia. */
export async function depositBalance(db: DB, accountId: string, contactId: string, side: "credit" | "debit", excludeJournalSourceId?: string) {
  const r = await db.get<{ b: number }>(sql`
    select coalesce(sum(${side === "credit" ? sql`l.credit - l.debit` : sql`l.debit - l.credit`}),0) as b
    from fin_journal_lines l join fin_journals j on j.id = l.journal_id
    where l.account_id = ${accountId} and l.contact_id = ${contactId}
      ${excludeJournalSourceId ? sql`and (j.source_id is null or j.source_id <> ${excludeJournalSourceId})` : sql``}`);
  return Number(r?.b ?? 0);
}

/** Baris jurnal otomatis sebuah dokumen, lengkap dengan nama akun (untuk ditampilkan). */
export async function journalFor(db: DB, source: JournalSource, sourceId: string) {
  return db.all<{ journalId: string; number: string; date: string; code: string; name: string; debit: number; credit: number; memo: string }>(sql`
    select j.id as journalId, j.number, l.date, a.code, a.name, l.debit, l.credit, l.memo
    from fin_journal_lines l join fin_journals j on j.id = l.journal_id join fin_accounts a on a.id = l.account_id
    where j.source = ${source} and j.source_id = ${sourceId}
    order by j.date, l.sort`);
}

/** Data formulir penerimaan/pembayaran: faktur terbuka milik kontak + alokasi dokumen yang sedang diubah. */
export async function settleData(db: DB, kind: "receipt" | "payment", contactId: string, existingId?: string) {
  const acc = await loadAccounts(db);
  const depositAccountId = acc.sys(kind === "receipt" ? "uang_muka_pelanggan" : "uang_muka_pembelian");
  const docs =
    kind === "receipt"
      ? await db.all<{ id: string; number: string; date: string; dueDate: string; total: number; paid: number; own: number }>(sql`
          select i.id, i.number, i.date, i.due_date as dueDate, i.total, i.paid,
            coalesce((select sum(amount) from fin_receipt_allocations where invoice_id = i.id and receipt_id = ${existingId ?? ""}),0) as own
          from fin_invoices i where i.contact_id = ${contactId} and i.void = 0
            and (i.paid < i.total or exists (select 1 from fin_receipt_allocations where invoice_id = i.id and receipt_id = ${existingId ?? ""}))
          order by i.due_date`)
      : await db.all<{ id: string; number: string; date: string; dueDate: string; total: number; paid: number; own: number }>(sql`
          select b.id, b.number, b.date, b.due_date as dueDate, b.total, b.paid,
            coalesce((select sum(amount) from fin_payment_allocations where bill_id = b.id and payment_id = ${existingId ?? ""}),0) as own
          from fin_bills b where b.contact_id = ${contactId} and b.void = 0
            and (b.paid < b.total or exists (select 1 from fin_payment_allocations where bill_id = b.id and payment_id = ${existingId ?? ""}))
          order by b.due_date`);
  const balance = await depositBalance(db, depositAccountId, contactId, kind === "receipt" ? "credit" : "debit", existingId);
  return {
    docs: docs.map((d) => ({ id: d.id, number: d.number, date: d.date, dueDate: d.dueDate, total: Number(d.total), left: Number(d.total) - Number(d.paid) + Number(d.own), alloc: Number(d.own) })),
    accounts: acc.rows.filter((a) => a.group === "kas_bank" && a.active).map((a) => ({ id: a.id, code: a.code, name: a.name })),
    depositAccountId,
    depositBalance: balance,
  };
}
