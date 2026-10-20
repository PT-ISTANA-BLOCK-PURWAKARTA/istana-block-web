"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, ne } from "drizzle-orm";
import type { FormState } from "@/components/admin/FormMessage";
import { weekRange } from "@/components/ops/qc/labels";
import { getDb, schema } from "@/db";
import { checkStatuses, mixLayers, type CheckStatus, type MaterialLine, type MixLayer } from "@/db/erp";
import { requirePerm, type CurrentUser } from "@/lib/auth";
import { chunk, guard, insertMany, runBatch, UserError, type DB } from "@/lib/erp/server";
import { isDate, parseQty, today } from "@/lib/erp/util";
import { deleteImage, saveImage, UploadError } from "@/lib/media";
import { logActivity } from "@/lib/ops/activity";
import { qcCan } from "@/lib/ops/qc";

/* ============================================================ pembantu */

/** Muat ulang halaman QC & lencana menu setelah aksi baris (ACC, revisi, hapus, dst.). */
function refresh() {
  revalidatePath("/operasional", "layout");
}

function text(form: FormData, key: string, label: string, min: number, max: number) {
  const v = String(form.get(key) ?? "").trim();
  if (v.length < min) throw new UserError(min <= 1 ? `Isi ${label}.` : `${label} minimal ${min} huruf.`);
  if (v.length > max) throw new UserError(`${label} maksimal ${max} huruf.`);
  return v;
}

function optText(form: FormData, key: string, label: string, max = 1000) {
  const v = String(form.get(key) ?? "").trim();
  if (v.length > max) throw new UserError(`${label} maksimal ${max} huruf.`);
  return v;
}

function oneOf<T extends string>(v: unknown, list: readonly T[], label: string): T {
  if (!list.includes(v as T)) throw new UserError(`${label} tidak valid.`);
  return v as T;
}

/** Angka opsional (kosong = null). Koma desimal diterima; negatif ditolak. */
function optNumber(v: unknown, label: string): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = parseQty(s);
  if (!Number.isFinite(n) || n < 0) throw new UserError(`${label} tidak valid.`);
  return n;
}

function optDate(v: unknown, label: string): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (!isDate(s)) throw new UserError(`${label} tidak valid.`);
  return s;
}

/** JSON baris bahan dari input tersembunyi: baris tanpa nama dibuang, maks 20 baris. */
function materials(raw: FormDataEntryValue | null, label: string, min = 0): MaterialLine[] {
  let data: unknown;
  try {
    data = JSON.parse(String(raw ?? "[]"));
  } catch {
    data = [];
  }
  const rows = (Array.isArray(data) ? data : []).filter((r): r is Record<string, unknown> => !!r && typeof r === "object" && String((r as { name?: unknown }).name ?? "").trim() !== "");
  if (rows.length > 20) throw new UserError(`${label}: maksimal 20 bahan.`);
  const out = rows.map((r, i) => {
    const name = String(r.name).trim();
    const unit = String(r.unit ?? "").trim();
    const qty = r.qty === null || r.qty === undefined || r.qty === "" ? null : Number(r.qty);
    if (name.length > 60) throw new UserError(`${label} baris ${i + 1}: nama bahan maksimal 60 huruf.`);
    if (unit.length > 20) throw new UserError(`${label} baris ${i + 1}: satuan maksimal 20 huruf.`);
    if (qty !== null && (!Number.isFinite(qty) || qty < 0)) throw new UserError(`${label} baris ${i + 1}: jumlah tidak valid.`);
    return { name, qty, unit };
  });
  if (out.length < min) throw new UserError(`${label}: isi minimal ${min} bahan.`);
  return out;
}

function rowsOf(raw: FormDataEntryValue | null): Record<string, unknown>[] {
  try {
    const x = JSON.parse(String(raw ?? "[]"));
    return Array.isArray(x) ? x.filter((r) => r && typeof r === "object") : [];
  } catch {
    return [];
  }
}

function noteArg(note: string | undefined, label: string, min: number, max = 500) {
  const v = (note ?? "").trim();
  if (v.length < min) throw new UserError(min <= 1 ? `Isi ${label}.` : `${label} minimal ${min} huruf.`);
  if (v.length > max) throw new UserError(`${label} maksimal ${max} huruf.`);
  return v;
}

async function backToWeek(date: string, tab: string, ok: string): Promise<never> {
  const w = weekRange(date);
  redirect(`/operasional/qc?tab=${tab}&from=${w.from}&to=${w.to}&ok=${encodeURIComponent(ok)}`);
}

/* ============================================================ template mix desain */

/** Template baru: pemegang izin setujui_qc (termasuk pemilik) langsung disetujui, selain itu diajukan. */
export async function createMixDesign(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("qc");
  const res = await guard(async () => {
    const db = await getDb();
    const name = text(form, "name", "Nama template", 2, 100);
    const layer = oneOf(form.get("layer"), mixLayers, "Lapisan");
    const product = text(form, "product", "Item pekerjaan / produk", 2, 100);
    const mats = materials(form.get("materials"), "Komposisi", 1);
    const notes = optText(form, "notes", "Catatan");
    const approved = qcCan(me.roles).approve;
    await db.insert(schema.mixDesigns).values({
      name, layer, product, materials: mats, notes,
      status: approved ? "disetujui" : "diajukan",
      createdBy: me.id,
      approvedBy: approved ? me.id : null,
      approvedAt: approved ? new Date() : null,
    });
    await logActivity(me, { action: "qc.template_buat", label: approved ? "Membuat template mix desain" : "Mengajukan template mix desain", summary: `${name} (${layer})` });
    return { approved };
  });
  if ("error" in res) return res;
  redirect(`/operasional/qc?tab=template&ok=${encodeURIComponent(res.approved ? "~Template disimpan & langsung dipakai." : "~Template diajukan, menunggu persetujuan.")}`);
}

/** Setujui (langsung dipakai, keluar dari rekapan) atau tolak template. */
export async function reviewMixDesign(id: string, approve: boolean, note?: string): Promise<FormState> {
  const me = await requirePerm("setujui_qc");
  const res = await guard(async () => {
    const db = await getDb();
    const d = await db.query.mixDesigns.findFirst({ where: eq(schema.mixDesigns.id, id) });
    if (!d) throw new UserError("Template tidak ditemukan.");
    const reviewNote = (note ?? "").trim().slice(0, 500) || null;
    await db
      .update(schema.mixDesigns)
      .set(
        approve
          ? { status: "disetujui", active: true, approvedBy: me.id, approvedAt: new Date(), reviewNote, retiredReason: null, retiredBy: null, retiredAt: null, updatedAt: new Date() }
          : { status: "ditolak", approvedBy: me.id, approvedAt: new Date(), reviewNote, updatedAt: new Date() },
      )
      .where(eq(schema.mixDesigns.id, id));
    await logActivity(me, { action: "qc.template_tinjau", label: approve ? "Menyetujui template mix desain" : "Menolak template mix desain", summary: d.name });
    return { ok: approve ? "Template disetujui & dipakai." : "Template ditolak." };
  });
  if (!("error" in res)) refresh();
  return res;
}

/** Nonaktif = tidak dipakai lagi (masuk rekapan, dengan alasan). Aktif lagi = dipakai kembali; template gagal kembali disetujui. */
export async function setMixDesignActive(id: string, isActive: boolean, reason?: string): Promise<FormState> {
  const me = await requirePerm("setujui_qc");
  const res = await guard(async () => {
    const db = await getDb();
    const d = await db.query.mixDesigns.findFirst({ where: eq(schema.mixDesigns.id, id) });
    if (!d) throw new UserError("Template tidak ditemukan.");
    await db
      .update(schema.mixDesigns)
      .set(
        isActive
          ? { active: true, status: d.status === "gagal" ? "disetujui" : d.status, retiredReason: null, retiredBy: null, retiredAt: null, updatedAt: new Date() }
          : { active: false, retiredReason: (reason ?? "").trim().slice(0, 500) || null, retiredBy: me.id, retiredAt: new Date(), updatedAt: new Date() },
      )
      .where(eq(schema.mixDesigns.id, id));
    await logActivity(me, { action: "qc.template_aktif", label: isActive ? "Memakai lagi template mix desain" : "Memindahkan template mix desain ke rekapan", summary: d.name });
    return { ok: isActive ? "Template dipakai lagi." : "Template dipindah ke rekapan." };
  });
  if (!("error" in res)) refresh();
  return res;
}

/** Template yang hasilnya gagal: keluar dari pilihan produksi dan masuk rekapan dengan alasan. */
export async function markMixDesignFailed(id: string, reason?: string): Promise<FormState> {
  const me = await requirePerm("setujui_qc");
  const res = await guard(async () => {
    const why = noteArg(reason, "Alasan", 3);
    const db = await getDb();
    const d = await db.query.mixDesigns.findFirst({ where: eq(schema.mixDesigns.id, id) });
    if (!d) throw new UserError("Template tidak ditemukan.");
    await db.update(schema.mixDesigns).set({ status: "gagal", active: false, retiredReason: why, retiredBy: me.id, retiredAt: new Date(), updatedAt: new Date() }).where(eq(schema.mixDesigns.id, id));
    await logActivity(me, { action: "qc.template_gagal", label: "Menandai template mix desain gagal", summary: `${d.name}: ${why}` });
    return { ok: "Ditandai gagal & dipindah ke rekapan." };
  });
  if (!("error" in res)) refresh();
  return res;
}

/* ============================================================ catatan harian mix desain */

async function mixLogValues(db: DB, form: FormData) {
  const workDate = form.get("workDate");
  if (!isDate(workDate)) throw new UserError("Hari / tanggal tidak valid.");
  const layer: MixLayer = oneOf(form.get("layer"), mixLayers, "Lapisan");
  const product = text(form, "product", "Item pekerjaan", 2, 100);
  const designId = String(form.get("mixDesignId") ?? "").trim() || null;
  if (designId) {
    const d = await db.query.mixDesigns.findFirst({ where: eq(schema.mixDesigns.id, designId) });
    if (!d) throw new UserError("Template mix desain tidak ditemukan.");
  }
  const status: CheckStatus = oneOf(form.get("status"), checkStatuses, "Status");
  return {
    workDate,
    layer,
    product,
    mixDesignId: designId,
    approvedMaterials: materials(form.get("approved"), "Mix desain disetujui"),
    actualMaterials: materials(form.get("actual"), "Mix desain actual"),
    mixingCount: optNumber(form.get("mixingCount"), "Mixing"),
    boards: optNumber(form.get("boards"), "Papan"),
    squareMeters: optNumber(form.get("squareMeters"), "Meter persegi"),
    rejects: layer === "kepalaan" ? null : optNumber(form.get("rejects"), "Reject"),
    status,
    notes: optText(form, "notes", "Catatan", 2000),
  };
}

export async function createMixLog(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("qc");
  const res = await guard(async () => {
    const db = await getDb();
    const v = await mixLogValues(db, form);
    await db.insert(schema.mixLogs).values({ ...v, createdBy: me.id });
    await logActivity(me, { action: "qc.catatan_buat", label: "Mengisi mix desain harian", summary: `${v.workDate} · ${v.layer} · ${v.product}` });
    return { date: v.workDate };
  });
  if ("error" in res) return res;
  return backToWeek(res.date, "harian", "~Data mix desain tersimpan.");
}

/** Catatan boleh diubah/dihapus bila belum di-ACC dan (pembuatnya atau kantor). */
async function editableMixLog(db: DB, me: Pick<CurrentUser, "id" | "roles">, id: string) {
  const row = await db.query.mixLogs.findFirst({ where: eq(schema.mixLogs.id, id) });
  if (!row) throw new UserError("Data tidak ditemukan.");
  if (row.reviewStatus === "disetujui") throw new UserError("Data yang sudah di-ACC tidak dapat diubah.");
  if (!qcCan(me.roles).editAny && row.createdBy !== me.id) throw new UserError("Hanya pembuat data atau kantor yang dapat mengubah.");
  return row;
}

/** Setelah diubah (mis. revisi), data kembali menunggu ACC. */
export async function updateMixLog(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("qc");
  const res = await guard(async () => {
    const db = await getDb();
    const id = String(form.get("id") ?? "");
    await editableMixLog(db, me, id);
    const v = await mixLogValues(db, form);
    await db.update(schema.mixLogs).set({ ...v, reviewStatus: "menunggu", reviewNote: null, updatedAt: new Date() }).where(eq(schema.mixLogs.id, id));
    await logActivity(me, { action: "qc.catatan_ubah", label: "Mengubah mix desain harian", summary: `${v.workDate} · ${v.layer} · ${v.product}` });
    return { date: v.workDate };
  });
  if ("error" in res) return res;
  return backToWeek(res.date, "harian", "~Data mix desain tersimpan.");
}

export async function deleteMixLog(id: string): Promise<FormState> {
  const me = await requirePerm("qc");
  const res = await guard(async () => {
    const db = await getDb();
    const row = await editableMixLog(db, me, id);
    await db.delete(schema.mixLogs).where(eq(schema.mixLogs.id, id));
    await logActivity(me, { action: "qc.catatan_hapus", label: "Menghapus mix desain harian", summary: `${row.workDate} · ${row.layer} · ${row.product}` });
    return { ok: "Data dihapus." };
  });
  if (!("error" in res)) refresh();
  return res;
}

/** Tombol "Sesuai mix desain": catat produksi hari ini memakai komposisi template apa adanya. */
export async function quickMixLog(layer: string, designId: string): Promise<FormState> {
  const me = await requirePerm("qc");
  const res = await guard(async () => {
    const db = await getDb();
    const l = oneOf(layer, mixLayers, "Lapisan");
    const d = await db.query.mixDesigns.findFirst({ where: eq(schema.mixDesigns.id, designId) });
    if (!d || d.status !== "disetujui" || !d.active) throw new UserError("Template tidak tersedia. Pilih template yang sedang dipakai.");
    if (d.layer !== l) throw new UserError("Template tidak sesuai dengan lapisan.");
    const date = today();
    await db.insert(schema.mixLogs).values({
      workDate: date, layer: l, product: d.product, mixDesignId: d.id,
      approvedMaterials: d.materials, actualMaterials: d.materials, status: "sesuai", createdBy: me.id,
    });
    await logActivity(me, { action: "qc.catatan_buat", label: "Mengisi mix desain harian (sesuai template)", summary: `${date} · ${l} · ${d.product}` });
    return { ok: "Tercatat sesuai mix desain. Hasil produksi (papan/m²/reject) bisa dilengkapi lewat tombol ubah." };
  });
  if (!("error" in res)) refresh();
  return res;
}

/** ACC massal (maks 200 baris) = tanda tangan "Diperiksa oleh". */
export async function approveMixLogs(ids: string[]): Promise<FormState> {
  const me = await requirePerm("setujui_qc");
  const res = await guard(async () => {
    const list = [...new Set((Array.isArray(ids) ? ids : []).map(String))];
    if (!list.length) throw new UserError("Tidak ada data yang dipilih.");
    if (list.length > 200) throw new UserError("Maksimal 200 data sekali ACC.");
    const db = await getDb();
    const l = schema.mixLogs;
    await runBatch(
      db,
      chunk(list, 80).map((part) =>
        db.update(l).set({ reviewStatus: "disetujui", reviewNote: null, managerSignedBy: me.id, managerSignedAt: new Date(), updatedAt: new Date() }).where(and(inArray(l.id, part), ne(l.reviewStatus, "disetujui"))),
      ),
    );
    await logActivity(me, { action: "qc.catatan_acc", label: "ACC mix desain harian", summary: `${list.length} data` });
    return { ok: `${list.length} data di-ACC & ditandatangani.` };
  });
  if (!("error" in res)) refresh();
  return res;
}

export async function requestMixLogRevision(id: string, note?: string): Promise<FormState> {
  const me = await requirePerm("setujui_qc");
  const res = await guard(async () => {
    const n = noteArg(note, "Catatan revisi", 3);
    const db = await getDb();
    const row = await db.query.mixLogs.findFirst({ where: eq(schema.mixLogs.id, id) });
    if (!row) throw new UserError("Data tidak ditemukan.");
    await db.update(schema.mixLogs).set({ reviewStatus: "revisi", reviewNote: n, managerSignedBy: null, managerSignedAt: null, updatedAt: new Date() }).where(eq(schema.mixLogs.id, id));
    await logActivity(me, { action: "qc.catatan_revisi", label: "Meminta revisi mix desain harian", summary: `${row.workDate} · ${row.layer} · ${n}` });
    return { ok: "Dikembalikan ke QC untuk revisi." };
  });
  if (!("error" in res)) refresh();
  return res;
}

/* ============================================================ uji kuat tekan */

async function strengthValues(form: FormData) {
  const reportDate = form.get("reportDate");
  if (!isDate(reportDate)) throw new UserError("Tanggal laporan tidak valid.");
  const concreteGrade = text(form, "concreteGrade", "Mutu beton", 1, 30);
  const rows = rowsOf(form.get("samples")).filter((r) => String(r.sampleName ?? "").trim());
  if (!rows.length) throw new UserError("Isi minimal satu benda uji.");
  if (rows.length > 50) throw new UserError("Maksimal 50 benda uji per laporan.");
  const samples = rows.map((r, i) => {
    const sampleName = String(r.sampleName).trim();
    if (sampleName.length > 100) throw new UserError(`Benda uji ${i + 1}: nama maksimal 100 huruf.`);
    return {
      position: i + 1,
      sampleName,
      madeAt: optDate(r.madeAt, `Benda uji ${i + 1}: tanggal pembuatan`),
      testedAt: optDate(r.testedAt, `Benda uji ${i + 1}: tanggal ditest`),
      weightKg: optNumber(r.weightKg, `Benda uji ${i + 1}: berat`),
      areaCm2: optNumber(r.areaCm2, `Benda uji ${i + 1}: luas bidang`),
      maxLoadKn: optNumber(r.maxLoadKn, `Benda uji ${i + 1}: tekanan`),
    };
  });
  return {
    header: {
      reportDate,
      companyName: optText(form, "companyName", "Nama perusahaan", 200),
      address: optText(form, "address", "Alamat", 500),
      concreteGrade,
      addressedTo: optText(form, "addressedTo", "Tertuju", 200),
      // Hanya bahan yang jumlahnya terisi yang masuk laporan (seperti form kertas).
      composition: materials(form.get("composition"), "Komposisi").filter((m) => m.qty !== null),
      notes: optText(form, "notes", "Note", 2000),
    },
    samples,
  };
}

export async function createStrengthTest(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("qc");
  const res = await guard(async () => {
    const db = await getDb();
    const { header, samples } = await strengthValues(form);
    const id = crypto.randomUUID();
    await runBatch(db, [
      db.insert(schema.strengthTests).values({ id, ...header, createdBy: me.id }),
      insertMany(db, schema.strengthSamples, samples.map((s) => ({ ...s, testId: id }))),
    ]);
    await logActivity(me, { action: "qc.uji_buat", label: "Membuat laporan uji kuat tekan", summary: `${header.reportDate} · ${header.concreteGrade} · ${samples.length} benda uji` });
    return { date: header.reportDate };
  });
  if ("error" in res) return res;
  return backToMonth(res.date, "~Laporan uji kuat tekan tersimpan.");
}

async function backToMonth(date: string, ok: string): Promise<never> {
  const from = `${date.slice(0, 7)}-01`;
  const to = date > today() ? date : today();
  redirect(`/operasional/qc?tab=uji-tekan&from=${from}&to=${to}&ok=${encodeURIComponent(ok)}`);
}

async function editableStrengthTest(db: DB, me: Pick<CurrentUser, "id" | "roles">, id: string) {
  const row = await db.query.strengthTests.findFirst({ where: eq(schema.strengthTests.id, id) });
  if (!row) throw new UserError("Laporan tidak ditemukan.");
  if (row.reviewStatus === "disetujui") throw new UserError("Laporan yang sudah di-ACC tidak dapat diubah.");
  if (!qcCan(me.roles).editAny && row.createdBy !== me.id) throw new UserError("Hanya pembuat laporan atau kantor yang dapat mengubah.");
  return row;
}

/** Setelah diubah (mis. revisi), laporan kembali menunggu ACC dan TTD lab dicabut. Benda uji diisi ulang. */
export async function updateStrengthTest(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("qc");
  const res = await guard(async () => {
    const db = await getDb();
    const id = String(form.get("id") ?? "");
    await editableStrengthTest(db, me, id);
    const { header, samples } = await strengthValues(form);
    await runBatch(db, [
      db.update(schema.strengthTests).set({ ...header, reviewStatus: "menunggu", reviewNote: null, labSignedBy: null, labSignedAt: null, updatedAt: new Date() }).where(eq(schema.strengthTests.id, id)),
      db.delete(schema.strengthSamples).where(eq(schema.strengthSamples.testId, id)),
      insertMany(db, schema.strengthSamples, samples.map((s) => ({ ...s, testId: id }))),
    ]);
    await logActivity(me, { action: "qc.uji_ubah", label: "Mengubah laporan uji kuat tekan", summary: `${header.reportDate} · ${header.concreteGrade} · ${samples.length} benda uji` });
    return { date: header.reportDate };
  });
  if ("error" in res) return res;
  return backToMonth(res.date, "~Laporan uji kuat tekan tersimpan.");
}

export async function deleteStrengthTest(id: string): Promise<FormState> {
  const me = await requirePerm("qc");
  const res = await guard(async () => {
    const db = await getDb();
    const row = await editableStrengthTest(db, me, id);
    await runBatch(db, [db.delete(schema.strengthSamples).where(eq(schema.strengthSamples.testId, id)), db.delete(schema.strengthTests).where(eq(schema.strengthTests.id, id))]);
    await logActivity(me, { action: "qc.uji_hapus", label: "Menghapus laporan uji kuat tekan", summary: `${row.reportDate} · ${row.concreteGrade}` });
    return { ok: "Laporan dihapus." };
  });
  if (!("error" in res)) refresh();
  return res;
}

/** ACC = tanda tangan "Diperiksa Lab Pengujian". */
export async function approveStrengthTest(id: string): Promise<FormState> {
  const me = await requirePerm("setujui_qc");
  const res = await guard(async () => {
    const db = await getDb();
    const row = await db.query.strengthTests.findFirst({ where: eq(schema.strengthTests.id, id) });
    if (!row) throw new UserError("Laporan tidak ditemukan.");
    if (row.reviewStatus !== "disetujui") {
      await db.update(schema.strengthTests).set({ reviewStatus: "disetujui", reviewNote: null, labSignedBy: me.id, labSignedAt: new Date(), updatedAt: new Date() }).where(eq(schema.strengthTests.id, id));
      await logActivity(me, { action: "qc.uji_acc", label: "ACC laporan uji kuat tekan (Diperiksa Lab)", summary: `${row.reportDate} · ${row.concreteGrade}` });
    }
    return { ok: "Laporan di-ACC (Diperiksa Lab). Pimpinan dapat menandatangani." };
  });
  if (!("error" in res)) refresh();
  return res;
}

export async function requestStrengthRevision(id: string, note?: string): Promise<FormState> {
  const me = await requirePerm("setujui_qc");
  const res = await guard(async () => {
    const n = noteArg(note, "Catatan revisi", 3);
    const db = await getDb();
    const row = await db.query.strengthTests.findFirst({ where: eq(schema.strengthTests.id, id) });
    if (!row) throw new UserError("Laporan tidak ditemukan.");
    if (row.leaderSignedAt) throw new UserError("Laporan sudah ditandatangani Pimpinan.");
    await db.update(schema.strengthTests).set({ reviewStatus: "revisi", reviewNote: n, labSignedBy: null, labSignedAt: null, updatedAt: new Date() }).where(eq(schema.strengthTests.id, id));
    await logActivity(me, { action: "qc.uji_revisi", label: "Meminta revisi laporan uji kuat tekan", summary: `${row.reportDate} · ${n}` });
    return { ok: "Dikembalikan ke QC untuk revisi." };
  });
  if (!("error" in res)) refresh();
  return res;
}

/** "Mengetahui Pimpinan": hanya setelah laporan di-ACC. */
export async function signStrengthAsLeader(id: string): Promise<FormState> {
  const me = await requirePerm("ttd_pimpinan");
  const res = await guard(async () => {
    const db = await getDb();
    const row = await db.query.strengthTests.findFirst({ where: eq(schema.strengthTests.id, id) });
    if (!row) throw new UserError("Laporan tidak ditemukan.");
    if (row.reviewStatus !== "disetujui") throw new UserError("Laporan harus di-ACC (Diperiksa Lab) terlebih dahulu.");
    await db.update(schema.strengthTests).set({ leaderSignedBy: me.id, leaderSignedAt: new Date(), updatedAt: new Date() }).where(eq(schema.strengthTests.id, id));
    await logActivity(me, { action: "qc.uji_ttd", label: "TTD Pimpinan laporan uji kuat tekan", summary: `${row.reportDate} · ${row.concreteGrade}` });
    return { ok: "Ditandatangani sebagai Pimpinan." };
  });
  if (!("error" in res)) refresh();
  return res;
}

/* ============================================================ tanda tangan bergambar */

const MAX_SIGNATURE = 2 * 1024 * 1024;

/**
 * Simpan / hapus tanda tangan bergambar milik sendiri. Isian `data` = PNG (data URL atau base64) dari kanvas,
 * maks 2 MB; `hapus` = "1" untuk menghapus. Berkas disimpan di R2 folder ttd/ dan kuncinya di users.signature_key.
 */
export async function setSignature(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("setujui_qc", "ttd_pimpinan");
  const res = await guard(async () => {
    const db = await getDb();
    const user = await db.query.users.findFirst({ where: eq(schema.users.id, me.id) });
    if (!user) throw new UserError("Akun tidak ditemukan.");
    if (form.get("hapus") === "1") {
      await db.update(schema.users).set({ signatureKey: null }).where(eq(schema.users.id, me.id));
      await deleteImage(user.signatureKey).catch(() => undefined);
      await logActivity(me, { action: "auth.setSignature", label: "Hapus tanda tangan" });
      return { ok: "Tanda tangan dihapus." };
    }
    const raw = String(form.get("data") ?? "").replace(/^data:image\/png;base64,/, "").trim();
    if (raw.length < 100) throw new UserError("Gambar tanda tangan kosong. Tanda tangani dulu di kotak.");
    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
    } catch {
      throw new UserError("Gambar tanda tangan tidak valid.");
    }
    if (bytes.length > MAX_SIGNATURE) throw new UserError("Ukuran tanda tangan maksimal 2 MB.");
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    if (!isPng) throw new UserError("Tanda tangan harus berformat PNG.");
    let key: string | null;
    try {
      key = await saveImage(new File([bytes as BlobPart], "tanda-tangan.png", { type: "image/png" }), "ttd");
    } catch (e) {
      if (e instanceof UploadError) throw new UserError(e.message);
      throw e;
    }
    if (!key) throw new UserError("Gambar tanda tangan kosong.");
    await db.update(schema.users).set({ signatureKey: key }).where(eq(schema.users.id, me.id));
    await deleteImage(user.signatureKey).catch(() => undefined);
    await logActivity(me, { action: "auth.setSignature", label: "Simpan tanda tangan" });
    return { ok: "Tanda tangan tersimpan." };
  });
  if (!("error" in res)) revalidatePath("/operasional", "layout");
  return res;
}
