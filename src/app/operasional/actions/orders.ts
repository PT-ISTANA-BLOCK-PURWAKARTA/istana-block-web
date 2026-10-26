"use server";

import { redirect } from "next/navigation";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { FormState } from "@/components/admin/FormMessage";
import { isPosted } from "@/components/ops/delivery/status";
import { getDb, schema } from "@/db";
import { requirePerm } from "@/lib/auth";
import { assertLive } from "@/lib/erp/archive";
import { docTotals } from "@/lib/erp/docs";
import { refreshOrderStatus, reopenStatus, SQL_OPEN } from "@/lib/erp/ops";
import { orderProgress } from "@/lib/erp/orders";
import { guard, insertMany, nextNumber, parseRows, requireDate, runBatch, UserError } from "@/lib/erp/server";
import { formatQty, isDate, parseQty, parseRupiah, today } from "@/lib/erp/util";
import { logActivity } from "@/lib/ops/activity";
import { notifyDriver } from "@/lib/ops/driverNotify";
import { notificationOp } from "@/lib/ops/notify";
import { findActiveOrdersByPhone, findCustomerByPhone, findInvoiceOrders, normPhone } from "@/lib/ops/orders";
import { hidePrices } from "@/lib/ops/shared/prices";
import { needsPaymentConfirmation, paymentStatus } from "@/lib/ops/shared/zahirInvoice";
import { can } from "@/lib/roles";

const EPS = 1e-9;
const text = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);

export async function saveOrder(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("pesanan");
  const res = await guard(async () => {
    const db = await getDb();
    const id = String(form.get("id") ?? "");
    const existing = id ? await db.query.orders.findFirst({ where: eq(schema.orders.id, id) }) : undefined;
    if (id && !existing) throw new UserError("Pesanan tidak ditemukan.");
    assertLive(existing?.id, "Pesanan");
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
    // Draf yang baru dikonfirmasi lewat formulir juga dihitung "PO baru".
    const becameConfirmed = status === "dikonfirmasi" && (!existing || existing.status === "draft");

    await runBatch(db, [
      existing ? db.update(schema.orders).set(header).where(eq(schema.orders.id, orderId)) : db.insert(schema.orders).values({ id: orderId, number, ...header, createdBy: me.id }),
      // PO baru yang sudah dikonfirmasi perlu diperiksa kantor/gudang (muncul di papan muatan & ringkasan).
      becameConfirmed ? notificationOp(db, "po_baru", orderId, "PO baru perlu diperiksa", `${number} · ${contact.name}`) : null,
      removed.length ? db.delete(schema.orderLines).where(inArray(schema.orderLines.id, removed)) : null,
      ...rows.map((l, i) => (progById.has(l.lineId) ? db.update(schema.orderLines).set(lineValues[i]).where(eq(schema.orderLines.id, l.lineId)) : null)),
      ...insertMany(db, schema.orderLines, lineValues.filter((_, i) => !progById.has(rows[i].lineId))),
    ]);
    if (existing) await refreshOrderStatus(db, orderId);
    await logActivity(me, { action: "pesanan.simpan", label: existing ? "Mengubah pesanan" : "Membuat pesanan", summary: `${number} · ${contact.name}` });
    return { id: orderId, number };
  });
  if ("error" in res) return res;
  redirect(`/operasional/pesanan/${res.id}?ok=${encodeURIComponent(res.number)}`);
}

/** Ubah status pesanan: konfirmasi, selesai (tutup sisa), atau buka kembali. Batal & hapus lewat cancelOrder / deleteOrder (wajib alasan). */
export async function setOrderStatus(id: string, to: "konfirmasi" | "selesai" | "buka"): Promise<FormState> {
  const me = await requirePerm("pesanan");
  const res = await guard(async () => {
    const db = await getDb();
    const o = await db.query.orders.findFirst({ where: eq(schema.orders.id, id) });
    if (!o) throw new UserError("Pesanan tidak ditemukan.");
    assertLive(o.id, "Pesanan");
    let status = o.status;
    const extra: unknown[] = [];
    if (to === "konfirmasi") {
      if (o.status !== "draft") throw new UserError("Hanya draf yang bisa dikonfirmasi.");
      status = "dikonfirmasi";
      const c = await db.query.contacts.findFirst({ where: eq(schema.contacts.id, o.contactId) });
      extra.push(notificationOp(db, "po_baru", o.id, "PO baru perlu diperiksa", `${o.number} · ${c?.name ?? ""}`));
    } else if (to === "selesai") {
      if (o.status === "draft" || o.status === "batal") throw new UserError("Pesanan draf/batal tidak bisa ditandai selesai.");
      const open = await db.get<{ n: number }>(sql`select count(*) n from ops_deliveries d where d.order_id = ${id} and ${sql.raw(SQL_OPEN)}`);
      if (Number(open?.n ?? 0) > 0) throw new UserError("Masih ada surat jalan yang dijadwalkan atau dalam perjalanan. Selesaikan atau batalkan dulu.");
      status = "selesai";
    } else {
      if (o.status !== "selesai" && o.status !== "batal") throw new UserError("Pesanan ini masih terbuka.");
      status = await reopenStatus(db, id);
      // Dibuka kembali dari batal: jejak pembatalan dibersihkan.
      if (o.status === "batal") extra.push(db.update(schema.orders).set({ cancelReason: null, cancelledBy: null, cancelledAt: null }).where(eq(schema.orders.id, id)));
    }
    await runBatch(db, [db.update(schema.orders).set({ status, updatedAt: new Date() }).where(eq(schema.orders.id, id)), ...extra]);
    await logActivity(me, { action: "pesanan.status", label: o_label(to), summary: o.number });
    return { ok: status };
  });
  if ("error" in res) return res;
  redirect(`/operasional/pesanan/${id}?ok=${encodeURIComponent(`~${o_label(to)}.`)}`);
}

function o_label(to: string) {
  return to === "konfirmasi" ? "Pesanan dikonfirmasi" : to === "selesai" ? "Pesanan ditutup" : "Pesanan dibuka kembali";
}

const reasonOf = (form: FormData, what: string) => {
  const reason = text(form, "reason", 500);
  if (reason.length < 3) throw new UserError(`Isi alasan ${what} (minimal 3 huruf).`);
  return reason;
};

/**
 * Batalkan pesanan dengan alasan (3-500). Ditolak bila sudah terkirim/selesai, atau ada surat jalan yang sudah
 * berangkat/terkirim (batalkan surat jalannya dulu di halaman pengiriman supaya stok & jurnal dikembalikan),
 * atau sudah difaktur. Surat jalan yang masih di gudang (dijadwalkan, dimuat, tertunda sebelum berangkat) ikut batal,
 * dan sopirnya diberi push "Dibatalkan".
 */
export async function cancelOrder(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("pesanan");
  const res = await guard(async () => {
    const db = await getDb();
    const id = String(form.get("id") ?? "");
    const reason = reasonOf(form, "pembatalan");
    const o = await db.query.orders.findFirst({ where: eq(schema.orders.id, id) });
    if (!o) throw new UserError("Pesanan tidak ditemukan.");
    assertLive(o.id, "Pesanan");
    if (o.status === "batal") throw new UserError("Pesanan ini sudah dibatalkan.");
    if (o.status === "terkirim" || o.status === "selesai") throw new UserError("Pesanan sudah terkirim atau ditutup, jadi tidak bisa dibatalkan.");
    const sjs = await db.select().from(schema.deliveries).where(eq(schema.deliveries.orderId, id));
    if (sjs.some((d) => d.status === "terkirim" || isPosted(d.status, d.departedAt))) {
      throw new UserError("Sebagian barang sudah berangkat atau terkirim. Batalkan surat jalannya dulu dari halaman pengiriman (stok dikembalikan), atau tandai pesanan selesai.");
    }
    const inv = await db.get<{ n: number }>(sql`select count(*) n from fin_invoices where order_id = ${id} and void = 0`);
    if (Number(inv?.n ?? 0) > 0) throw new UserError("Pesanan ini sudah difaktur. Hapus fakturnya dulu bila memang batal.");

    const contact = await db.query.contacts.findFirst({ where: eq(schema.contacts.id, o.contactId) });
    const now = new Date();
    const open = sjs.filter((d) => d.status !== "batal");
    await runBatch(db, [
      db.update(schema.orders).set({ status: "batal", cancelReason: reason, cancelledBy: me.id, cancelledAt: now, updatedAt: now }).where(eq(schema.orders.id, id)),
      ...open.flatMap((d) => [
        db.update(schema.deliveries).set({ status: "batal", note: [d.note, `Dibatalkan: ${reason}`].filter(Boolean).join("\n"), updatedAt: now }).where(eq(schema.deliveries.id, d.id)),
        db.insert(schema.deliveryHistory).values({ deliveryId: d.id, fromStatus: d.status, toStatus: "batal", changedBy: me.id, note: `Pesanan ${o.number} dibatalkan: ${reason}` }),
        notificationOp(db, "status_kirim", d.id, `${d.number} · Dibatalkan`, [contact?.name, reason].filter(Boolean).join(" · ")),
      ]),
      db.update(schema.notifications).set({ readAt: now }).where(and(eq(schema.notifications.kind, "po_baru"), eq(schema.notifications.refId, id), isNull(schema.notifications.readAt))),
    ]);
    for (const d of open) if (d.driverId) await notifyDriver(db, d.driverId, "dibatalkan", d.id, reason);
    await logActivity(me, { action: "pesanan.batal", label: "Membatalkan pesanan", summary: `${o.number}: ${reason}` });
    return { id };
  });
  if ("error" in res) return res;
  redirect(`/operasional/pesanan/${res.id}?ok=${encodeURIComponent("~Pesanan dibatalkan.")}`);
}

/**
 * Hapus pesanan dengan alasan (3-500). Hanya bila tidak ada surat jalan yang sudah terposting/terkirim, tidak ada
 * foto bukti, dan belum difaktur. Jejaknya (snapshot ringkas, tanpa harga) disimpan di ops_order_deletions dalam batch yang sama.
 */
export async function deleteOrder(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("pesanan");
  const res = await guard(async () => {
    const db = await getDb();
    const id = String(form.get("id") ?? "");
    const reason = reasonOf(form, "penghapusan");
    const o = await db.query.orders.findFirst({ where: eq(schema.orders.id, id) });
    if (!o) throw new UserError("Pesanan tidak ditemukan.");
    assertLive(o.id, "Pesanan");
    const sjs = await db.select().from(schema.deliveries).where(eq(schema.deliveries.orderId, id));
    if (sjs.some((d) => d.status === "terkirim" || isPosted(d.status, d.departedAt))) throw new UserError("Pesanan sudah punya surat jalan yang berangkat atau terkirim. Batalkan pesanan saja.");
    const sjIds = sjs.map((d) => d.id);
    const proofs = sjIds.length ? await db.get<{ n: number }>(sql`select count(*) n from ops_delivery_proofs where delivery_id in (${sql.join(sjIds.map((x) => sql`${x}`), sql`, `)})`) : { n: 0 };
    if (Number(proofs?.n ?? 0) > 0 || sjs.some((d) => d.proofKey)) throw new UserError("Pesanan punya foto bukti pengiriman, jadi tidak bisa dihapus. Batalkan pesanan saja.");
    const inv = await db.get<{ n: number }>(sql`select count(*) n from fin_invoices where order_id = ${id}`);
    if (Number(inv?.n ?? 0) > 0) throw new UserError("Pesanan sudah difaktur, tidak bisa dihapus.");

    const [contact, lines] = await Promise.all([
      db.query.contacts.findFirst({ where: eq(schema.contacts.id, o.contactId) }),
      db
        .select({ qty: schema.orderLines.qty, unit: schema.orderLines.unit, description: schema.orderLines.description, name: schema.items.name })
        .from(schema.orderLines)
        .leftJoin(schema.items, eq(schema.items.id, schema.orderLines.itemId))
        .where(eq(schema.orderLines.orderId, id))
        .orderBy(schema.orderLines.sort),
    ]);
    const snapshot = {
      date: o.date,
      status: o.status,
      customerRef: o.customerRef,
      externalRef: o.externalRef,
      paymentStatus: o.paymentStatus,
      project: o.project,
      address: o.address,
      requestedDate: o.requestedDate,
      note: o.note,
      createdBy: o.createdBy,
      lines: lines.map((l) => ({ name: l.name ?? l.description, qty: l.qty, unit: l.unit })),
      deliveries: sjs.map((d) => ({ number: d.number, status: d.status, date: d.date })),
    };
    // Sopir yang sudah ditugaskan diberi tahu sebelum datanya hilang.
    for (const d of sjs) if (d.driverId && d.status !== "batal") await notifyDriver(db, d.driverId, "dibatalkan", d.id, "Pesanan dihapus oleh kantor.");
    await runBatch(db, [
      db.insert(schema.orderDeletions).values({ orderId: id, number: o.number, customerName: contact?.name ?? "", customerPhone: contact?.phone ?? "", reason, snapshot, deletedBy: me.id }),
      sjIds.length ? db.delete(schema.deliveryLines).where(inArray(schema.deliveryLines.deliveryId, sjIds)) : null,
      sjIds.length ? db.delete(schema.deliveryHistory).where(inArray(schema.deliveryHistory.deliveryId, sjIds)) : null,
      sjIds.length ? db.delete(schema.trackingLinks).where(inArray(schema.trackingLinks.deliveryId, sjIds)) : null,
      sjIds.length ? db.delete(schema.notifications).where(and(inArray(schema.notifications.kind, ["status_kirim", "dimuat"]), inArray(schema.notifications.refId, sjIds))) : null,
      db.delete(schema.notifications).where(and(eq(schema.notifications.kind, "po_baru"), eq(schema.notifications.refId, id))),
      sjIds.length ? db.delete(schema.deliveries).where(eq(schema.deliveries.orderId, id)) : null,
      db.delete(schema.orderLines).where(eq(schema.orderLines.orderId, id)),
      db.delete(schema.orders).where(eq(schema.orders.id, id)),
    ]);
    await logActivity(me, { action: "pesanan.hapus", label: "Menghapus pesanan", summary: `${o.number}: ${reason}` });
    return { ok: "deleted" };
  });
  if ("error" in res) return res;
  redirect("/operasional/pesanan?ok=dihapus");
}

/* ------------------------------------------------------------------ impor Zahir (.fp3) */

/** Anti-dobel: PO yang sudah memakai nomor dokumen itu, dan PO aktif pelanggan dengan nomor HP yang sama. */
export async function checkInvoices(refs: string[], phones: string[]): Promise<{ byRef: Record<string, { id: string; number: string }>; byPhone: Record<string, { id: string; number: string; externalRef: string | null }[]> }> {
  await requirePerm("pesanan");
  const db = await getDb();
  const [hits, active] = await Promise.all([findInvoiceOrders(db, refs.slice(0, 90)), findActiveOrdersByPhone(db, phones.slice(0, 90))]);
  const byRef: Record<string, { id: string; number: string }> = {};
  for (const h of hits) byRef[h.externalRef] = { id: h.id, number: h.number };
  const byPhone: Record<string, { id: string; number: string; externalRef: string | null }[]> = {};
  for (const a of active) (byPhone[a.phone] ??= []).push({ id: a.id, number: a.number, externalRef: a.externalRef });
  return { byRef, byPhone };
}

const ImportSchema = z.object({
  externalRef: z.string().trim().min(1, "Nomor dokumen kosong.").max(60),
  kind: z.enum(["faktur", "surat_jalan"]),
  customerName: z.string().trim().min(2, "Nama pelanggan minimal 2 huruf.").max(120),
  customerPhone: z.string().trim().max(40).default(""),
  address: z.string().trim().min(5, "Alamat pengiriman minimal 5 huruf.").max(500),
  mapsUrl: z.string().trim().max(500).default(""),
  siteContact: z.string().trim().max(120).default(""),
  customerRef: z.string().trim().max(80).default(""),
  date: z.string().nullable().default(null),
  requestedDate: z.string().nullable().default(null),
  notes: z.string().trim().max(1000).default(""),
  items: z
    .array(
      z.object({
        name: z.string().trim().max(300),
        qty: z.number().nullable(),
        unit: z.string().trim().max(20).default(""),
        price: z.number().nullable().default(null),
        itemId: z.string().max(64).default(""),
      }),
    )
    .min(1, "Dokumen ini tidak punya barang.")
    .max(40),
  payment: z.object({ terms: z.string().nullable(), total: z.number().nullable(), downPayment: z.number().nullable(), balance: z.number().nullable() }),
  paymentConfirmed: z.boolean().default(false),
  driverId: z.string().max(64).default(""),
  vehicleId: z.string().max(64).default(""),
  deliveryDate: z.string().nullable().default(null),
});
export type ImportInput = z.input<typeof ImportSchema>;

/**
 * Buat satu PO dari satu dokumen Zahir (faktur atau surat jalan). Pelanggan dicari/dibuat lewat nomor HP; barang dicocokkan
 * ke Data barang lewat nama (atau pilihan kantor di pratinjau). Yang disimpan dari faktur HANYA status bayar (bukan nominal),
 * dan harga per baris hanya diisi dari faktur bila akun punya izin keuangan. Bila sopir dipilih, dibuat surat jalan
 * "dijadwalkan" untuk seluruh qty dan sopir diberi push tugas baru.
 */
export async function importFromInvoice(raw: ImportInput): Promise<{ error: string } | { id: string; number: string; deliveryNumber: string | null }> {
  const me = await requirePerm("pesanan");
  return guard(async () => {
    const p = ImportSchema.safeParse(raw);
    if (!p.success) throw new UserError(p.error.issues[0]?.message ?? "Data impor tidak valid.");
    const input = p.data;
    const db = await getDb();
    const ref = input.externalRef;
    if (input.kind === "surat_jalan" && !/^SJ/i.test(ref)) throw new UserError(`Nomor surat jalan harus diawali "SJ" (terbaca: ${ref}). Periksa file yang dipilih.`);

    // Anti-dobel (CONFLICT).
    const dup = (await findInvoiceOrders(db, [ref]))[0];
    if (dup) throw new UserError(`Dokumen ${ref} sudah pernah diimpor menjadi ${dup.number}.`);

    // Status bayar: hanya dari faktur; belum lunas / tidak terbaca wajib dikonfirmasi.
    const pay = input.kind === "faktur" ? paymentStatus(input.payment) : null;
    const confirmNeeded = pay !== null && needsPaymentConfirmation(pay);
    if (confirmNeeded && !input.paymentConfirmed) throw new UserError("Faktur ini belum lunas atau status bayarnya tidak terbaca. Centang konfirmasi pembayaran dulu sebelum membuat PO.");

    // Sopir & armada (opsional): butuh izin penjadwalan.
    const driverId = input.driverId || null;
    const vehicleId = input.vehicleId || null;
    if ((driverId || vehicleId) && !can(me.roles, "pengiriman")) throw new UserError("Akun Anda tidak boleh menugaskan sopir atau armada.");
    if (driverId) {
      const d = await db.query.drivers.findFirst({ where: eq(schema.drivers.id, driverId) });
      if (!d) throw new UserError("Sopir tidak ditemukan.");
      if (!d.active) throw new UserError(`Sopir ${d.name} sedang tidak tersedia (nonaktif).`);
    }
    if (vehicleId) {
      const v = await db.query.vehicles.findFirst({ where: eq(schema.vehicles.id, vehicleId) });
      if (!v) throw new UserError("Kendaraan tidak ditemukan.");
      if (!v.active) throw new UserError(`Kendaraan ${v.plate} sedang tidak aktif.`);
    }

    // Barang: pilihan eksplisit > nama sama (tanpa membedakan huruf besar/kecil) > barang jenis "lainnya" dengan nama Zahir di deskripsi.
    const catalog = (await db.select().from(schema.items).where(eq(schema.items.active, true))).sort((a, b) => a.code.localeCompare(b.code));
    const byId = new Map(catalog.map((i) => [i.id, i]));
    const byName = new Map<string, (typeof catalog)[number]>();
    for (const i of catalog) if (!byName.has(i.name.trim().toLowerCase())) byName.set(i.name.trim().toLowerCase(), i);
    const other = catalog.find((i) => i.kind === "lainnya");
    const canPrice = can(me.roles, "keuangan");
    const orderId = crypto.randomUUID();
    const lines = input.items.map((l, idx) => {
      const qty = parseQty(l.qty ?? 0);
      if (qty <= 0) throw new UserError(`Baris ${idx + 1} ("${l.name}"): jumlah tidak terbaca atau nol.`);
      const matched = (l.itemId && byId.get(l.itemId)) || byName.get(l.name.trim().toLowerCase()) || null;
      const item = matched ?? other;
      if (!item) throw new UserError(`Barang "${l.name}" belum ada di Data barang. Pilih barang yang sesuai di pratinjau, atau tambahkan dulu di Akuntansi › Data barang.`);
      return {
        id: crypto.randomUUID(),
        orderId,
        itemId: item.id,
        description: matched ? "" : l.name.slice(0, 300),
        qty,
        unit: (matched ? item.unit : l.unit) || item.unit,
        // Harga dari faktur hanya untuk keuangan; selain itu harga jual barang.
        price: canPrice && l.price != null && l.price >= 0 ? Math.round(l.price) : item.sellPrice,
        sort: idx,
      };
    });

    // Pelanggan: cari lewat nomor HP (bila tidak ada HP, lewat nama persis); kalau tidak ada, buat baru.
    const phone = normPhone(input.customerPhone);
    let contactId: string | null = null;
    if (phone) contactId = (await findCustomerByPhone(db, phone))?.id ?? null;
    else {
      const row = await db.get<{ id: string }>(sql`select id from fin_contacts where active = 1 and kind <> 'pemasok' and lower(name) = ${input.customerName.toLowerCase()} limit 1`);
      contactId = row?.id ?? null;
    }
    const newContactId = contactId ? null : crypto.randomUUID();
    const finalContactId = contactId ?? newContactId!;

    const date = input.date && isDate(input.date) ? input.date : today();
    const requestedDate = input.requestedDate && isDate(input.requestedDate) ? input.requestedDate : null;
    const mapsUrl = input.mapsUrl;
    if (mapsUrl && !/^https?:\/\//i.test(mapsUrl)) throw new UserError("Tautan peta harus diawali https://");
    const number = await nextNumber(db, "PO", date);
    const now = new Date();
    // Catatan terlihat sopir: tanpa nominal.
    const note = hidePrices(input.notes) ?? "";

    let deliveryId: string | null = null;
    let deliveryNumber: string | null = null;
    let sjDate = today();
    if (driverId) {
      sjDate = input.deliveryDate && isDate(input.deliveryDate) ? input.deliveryDate : today();
      deliveryId = crypto.randomUUID();
      deliveryNumber = await nextNumber(db, "SJ", sjDate);
    }

    await runBatch(db, [
      newContactId ? db.insert(schema.contacts).values({ id: newContactId, kind: "pelanggan", name: input.customerName, phone, address: input.address }) : null,
      db.insert(schema.orders).values({
        id: orderId,
        number,
        date,
        contactId: finalContactId,
        customerRef: input.customerRef,
        project: "",
        address: input.address,
        mapsUrl,
        siteContact: input.siteContact,
        requestedDate,
        status: "dikonfirmasi",
        ongkir: 0,
        discount: 0,
        taxable: false,
        note,
        externalRef: ref,
        paymentStatus: pay,
        paymentConfirmedBy: confirmNeeded ? me.id : null,
        paymentConfirmedAt: confirmNeeded ? now : null,
        createdBy: me.id,
      }),
      ...insertMany(db, schema.orderLines, lines),
      notificationOp(db, "po_baru", orderId, "PO baru perlu diperiksa", `${number} · ${input.customerName} · dari Zahir ${ref}`),
      deliveryId
        ? [
            db.insert(schema.deliveries).values({ id: deliveryId, number: deliveryNumber!, orderId, date: sjDate, vehicleId, driverId, status: "dijadwalkan", createdBy: me.id }),
            ...insertMany(db, schema.deliveryLines, lines.map((l) => ({ deliveryId: deliveryId!, orderLineId: l.id, itemId: l.itemId, qty: l.qty }))),
            db.insert(schema.deliveryHistory).values({ deliveryId, fromStatus: null, toStatus: "dijadwalkan", changedBy: me.id, note: `Surat jalan dijadwalkan dari impor Zahir ${ref}` }),
          ]
        : null,
    ]);
    if (deliveryId && driverId) await notifyDriver(db, driverId, "baru", deliveryId);
    await logActivity(me, { action: "pesanan.impor", label: "Impor pesanan dari Zahir", summary: `${number} dari ${ref}${deliveryNumber ? ` · ${deliveryNumber}` : ""}` });
    return { id: orderId, number, deliveryNumber };
  });
}
