"use server";

import { redirect } from "next/navigation";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import type { FormState } from "@/components/admin/FormMessage";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { docTotals } from "@/lib/erp/docs";
import { refreshOrderStatus, reopenStatus } from "@/lib/erp/ops";
import { orderProgress } from "@/lib/erp/orders";
import { guard, insertMany, nextNumber, parseRows, requireDate, runBatch, UserError } from "@/lib/erp/server";
import { formatQty, parseQty, parseRupiah } from "@/lib/erp/util";

const EPS = 1e-9;
const text = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);

export async function saveOrder(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireModule("operasional");
  const res = await guard(async () => {
    const db = await getDb();
    const id = String(form.get("id") ?? "");
    const existing = id ? await db.query.orders.findFirst({ where: eq(schema.orders.id, id) }) : undefined;
    if (id && !existing) throw new UserError("Pesanan tidak ditemukan.");
    if (existing && (existing.status === "batal" || existing.status === "selesai")) throw new UserError("Pesanan yang sudah selesai atau batal tidak bisa diubah. Buka kembali dulu.");

    const contact = await db.query.contacts.findFirst({ where: eq(schema.contacts.id, String(form.get("contactId") ?? "")) });
    if (!contact || contact.kind === "pemasok") throw new UserError("Pilih pelanggan.");
    if (existing && contact.id !== existing.contactId) {
      const inv = await db.get<{ n: number }>(sql`select count(*) n from fin_invoices where order_id = ${existing.id}`);
      if (Number(inv?.n ?? 0) > 0) throw new UserError("Pesanan ini sudah difaktur, jadi pelanggannya tidak bisa diganti.");
    }
    const date = requireDate(form.get("date"), "Tanggal pesanan");
    const rq = String(form.get("requestedDate") ?? "");
    const requestedDate = rq ? requireDate(rq, "Tanggal kirim diminta") : null;
    const mapsUrl = text(form, "mapsUrl", 500);
    if (mapsUrl && !/^https?:\/\//i.test(mapsUrl)) throw new UserError("Tautan peta harus diawali https://");

    const rows = parseRows(form.get("lines"))
      .map((r) => {
        const ref = String(r.ref ?? "");
        return {
          itemId: ref.startsWith("item:") ? ref.slice(5) : "",
          description: String(r.description ?? "").trim().slice(0, 300),
          qty: parseQty(r.qty),
          unit: String(r.unit ?? "").trim().slice(0, 20),
          price: parseRupiah(r.price),
          lineId: String(r.orderLineId ?? ""),
        };
      })
      .filter((l) => l.itemId || l.qty || l.price);
    if (!rows.length) throw new UserError("Isi minimal satu barang.");
    const items = new Map((await db.select().from(schema.items).where(inArray(schema.items.id, rows.map((r) => r.itemId).filter(Boolean)))).map((i) => [i.id, i]));
    for (const [i, l] of rows.entries()) {
      if (!items.has(l.itemId)) throw new UserError(`Baris ${i + 1}: pilih barang.`);
      if (l.qty <= 0) throw new UserError(`Baris ${i + 1}: qty harus lebih dari 0.`);
      if (l.price < 0) throw new UserError(`Baris ${i + 1}: harga tidak boleh negatif.`);
    }

    // Baris yang sudah dijadwalkan kirim/difaktur tidak boleh hilang atau dikurangi di bawah yang sudah berjalan.
    const prog = existing ? await orderProgress(db, existing.id) : [];
    const progById = new Map(prog.map((p) => [p.id, p]));
    const keepIds = new Set(rows.map((r) => r.lineId).filter((x) => progById.has(x)));
    for (const p of prog) {
      if (!keepIds.has(p.id) && (p.scheduled > EPS || p.invoiced > EPS)) throw new UserError(`Baris "${p.name}" sudah dijadwalkan kirim atau difaktur, jadi tidak bisa dihapus.`);
    }
    for (const l of rows) {
      const p = progById.get(l.lineId);
      if (!p) continue;
      const used = Math.max(p.scheduled, p.invoiced);
      if (l.qty + EPS < used) throw new UserError(`Qty "${p.name}" tidak boleh kurang dari ${formatQty(used)} ${p.unit} yang sudah dijadwalkan/difaktur.`);
      if (l.itemId !== p.itemId && p.scheduled > EPS) throw new UserError(`Barang pada baris "${p.name}" tidak bisa diganti karena sudah dijadwalkan kirim.`);
    }

    const t = docTotals(rows, { discount: parseRupiah(form.get("discount")), ongkir: parseRupiah(form.get("ongkir")) });
    const intent = String(form.get("intent") ?? "");
    const status = existing ? (existing.status === "draft" && intent === "konfirmasi" ? "dikonfirmasi" : existing.status) : intent === "draft" ? "draft" : "dikonfirmasi";
    const orderId = existing?.id ?? crypto.randomUUID();
    const number = existing?.number ?? (await nextNumber(db, "PO", date));
    const header = {
      date,
      contactId: contact.id,
      customerRef: text(form, "customerRef", 80),
      project: text(form, "project", 200),
      address: text(form, "address", 500),
      mapsUrl,
      siteContact: text(form, "siteContact", 120),
      requestedDate,
      status,
      ongkir: t.ongkir,
      discount: t.discount,
      taxable: form.get("taxable") === "on",
      note: text(form, "note", 1000),
      updatedAt: new Date(),
    };
    const lineValues = rows.map((l, sort) => ({ orderId, itemId: l.itemId, description: l.description, qty: l.qty, unit: l.unit || items.get(l.itemId)?.unit || "", price: l.price, sort }));
    const removed = prog.filter((p) => !keepIds.has(p.id)).map((p) => p.id);

    await runBatch(db, [
      existing ? db.update(schema.orders).set(header).where(eq(schema.orders.id, orderId)) : db.insert(schema.orders).values({ id: orderId, number, ...header, createdBy: me.id }),
      removed.length ? db.delete(schema.orderLines).where(inArray(schema.orderLines.id, removed)) : null,
      ...rows.map((l, i) => (progById.has(l.lineId) ? db.update(schema.orderLines).set(lineValues[i]).where(eq(schema.orderLines.id, l.lineId)) : null)),
      ...insertMany(db, schema.orderLines, lineValues.filter((_, i) => !progById.has(rows[i].lineId))),
    ]);
    if (existing) await refreshOrderStatus(db, orderId);
    return { id: orderId, number };
  });
  if ("error" in res) return res;
  redirect(`/operasional/pesanan/${res.id}?ok=${encodeURIComponent(res.number)}`);
}

/** Ubah status pesanan: konfirmasi, selesai (tutup sisa), batal, atau buka kembali. */
export async function setOrderStatus(id: string, to: "konfirmasi" | "selesai" | "batal" | "buka"): Promise<FormState> {
  await requireModule("operasional");
  const res = await guard(async () => {
    const db = await getDb();
    const o = await db.query.orders.findFirst({ where: eq(schema.orders.id, id) });
    if (!o) throw new UserError("Pesanan tidak ditemukan.");
    const open = await db.get<{ n: number }>(sql`select count(*) n from ops_deliveries where order_id = ${id} and status in ('dijadwalkan','berangkat')`);
    let status = o.status;
    if (to === "konfirmasi") {
      if (o.status !== "draft") throw new UserError("Hanya draf yang bisa dikonfirmasi.");
      status = "dikonfirmasi";
    } else if (to === "selesai") {
      if (o.status === "draft" || o.status === "batal") throw new UserError("Pesanan draf/batal tidak bisa ditandai selesai.");
      if (Number(open?.n ?? 0) > 0) throw new UserError("Masih ada surat jalan yang dijadwalkan atau dalam perjalanan. Selesaikan atau batalkan dulu.");
      status = "selesai";
    } else if (to === "batal") {
      const shipped = await db.get<{ n: number }>(sql`select count(*) n from ops_deliveries where order_id = ${id} and status in ('berangkat','terkirim')`);
      if (Number(shipped?.n ?? 0) > 0) throw new UserError("Sebagian barang sudah dikirim. Tandai pesanan sebagai selesai, bukan batal.");
      const inv = await db.get<{ n: number }>(sql`select count(*) n from fin_invoices where order_id = ${id} and void = 0`);
      if (Number(inv?.n ?? 0) > 0) throw new UserError("Pesanan ini sudah difaktur. Hapus fakturnya dulu bila memang batal.");
      await db.update(schema.deliveries).set({ status: "batal", updatedAt: new Date() }).where(and(eq(schema.deliveries.orderId, id), eq(schema.deliveries.status, "dijadwalkan")));
      status = "batal";
    } else {
      if (o.status !== "selesai" && o.status !== "batal") throw new UserError("Pesanan ini masih terbuka.");
      status = await reopenStatus(db, id);
    }
    await db.update(schema.orders).set({ status, updatedAt: new Date() }).where(eq(schema.orders.id, id));
    return { ok: status };
  });
  if ("error" in res) return res;
  redirect(`/operasional/pesanan/${id}?ok=${encodeURIComponent(`~${o_label(to)}.`)}`);
}

function o_label(to: string) {
  return to === "konfirmasi" ? "Pesanan dikonfirmasi" : to === "selesai" ? "Pesanan ditutup" : to === "batal" ? "Pesanan dibatalkan" : "Pesanan dibuka kembali";
}

export async function deleteOrder(id: string): Promise<FormState> {
  await requireModule("operasional");
  const res = await guard(async () => {
    const db = await getDb();
    const used = await db.get<{ d: number; i: number }>(sql`
      select (select count(*) from ops_deliveries where order_id = ${id} and status <> 'batal') d,
             (select count(*) from fin_invoices where order_id = ${id}) i`);
    if (Number(used?.d ?? 0) > 0) throw new UserError("Pesanan sudah punya surat jalan. Batalkan pesanan saja.");
    if (Number(used?.i ?? 0) > 0) throw new UserError("Pesanan sudah difaktur, tidak bisa dihapus.");
    const dead = db.select({ id: schema.deliveries.id }).from(schema.deliveries).where(eq(schema.deliveries.orderId, id));
    await runBatch(db, [
      db.delete(schema.deliveryLines).where(inArray(schema.deliveryLines.deliveryId, dead)),
      db.delete(schema.deliveries).where(and(eq(schema.deliveries.orderId, id), ne(schema.deliveries.status, "berangkat"), ne(schema.deliveries.status, "terkirim"))),
      db.delete(schema.orderLines).where(eq(schema.orderLines.orderId, id)),
      db.delete(schema.orders).where(eq(schema.orders.id, id)),
    ]);
    return { ok: "deleted" };
  });
  if ("error" in res) return res;
  redirect("/operasional/pesanan?ok=dihapus");
}
