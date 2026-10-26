"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { FormState } from "@/components/admin/FormMessage";
import { DRIVER_STEP_LABEL, FLOW_STEPS, STATUS_LABEL, STATUS_TITLE, driverBase, isPosted } from "@/components/ops/delivery/status";
import { getDb, schema } from "@/db";
import { MAX_DELIVERY_PROOFS, type DeliveryStatus } from "@/db/erp";
import { requirePerm, type CurrentUser } from "@/lib/auth";
import { can } from "@/lib/roles";
import { deleteImage, saveImage, UploadError } from "@/lib/media";
import { assertLive } from "@/lib/erp/archive";
import { postDeliveryOps, refreshOrderStatus, unpostDeliveryOps } from "@/lib/erp/ops";
import { orderProgress } from "@/lib/erp/orders";
import { assertOpen, getFinSettings, guard, insertMany, loadAccounts, nextNumber, parseRows, requireDate, runBatch, UserError, type DB } from "@/lib/erp/server";
import { formatQty, parseQty, today } from "@/lib/erp/util";
import { parseWibLocal } from "@/components/ops/receipts/util";
import { logActivity } from "@/lib/ops/activity";
import { deliveryProofKeys, newToken, proofRowCount, sha256Hex } from "@/lib/ops/deliveries";
import { requireShift } from "@/lib/ops/duty";
import { notifyDriver } from "@/lib/ops/driverNotify";
import { notificationOp } from "@/lib/ops/notify";

const EPS = 1e-9;

type DeliveryRow = typeof schema.deliveries.$inferSelect;

/** Alamat kembali yang diizinkan setelah aksi (papan muatan / pengiriman / tugas), supaya tidak jadi open-redirect. */
function backTarget(form: FormData, fallback: string) {
  const v = String(form.get("back") ?? "");
  return /^\/operasional\/(muatan|pengiriman|tugas)(\/[\w-]+)?(\?[\w=&%.~-]*)?$/.test(v) ? v : fallback;
}

/** Sopir yang dipilih harus ada dan aktif ("tersedia"); kendaraan harus ada dan aktif. Hanya diperiksa bila berubah. */
async function checkAssignees(db: DB, existing: Pick<DeliveryRow, "driverId" | "vehicleId"> | undefined, driverId: string | null, vehicleId: string | null) {
  if (vehicleId && vehicleId !== existing?.vehicleId) {
    const v = await db.query.vehicles.findFirst({ where: eq(schema.vehicles.id, vehicleId) });
    if (!v) throw new UserError("Kendaraan tidak ditemukan.");
    if (!v.active) throw new UserError(`Kendaraan ${v.plate} sedang tidak aktif.`);
  }
  if (driverId && driverId !== existing?.driverId) {
    const d = await db.query.drivers.findFirst({ where: eq(schema.drivers.id, driverId) });
    if (!d) throw new UserError("Sopir tidak ditemukan.");
    if (!d.active) throw new UserError(`Sopir ${d.name} sedang tidak tersedia (nonaktif). Pilih sopir lain.`);
  }
}

/** Jadwalkan (atau ubah jadwal) surat jalan dari sisa pesanan yang belum dijadwalkan. */
export async function saveDelivery(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("pengiriman");
  const res = await guard(async () => {
    const db = await getDb();
    const id = String(form.get("id") ?? "");
    const existing = id ? await db.query.deliveries.findFirst({ where: eq(schema.deliveries.id, id) }) : undefined;
    if (id && !existing) throw new UserError("Surat jalan tidak ditemukan.");
    assertLive(existing?.id, "Surat jalan");
    if (existing && existing.status !== "dijadwalkan") throw new UserError("Surat jalan yang sudah dimuat, berangkat, terkirim, atau batal tidak bisa diubah. Sopir dan armada masih bisa diganti dari halaman detail selama belum berangkat.");
    const orderId = existing?.orderId ?? String(form.get("orderId") ?? "");
    assertLive(orderId, "Pesanan");
    const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, orderId) });
    if (!order) throw new UserError("Pesanan tidak ditemukan.");
    if (order.status === "draft") throw new UserError("Konfirmasi pesanan dulu sebelum menjadwalkan pengiriman.");
    if (order.status === "batal" || order.status === "selesai") throw new UserError("Pesanan sudah ditutup.");
    const date = requireDate(form.get("date"), "Tanggal kirim");

    const vehicleId = String(form.get("vehicleId") ?? "") || null;
    const driverId = String(form.get("driverId") ?? "") || null;
    await checkAssignees(db, existing, driverId, vehicleId);

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
        : [
            db.insert(schema.deliveries).values({ id: deliveryId, number, orderId: order.id, status: "dijadwalkan", ...header, createdBy: me.id }),
            db.insert(schema.deliveryHistory).values({ deliveryId, fromStatus: null, toStatus: "dijadwalkan", changedBy: me.id, note: "Surat jalan dijadwalkan" }),
          ],
      ...insertMany(db, schema.deliveryLines, lines.map((l) => ({ ...l, deliveryId }))),
    ]);
    // Push ke sopir: tugas baru; bila sopir diganti, yang lama diberi tahu "dialihkan".
    if (driverId && driverId !== existing?.driverId) await notifyDriver(db, driverId, "baru", deliveryId);
    if (existing?.driverId && existing.driverId !== driverId) await notifyDriver(db, existing.driverId, "dialihkan", deliveryId);
    await logActivity(me, { action: "pengiriman.simpan", label: existing ? "Mengubah jadwal surat jalan" : "Menjadwalkan surat jalan", summary: number });
    return { id: deliveryId, number };
  });
  if ("error" in res) return res;
  redirect(`/operasional/pengiriman/${res.id}?ok=${encodeURIComponent(res.number)}`);
}

/** Ganti sopir/armada surat jalan yang belum berangkat (dijadwalkan atau sudah dimuat). */
export async function assignDelivery(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("pengiriman");
  const res = await guard(async () => {
    const db = await getDb();
    const d = await db.query.deliveries.findFirst({ where: eq(schema.deliveries.id, String(form.get("id") ?? "")) });
    if (!d) throw new UserError("Surat jalan tidak ditemukan.");
    assertLive(d.id, "Surat jalan");
    if (d.status !== "dijadwalkan" && d.status !== "dimuat") throw new UserError("Sopir dan armada hanya bisa diganti sebelum truk berangkat.");
    const vehicleId = String(form.get("vehicleId") ?? "") || null;
    const driverId = String(form.get("driverId") ?? "") || null;
    if (vehicleId === d.vehicleId && driverId === d.driverId) return { id: d.id };
    await checkAssignees(db, d, driverId, vehicleId);
    await runBatch(db, [
      db.update(schema.deliveries).set({ vehicleId, driverId, updatedAt: new Date() }).where(eq(schema.deliveries.id, d.id)),
      db.insert(schema.deliveryHistory).values({ deliveryId: d.id, fromStatus: d.status, toStatus: d.status, changedBy: me.id, note: "Sopir/armada diganti" }),
    ]);
    if (driverId && driverId !== d.driverId) await notifyDriver(db, driverId, "baru", d.id);
    if (d.driverId && d.driverId !== driverId) await notifyDriver(db, d.driverId, "dialihkan", d.id);
    await logActivity(me, { action: "pengiriman.tugaskan", label: "Mengganti sopir/armada surat jalan", summary: d.number });
    return { id: d.id };
  });
  if ("error" in res) return res;
  redirect(`/operasional/pengiriman/${res.id}?ok=${encodeURIComponent("~Sopir/armada diperbarui.")}`);
}

/** Tabel transisi status yang sah (kantor dengan izin pengiriman boleh semuanya; muat & antar dibatasi di bawah). */
const NEXT: Record<DeliveryStatus, DeliveryStatus[]> = {
  dijadwalkan: ["dimuat", "berangkat", "tertunda", "terkirim", "batal"],
  dimuat: ["dijadwalkan", "berangkat", "tertunda", "terkirim", "batal"],
  berangkat: ["dimuat", "dijadwalkan", "tiba", "tertunda", "terkirim", "batal"],
  tiba: ["berangkat", "dimuat", "dijadwalkan", "tertunda", "terkirim", "batal"],
  tertunda: ["dijadwalkan", "dimuat", "berangkat", "tiba", "terkirim", "batal"],
  terkirim: ["batal"],
  batal: ["dijadwalkan"],
};

type Opts = {
  receivedBy?: string;
  proof?: FormDataEntryValue | null;
  reason?: string;
  note?: string;
  date?: string;
  /** Kantor menyelesaikan lewat izin "selesaikan": lompat ke terkirim tanpa foto/nama penerima. */
  complete?: boolean;
};

type Result = { id: string; to: DeliveryStatus; noop?: boolean; code: string };

/**
 * Inti perubahan status. Mengisi waktu (loaded/departed/arrived/delivered), memposting atau membatalkan posting stok &
 * jurnal HPP (terposting bila departed_at terisi dan status bukan dijadwalkan/dimuat/batal), mencatat riwayat,
 * notifikasi kantor, jejak aktivitas, dan push ke sopir. `uploaded` mengumpulkan kunci R2 baru agar dibersihkan bila gagal.
 */
async function transition(me: CurrentUser, id: string, to: DeliveryStatus, o: Opts, uploaded: string[]): Promise<Result> {
  const db = await getDb();
  const d = await db.query.deliveries.findFirst({ where: eq(schema.deliveries.id, id) });
  if (!d) throw new UserError("Surat jalan tidak ditemukan.");
  assertLive(d.id, "Surat jalan");
  if (!(to in NEXT)) throw new UserError("Status tujuan tidak dikenal.");
  const from = d.status;

  // --- siapa boleh apa
  const office = o.complete ? can(me.roles, "selesaikan") : can(me.roles, "pengiriman");
  const loader = can(me.roles, "muat");
  const driver = !o.complete && can(me.roles, "antar") && !!me.driverId && d.driverId === me.driverId;
  if (!office && !loader && !driver) throw new UserError(can(me.roles, "antar") ? "Surat jalan ini bukan tugas Anda." : "Akun Anda tidak boleh mengubah status surat jalan.");
  if (to === from) return { id: d.id, to, noop: true, code: d.number }; // idempoten: tekan dua kali / antrean ulang

  let mode: "office" | "loader" | "driver";
  if (office) mode = "office";
  else if (loader && ((from === "dijadwalkan" && to === "dimuat") || (from === "dimuat" && to === "dijadwalkan"))) mode = "loader";
  else if (driver) mode = "driver";
  else throw new UserError("Akun Anda hanya bisa menandai barang sudah dimuat. Status lain diubah oleh bagian pengiriman.");

  if (mode === "driver") {
    if (from === "batal") throw new UserError("Surat jalan ini sudah dibatalkan oleh kantor.");
    const steps = FLOW_STEPS as readonly string[];
    const iTo = steps.indexOf(to);
    if (iTo < 1) throw new UserError("Sopir hanya bisa menandai sudah dimuat, berangkat, tiba, dan terkirim. Hubungi admin pengiriman untuk perubahan lain.");
    const base = driverBase(d);
    const iBase = steps.indexOf(base);
    const resume = from === "tertunda" && iTo === iBase; // lanjut setelah kantor mencatat tunda
    if (!resume) {
      if (iTo <= iBase) return { id: d.id, to, noop: true, code: d.number };
      if (iTo > iBase + 1) throw new UserError(base === "dijadwalkan" ? "Tekan Sudah dimuat terlebih dahulu." : `Ikuti urutan: tekan "${DRIVER_STEP_LABEL[steps[iBase + 1]]}" dulu.`);
    }
  }
  if (!NEXT[from].includes(to)) throw new UserError("Perubahan status ini tidak diizinkan.");
  // Satpam/mandor harus sedang piket untuk menandai "sudah dimuat".
  if (to === "dimuat") await requireShift(me);

  const reason = (o.reason ?? "").trim().slice(0, 300);
  if (to === "tertunda" && reason.length < 3) throw new UserError("Isi alasan tertunda (minimal 3 huruf).");

  // --- foto & penerima untuk terkirim
  let newProof: string | null = null;
  const file = o.proof && typeof o.proof !== "string" && o.proof.size > 0 ? o.proof : null;
  if (to === "terkirim") {
    if (file) {
      if ((await proofRowCount(db, d.id)) >= MAX_DELIVERY_PROOFS) throw new UserError(`Foto bukti maksimal ${MAX_DELIVERY_PROOFS} per surat jalan.`);
      try {
        newProof = await saveImage(file, "pengiriman");
      } catch (e) {
        if (e instanceof UploadError) throw new UserError(e.message);
        throw e;
      }
      if (newProof) uploaded.push(newProof);
    }
    if (mode === "driver") {
      if (!(o.receivedBy ?? "").trim()) throw new UserError("Isi nama penerima di lokasi.");
      const have = (await deliveryProofKeys(db, d.id, d.proofKey)).length + (newProof ? 1 : 0);
      if (have < 1) throw new UserError("Ambil foto bukti terima dulu (surat jalan bertanda tangan atau barang di lokasi).");
    }
  }

  // --- waktu kejadian
  const now = new Date();
  let { loadedAt, departedAt, arrivedAt, deliveredAt, delayReason, receivedBy } = d;
  switch (to) {
    case "dijadwalkan":
      loadedAt = departedAt = arrivedAt = deliveredAt = null;
      delayReason = null;
      receivedBy = "";
      break;
    case "dimuat":
      loadedAt ??= now;
      departedAt = arrivedAt = deliveredAt = null;
      delayReason = null;
      break;
    case "berangkat":
      loadedAt ??= now;
      departedAt ??= now;
      arrivedAt = deliveredAt = null;
      delayReason = null;
      break;
    case "tiba":
      loadedAt ??= now;
      departedAt ??= now;
      arrivedAt ??= now;
      deliveredAt = null;
      delayReason = null;
      break;
    case "tertunda":
      delayReason = reason;
      break;
    case "terkirim":
      loadedAt ??= now;
      departedAt ??= now;
      deliveredAt = now;
      delayReason = null;
      receivedBy = o.complete ? "" : (o.receivedBy ?? "").trim().slice(0, 120);
      break;
    case "batal":
      break;
  }

  // --- posting stok & jurnal
  const wasPosted = isPosted(from, d.departedAt);
  const willPost = isPosted(to, departedAt);
  let date = d.date;
  // Hari berangkat = tanggal surat jalan & stok keluar. Tanggal dari form hanya dipakai kantor; sopir/gudang selalu hari ini (WIB).
  if (!wasPosted && willPost) date = mode === "office" && o.date ? requireDate(o.date) : today();
  const fin = await getFinSettings(db);
  // Periode terkunci hanya diperiksa saat posting dicabut (tanggal lama) atau dibuat baru (tanggal baru); perubahan status lain tidak diblokir.
  if (wasPosted && !willPost) assertOpen(d.date, fin.lockDate, "Surat jalan");
  if (willPost && !wasPosted) assertOpen(date, fin.lockDate, "Surat jalan");

  if (from === "batal" && to === "dijadwalkan") {
    // Pastikan sisa pesanan masih cukup (bisa sudah dipakai surat jalan lain).
    const prog = new Map((await orderProgress(db, d.orderId)).map((p) => [p.id, p]));
    for (const l of await db.select().from(schema.deliveryLines).where(eq(schema.deliveryLines.deliveryId, d.id))) {
      const p = prog.get(l.orderLineId);
      if (!p || l.qty > p.qty - p.scheduled + EPS) throw new UserError(`Sisa pesanan "${p?.name ?? "barang"}" tidak cukup lagi untuk surat jalan ini. Buat surat jalan baru.`);
    }
    const ord = await db.query.orders.findFirst({ where: eq(schema.orders.id, d.orderId) });
    if (!ord || ord.status === "batal" || ord.status === "selesai" || ord.status === "draft") throw new UserError("Pesanan sudah ditutup; buka kembali pesanannya dulu.");
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

  const patch: Partial<typeof schema.deliveries.$inferInsert> = { status: to, date, loadedAt, departedAt, arrivedAt, deliveredAt, delayReason, receivedBy, updatedAt: now };
  if (to === "batal" && reason) patch.note = [d.note, `Dibatalkan: ${reason}`].filter(Boolean).join("\n");
  // Dijadwalkan ulang dari batal: bukti lama tidak berlaku lagi.
  let oldProofs: string[] = [];
  if (to === "dijadwalkan" && from === "batal") {
    oldProofs = await deliveryProofKeys(db, d.id, d.proofKey);
    patch.proofKey = null;
  }

  // --- catatan riwayat & notifikasi kantor
  const ctx = await db.get<{ customer: string; driver: string | null }>(
    sql`select c.name customer, dr.name driver from ops_orders o join fin_contacts c on c.id = o.contact_id left join ops_drivers dr on dr.id = ${d.driverId} where o.id = ${d.orderId}`,
  );
  const byDriver = mode === "driver";
  const histNote =
    o.complete ? `Diselesaikan dari kantor oleh ${me.name}${(o.note ?? "").trim() ? `: ${(o.note ?? "").trim().slice(0, 500)}` : ""}`
    : to === "dimuat" ? `Barang sudah dimuat (dikonfirmasi ${byDriver ? "sopir" : me.name})`
    : to === "tertunda" || to === "batal" ? reason
    : to === "terkirim" ? `Diterima oleh ${receivedBy || "—"}`
    : (o.note ?? "").trim().slice(0, 300);
  const notifTitle = `${d.number} · ${STATUS_TITLE[to]}`;
  const notifMsg = [ctx?.customer, ctx?.driver && `sopir ${ctx.driver}`, to === "tertunda" || to === "batal" ? reason : ""].filter(Boolean).join(" · ");
  // Notifikasi "PO baru perlu diperiksa" untuk PO ini selesai begitu surat jalan dimuat/berjalan/selesai/batal.
  const closesPoNotice = to !== "dijadwalkan" && to !== "tertunda";

  const acc = willPost && (!wasPosted || date !== d.date) ? await loadAccounts(db) : null;
  await runBatch(db, [
    db.update(schema.deliveries).set(patch).where(eq(schema.deliveries.id, d.id)),
    // Selalu hapus dulu sebelum memposting ulang: kalau tombol ditekan dua kali bersamaan,
    // hasil akhirnya tetap satu set stok keluar & satu jurnal (batch D1 berjalan berurutan).
    (wasPosted && !willPost) || (willPost && (!wasPosted || date !== d.date)) ? unpostDeliveryOps(db, d.id) : null,
    acc ? await postDeliveryOps(db, acc, { ...d, date }, me.id) : null,
    db.insert(schema.deliveryHistory).values({ deliveryId: d.id, fromStatus: from, toStatus: to, changedBy: me.id, changedByDriver: byDriver ? me.driverId : null, note: histNote }),
    notificationOp(db, to === "dimuat" ? "dimuat" : "status_kirim", d.id, notifTitle, notifMsg),
    closesPoNotice ? db.update(schema.notifications).set({ readAt: now }).where(and(eq(schema.notifications.kind, "po_baru"), eq(schema.notifications.refId, d.orderId), isNull(schema.notifications.readAt))) : null,
    newProof ? db.insert(schema.deliveryProofs).values({ deliveryId: d.id, kind: "photo", fileKey: newProof, originalName: file && typeof file !== "string" ? file.name.slice(0, 200) : "", createdBy: me.id, createdByDriver: byDriver ? me.driverId : null }) : null,
    oldProofs.length ? db.delete(schema.deliveryProofs).where(eq(schema.deliveryProofs.deliveryId, d.id)) : null,
  ]);
  for (const k of oldProofs) await deleteImage(k);
  await refreshOrderStatus(db, d.orderId);
  await logActivity(me, { action: o.complete ? "pengiriman.selesaikan" : "pengiriman.status", label: o.complete ? "Menyelesaikan pengiriman dari kantor" : "Mengubah status surat jalan", summary: `${d.number}: ${STATUS_LABEL[from]} → ${STATUS_LABEL[to]}` });
  if (to === "dimuat" && d.driverId && !byDriver) await notifyDriver(db, d.driverId, "dimuat", d.id);
  if (to === "batal" && d.driverId) await notifyDriver(db, d.driverId, "dibatalkan", d.id, reason);
  return { id: d.id, to, code: d.number };
}

function doneMessage(r: Result) {
  return r.noop ? `~Surat jalan sudah berstatus ${STATUS_LABEL[r.to].toLowerCase()}.` : `~Status surat jalan ${r.code}: ${STATUS_LABEL[r.to]}.`;
}

/**
 * Ubah status surat jalan (alur dijadwalkan → dimuat → berangkat → tiba → terkirim, plus tertunda & batal).
 * Kantor (izin "pengiriman") bebas; "muat" hanya dimuat/kembali; sopir hanya miliknya, berurutan & idempoten.
 */
export async function setDeliveryStatus(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("pengiriman", "muat", "antar");
  const uploaded: string[] = [];
  const res = await guard(() =>
    transition(me, String(form.get("id") ?? ""), String(form.get("to") ?? "") as DeliveryStatus, { receivedBy: String(form.get("receivedBy") ?? ""), proof: form.get("proof"), reason: String(form.get("reason") ?? ""), note: String(form.get("note") ?? ""), date: String(form.get("date") ?? "") || undefined }, uploaded),
  );
  if ("error" in res) {
    for (const k of uploaded) await deleteImage(k);
    return res;
  }
  const fallback = `/operasional/${can(me.roles, "lihat_ops") ? "pengiriman" : "tugas"}/${res.id}`;
  const target = backTarget(form, fallback);
  redirect(`${target}${target.includes("?") ? "&" : "?"}ok=${encodeURIComponent(doneMessage(res))}`);
}

/** Kantor menyelesaikan pengiriman (izin "selesaikan") dengan catatan: "Diselesaikan dari kantor oleh <nama>". */
export async function completeDelivery(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("selesaikan");
  const uploaded: string[] = [];
  const res = await guard(async () => {
    const note = String(form.get("note") ?? "");
    if (note.trim().length > 500) throw new UserError("Catatan maksimal 500 huruf.");
    return transition(me, String(form.get("id") ?? ""), "terkirim", { complete: true, note }, uploaded);
  });
  if ("error" in res) {
    for (const k of uploaded) await deleteImage(k);
    return res;
  }
  redirect(`${backTarget(form, `/operasional/pengiriman/${res.id}`)}?ok=${encodeURIComponent(doneMessage(res))}`);
}

/** Unggah satu foto bukti (maks 4 per surat jalan) oleh kantor atau sopir pemilik tugas. */
export async function uploadDeliveryProof(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("pengiriman", "antar");
  let key: string | null = null;
  const res = await guard(async () => {
    const db = await getDb();
    const d = await db.query.deliveries.findFirst({ where: eq(schema.deliveries.id, String(form.get("id") ?? "")) });
    if (!d) throw new UserError("Surat jalan tidak ditemukan.");
    assertLive(d.id, "Surat jalan");
    const office = can(me.roles, "pengiriman");
    if (!office && (!me.driverId || d.driverId !== me.driverId)) throw new UserError("Surat jalan ini bukan tugas Anda.");
    if (d.status === "batal") throw new UserError("Surat jalan sudah dibatalkan.");
    const file = form.get("proof");
    if (!file || typeof file === "string" || file.size === 0) throw new UserError("Pilih atau ambil fotonya dulu.");
    if ((await proofRowCount(db, d.id)) >= MAX_DELIVERY_PROOFS) throw new UserError(`Foto bukti maksimal ${MAX_DELIVERY_PROOFS} per surat jalan.`);
    try {
      key = await saveImage(file, "pengiriman");
    } catch (e) {
      if (e instanceof UploadError) throw new UserError(e.message);
      throw e;
    }
    if (!key) throw new UserError("Foto tidak terbaca.");
    await db.insert(schema.deliveryProofs).values({ deliveryId: d.id, kind: "photo", fileKey: key, originalName: file.name.slice(0, 200), createdBy: me.id, createdByDriver: office ? null : me.driverId });
    await logActivity(me, { action: "pengiriman.foto", label: "Mengunggah foto bukti pengiriman", summary: d.number });
    return { id: d.id };
  });
  if ("error" in res) {
    if (key) await deleteImage(key);
    return res;
  }
  revalidatePath(`/operasional/pengiriman/${res.id}`);
  revalidatePath(`/operasional/tugas/${res.id}`);
  return { ok: "Foto bukti tersimpan." };
}

/**
 * Buat tautan lacak publik. Token acak 24 byte (hex) hanya ditampilkan sekali; yang disimpan SHA-256-nya.
 * Mengembalikan path `/kiriman/<token>` (klien menambahkan origin). Setiap pemanggilan membuat tautan baru.
 */
export async function createTrackingLink(deliveryId: string): Promise<{ error?: string; path?: string }> {
  const me = await requirePerm("pengiriman");
  const res = await guard(async () => {
    const db = await getDb();
    const d = await db.query.deliveries.findFirst({ where: eq(schema.deliveries.id, deliveryId) });
    if (!d) throw new UserError("Surat jalan tidak ditemukan.");
    assertLive(d.id, "Surat jalan");
    if (d.status === "batal") throw new UserError("Surat jalan sudah dibatalkan; tautan lacak tidak dibuat.");
    const token = newToken();
    await db.insert(schema.trackingLinks).values({ deliveryId: d.id, tokenHash: await sha256Hex(token), createdBy: me.id });
    await logActivity(me, { action: "pengiriman.tautan", label: "Membuat tautan lacak pelanggan", summary: d.number });
    return { path: `/kiriman/${token}` };
  });
  return res;
}

/** Tandai notifikasi dibaca (maks 50 sekaligus). */
export async function markNotificationsRead(_prev: FormState, form: FormData): Promise<FormState> {
  await requirePerm("muat", "pengiriman");
  let ids: string[] = [];
  try {
    const x = JSON.parse(String(form.get("ids") ?? "[]"));
    ids = Array.isArray(x) ? x.filter((v): v is string => typeof v === "string").slice(0, 50) : [];
  } catch {
    ids = [];
  }
  if (!ids.length) return { ok: "Tidak ada notifikasi." };
  const db = await getDb();
  await db.update(schema.notifications).set({ readAt: new Date() }).where(and(inArray(schema.notifications.id, ids), isNull(schema.notifications.readAt)));
  revalidatePath("/operasional/muatan");
  return { ok: "Ditandai sudah dibaca." };
}

export async function deleteDelivery(id: string): Promise<FormState> {
  const me = await requirePerm("pengiriman");
  const res = await guard(async () => {
    const db = await getDb();
    const d = await db.query.deliveries.findFirst({ where: eq(schema.deliveries.id, id) });
    if (!d) return { orderId: "", keys: [] as string[] };
    assertLive(d.id, "Surat jalan");
    if (isPosted(d.status, d.departedAt) || d.status === "terkirim") throw new UserError("Surat jalan yang sudah berangkat/terkirim tidak bisa dihapus. Batalkan dulu.");
    const keys = await deliveryProofKeys(db, id, d.proofKey);
    if (d.driverId && d.status !== "batal") await notifyDriver(db, d.driverId, "dibatalkan", id, "Surat jalan dihapus oleh kantor.");
    await runBatch(db, [
      db.delete(schema.deliveryLines).where(eq(schema.deliveryLines.deliveryId, id)),
      db.delete(schema.deliveryHistory).where(eq(schema.deliveryHistory.deliveryId, id)),
      db.delete(schema.deliveryProofs).where(eq(schema.deliveryProofs.deliveryId, id)),
      db.delete(schema.trackingLinks).where(eq(schema.trackingLinks.deliveryId, id)),
      db.delete(schema.notifications).where(and(inArray(schema.notifications.kind, ["status_kirim", "dimuat"]), eq(schema.notifications.refId, id))),
      db.delete(schema.deliveries).where(eq(schema.deliveries.id, id)),
    ]);
    for (const k of keys) await deleteImage(k);
    await logActivity(me, { action: "pengiriman.hapus", label: "Menghapus surat jalan", summary: d.number });
    return { orderId: d.orderId, keys };
  });
  if ("error" in res) return res;
  redirect(res.orderId ? `/operasional/pesanan/${res.orderId}?ok=dihapus` : "/operasional/pengiriman?ok=dihapus");
}

/**
 * Batalkan status Selesai (terkirim -> tiba) atau Sampai (tiba -> berangkat): mundur SATU langkah, alasan wajib (min. 5 huruf),
 * tercatat di riwayat. Izin "selesaikan".
 *
 * Aman terhadap stok & jurnal: di web stok keluar + jurnal HPP diposting saat BERANGKAT (departed_at terisi dan status bukan
 * dijadwalkan/dimuat/batal, lihat isPosted). Kedua mundur ini tetap di status terposting dan departed_at tidak disentuh, jadi
 * postingan TIDAK dibalik/diulang. Hanya kolom waktu tiba/terkirim, penerima, dan status yang berubah. Pembatalan lebih jauh
 * (kembali ke jadwal / batal) tetap lewat tombol status biasa yang membalik posting dengan pemeriksaan faktur.
 */
export async function revertDeliveryStatus(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("selesaikan");
  const res = await guard(async () => {
    const db = await getDb();
    const d = await db.query.deliveries.findFirst({ where: eq(schema.deliveries.id, String(form.get("id") ?? "")) });
    if (!d) throw new UserError("Surat jalan tidak ditemukan.");
    assertLive(d.id, "Surat jalan");
    const reason = String(form.get("reason") ?? "").trim().slice(0, 300);
    if (reason.length < 5) throw new UserError("Tulis alasan pembatalan status (min. 5 huruf).");
    const from = d.status;
    const to: DeliveryStatus | null = from === "terkirim" ? "tiba" : from === "tiba" ? "berangkat" : null;
    if (!to) throw new UserError('Hanya status "Terkirim" (Selesai) atau "Tiba" (Sampai) yang bisa dibatalkan.');
    // Penjaga keselamatan stok: kedua sisi harus sama-sama terposting, dan jam berangkat harus ada.
    if (!d.departedAt || !isPosted(from, d.departedAt) || !isPosted(to, d.departedAt)) throw new UserError("Data surat jalan tidak lengkap (jam berangkat kosong); status tidak diubah.");
    const now = new Date();
    const patch: Partial<typeof schema.deliveries.$inferInsert> =
      from === "terkirim"
        ? { status: to, arrivedAt: d.arrivedAt ?? d.deliveredAt ?? now, deliveredAt: null, receivedBy: "", updatedAt: now }
        : { status: to, arrivedAt: null, deliveredAt: null, updatedAt: now };
    await runBatch(db, [
      db.update(schema.deliveries).set(patch).where(and(eq(schema.deliveries.id, d.id), eq(schema.deliveries.status, from))),
      db.insert(schema.deliveryHistory).values({ deliveryId: d.id, fromStatus: from, toStatus: to, changedBy: me.id, note: `Status ${from === "terkirim" ? "Selesai" : "Sampai"} dibatalkan oleh ${me.name}: ${reason}` }),
      notificationOp(db, "status_kirim", d.id, `${d.number} · ${STATUS_TITLE[to]}`, `Status ${STATUS_LABEL[from]} dibatalkan: ${reason}`),
    ]);
    await refreshOrderStatus(db, d.orderId);
    await logActivity(me, { action: "pengiriman.batal_status", label: "Membatalkan status surat jalan", summary: `${d.number}: ${STATUS_LABEL[from]} → ${STATUS_LABEL[to]} (${reason})` });
    return { id: d.id, to };
  });
  if ("error" in res) return res;
  revalidatePath(`/operasional/pengiriman/${res.id}`);
  revalidatePath("/operasional/pengiriman");
  revalidatePath(`/operasional/tugas/${res.id}`);
  return { ok: `Kembali ke status "${STATUS_LABEL[res.to]}".` };
}

/**
 * Koreksi jam tiba sebenarnya (mis. sopir lupa menekan Sampai): jam asli `arrived_at` tetap tersimpan; yang dipakai penilaian
 * ketepatan waktu adalah `arrival_corrected_at`. Alasan/bukti min. 10 huruf. Jam kosong = batalkan koreksi. Izin "selesaikan".
 */
export async function correctDeliveryArrival(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("selesaikan");
  const res = await guard(async () => {
    const db = await getDb();
    const d = await db.query.deliveries.findFirst({ where: eq(schema.deliveries.id, String(form.get("id") ?? "")) });
    if (!d) throw new UserError("Surat jalan tidak ditemukan.");
    assertLive(d.id, "Surat jalan");
    if (!d.arrivedAt && !d.deliveredAt) throw new UserError("Surat jalan ini belum tiba; belum ada jam tiba yang bisa dikoreksi.");
    const raw = String(form.get("arrivedAt") ?? "").trim();
    const now = new Date();
    if (!raw) {
      if (!d.arrivalCorrectedAt) throw new UserError("Belum ada koreksi yang dibatalkan.");
      await runBatch(db, [
        db.update(schema.deliveries).set({ arrivalCorrectedAt: null, arrivalCorrectedBy: null, arrivalCorrectionMadeAt: null, arrivalCorrectionReason: null, updatedAt: now }).where(eq(schema.deliveries.id, d.id)),
        db.insert(schema.deliveryHistory).values({ deliveryId: d.id, fromStatus: d.status, toStatus: d.status, changedBy: me.id, note: `Koreksi jam tiba dibatalkan oleh ${me.name}` }),
      ]);
      await logActivity(me, { action: "pengiriman.koreksi_tiba", label: "Membatalkan koreksi jam tiba", summary: d.number });
      return { id: d.id, cancelled: true };
    }
    const at = parseWibLocal(raw);
    if (!at) throw new UserError("Jam tiba sebenarnya tidak valid.");
    if (at.getTime() > now.getTime() + 5 * 60_000) throw new UserError("Jam tiba tidak boleh di masa depan.");
    if (d.departedAt && at.getTime() < d.departedAt.getTime() - 60_000) throw new UserError("Jam tiba tidak boleh sebelum jam berangkat.");
    const reason = String(form.get("reason") ?? "").trim().slice(0, 500);
    if (reason.length < 10) throw new UserError("Tulis alasan & bukti koreksi (min. 10 huruf).");
    const label = at.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    await runBatch(db, [
      db.update(schema.deliveries).set({ arrivalCorrectedAt: at, arrivalCorrectedBy: me.id, arrivalCorrectionMadeAt: now, arrivalCorrectionReason: reason, updatedAt: now }).where(eq(schema.deliveries.id, d.id)),
      db.insert(schema.deliveryHistory).values({ deliveryId: d.id, fromStatus: d.status, toStatus: d.status, changedBy: me.id, note: `Jam tiba dikoreksi ke ${label} oleh ${me.name}: ${reason}` }),
    ]);
    await logActivity(me, { action: "pengiriman.koreksi_tiba", label: "Mengoreksi jam tiba pengiriman", summary: `${d.number}: ${label} (${reason})` });
    return { id: d.id, cancelled: false };
  });
  if ("error" in res) return res;
  revalidatePath(`/operasional/pengiriman/${res.id}`);
  return { ok: res.cancelled ? "Koreksi jam tiba dibatalkan." : "Koreksi jam tiba tersimpan." };
}