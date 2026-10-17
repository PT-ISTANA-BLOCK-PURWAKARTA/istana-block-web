"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import type { FormState } from "@/components/admin/FormMessage";
import { getDb, schema } from "@/db";
import type { DeliveryStatus } from "@/db/erp";
import { requireModule } from "@/lib/auth";
import { deleteImage, saveImage, UploadError } from "@/lib/media";
import { POSTED, postDeliveryOps, refreshOrderStatus, unpostDeliveryOps } from "@/lib/erp/ops";
import { orderProgress } from "@/lib/erp/orders";
import { assertOpen, getFinSettings, guard, insertMany, loadAccounts, nextNumber, parseRows, requireDate, runBatch, UserError } from "@/lib/erp/server";
import { formatQty, parseQty, today } from "@/lib/erp/util";

const EPS = 1e-9;

/** Jadwalkan (atau ubah jadwal) surat jalan dari sisa pesanan yang belum dijadwalkan. */
export async function saveDelivery(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireModule("operasional");
  const res = await guard(async () => {
    const db = await getDb();
    const id = String(form.get("id") ?? "");
    const existing = id ? await db.query.deliveries.findFirst({ where: eq(schema.deliveries.id, id) }) : undefined;
    if (id && !existing) throw new UserError("Surat jalan tidak ditemukan.");
    if (existing && existing.status !== "dijadwalkan") throw new UserError("Surat jalan yang sudah berangkat, terkirim, atau batal tidak bisa diubah.");
    const orderId = existing?.orderId ?? String(form.get("orderId") ?? "");
    const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, orderId) });
    if (!order) throw new UserError("Pesanan tidak ditemukan.");
    if (order.status === "draft") throw new UserError("Konfirmasi pesanan dulu sebelum menjadwalkan pengiriman.");
    if (order.status === "batal" || order.status === "selesai") throw new UserError("Pesanan sudah ditutup.");
    const date = requireDate(form.get("date"), "Tanggal kirim");

    const vehicleId = String(form.get("vehicleId") ?? "") || null;
    const driverId = String(form.get("driverId") ?? "") || null;
    if (vehicleId && !(await db.query.vehicles.findFirst({ where: eq(schema.vehicles.id, vehicleId) }))) throw new UserError("Kendaraan tidak ditemukan.");
    if (driverId && !(await db.query.drivers.findFirst({ where: eq(schema.drivers.id, driverId) }))) throw new UserError("Sopir tidak ditemukan.");

    const prog = await orderProgress(db, order.id);
    const own = existing ? await db.select().from(schema.deliveryLines).where(eq(schema.deliveryLines.deliveryId, existing.id)) : [];
    const ownQty = new Map<string, number>();
    for (const l of own) ownQty.set(l.orderLineId, (ownQty.get(l.orderLineId) ?? 0) + l.qty);
    const want = new Map(parseRows(form.get("lines")).map((r) => [String(r.orderLineId ?? ""), parseQty(r.qty)]));
    const lines: { orderLineId: string; itemId: string; qty: number }[] = [];
    for (const p of prog) {
      const qty = want.get(p.id) ?? 0;
      if (qty < 0) throw new UserError(`Qty "${p.name}" tidak boleh negatif.`);
      if (qty <= EPS) continue;
      const left = p.qty - p.scheduled + (ownQty.get(p.id) ?? 0);
      if (qty > left + EPS) throw new UserError(`Qty "${p.name}" melebihi sisa pesanan (${formatQty(left)} ${p.unit}).`);
      lines.push({ orderLineId: p.id, itemId: p.itemId, qty });
    }
    if (!lines.length) throw new UserError("Isi qty minimal satu barang yang dikirim.");

    const deliveryId = existing?.id ?? crypto.randomUUID();
    const number = existing?.number ?? (await nextNumber(db, "SJ", date));
    const header = { date, vehicleId, driverId, note: String(form.get("note") ?? "").trim().slice(0, 1000), updatedAt: new Date() };
    await runBatch(db, [
      existing
        ? [db.update(schema.deliveries).set(header).where(eq(schema.deliveries.id, deliveryId)), db.delete(schema.deliveryLines).where(eq(schema.deliveryLines.deliveryId, deliveryId))]
        : db.insert(schema.deliveries).values({ id: deliveryId, number, orderId: order.id, status: "dijadwalkan", ...header, createdBy: me.id }),
      ...insertMany(db, schema.deliveryLines, lines.map((l) => ({ ...l, deliveryId }))),
    ]);
    return { id: deliveryId, number };
  });
  if ("error" in res) return res;
  redirect(`/operasional/pengiriman/${res.id}?ok=${encodeURIComponent(res.number)}`);
}

const NEXT: Record<DeliveryStatus, DeliveryStatus[]> = {
  dijadwalkan: ["berangkat", "terkirim", "batal"],
  berangkat: ["terkirim", "dijadwalkan", "batal"],
  terkirim: ["batal"],
  batal: ["dijadwalkan"],
};

/**
 * Ubah status surat jalan. Berangkat/terkirim = stok keluar + jurnal HPP (tanggal surat jalan ikut hari berangkat);
 * kembali ke dijadwalkan/batal = stok & jurnal dihapus.
 */
export async function setDeliveryStatus(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireModule("operasional");
  let uploaded: string | null = null;
  const res = await guard(async () => {
    const db = await getDb();
    const d = await db.query.deliveries.findFirst({ where: eq(schema.deliveries.id, String(form.get("id") ?? "")) });
    if (!d) throw new UserError("Surat jalan tidak ditemukan.");
    const to = String(form.get("to") ?? "") as DeliveryStatus;
    if (!NEXT[d.status]?.includes(to)) throw new UserError("Perubahan status ini tidak diizinkan.");
    const fin = await getFinSettings(db);
    const wasPosted = POSTED.includes(d.status);
    const willPost = POSTED.includes(to);

    // Hari berangkat menjadi tanggal surat jalan (dan tanggal stok keluar).
    let date = d.date;
    if (!wasPosted && willPost) {
      const t = today();
      date = String(form.get("date") ?? "") ? requireDate(form.get("date")) : t;
    }
    if (wasPosted) assertOpen(d.date, fin.lockDate, "Surat jalan");
    if (willPost) assertOpen(date, fin.lockDate, "Surat jalan");

    if (to === "dijadwalkan" && d.status === "batal") {
      // Pastikan sisa pesanan masih cukup (bisa sudah dipakai surat jalan lain).
      const prog = new Map((await orderProgress(db, d.orderId)).map((p) => [p.id, p]));
      for (const l of await db.select().from(schema.deliveryLines).where(eq(schema.deliveryLines.deliveryId, d.id))) {
        const p = prog.get(l.orderLineId);
        if (!p || l.qty > p.qty - p.scheduled + EPS) throw new UserError(`Sisa pesanan "${p?.name ?? "barang"}" tidak cukup lagi untuk surat jalan ini. Buat surat jalan baru.`);
      }
      const o = await db.query.orders.findFirst({ where: eq(schema.orders.id, d.orderId) });
      if (!o || o.status === "batal" || o.status === "selesai" || o.status === "draft") throw new UserError("Pesanan sudah ditutup; buka kembali pesanannya dulu.");
    }

    if (wasPosted && !willPost) {
      // Barang yang sudah difaktur tidak boleh "kembali ke gudang" tanpa faktur dikoreksi dulu.
      const own = await db.select().from(schema.deliveryLines).where(eq(schema.deliveryLines.deliveryId, d.id));
      const prog = new Map((await orderProgress(db, d.orderId)).map((p) => [p.id, p]));
      for (const l of own) {
        const p = prog.get(l.orderLineId);
        if (p && p.invoiced > p.shipped - l.qty + EPS && p.invoiced > EPS) {
          throw new UserError(`"${p.name}" dari surat jalan ini sudah difaktur. Koreksi atau hapus fakturnya dulu sebelum membatalkan pengiriman.`);
        }
      }
    }

    const now = new Date();
    const patch: Partial<typeof schema.deliveries.$inferInsert> = { status: to, date, updatedAt: now };
    if (to === "berangkat") patch.departedAt = d.departedAt ?? now;
    if (to === "terkirim") {
      patch.departedAt = d.departedAt ?? now;
      patch.deliveredAt = now;
      patch.receivedBy = String(form.get("receivedBy") ?? "").trim().slice(0, 120);
      try {
        uploaded = await saveImage(form.get("proof"), "pengiriman");
      } catch (e) {
        if (e instanceof UploadError) throw new UserError(e.message);
        throw e;
      }
      if (uploaded) patch.proofKey = uploaded;
    }
    if (to === "dijadwalkan") {
      // Kembali ke jadwal: data perjalanan & bukti terima sebelumnya tidak berlaku lagi.
      patch.departedAt = null;
      patch.deliveredAt = null;
      patch.receivedBy = "";
      patch.proofKey = null;
    }
    if (to === "batal" && String(form.get("reason") ?? "").trim()) {
      patch.note = [d.note, `Dibatalkan: ${String(form.get("reason")).trim().slice(0, 300)}`].filter(Boolean).join("\n");
    }

    const acc = await loadAccounts(db);
    await runBatch(db, [
      db.update(schema.deliveries).set(patch).where(eq(schema.deliveries.id, d.id)),
      // Selalu hapus dulu sebelum memposting ulang: kalau tombol terkirim dua kali bersamaan,
      // hasil akhirnya tetap satu set stok keluar & satu jurnal (batch D1 berjalan berurutan).
      (wasPosted && !willPost) || (willPost && (!wasPosted || date !== d.date)) ? unpostDeliveryOps(db, d.id) : null,
      willPost && (!wasPosted || date !== d.date) ? await postDeliveryOps(db, acc, { ...d, date }, me.id) : null,
    ]);
    if (d.proofKey && (to === "dijadwalkan" || (uploaded && d.proofKey !== uploaded))) await deleteImage(d.proofKey);
    await refreshOrderStatus(db, d.orderId);
    return { id: d.id, to };
  });
  if ("error" in res) {
    if (uploaded) await deleteImage(uploaded);
    return res;
  }
  const label: Record<string, string> = { berangkat: "Berangkat", terkirim: "Terkirim", batal: "Dibatalkan", dijadwalkan: "Dijadwalkan ulang" };
  redirect(`/operasional/pengiriman/${res.id}?ok=${encodeURIComponent(`~Status surat jalan: ${label[res.to]}.`)}`);
}

export async function deleteDelivery(id: string): Promise<FormState> {
  await requireModule("operasional");
  const res = await guard(async () => {
    const db = await getDb();
    const d = await db.query.deliveries.findFirst({ where: eq(schema.deliveries.id, id) });
    if (!d) return { orderId: "" };
    if (POSTED.includes(d.status)) throw new UserError("Surat jalan yang sudah berangkat/terkirim tidak bisa dihapus. Batalkan dulu.");
    await runBatch(db, [db.delete(schema.deliveryLines).where(eq(schema.deliveryLines.deliveryId, id)), db.delete(schema.deliveries).where(eq(schema.deliveries.id, id))]);
    if (d.proofKey) await deleteImage(d.proofKey);
    return { orderId: d.orderId };
  });
  if ("error" in res) return res;
  redirect(res.orderId ? `/operasional/pesanan/${res.orderId}?ok=dihapus` : "/operasional/pengiriman?ok=dihapus");
}
