"use server";

import { redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import type { FormState } from "@/components/admin/FormMessage";
import { getDb, schema } from "@/db";
import { requirePerm } from "@/lib/auth";
import { stockItemsById } from "@/lib/erp/ops";
import {
  assertOpen,
  chunk,
  deleteJournalOps,
  getFinSettings,
  guard,
  insertMany,
  inventoryAccount,
  isStockItem,
  journalOps,
  loadAccounts,
  nextNumber,
  parseRows,
  requireDate,
  runBatch,
  stockLevels,
  unitCost,
  UserError,
  type JLine,
} from "@/lib/erp/server";
import { parseQty } from "@/lib/erp/util";
import { logActivity } from "@/lib/ops/activity";

/** Waktu hitung dari <input type="datetime-local"> (WIB): "2026-10-27T14:30" -> Date. */
function parseCountedAt(v: FormDataEntryValue | null) {
  const s = String(v ?? "");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) throw new UserError("Waktu hitung tidak valid.");
  const d = new Date(`${s}:00+07:00`);
  if (Number.isNaN(d.getTime())) throw new UserError("Waktu hitung tidak valid.");
  return { date: requireDate(s.slice(0, 10), "Tanggal hitung"), at: d };
}

/**
 * Simpan stok opname: hitung fisik per barang -> dokumen inv_counts + inv_count_lines.
 * Tiap barang yang SELISIH (jumlah fisik - stok web saat ini != 0) menghasilkan SATU penyesuaian (inv_adjustments.count_id terisi)
 * + pergerakan stok "penyesuaian" + jurnal "penyesuaian" persis seperti Penyesuaian stok:
 * tambah = Dr Persediaan / Cr Selisih persediaan; kurang = kebalikannya, dinilai harga pokok rata-rata. Satu transaksi atomik.
 * Barang yang tidak diisi dilewati. Selisih 0 hanya dicatat di baris dokumen.
 */
export async function saveCount(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("opname");
  const res = await guard(async () => {
    const db = await getDb();
    const { date, at } = parseCountedAt(form.get("countedAt"));
    const fin = await getFinSettings(db);
    assertOpen(date, fin.lockDate, "Stok opname");
    const note = String(form.get("note") ?? "").trim().slice(0, 300);
    const rows = parseRows(form.get("lines"))
      .map((r) => ({ itemId: String(r.itemId ?? ""), raw: String(r.counted ?? "").trim() }))
      .filter((r) => r.itemId && r.raw !== "");
    if (!rows.length) throw new UserError("Isi jumlah fisik minimal satu barang.");
    const items = await stockItemsById(db, rows.map((r) => r.itemId));
    const seen = new Set<string>();
    const lines = rows.map((r, i) => {
      const it = items.get(r.itemId);
      if (!it) throw new UserError(`Baris ${i + 1}: barang tidak ditemukan.`);
      if (!isStockItem(it)) throw new UserError(`"${it.name}" tidak dilacak stoknya.`);
      if (seen.has(it.id)) throw new UserError(`"${it.name}" terisi dua kali.`);
      seen.add(it.id);
      const counted = parseQty(r.raw);
      if (!Number.isFinite(counted) || counted < 0 || counted > 1_000_000) throw new UserError(`Jumlah fisik "${it.name}" harus angka 0 atau lebih.`);
      return { item: it, counted };
    });

    const levels = await stockLevels(db);
    const acct = await loadAccounts(db);
    const countId = crypto.randomUUID();
    const number = await nextNumber(db, "OPN", date);
    const ops: Parameters<typeof runBatch>[1] = [db.insert(schema.stockCounts).values({ id: countId, number, date, countedAt: at, note, createdBy: me.id })];
    const countLines: (typeof schema.stockCountLines.$inferInsert)[] = [];
    let adjusted = 0;
    for (const l of lines) {
      const system = levels.get(l.item.id)?.qty ?? 0;
      const diff = Math.round((l.counted - system) * 1000) / 1000;
      countLines.push({ countId, itemId: l.item.id, systemQty: system, countedQty: l.counted });
      if (diff === 0) continue;
      adjusted++;
      const avg = Math.round(unitCost(levels.get(l.item.id), l.item));
      const value = Math.round(diff * avg);
      const adjId = crypto.randomUUID();
      const adjNumber = await nextNumber(db, "ADJ", date);
      const reason = `Opname ${number}`;
      const memo = `Penyesuaian stok ${l.item.name} · ${reason}`;
      const other = acct.sys("selisih_persediaan");
      const inv = inventoryAccount(acct, l.item);
      const jl: JLine[] = value >= 0 ? [{ accountId: inv, debit: value, memo }, { accountId: other, credit: value, memo }] : [{ accountId: other, debit: -value, memo }, { accountId: inv, credit: -value, memo }];
      ops.push(
        db.insert(schema.adjustments).values({ id: adjId, number: adjNumber, date, itemId: l.item.id, qty: diff, unitCost: avg, reason, countId, createdBy: me.id }),
        db.insert(schema.stockMoves).values({ itemId: l.item.id, date, qty: diff, value, source: "penyesuaian", sourceId: adjId, note: adjNumber }),
        ...journalOps(db, { number: adjNumber, date, memo, source: "penyesuaian", sourceId: adjId, createdBy: me.id, lines: jl }),
      );
    }
    ops.push(...insertMany(db, schema.stockCountLines, countLines));
    await runBatch(db, ops);
    return { id: countId, number, lines: lines.length, adjusted };
  });
  if ("error" in res) return res;
  await logActivity(me, { action: "opname.simpan", label: "Menyimpan stok opname", summary: `${res.number} · ${res.lines} barang · ${res.adjusted} selisih` });
  redirect(`/operasional/stok/opname/${res.id}?ok=${encodeURIComponent(`~Stok opname tersimpan (${res.lines} barang, ${res.adjusted} selisih diposting).`)}`);
}

/** Hapus dokumen opname: penyesuaian selisihnya beserta pergerakan stok & jurnalnya ikut dihapus. */
export async function deleteCount(id: string): Promise<FormState> {
  const me = await requirePerm("opname");
  const res = await guard(async () => {
    const db = await getDb();
    const c = await db.query.stockCounts.findFirst({ where: eq(schema.stockCounts.id, id) });
    if (!c) return { ok: "" };
    const fin = await getFinSettings(db);
    assertOpen(c.date, fin.lockDate, "Stok opname");
    const adjs = await db.select({ id: schema.adjustments.id }).from(schema.adjustments).where(eq(schema.adjustments.countId, id));
    const ids = adjs.map((a) => a.id);
    await runBatch(db, [
      ...chunk(ids, 80).map((part) => db.delete(schema.stockMoves).where(inArray(schema.stockMoves.sourceId, part))),
      ...ids.flatMap((adjId) => deleteJournalOps(db, "penyesuaian", adjId)),
      db.delete(schema.adjustments).where(eq(schema.adjustments.countId, id)),
      db.delete(schema.stockCountLines).where(eq(schema.stockCountLines.countId, id)),
      db.delete(schema.stockCounts).where(eq(schema.stockCounts.id, id)),
    ]);
    await logActivity(me, { action: "opname.hapus", label: "Menghapus stok opname", summary: `${c.number} · ${ids.length} penyesuaian dibalik` });
    return { ok: "deleted" };
  });
  if ("error" in res) return res;
  redirect(`/operasional/stok/opname?ok=${encodeURIComponent("~Stok opname dihapus.")}`);
}
