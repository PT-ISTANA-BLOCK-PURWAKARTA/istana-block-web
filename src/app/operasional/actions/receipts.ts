"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import type { FormState } from "@/components/admin/FormMessage";
import { isOffice, parseWibLocal } from "@/components/ops/receipts/util";
import { getDb, schema } from "@/db";
import { deliveryModes, receiptCategories, receiptStatuses, type DeliveryMode, type ReceiptCategory, type ReceiptStatus } from "@/db/erp";
import { requirePerm } from "@/lib/auth";
import { guard, runBatch, UserError } from "@/lib/erp/server";
import { parseQty } from "@/lib/erp/util";
import { deleteImage, saveImage, UploadError } from "@/lib/media";
import { logActivity } from "@/lib/ops/activity";
import { requireShift } from "@/lib/ops/duty";
import { formatQuantity } from "@/lib/ops/shared/format";
import { MAX_RECEIPT_PHOTOS } from "@/lib/ops/shared/goods";
import { PRICE_LABELS, SPEED_LABELS, TIER_LABELS, type SandTier } from "@/lib/ops/shared/sand";

const r = schema.goodsReceipts;

/** Teks bebas: dipangkas, kosong → null. */
const text = (form: FormData, name: string, max = 80) => String(form.get(name) ?? "").trim().slice(0, max) || null;

function refresh() {
  for (const path of ["/operasional/barang-masuk", "/operasional/bahan-baku", "/operasional/uji-pasir"]) revalidatePath(path);
}

async function findReceipt(id: string) {
  const db = await getDb();
  const row = await db.query.goodsReceipts.findFirst({ where: eq(r.id, id) });
  if (!row) throw new UserError("Data barang masuk tidak ditemukan.");
  return { db, row };
}

/** Catat barang yang datang di gerbang (satpam; kantor boleh). TIDAK memposting stok (stok lewat Pembelian di /akuntansi). */
export async function createReceipt(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("barang_masuk");
  const uploaded: string[] = [];
  const res = await guard(async () => {
    await requireShift(me);
    const receivedAt = parseWibLocal(form.get("receivedAt"));
    if (!receivedAt) throw new UserError("Tanggal & jam datang tidak valid.");
    const category = String(form.get("category") ?? "") as ReceiptCategory;
    if (!receiptCategories.includes(category)) throw new UserError("Pilih jenis barang.");
    const itemName = String(form.get("itemName") ?? "").trim();
    if (itemName.length < 2 || itemName.length > 60) throw new UserError("Pilih atau tulis nama barang (2–60 huruf).");
    const quantity = parseQty(form.get("quantity"));
    if (!(quantity > 0) || quantity > 100_000) throw new UserError("Isi jumlah barang (lebih dari 0, maksimal 100.000).");
    const unit = String(form.get("unit") ?? "").trim().slice(0, 20);
    if (!unit) throw new UserError("Pilih satuan.");
    const modeRaw = String(form.get("deliveryMode") ?? "") as DeliveryMode;
    const deliveryMode = deliveryModes.includes(modeRaw) ? modeRaw : null;
    const expeditionName = deliveryMode === "ekspedisi" ? text(form, "expeditionName") : null;
    if (deliveryMode === "ekspedisi" && !expeditionName) throw new UserError("Isi nama ekspedisi.");
    const statusRaw = String(form.get("status") ?? "diterima") as ReceiptStatus;
    if (!receiptStatuses.includes(statusRaw)) throw new UserError("Status tidak valid.");
    const raw = category === "bahan_baku";

    const files = form.getAll("photos").filter((f): f is File => typeof f !== "string" && f.size > 0);
    if (files.length > MAX_RECEIPT_PHOTOS) throw new UserError(`Foto maksimal ${MAX_RECEIPT_PHOTOS}.`);
    for (const file of files) {
      try {
        const key = await saveImage(file, "penerimaan");
        if (key) uploaded.push(key);
      } catch (e) {
        if (e instanceof UploadError) throw new UserError(e.message);
        throw e;
      }
    }

    const id = crypto.randomUUID();
    const db = await getDb();
    try {
      await db.insert(r).values({
        id,
        receivedAt,
        category,
        itemName,
        tag: raw ? text(form, "tag") : null,
        supplier: text(form, "supplier"),
        quarry: raw ? text(form, "quarry") : null,
        quantity,
        unit,
        vehiclePlate: text(form, "vehiclePlate", 20)?.toUpperCase() ?? null,
        driverName: text(form, "driverName"),
        deliveryNoteNo: text(form, "deliveryNoteNo"),
        deliveryMode,
        expeditionName,
        hasBrangkal: raw ? form.get("hasBrangkal") === "ya" : null,
        status: statusRaw,
        photoKeys: uploaded,
        notes: text(form, "notes", 1000) ?? "",
        createdBy: me.id,
      });
    } catch (e) {
      await Promise.all(uploaded.map((key) => deleteImage(key)));
      throw e;
    }
    return { id, itemName, quantity, unit, raw };
  });
  if ("error" in res) {
    await Promise.all(uploaded.map((key) => deleteImage(key)));
    return res;
  }
  await logActivity(me, { action: "barang_masuk.catat", label: "Mencatat barang masuk", summary: `${res.itemName} ${formatQuantity(res.quantity)} ${res.unit}` });
  const message = `~${res.itemName} ${formatQuantity(res.quantity)} ${res.unit} tercatat.`;
  // `r` (id baru) membuat form dimuat ulang kosong setelah tersimpan; `uji` memunculkan tautan "Mulai uji lumpur".
  redirect(`/operasional/barang-masuk?ok=${encodeURIComponent(message)}&r=${res.id}${res.raw ? `&uji=${res.id}` : ""}`);
}

/** Hapus data yang salah input: kantor kapan saja, pembuat dalam 24 jam. Uji lumpur terkait ikut terhapus (satu batch). */
export async function deleteReceipt(id: string): Promise<FormState> {
  const me = await requirePerm("barang_masuk", "lihat_barang_masuk");
  const res = await guard(async () => {
    const { db, row } = await findReceipt(id);
    if (!isOffice(me.roles) && (row.createdBy !== me.id || Date.now() - row.createdAt.getTime() > 24 * 3600_000)) {
      throw new UserError("Hanya bisa dihapus pembuatnya dalam 24 jam, atau oleh kantor.");
    }
    const tests = await db
      .select({ start: schema.sandTests.startPhotoKey, photo: schema.sandTests.photoKey, status: schema.sandTests.status })
      .from(schema.sandTests)
      .where(eq(schema.sandTests.receiptId, id));
    // Uji lumpur yang sudah selesai adalah catatan mutu: pembuat non-kantor tidak boleh ikut menghapusnya.
    if (!isOffice(me.roles) && tests.some((t) => t.status === "selesai")) {
      throw new UserError("Data ini sudah punya uji lumpur yang selesai. Minta kantor (pemilik/operasional) untuk menghapusnya.");
    }
    await runBatch(db, [db.delete(schema.sandTests).where(eq(schema.sandTests.receiptId, id)), db.delete(r).where(eq(r.id, id))]);
    // Foto yatim dibersihkan setelah data terhapus (kegagalan di sini tidak boleh membatalkan hapus).
    const keys = [...row.photoKeys, ...tests.flatMap((t) => [t.start, t.photo])].filter((key): key is string => Boolean(key));
    await Promise.all(keys.map((key) => deleteImage(key).catch(() => undefined)));
    return row;
  });
  if ("error" in res) return res;
  await logActivity(me, { action: "barang_masuk.hapus", label: "Menghapus barang masuk", summary: `${res.itemName} ${formatQuantity(res.quantity)} ${res.unit}` });
  refresh();
  return { ok: "Data dihapus." };
}

/** QC (nilai_mutu): tier kualitas 1–4 + keterangan material/supplier, boleh meluruskan temuan brangkal. */
export async function rateQuality(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("nilai_mutu");
  const res = await guard(async () => {
    const tier = Number(form.get("tier"));
    if (!Number.isInteger(tier) || tier < 1 || tier > 4) throw new UserError("Pilih tier 1–4.");
    const { db, row } = await findReceipt(String(form.get("id") ?? ""));
    const brangkal = String(form.get("hasBrangkal") ?? "");
    await db
      .update(r)
      .set({
        tier,
        qualityNote: text(form, "qualityNote", 1000),
        ...(brangkal === "ya" || brangkal === "tidak" ? { hasBrangkal: brangkal === "ya" } : {}),
        qualityBy: me.id,
        qualityAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(r.id, row.id));
    return { row, tier: tier as SandTier };
  });
  if ("error" in res) return res;
  await logActivity(me, { action: "barang_masuk.nilai_mutu", label: "Menilai tier bahan baku", summary: `${res.row.itemName}: Tier ${res.tier} ${TIER_LABELS[res.tier]}` });
  refresh();
  return { ok: "Tier tersimpan." };
}

/** Kantor (nilai_kirim): pengirim, kecepatan, keterangan; boleh merapikan tag & jumlah untuk rekap inventory. */
export async function rateDelivery(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("nilai_kirim");
  const res = await guard(async () => {
    const modeRaw = String(form.get("deliveryMode") ?? "") as DeliveryMode;
    if (!deliveryModes.includes(modeRaw)) throw new UserError("Pilih siapa yang mengirim.");
    const expeditionName = modeRaw === "ekspedisi" ? text(form, "expeditionName") : null;
    if (modeRaw === "ekspedisi" && !expeditionName) throw new UserError("Isi nama ekspedisi.");
    const speed = Number(form.get("speedRating") || 0);
    if (!Number.isInteger(speed) || speed < 0 || speed > 3) throw new UserError("Kecepatan tidak valid.");
    const quantityText = String(form.get("quantity") ?? "").trim();
    const quantity = quantityText ? parseQty(quantityText) : null;
    if (quantity !== null && (!(quantity > 0) || quantity > 100_000)) throw new UserError("Jumlah harus angka lebih dari 0.");
    const unit = text(form, "unit", 20);
    const { db, row } = await findReceipt(String(form.get("id") ?? ""));
    await db
      .update(r)
      .set({
        deliveryMode: modeRaw,
        expeditionName,
        speedRating: speed || null,
        deliveryNote: text(form, "deliveryNote", 1000),
        tag: text(form, "tag"),
        ...(quantity ? { quantity } : {}),
        ...(unit ? { unit } : {}),
        deliveryBy: me.id,
        deliveryAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(r.id, row.id));
    return { row, speed };
  });
  if ("error" in res) return res;
  await logActivity(me, { action: "barang_masuk.nilai_kirim", label: "Menilai pengiriman bahan baku", summary: `${res.row.itemName}: ${res.speed ? SPEED_LABELS[res.speed] : "tanpa nilai kecepatan"}` });
  refresh();
  return { ok: "Penilaian pengiriman tersimpan." };
}

/** Pimpinan (nilai_harga): 1 Mahal / 2 Sedang / 3 Affordable + keterangan harga. */
export async function ratePrice(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("nilai_harga");
  const res = await guard(async () => {
    const rating = Number(form.get("priceRating"));
    if (!Number.isInteger(rating) || rating < 1 || rating > 3) throw new UserError("Pilih penilaian harga.");
    const { db, row } = await findReceipt(String(form.get("id") ?? ""));
    await db.update(r).set({ priceRating: rating, priceNote: text(form, "priceNote", 1000), priceBy: me.id, priceAt: new Date(), updatedAt: new Date() }).where(eq(r.id, row.id));
    return { row, rating };
  });
  if ("error" in res) return res;
  await logActivity(me, { action: "barang_masuk.nilai_harga", label: "Menilai harga bahan baku", summary: `${res.row.itemName}: ${PRICE_LABELS[res.rating]}` });
  refresh();
  return { ok: "Penilaian harga tersimpan." };
}
