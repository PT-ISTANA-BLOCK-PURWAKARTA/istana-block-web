"use server";

import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import type { FormState } from "@/components/admin/FormMessage";
import { getDb, schema } from "@/db";
import { requirePerm } from "@/lib/auth";
import { stockItemsById } from "@/lib/erp/ops";
import {
  assertOpen,
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
import { parseQty, parseRupiah } from "@/lib/erp/util";

/* ============================================================ Hasil produksi */

/**
 * Hasil produksi: bahan baku keluar (harga pokok rata-rata) + biaya produksi → barang jadi masuk.
 * Jurnal: Dr Persediaan barang jadi / Cr Persediaan bahan baku, Cr Biaya produksi (upah dll. yang diserap).
 * Bila biaya produksi dikosongkan, nilainya = harga pokok standar hasil − nilai bahan (minimal 0).
 */
export async function saveProduction(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("stok");
  const res = await guard(async () => {
    const db = await getDb();
    const id = String(form.get("id") ?? "");
    const existing = id ? await db.query.productions.findFirst({ where: eq(schema.productions.id, id) }) : undefined;
    if (id && !existing) throw new UserError("Catatan produksi tidak ditemukan.");
    const fin = await getFinSettings(db);
    const date = requireDate(form.get("date"));
    assertOpen(date, fin.lockDate, "Produksi");
    if (existing) assertOpen(existing.date, fin.lockDate, "Produksi");

    const parse = (key: string) =>
      parseRows(form.get(key))
        .map((r) => ({ itemId: String(r.itemId ?? ""), qty: parseQty(r.qty) }))
        .filter((l) => l.itemId || l.qty);
    const out = parse("hasil");
    const used = parse("bahan");
    if (!out.length) throw new UserError("Isi minimal satu barang hasil produksi.");
    const items = await stockItemsById(db, [...out, ...used].map((l) => l.itemId));
    for (const [label, rows] of [["Hasil", out], ["Bahan", used]] as const) {
      for (const [i, l] of rows.entries()) {
        const it = items.get(l.itemId);
        if (!it) throw new UserError(`${label} baris ${i + 1}: pilih barang.`);
        if (!isStockItem(it)) throw new UserError(`${label} baris ${i + 1}: "${it.name}" tidak dilacak stoknya.`);
        if (l.qty <= 0) throw new UserError(`${label} baris ${i + 1}: qty harus lebih dari 0.`);
      }
    }
    const prodId = existing?.id ?? crypto.randomUUID();
    const levels = await stockLevels(db, undefined, prodId);
    const usedValues = used.map((l) => Math.round(l.qty * unitCost(levels.get(l.itemId), items.get(l.itemId)!)));
    const materials = usedValues.reduce((a, v) => a + v, 0);
    const standard = out.reduce((a, l) => a + Math.round(l.qty * items.get(l.itemId)!.buyPrice), 0);
    // Kolom biaya hanya tampil untuk staf keuangan; bila tidak dikirim saat mengubah, pakai nilai lama.
    const laborField = form.get("laborCost");
    const laborRaw = String(laborField ?? "").trim();
    const labor = laborField === null && existing ? existing.laborCost : laborRaw ? parseRupiah(laborRaw) : Math.max(0, standard - materials);
    if (labor < 0) throw new UserError("Biaya produksi tidak boleh negatif.");
    const total = materials + labor;

    // Bagi nilai ke hasil menurut harga pokok standar (atau qty bila standar kosong); sisa pembulatan ke baris terakhir.
    const weights = out.map((l) => l.qty * (standard > 0 ? items.get(l.itemId)!.buyPrice : 1));
    const wsum = weights.reduce((a, w) => a + w, 0) || 1;
    const outValues = out.map((_, i) => Math.round((total * weights[i]) / wsum));
    outValues[outValues.length - 1] += total - outValues.reduce((a, v) => a + v, 0);

    const number = existing?.number ?? (await nextNumber(db, "PRD", date));
    const note = String(form.get("note") ?? "").trim().slice(0, 1000);
    const acc = await loadAccounts(db);
    const jl: JLine[] = [
      ...out.map((l, i) => ({ accountId: inventoryAccount(acc, items.get(l.itemId)!), debit: outValues[i], memo: items.get(l.itemId)!.name })),
      ...used.map((l, i) => ({ accountId: inventoryAccount(acc, items.get(l.itemId)!), credit: usedValues[i], memo: items.get(l.itemId)!.name })),
      { accountId: acc.sys("upah_produksi"), credit: labor, memo: "Biaya produksi diserap ke persediaan" },
    ];
    const moves = [
      ...out.map((l, i) => ({ itemId: l.itemId, date, qty: l.qty, value: outValues[i], source: "produksi" as const, sourceId: prodId, note: number })),
      ...used.map((l, i) => ({ itemId: l.itemId, date, qty: -l.qty, value: -usedValues[i], source: "produksi" as const, sourceId: prodId, note: number })),
    ];
    const header = { number, date, laborCost: labor, note, updatedAt: new Date() };
    await runBatch(db, [
      existing
        ? [
            db.update(schema.productions).set(header).where(eq(schema.productions.id, prodId)),
            db.delete(schema.productionLines).where(eq(schema.productionLines.productionId, prodId)),
            db.delete(schema.stockMoves).where(and(eq(schema.stockMoves.source, "produksi"), eq(schema.stockMoves.sourceId, prodId))),
            ...deleteJournalOps(db, "produksi", prodId),
          ]
        : db.insert(schema.productions).values({ id: prodId, ...header, createdBy: me.id }),
      ...insertMany(db, schema.productionLines, [...out.map((l) => ({ ...l, role: "hasil" as const, productionId: prodId })), ...used.map((l) => ({ ...l, role: "bahan" as const, productionId: prodId }))]),
      ...insertMany(db, schema.stockMoves, moves),
      ...journalOps(db, { number, date, memo: `Hasil produksi ${number}${note ? ` · ${note.slice(0, 80)}` : ""}`, source: "produksi", sourceId: prodId, createdBy: me.id, lines: jl }),
    ]);
    return { id: prodId, number };
  });
  if ("error" in res) return res;
  redirect(`/operasional/produksi/${res.id}?ok=${encodeURIComponent(res.number)}`);
}

export async function deleteProduction(id: string): Promise<FormState> {
  await requirePerm("stok");
  const res = await guard(async () => {
    const db = await getDb();
    const p = await db.query.productions.findFirst({ where: eq(schema.productions.id, id) });
    if (!p) return { ok: "" };
    const fin = await getFinSettings(db);
    assertOpen(p.date, fin.lockDate, "Produksi");
    await runBatch(db, [
      db.delete(schema.productionLines).where(eq(schema.productionLines.productionId, id)),
      db.delete(schema.stockMoves).where(and(eq(schema.stockMoves.source, "produksi"), eq(schema.stockMoves.sourceId, id))),
      ...deleteJournalOps(db, "produksi", id),
      db.delete(schema.productions).where(eq(schema.productions.id, id)),
    ]);
    return { ok: "deleted" };
  });
  if ("error" in res) return res;
  redirect("/operasional/produksi?ok=dihapus");
}

/* ============================================================ Penyesuaian & saldo awal stok */

const ADJ_SOURCES = ["penyesuaian", "saldo_awal"] as const;

/**
 * Penyesuaian stok (hasil stok opname, rusak, dll.) atau saldo awal stok.
 * Tambah: Dr Persediaan / Cr Selisih persediaan (atau Saldo awal). Kurang: kebalikannya, dinilai harga pokok rata-rata.
 */
export async function saveAdjustment(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("stok");
  const res = await guard(async () => {
    const db = await getDb();
    const id = String(form.get("id") ?? "");
    const existing = id ? await db.query.adjustments.findFirst({ where: eq(schema.adjustments.id, id) }) : undefined;
    if (id && !existing) throw new UserError("Penyesuaian tidak ditemukan.");
    const fin = await getFinSettings(db);
    const date = requireDate(form.get("date"));
    assertOpen(date, fin.lockDate, "Penyesuaian stok");
    if (existing) assertOpen(existing.date, fin.lockDate, "Penyesuaian stok");
    const item = (await stockItemsById(db, [String(form.get("itemId") ?? "")])).values().next().value;
    if (!item) throw new UserError("Pilih barang.");
    if (!isStockItem(item)) throw new UserError(`"${item.name}" tidak dilacak stoknya. Aktifkan "lacak stok" di data barang.`);
    const dir = String(form.get("direction") ?? "tambah");
    const amount = parseQty(form.get("qty"));
    if (amount <= 0) throw new UserError("Qty harus lebih dari 0.");
    const opening = form.get("opening") === "on";
    if (opening && dir !== "tambah") throw new UserError("Saldo awal stok selalu berupa penambahan.");
    const qty = dir === "kurang" ? -amount : amount;
    const reason = String(form.get("reason") ?? "").trim().slice(0, 300);
    if (!reason && !opening) throw new UserError("Tulis alasan penyesuaian (mis. hasil stok opname, barang rusak).");

    const adjId = existing?.id ?? crypto.randomUUID();
    const levels = await stockLevels(db, undefined, adjId);
    const avg = unitCost(levels.get(item.id), item);
    // Kolom nilai hanya tampil untuk staf keuangan; bila tidak dikirim saat mengubah, pakai nilai lama.
    const costField = form.get("unitCost");
    const typed = costField === null && existing && existing.qty > 0 ? existing.unitCost : parseRupiah(costField);
    const cost = qty > 0 ? typed || Math.round(avg) : Math.round(avg);
    const value = Math.round(qty * cost);
    const number = existing?.number ?? (await nextNumber(db, "ADJ", date));
    const acc = await loadAccounts(db);
    const inv = inventoryAccount(acc, item);
    const other = opening ? acc.sys("saldo_awal") : acc.sys("selisih_persediaan");
    const memo = `${opening ? "Saldo awal stok" : "Penyesuaian stok"} ${item.name}${reason ? ` · ${reason}` : ""}`;
    const jl: JLine[] = value >= 0 ? [{ accountId: inv, debit: value, memo }, { accountId: other, credit: value, memo }] : [{ accountId: other, debit: -value, memo }, { accountId: inv, credit: -value, memo }];
    const header = { number, date, itemId: item.id, qty, unitCost: cost, reason: opening ? reason || "Saldo awal" : reason, updatedAt: new Date() };
    await runBatch(db, [
      existing
        ? [
            db.update(schema.adjustments).set(header).where(eq(schema.adjustments.id, adjId)),
            db.delete(schema.stockMoves).where(and(inArray(schema.stockMoves.source, [...ADJ_SOURCES]), eq(schema.stockMoves.sourceId, adjId))),
            ...deleteJournalOps(db, "penyesuaian", adjId),
          ]
        : db.insert(schema.adjustments).values({ id: adjId, ...header, createdBy: me.id }),
      db.insert(schema.stockMoves).values({ itemId: item.id, date, qty, value, source: opening ? "saldo_awal" : "penyesuaian", sourceId: adjId, note: number }),
      ...journalOps(db, { number, date, memo, source: "penyesuaian", sourceId: adjId, createdBy: me.id, lines: jl }),
    ]);
    return { id: adjId, number };
  });
  if ("error" in res) return res;
  redirect(`/operasional/stok/penyesuaian/${res.id}?ok=${encodeURIComponent(res.number)}`);
}

export async function deleteAdjustment(id: string): Promise<FormState> {
  await requirePerm("stok");
  const res = await guard(async () => {
    const db = await getDb();
    const a = await db.query.adjustments.findFirst({ where: eq(schema.adjustments.id, id) });
    if (!a) return { ok: "" };
    const fin = await getFinSettings(db);
    assertOpen(a.date, fin.lockDate, "Penyesuaian stok");
    await runBatch(db, [
      db.delete(schema.stockMoves).where(and(inArray(schema.stockMoves.source, [...ADJ_SOURCES]), eq(schema.stockMoves.sourceId, id))),
      ...deleteJournalOps(db, "penyesuaian", id),
      db.delete(schema.adjustments).where(eq(schema.adjustments.id, id)),
    ]);
    return { ok: "deleted" };
  });
  if ("error" in res) return res;
  redirect("/operasional/stok/penyesuaian?ok=dihapus");
}
