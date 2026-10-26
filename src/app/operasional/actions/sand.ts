"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import type { FormState } from "@/components/admin/FormMessage";
import { isOffice, parseWibLocal } from "@/components/ops/receipts/util";
import { MAX_READING, readingOf, siltPercentOf } from "@/components/ops/sand/util";
import { getDb, schema } from "@/db";
import { MAX_SILT_PERCENT, readingUnits, sandDecisions, skipLevels, type ReadingUnit, type SandDecision, type SandEdit, type SkipLevel } from "@/db/erp";
import { requirePerm } from "@/lib/auth";
import { chunk, guard, runBatch, UserError } from "@/lib/erp/server";
import { deleteImage, saveImage, UploadError } from "@/lib/media";
import { logActivity } from "@/lib/ops/activity";
import { requireShift } from "@/lib/ops/duty";
import { formatQuantity } from "@/lib/ops/shared/format";
import { SKIP_LEVEL_LABELS } from "@/lib/ops/shared/sand";

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
        // Barang yang akhirnya diuji tidak lagi berstatus "dilewati".
        receiptId ? db.update(schema.goodsReceipts).set({ testSkippedAt: null, testSkipLevel: null, testSkipReason: null, testSkippedBy: null }).where(and(eq(schema.goodsReceipts.id, receiptId), isNotNull(schema.goodsReceipts.testSkippedAt))) : null,
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
  // Redirect dengan ok baru supaya flash lama (?ok=draft tersimpan) di URL tergantikan.
  redirect(`/operasional/uji-pasir?ok=${encodeURIComponent(`~Hasil uji tersimpan · kadar lumpur ${formatQuantity(res.percent)}%.`)}&u=${res.draft.id}`);
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

/* ============================================================ skip uji lumpur */

/** Lewati uji lumpur bahan baku (mis. pasir pantai): kondisi lumpur menurut pengamatan + alasan wajib. Tanpa data uji. */
export async function skipSandTest(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("uji_pasir");
  const res = await guard(async () => {
    await requireShift(me);
    const level = String(form.get("level") ?? "") as SkipLevel;
    if (!skipLevels.includes(level)) throw new UserError("Pilih kondisi lumpur: Tidak berlumpur / Lumpur sedikit / Lumpur sedang.");
    const reason = text(form, "reason", 300);
    if (!reason || reason.length < 3) throw new UserError("Tulis alasan skip uji lumpur (mis. pasir pantai).");
    const db = await getDb();
    const receipt = await db.query.goodsReceipts.findFirst({ where: eq(schema.goodsReceipts.id, String(form.get("receiptId") ?? "")) });
    if (!receipt) throw new UserError("Data barang masuk tidak ditemukan.");
    if (receipt.category !== "bahan_baku") throw new UserError("Hanya bahan baku yang diuji lumpur.");
    if (receipt.testSkippedAt) throw new UserError("Uji lumpur barang ini sudah dilewati.");
    const tests = await db.select({ id: t.id }).from(t).where(eq(t.receiptId, receipt.id)).limit(1);
    if (tests.length) throw new UserError("Barang ini sudah punya uji lumpur (draft atau selesai), tidak bisa dilewati.");
    await db
      .update(schema.goodsReceipts)
      .set({ testSkippedAt: new Date(), testSkipLevel: level, testSkipReason: reason, testSkippedBy: me.id, updatedAt: new Date() })
      .where(and(eq(schema.goodsReceipts.id, receipt.id), isNull(schema.goodsReceipts.testSkippedAt)));
    return { receipt, level, reason };
  });
  if ("error" in res) return res;
  await logActivity(me, { action: "uji_pasir.skip", label: "Melewati uji lumpur", summary: `${res.receipt.itemName}: ${SKIP_LEVEL_LABELS[res.level]} — ${res.reason}` });
  refresh();
  return { ok: "Uji lumpur dilewati." };
}

/** Batalkan skip: barang kembali ke daftar yang perlu diuji. */
export async function unskipSandTest(receiptId: string): Promise<FormState> {
  const me = await requirePerm("uji_pasir");
  const res = await guard(async () => {
    const db = await getDb();
    const receipt = await db.query.goodsReceipts.findFirst({ where: eq(schema.goodsReceipts.id, receiptId) });
    if (!receipt || !receipt.testSkippedAt) throw new UserError("Barang ini tidak dalam status dilewati.");
    await db
      .update(schema.goodsReceipts)
      .set({ testSkippedAt: null, testSkipLevel: null, testSkipReason: null, testSkippedBy: null, updatedAt: new Date() })
      .where(eq(schema.goodsReceipts.id, receipt.id));
    return receipt;
  });
  if ("error" in res) return res;
  await logActivity(me, { action: "uji_pasir.batal_skip", label: "Membatalkan skip uji lumpur", summary: res.itemName });
  refresh();
  return { ok: "Dikembalikan ke daftar yang perlu diuji." };
}

/* ============================================================ ubah hasil (dengan riwayat) */

/**
 * Ubah hasil uji yang sudah selesai. Nilai lama disimpan di riwayat (edit_history) beserta alasan (min. 5 huruf).
 * Boleh: kantor; atau QC / satpam (satpam hanya dalam 24 jam sejak selesai) selama Manager & Pimpinan belum TTD.
 * Setelah diubah ketiga TTD direset dan perlu diulang.
 */
export async function editSandResult(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("uji_pasir");
  const uploaded: string[] = [];
  const res = await guard(async () => {
    const db = await getDb();
    const row = await db.query.sandTests.findFirst({ where: eq(t.id, String(form.get("id") ?? "")) });
    if (!row) throw new UserError("Uji tidak ditemukan.");
    if (row.status !== "selesai") throw new UserError("Hanya uji yang sudah selesai yang bisa diubah hasilnya.");
    const signedAbove = Boolean(row.managerAckBy || row.leaderAckBy);
    const freshSatpam = me.roles.includes("satpam") && row.completedAt !== null && Date.now() - row.completedAt.getTime() < 24 * 3600_000;
    if (!isOffice(me.roles) && (signedAbove || !(me.roles.includes("qc") || freshSatpam))) {
      throw new UserError("Hasil ini tidak bisa Anda ubah (sudah ditandatangani Manager / Pimpinan, atau melewati batas waktu). Minta kantor.");
    }
    const reason = String(form.get("reason") ?? "").trim().slice(0, 300);
    if (reason.length < 5) throw new UserError("Tulis alasan perubahan (min. 5 huruf), mis. salah baca skala.");
    const unit = unitOf(form);
    const reading = readFrom(form, unit);
    const photoKey = await savePhoto(form, "resultPhoto", uploaded);
    const ackReset = Boolean(row.secretaryAckBy || row.managerAckBy || row.leaderAckBy);
    const entry: SandEdit = {
      at: Math.floor(Date.now() / 1000),
      by: me.id,
      reason,
      old: { readingUnit: row.readingUnit, sandHeight: row.sandHeight, siltHeight: row.siltHeight, siltPercent: row.siltPercent, decision: row.decision },
    };
    try {
      await runBatch(db, [
        db
          .update(t)
          .set({
            readingUnit: unit,
            sandHeight: reading.sand,
            siltHeight: reading.silt,
            siltPercent: reading.percent,
            decision: reading.decision,
            ...(photoKey ? { photoKey } : {}),
            editHistory: [...(row.editHistory ?? []), entry],
            secretaryAckBy: null, secretaryAckAt: null, managerAckBy: null, managerAckAt: null, leaderAckBy: null, leaderAckAt: null,
            updatedAt: new Date(),
          })
          .where(and(eq(t.id, row.id), eq(t.status, "selesai"))),
        syncReceipt(db, row.receiptId, reading.decision),
      ]);
    } catch (e) {
      await Promise.all(uploaded.map((key) => deleteImage(key)));
      throw e;
    }
    if (photoKey && row.photoKey) await deleteImage(row.photoKey).catch(() => undefined);
    return { row, percent: reading.percent, ackReset };
  });
  if ("error" in res) {
    await Promise.all(uploaded.map((key) => deleteImage(key)));
    return res;
  }
  await logActivity(me, { action: "uji_pasir.ubah_hasil", label: "Mengubah hasil uji lumpur", summary: `${res.row.sandType}: ${formatQuantity(res.row.siltPercent ?? 0)}% → ${formatQuantity(res.percent)}%` });
  refresh();
  return { ok: `Hasil diubah · kadar lumpur ${formatQuantity(res.percent)}%${res.ackReset ? " · tanda tangan perlu diulang" : ""}.` };
}

/* ============================================================ TTD bertingkat */

const ACK_LEVELS = {
  sekretaris: { perm: "ttd_sekretaris", label: "Sekretaris" },
  manager: { perm: "setujui_qc", label: "Manager in charge" },
  pimpinan: { perm: "ttd_pimpinan", label: "Pimpinan" },
} as const;
export type AckLevel = keyof typeof ACK_LEVELS;

/**
 * Tanda tangan massal "Mengetahui" pada hasil uji yang sudah selesai. Bertingkat: Sekretaris dulu, lalu Manager
 * (butuh TTD Sekretaris), lalu Pimpinan (butuh TTD Manager). Baris yang belum memenuhi syarat dilewati.
 */
export async function ackSandTests(level: AckLevel, ids: string[]): Promise<FormState> {
  const cfg = ACK_LEVELS[level];
  if (!cfg) return { error: "Tingkat tanda tangan tidak dikenal." };
  const me = await requirePerm(cfg.perm);
  const res = await guard(async () => {
    if (!Array.isArray(ids) || !ids.length) throw new UserError("Tidak ada hasil uji yang dipilih.");
    const db = await getDb();
    const by = level === "sekretaris" ? t.secretaryAckBy : level === "manager" ? t.managerAckBy : t.leaderAckBy;
    const prerequisite = level === "sekretaris" ? undefined : level === "manager" ? isNotNull(t.secretaryAckBy) : isNotNull(t.managerAckBy);
    const eligible: string[] = [];
    for (const part of chunk([...new Set(ids.map(String))].slice(0, 2000), 90)) {
      const rows = await db.select({ id: t.id }).from(t).where(and(inArray(t.id, part), eq(t.status, "selesai"), isNull(by), prerequisite));
      eligible.push(...rows.map((row) => row.id));
    }
    if (!eligible.length) {
      throw new UserError(
        level === "sekretaris" ? "Tidak ada hasil uji yang menunggu TTD Sekretaris." : `Tidak ada hasil uji yang siap: TTD ${level === "manager" ? "Sekretaris" : "Manager"} harus ada lebih dulu.`,
      );
    }
    const now = new Date();
    const set =
      level === "sekretaris" ? { secretaryAckBy: me.id, secretaryAckAt: now } : level === "manager" ? { managerAckBy: me.id, managerAckAt: now } : { leaderAckBy: me.id, leaderAckAt: now };
    await runBatch(db, chunk(eligible, 90).map((part) => db.update(t).set({ ...set, updatedAt: now }).where(and(inArray(t.id, part), isNull(by)))));
    return { count: eligible.length };
  });
  if ("error" in res) return res;
  await logActivity(me, { action: "uji_pasir.ttd", label: `TTD ${cfg.label} uji lumpur`, summary: `${res.count} hasil uji` });
  refresh();
  return { ok: `${res.count} hasil uji ditandatangani sebagai ${cfg.label}.` };
}