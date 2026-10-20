"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import type { FormState } from "@/components/admin/FormMessage";
import { parseWibLocal } from "@/components/ops/receipts/util";
import { MAX_READING, readingOf, siltPercentOf } from "@/components/ops/sand/util";
import { getDb, schema } from "@/db";
import { MAX_SILT_PERCENT, readingUnits, sandDecisions, type ReadingUnit, type SandDecision } from "@/db/erp";
import { requirePerm } from "@/lib/auth";
import { guard, runBatch, UserError } from "@/lib/erp/server";
import { deleteImage, saveImage, UploadError } from "@/lib/media";
import { logActivity } from "@/lib/ops/activity";
import { requireShift } from "@/lib/ops/duty";
import { formatQuantity } from "@/lib/ops/shared/format";

const t = schema.sandTests;

const text = (form: FormData, name: string, max = 80) => String(form.get(name) ?? "").trim().slice(0, max) || null;

function refresh() {
  for (const path of ["/operasional/uji-pasir", "/operasional/barang-masuk", "/operasional/bahan-baku"]) revalidatePath(path);
}

/** Satu foto dari isian file (kosong → null). Kegagalan unggah → UserError. */
async function savePhoto(form: FormData, name: string, uploaded: string[]) {
  const file = form.get(name);
  if (!file || typeof file === "string" || file.size === 0) return null;
  try {
    const key = await saveImage(file, "uji-pasir");
    if (key) uploaded.push(key);
    return key;
  } catch (e) {
    if (e instanceof UploadError) throw new UserError(e.message);
    throw e;
  }
}

function unitOf(form: FormData): ReadingUnit {
  const raw = String(form.get("readingUnit") ?? "ml") as ReadingUnit;
  return readingUnits.includes(raw) ? raw : "ml";
}

/** Validasi pembacaan endapan dan hitung kadar lumpur. Melempar UserError berpesan Indonesia. */
function readFrom(form: FormData, unit: ReadingUnit) {
  const r = readingOf(unit, String(form.get("sandTop") ?? ""), String(form.get("siltTop") ?? ""), String(form.get("decision") ?? ""));
  if (r.invalid) throw new UserError("Skala batas atas lumpur harus lebih besar dari batas atas pasir.");
  if (r.sand === undefined || r.sand <= 0) throw new UserError("Endapan pasir harus lebih dari 0.");
  if (r.silt === undefined) throw new UserError("Isi pembacaan endapan lumpur.");
  if (r.sand > MAX_READING || r.silt > MAX_READING) throw new UserError(`Pembacaan maksimal ${MAX_READING}.`);
  if (!sandDecisions.includes(r.decision as SandDecision)) throw new UserError("Pilih keputusan: diterima, diterima bersyarat, atau ditolak.");
  return { sand: r.sand, silt: r.silt, percent: siltPercentOf(r.sand, r.silt), decision: r.decision as SandDecision };
}

/** Keputusan uji ikut menentukan status barang masuk (ditolak = muatan dikembalikan). */
const syncReceipt = (db: Awaited<ReturnType<typeof getDb>>, receiptId: string | null, decision: SandDecision) =>
  receiptId ? db.update(schema.goodsReceipts).set({ status: decision === "ditolak" ? "ditolak" : "diterima", updatedAt: new Date() }).where(eq(schema.goodsReceipts.id, receiptId)) : null;

/**
 * Mulai uji: sampel diambil, gelas/botol dikocok, lalu diendapkan (draft + foto awal).
 * Bila "isi hasil sekarang" dicentang, pembacaan diisi dan uji langsung selesai.
 */
export async function startSandTest(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("uji_pasir");
  const uploaded: string[] = [];
  const res = await guard(async () => {
    await requireShift(me);
    const testedAt = parseWibLocal(form.get("testedAt"));
    if (!testedAt) throw new UserError("Waktu sampel diambil tidak valid.");
    const unit = unitOf(form);
    const db = await getDb();

    const target = String(form.get("receiptId") ?? "");
    let receiptId: string | null = null;
    let sandType: string;
    let supplier: string | null = null;
    let quarry: string | null = null;
    if (target && target !== "manual") {
      const receipt = await db.query.goodsReceipts.findFirst({ where: eq(schema.goodsReceipts.id, target) });
      if (!receipt) throw new UserError("Data barang masuk tidak ditemukan.");
      receiptId = receipt.id;
      sandType = receipt.itemName;
    } else if (target === "manual") {
      sandType = String(form.get("sandType") ?? "").trim();
      if (sandType.length < 2 || sandType.length > 60) throw new UserError("Pilih jenis material.");
      supplier = text(form, "supplier");
      quarry = text(form, "quarry");
    } else {
      throw new UserError('Pilih barang masuk yang diuji (atau "Tanpa data barang masuk").');
    }

    const done = form.get("now") === "1";
    const reading = done ? readFrom(form, unit) : null;
    const startPhotoKey = await savePhoto(form, "startPhoto", uploaded);
    if (!done && !startPhotoKey) throw new UserError("Ambil foto gelas/botol yang sudah diisi & dikocok.");
    const photoKey = done ? await savePhoto(form, "resultPhoto", uploaded) : null;

    const id = crypto.randomUUID();
    try {
      await runBatch(db, [
        db.insert(t).values({
          id,
          receiptId,
          status: reading ? "selesai" : "draft",
          testedAt,
          completedAt: reading ? new Date() : null,
          supplier,
          quarry,
          sandType,
          readingUnit: unit,
          sandHeight: reading?.sand ?? null,
          siltHeight: reading?.silt ?? null,
          siltPercent: reading?.percent ?? null,
          maxSiltPercent: MAX_SILT_PERCENT,
          decision: reading?.decision ?? null,
          startPhotoKey,
          photoKey,
          notes: text(form, "notes", 1000) ?? "",
          createdBy: me.id,
          completedBy: reading ? me.id : null,
        }),
        reading ? syncReceipt(db, receiptId, reading.decision) : null,
      ]);
    } catch (e) {
      await Promise.all(uploaded.map((key) => deleteImage(key)));
      throw e;
    }
    return { id, sandType, percent: reading?.percent ?? null };
  });
  if ("error" in res) {
    await Promise.all(uploaded.map((key) => deleteImage(key)));
    return res;
  }
  await logActivity(me, {
    action: res.percent === null ? "uji_pasir.mulai" : "uji_pasir.selesai",
    label: res.percent === null ? "Memulai uji lumpur pasir" : "Menyimpan hasil uji lumpur pasir",
    summary: res.percent === null ? res.sandType : `${res.sandType}: lumpur ${formatQuantity(res.percent)}%`,
  });
  const message = res.percent === null ? "~Draft tersimpan — sampel sedang mengendap." : `~Hasil uji tersimpan · kadar lumpur ${formatQuantity(res.percent)}%.`;
  redirect(`/operasional/uji-pasir?ok=${encodeURIComponent(message)}&u=${res.id}`);
}

/** Selesaikan draft setelah mengendap: pembacaan, foto akhir, keputusan. Hanya akun yang memulainya. */
export async function completeSandTest(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("uji_pasir");
  const uploaded: string[] = [];
  const res = await guard(async () => {
    await requireShift(me);
    const db = await getDb();
    const draft = await db.query.sandTests.findFirst({ where: eq(t.id, String(form.get("id") ?? "")) });
    if (!draft) throw new UserError("Uji tidak ditemukan.");
    if (draft.status !== "draft") throw new UserError("Uji ini sudah selesai.");
    if (draft.createdBy !== me.id) throw new UserError("Uji ini dimulai dari akun lain.");
    const unit = unitOf(form);
    const reading = readFrom(form, unit);
    const photoKey = await savePhoto(form, "resultPhoto", uploaded);
    try {
      await runBatch(db, [
        db
          .update(t)
          .set({
            status: "selesai",
            readingUnit: unit,
            sandHeight: reading.sand,
            siltHeight: reading.silt,
            siltPercent: reading.percent,
            decision: reading.decision,
            completedAt: new Date(),
            completedBy: me.id,
            photoKey,
            notes: text(form, "notes", 1000) ?? draft.notes,
            updatedAt: new Date(),
          })
          // Hanya bila masih draft: dua kali tekan tidak menyelesaikan ganda.
          .where(and(eq(t.id, draft.id), eq(t.status, "draft"))),
        syncReceipt(db, draft.receiptId, reading.decision),
      ]);
    } catch (e) {
      await Promise.all(uploaded.map((key) => deleteImage(key)));
      throw e;
    }
    return { draft, percent: reading.percent };
  });
  if ("error" in res) {
    await Promise.all(uploaded.map((key) => deleteImage(key)));
    return res;
  }
  await logActivity(me, { action: "uji_pasir.selesai", label: "Menyimpan hasil uji lumpur pasir", summary: `${res.draft.sandType}: lumpur ${formatQuantity(res.percent)}%` });
  refresh();
  return { ok: `Hasil uji tersimpan · kadar lumpur ${formatQuantity(res.percent)}%.` };
}

/** Hapus draft milik akun sendiri (uji yang sudah selesai tidak bisa dihapus dari sini). */
export async function deleteSandDraft(id: string): Promise<FormState> {
  const me = await requirePerm("uji_pasir");
  const res = await guard(async () => {
    const db = await getDb();
    const row = await db.query.sandTests.findFirst({ where: eq(t.id, id) });
    if (!row || row.status !== "draft" || row.createdBy !== me.id) throw new UserError("Hanya draft milik akun ini yang bisa dihapus.");
    await db.delete(t).where(and(eq(t.id, id), eq(t.status, "draft")));
    if (row.startPhotoKey) await deleteImage(row.startPhotoKey).catch(() => undefined);
    return row;
  });
  if ("error" in res) return res;
  await logActivity(me, { action: "uji_pasir.hapus_draft", label: "Menghapus draft uji lumpur", summary: res.sandType });
  refresh();
  return { ok: "Draft dihapus." };
}
