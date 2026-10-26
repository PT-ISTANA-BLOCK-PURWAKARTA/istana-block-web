"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import type { FormState } from "@/components/admin/FormMessage";
import { getDb, schema } from "@/db";
import { requirePerm } from "@/lib/auth";
import { stockItemsById } from "@/lib/erp/ops";
import { assertOpen, getFinSettings, guard, isStockItem, nextNumber, requireDate, runBatch, stockLevels, unitCost, UserError } from "@/lib/erp/server";
import { formatQty, parseQty } from "@/lib/erp/util";
import { logActivity } from "@/lib/ops/activity";

/**
 * Cat genteng / konversi barang 1:1 (natural -> hitam / merah): stok barang asal berkurang, barang tujuan bertambah
 * (2 pergerakan stok sumber "konversi"). Nilai keluar = jumlah x harga pokok rata-rata barang asal, nilai masuk = sama,
 * jadi nilai persediaan netral dan TIDAK ada jurnal (kedua barang wajib barang jadi, akun persediaannya sama).
 * Bukan hasil produksi. Melebihi stok barang asal diperbolehkan hanya dengan konfirmasi (force).
 */
export async function saveConversion(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("cat_genteng");
  const res = await guard(async () => {
    const db = await getDb();
    const movedRaw = String(form.get("movedAt") ?? "");
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(movedRaw)) throw new UserError("Waktu tidak valid.");
    const movedAt = new Date(`${movedRaw}:00+07:00`);
    if (Number.isNaN(movedAt.getTime())) throw new UserError("Waktu tidak valid.");
    const date = requireDate(movedRaw.slice(0, 10));
    const fin = await getFinSettings(db);
    assertOpen(date, fin.lockDate, "Cat genteng");

    const fromId = String(form.get("fromItemId") ?? "");
    const toId = String(form.get("toItemId") ?? "");
    if (!fromId) throw new UserError("Pilih tipe genteng natural yang dicat.");
    if (!toId) throw new UserError("Barang hasil cat (hitam / merah) belum dipilih atau belum ada.");
    if (fromId === toId) throw new UserError("Barang asal dan tujuan tidak boleh sama.");
    const qty = parseQty(form.get("qty"));
    if (!Number.isFinite(qty) || qty <= 0 || qty > 1_000_000) throw new UserError("Isi jumlah yang dicat (lebih dari 0).");
    const items = await stockItemsById(db, [fromId, toId]);
    const from = items.get(fromId);
    const to = items.get(toId);
    if (!from || !to) throw new UserError("Barang tidak ditemukan.");
    for (const it of [from, to]) {
      if (it.kind !== "barang_jadi" || !isStockItem(it)) throw new UserError(`"${it.name}" harus barang jadi yang dilacak stoknya.`);
    }
    const levels = await stockLevels(db);
    const have = levels.get(from.id)?.qty ?? 0;
    if (qty > have + 0.0005 && form.get("force") !== "on") {
      throw new UserError(`Stok ${from.name} di sistem hanya ${formatQty(have)} ${from.unit}. Centang "Tetap simpan" bila memang benar.`);
    }
    const value = Math.round(qty * unitCost(levels.get(from.id), from));
    const id = crypto.randomUUID();
    const number = await nextNumber(db, "KNV", date);
    const note = String(form.get("note") ?? "").trim().slice(0, 300);
    await runBatch(db, [
      db.insert(schema.conversions).values({ id, number, date, movedAt, fromItemId: from.id, toItemId: to.id, qty, note, createdBy: me.id }),
      db.insert(schema.stockMoves).values({ itemId: from.id, date, qty: -qty, value: -value, source: "konversi", sourceId: id, note: number }),
      db.insert(schema.stockMoves).values({ itemId: to.id, date, qty, value, source: "konversi", sourceId: id, note: number }),
    ]);
    return { number, label: `${from.name} → ${to.name}`, qty, unit: from.unit };
  });
  if ("error" in res) return res;
  await logActivity(me, { action: "konversi.simpan", label: "Cat genteng", summary: `${res.number} · ${res.label} · ${formatQty(res.qty)} ${res.unit}` });
  redirect(`/operasional/stok/cat-genteng?ok=${encodeURIComponent(`~Tersimpan: ${res.label} (${formatQty(res.qty)} ${res.unit}).`)}`);
}

/** Hapus catatan cat: pergerakan stok keluar & masuk dibalik (dihapus). */
export async function deleteConversion(id: string): Promise<FormState> {
  const me = await requirePerm("cat_genteng");
  const res = await guard(async () => {
    const db = await getDb();
    const c = await db.query.conversions.findFirst({ where: eq(schema.conversions.id, id) });
    if (!c) return { ok: "" };
    const fin = await getFinSettings(db);
    assertOpen(c.date, fin.lockDate, "Cat genteng");
    await runBatch(db, [
      db.delete(schema.stockMoves).where(and(eq(schema.stockMoves.source, "konversi"), eq(schema.stockMoves.sourceId, id))),
      db.delete(schema.conversions).where(eq(schema.conversions.id, id)),
    ]);
    await logActivity(me, { action: "konversi.hapus", label: "Menghapus catatan cat genteng", summary: `${c.number} · ${formatQty(c.qty)}` });
    return { ok: "deleted" };
  });
  if ("error" in res) return res;
  redirect(`/operasional/stok/cat-genteng?ok=${encodeURIComponent("~Catatan cat dihapus.")}`);
}
