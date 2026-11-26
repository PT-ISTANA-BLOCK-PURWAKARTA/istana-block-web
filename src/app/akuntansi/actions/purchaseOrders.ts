"use server";

// Permintaan Penawaran (RFQ) & Pesanan Pembelian (PO) ke pemasok: dokumen tanpa jurnal; PO diteruskan menjadi faktur pembelian.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import type { FormState } from "@/components/admin/FormMessage";
import { getDb, schema } from "@/db";
import { purchaseOrderStatuses, type PurchaseOrderKind } from "@/db/erp";
import { requireModule } from "@/lib/auth";
import { getFinSettings, guard, insertMany, nextNumber, parseRows, requireDate, runBatch, UserError } from "@/lib/erp/server";
import { isDate, parseQty, parseRupiah } from "@/lib/erp/util";

const PATH = (k: PurchaseOrderKind) => `/akuntansi/pesanan-pembelian${k === "rfq" ? "?jenis=rfq" : ""}`;

export async function savePurchaseOrder(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireModule("keuangan");
  const res = await guard(async () => {
    const db = await getDb();
    const id = String(form.get("id") ?? "");
    const existing = id ? await db.query.purchaseOrders.findFirst({ where: eq(schema.purchaseOrders.id, id) }) : undefined;
    if (id && !existing) throw new UserError("Dokumen tidak ditemukan.");
    const kind = (existing?.kind ?? (String(form.get("kind")) === "rfq" ? "rfq" : "po")) as PurchaseOrderKind;
    const date = requireDate(form.get("date"));
    const contactId = String(form.get("contactId") ?? "");
    const c = contactId ? await db.query.contacts.findFirst({ where: eq(schema.contacts.id, contactId) }) : undefined;
    if (!c || c.kind === "pelanggan") throw new UserError("Pilih pemasok.");
    const expected = String(form.get("expectedDate") ?? "");
    const status = String(form.get("status") ?? existing?.status ?? "draft");
    if (!purchaseOrderStatuses.includes(status as never)) throw new UserError("Status tidak dikenal.");
    const items = await db.select({ id: schema.items.id, name: schema.items.name, unit: schema.items.unit }).from(schema.items);
    const byId = new Map(items.map((i) => [i.id, i]));
    const lines = parseRows(form.get("lines"))
      .map((r) => {
        const itemId = String(r.itemId ?? "") || null;
        const it = itemId ? byId.get(itemId) : undefined;
        const qty = parseQty(r.qty) || 0;
        const price = parseRupiah(r.price);
        return { itemId: it ? itemId : null, description: (String(r.description ?? "").trim() || it?.name || "").slice(0, 300), qty, unit: (String(r.unit ?? "") || it?.unit || "").slice(0, 20), price, amount: Math.round(qty * price) };
      })
      .filter((l) => l.description && l.qty > 0);
    if (!lines.length) throw new UserError("Isi minimal satu barang (nama dan jumlah).");
    const fin = await getFinSettings(db);
    const subtotal = lines.reduce((s, l) => s + l.amount, 0);
    const tax = form.get("ppn") === "on" ? Math.round((subtotal * fin.ppnRate) / 100) : 0;
    const orderId = existing?.id ?? crypto.randomUUID();
    const number = existing?.number ?? (await nextNumber(db, kind === "rfq" ? "RFQ" : "POB", date));
    const header = {
      kind, number, date, contactId, expectedDate: isDate(expected) ? expected : null, status: status as (typeof purchaseOrderStatuses)[number],
      subtotal, tax, total: subtotal + tax, memo: String(form.get("memo") ?? "").slice(0, 500), sourceId: existing?.sourceId ?? (String(form.get("sourceId") ?? "") || null), updatedAt: new Date(),
    };
    await runBatch(db, [
      existing
        ? [db.update(schema.purchaseOrders).set(header).where(eq(schema.purchaseOrders.id, orderId)), db.delete(schema.purchaseOrderLines).where(eq(schema.purchaseOrderLines.orderId, orderId))]
        : db.insert(schema.purchaseOrders).values({ id: orderId, ...header, createdBy: me.id }),
      ...insertMany(db, schema.purchaseOrderLines, lines.map((l, i) => ({ orderId, ...l, sort: i }))),
    ]);
    return { id: orderId, number };
  });
  if ("error" in res) return res;
  redirect(`/akuntansi/pesanan-pembelian/${res.id}?ok=${encodeURIComponent(res.number)}`);
}

export async function setPurchaseOrderStatus(id: string, status: string): Promise<{ ok?: string; error?: string }> {
  await requireModule("keuangan");
  const res = await guard(async () => {
    if (!purchaseOrderStatuses.includes(status as never)) throw new UserError("Status tidak dikenal.");
    const db = await getDb();
    await db.update(schema.purchaseOrders).set({ status: status as never, updatedAt: new Date() }).where(eq(schema.purchaseOrders.id, id));
    return { ok: `Status diubah: ${status}.` };
  });
  revalidatePath(`/akuntansi/pesanan-pembelian/${id}`);
  return res;
}

/** Permintaan penawaran → pesanan pembelian (salin baris, harga dari penawaran pemasok). */
export async function rfqToPo(id: string): Promise<{ ok?: string; error?: string }> {
  const me = await requireModule("keuangan");
  const res = await guard(async () => {
    const db = await getDb();
    const r = await db.query.purchaseOrders.findFirst({ where: eq(schema.purchaseOrders.id, id) });
    if (!r || r.kind !== "rfq") throw new UserError("Permintaan penawaran tidak ditemukan.");
    const lines = await db.select().from(schema.purchaseOrderLines).where(eq(schema.purchaseOrderLines.orderId, id));
    const poId = crypto.randomUUID();
    const date = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const number = await nextNumber(db, "POB", date);
    await runBatch(db, [
      db.insert(schema.purchaseOrders).values({ id: poId, kind: "po", number, date, contactId: r.contactId, expectedDate: r.expectedDate, status: "draft", subtotal: r.subtotal, tax: r.tax, total: r.total, memo: r.memo, sourceId: r.id, createdBy: me.id }),
      ...insertMany(db, schema.purchaseOrderLines, lines.map((l) => ({ orderId: poId, itemId: l.itemId, description: l.description, qty: l.qty, unit: l.unit, price: l.price, amount: l.amount, sort: l.sort }))),
      db.update(schema.purchaseOrders).set({ status: "selesai", updatedAt: new Date() }).where(eq(schema.purchaseOrders.id, id)),
    ]);
    return { id: poId };
  });
  if ("error" in res) return res;
  redirect(`/akuntansi/pesanan-pembelian/${res.id}?ok=${encodeURIComponent("dibuat dari permintaan penawaran")}`);
}

export async function deletePurchaseOrder(id: string): Promise<{ ok?: string; error?: string }> {
  await requireModule("keuangan");
  const res = await guard(async () => {
    const db = await getDb();
    const r = await db.query.purchaseOrders.findFirst({ where: eq(schema.purchaseOrders.id, id) });
    if (!r) return { kind: "po" as PurchaseOrderKind };
    await runBatch(db, [db.delete(schema.purchaseOrderLines).where(eq(schema.purchaseOrderLines.orderId, id)), db.delete(schema.purchaseOrders).where(eq(schema.purchaseOrders.id, id))]);
    return { kind: r.kind };
  });
  if ("error" in res) return res;
  redirect(PATH(res.kind));
}
