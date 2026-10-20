import "server-only";
import { and, eq, inArray, like, sql } from "drizzle-orm";
import { schema } from "@/db";
import { requirePerm, type CurrentUser } from "@/lib/auth";
import { UserError, runBatch, type DB } from "@/lib/erp/server";
import { requireShift } from "./duty";
import { canDeleteAny, canInputForm, canSetObjective, canViewCustomers, getManualRecord, IsoError } from "./iso-core";
import { cleanIsoValues, FORM_BY_CODE, isDay, type IsoCode, type IsoValues } from "./shared/isoForms";
import { QUALITY_OBJECTIVES } from "./shared/isoObjectives";
import { wibDate } from "./shared/period";

// Kueri baca + logika tulis Rekap ISO untuk halaman, route handler, dan server action.
// Kueri baca ada di iso-core.ts (tanpa server-only, dipakai cron juga); di sini hanya yang butuh auth/aksi.
export * from "./iso-core";

const ir = schema.isoRecords;

/** Izin halaman & aksi Rekap ISO. */
export async function isoAccess() {
  const user = await requirePerm("iso");
  return {
    user,
    canCustomers: canViewCustomers(user.roles),
    canObjective: canSetObjective(user.roles),
    isOffice: canDeleteAny(user.roles),
  };
}

/** Jalankan fungsi inti; IsoError diubah menjadi UserError supaya tampil di formulir. */
export async function asUserError<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof IsoError) throw new UserError(e.message);
    throw e;
  }
}

function formOf(code: string) {
  const form = FORM_BY_CODE[code as IsoCode];
  if (!form) throw new UserError("Form tidak dikenal.");
  return form;
}

/** Nomor NCR otomatis NCR-<tahun>-<nnn>. */
async function nextNcrNumber(db: DB, day: string) {
  const prefix = `NCR-${day.slice(0, 4)}-`;
  const rows = await db.select({ number: ir.number }).from(ir).where(and(eq(ir.formCode, "F-IB-15"), like(ir.number, `${prefix}%`)));
  const last = Math.max(0, ...rows.map((r) => Number(r.number?.slice(prefix.length)) || 0));
  return `${prefix}${String(last + 1).padStart(3, "0")}`;
}

/** Simpan (baru/ubah) satu baris form yang diisi langsung. */
export async function saveIsoRecord(db: DB, me: CurrentUser, input: { code: string; id?: string; values: Record<string, unknown>; from?: string }) {
  const form = formOf(input.code);
  if (!form.manual) throw new UserError(`${form.code} diisi dari halaman ${form.app?.pageLabel ?? "lain"}.`);
  if (!canInputForm(me.roles, form)) throw new UserError("Akun Anda tidak bisa mengisi form ini.");
  await requireShift(me);
  const { values, error } = cleanIsoValues(form, input.values);
  if (error) throw new UserError(error);
  const recordDate = values[form.dateKey];
  if (!isDay(recordDate)) throw new UserError("Tanggal wajib diisi.");
  const who = me.name;
  if (input.id) {
    const row = await getManualRecord(db, form.code, input.id);
    if (!row) throw new UserError("Data tidak ditemukan.");
    // Sama dengan aturan hapus: baris manual orang lain hanya boleh diubah pembuatnya atau kantor.
    if (!canDeleteAny(me.roles) && row.createdBy !== me.id) throw new UserError("Hanya pembuat data atau kantor yang dapat mengubah.");
    // Jadwal kalibrasi/maintenance: tanggal pengerjaan sebelumnya disimpan sebagai riwayat (maks 50).
    const history =
      form.code === "F-IB-06" && row.data.terakhir && row.data.terakhir !== values.terakhir
        ? [...row.history, { at: new Date().toISOString(), by: who, values: { terakhir: row.data.terakhir, pelaksana: row.data.pelaksana ?? null, sertifikat: row.data.sertifikat ?? null, keterangan: row.data.keterangan ?? null } }].slice(-50)
        : row.history;
    await db.update(ir).set({ data: { ...values, ...(row.data._from ? { _from: row.data._from } : {}) }, recordDate, history, updatedByName: who, updatedAt: new Date() }).where(eq(ir.id, row.id));
    return { id: row.id, number: row.number, created: false };
  }
  const number = form.code === "F-IB-15" ? await nextNcrNumber(db, recordDate) : null;
  const [row] = await db
    .insert(ir)
    .values({ formCode: form.code, kind: "record", recordDate, number, data: { ...values, ...(input.from ? { _from: input.from.slice(0, 60) } : {}) }, createdBy: me.id, createdByName: who })
    .returning({ id: ir.id, number: ir.number });
  return { id: row.id, number: row.number, created: true };
}

/** Hapus baris isian langsung: pembuat atau kantor. */
export async function deleteIsoRecord(db: DB, me: CurrentUser, id: string) {
  const [row] = await db.select({ id: ir.id, formCode: ir.formCode, kind: ir.kind, createdBy: ir.createdBy, number: ir.number }).from(ir).where(eq(ir.id, id)).limit(1);
  if (!row || row.kind !== "record") throw new UserError("Data tidak ditemukan.");
  if (!canDeleteAny(me.roles) && row.createdBy !== me.id) throw new UserError("Hanya pembuat data atau kantor yang dapat menghapus.");
  await db.delete(ir).where(eq(ir.id, id));
  return row;
}

type SupplementItem = { sourceKey: string; recordDate: string; data: IsoValues };

/** Susun perintah upsert pelengkap: semua kolom kosong -> baris dihapus. */
async function supplementOps(db: DB, code: IsoCode, items: SupplementItem[], who: string) {
  const existing = await db.select({ id: ir.id, sourceKey: ir.sourceKey }).from(ir).where(and(eq(ir.formCode, code), inArray(ir.sourceKey, items.map((i) => i.sourceKey))));
  const ops: unknown[] = [];
  for (const item of items) {
    const row = existing.find((e) => e.sourceKey === item.sourceKey);
    const empty = Object.values(item.data).every((v) => v === null);
    if (row && empty) ops.push(db.delete(ir).where(eq(ir.id, row.id)));
    else if (row) ops.push(db.update(ir).set({ data: item.data, recordDate: item.recordDate, updatedByName: who, updatedAt: new Date() }).where(eq(ir.id, row.id)));
    else if (!empty) ops.push(db.insert(ir).values({ formCode: code, kind: "supplement", sourceKey: item.sourceKey, recordDate: item.recordDate, data: item.data, createdBy: null, createdByName: who }));
  }
  return ops;
}

const SUPPLEMENT_PREFIX: Partial<Record<IsoCode, string>> = { "F-IB-01": "order", "F-IB-03": "mix", "F-IB-04": "sample", "F-IB-09": "receipt" };

/** Lengkapi kolom putih pada baris yang datang dari aplikasi (mis. tipe pelanggan, kode batch, lab penguji). */
export async function saveIsoSupplement(db: DB, me: CurrentUser, input: { code: string; key: string; values: Record<string, unknown> }) {
  const form = formOf(input.code);
  if (!form.app || !form.columns.some((c) => c.supplement)) throw new UserError("Baris form ini tidak bisa dilengkapi.");
  if (!canInputForm(me.roles, form)) throw new UserError("Akun Anda tidak bisa melengkapi form ini.");
  await requireShift(me);
  const { values, error } = cleanIsoValues(form, input.values, { onlySupplement: true });
  if (error) throw new UserError(error);
  const cut = input.key.indexOf(":");
  const prefix = input.key.slice(0, cut), id = input.key.slice(cut + 1);
  if (cut < 0 || prefix !== SUPPLEMENT_PREFIX[form.code] || !id) throw new UserError("Baris tidak dikenal.");
  const who = me.name;
  if (form.code === "F-IB-01") {
    const [order] = await db.select({ contactId: schema.orders.contactId, date: schema.orders.date }).from(schema.orders).where(eq(schema.orders.id, id)).limit(1);
    if (!order) throw new UserError("PO tidak ditemukan.");
    // Tipe & pembayaran berlaku untuk pelanggan (semua PO-nya); nama proyek & keterangan per PO.
    await runBatch(db, await supplementOps(db, form.code, [
      { sourceKey: `customer:${order.contactId}`, recordDate: order.date, data: { tipe: values.tipe ?? null, bayar: values.bayar ?? null } },
      { sourceKey: `order:${id}`, recordDate: order.date, data: { proyek: values.proyek ?? null, keterangan: values.keterangan ?? null } },
    ], who));
    return;
  }
  let date: string | undefined;
  if (form.code === "F-IB-03") date = (await db.select({ d: schema.mixLogs.workDate }).from(schema.mixLogs).where(eq(schema.mixLogs.id, id)).limit(1))[0]?.d;
  else if (form.code === "F-IB-04") {
    date = (await db
      .select({ d: sql<string>`coalesce(${schema.strengthSamples.testedAt}, ${schema.strengthTests.reportDate})` })
      .from(schema.strengthSamples).innerJoin(schema.strengthTests, eq(schema.strengthSamples.testId, schema.strengthTests.id))
      .where(eq(schema.strengthSamples.id, id)).limit(1))[0]?.d;
  } else {
    const at = (await db.select({ d: schema.goodsReceipts.receivedAt }).from(schema.goodsReceipts).where(eq(schema.goodsReceipts.id, id)).limit(1))[0]?.d;
    date = at ? wibDate(at) : undefined;
  }
  if (!date) throw new UserError("Data tidak ditemukan.");
  await runBatch(db, await supplementOps(db, form.code, [{ sourceKey: input.key, recordDate: date, data: values }], who));
}

/** Isi/ubah/hapus angka Sasaran Mutu manual untuk satu bulan. */
export async function setObjective(db: DB, me: CurrentUser, input: { month: string; no: number; total: number | null; achieved: number | null; note?: string }) {
  if (!canSetObjective(me.roles)) throw new UserError("Akun Anda tidak bisa mengisi Sasaran Mutu.");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.month)) throw new UserError("Bulan tidak valid.");
  const objective = QUALITY_OBJECTIVES.find((item) => item.no === input.no);
  if (!objective) throw new UserError("Sasaran tidak dikenal.");
  if (objective.auto) throw new UserError("Sasaran ini dihitung otomatis dari data aplikasi.");
  const { total, achieved } = input;
  if ((total !== null && (!Number.isFinite(total) || total < 0)) || (achieved !== null && (!Number.isFinite(achieved) || achieved < 0))) throw new UserError("Jumlah harus angka nol atau lebih.");
  if (total !== null && achieved !== null && achieved > total) throw new UserError("Jumlah tercapai tidak boleh lebih dari jumlah total.");
  const sourceKey = `${input.month}:${input.no}`;
  const [existing] = await db.select({ id: ir.id }).from(ir).where(and(eq(ir.formCode, "F-IB-16"), eq(ir.sourceKey, sourceKey))).limit(1);
  if (total === null && achieved === null) {
    if (existing) await db.delete(ir).where(eq(ir.id, existing.id));
    return { cleared: true };
  }
  const data = { no: input.no, total, achieved, note: input.note?.trim().slice(0, 200) || null };
  if (existing) await db.update(ir).set({ data, updatedByName: me.name, updatedAt: new Date() }).where(eq(ir.id, existing.id));
  else await db.insert(ir).values({ formCode: "F-IB-16", kind: "objective", sourceKey, recordDate: `${input.month}-01`, data, createdBy: me.id, createdByName: me.name });
  return { cleared: false };
}
