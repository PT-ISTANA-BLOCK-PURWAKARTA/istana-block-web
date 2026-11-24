"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/components/admin/FormMessage";
import { getDb } from "@/db";
import { requirePerm } from "@/lib/auth";
import { guard, UserError } from "@/lib/erp/server";
import { logActivity } from "@/lib/ops/activity";
import { asUserError, deleteIsoRecord, saveIsoRecord, saveIsoSupplement, setObjective, signIsoRecord } from "@/lib/ops/iso";
import { revalidatePath } from "next/cache";
import { getManualRecord, todayWib } from "@/lib/ops/iso-core";
import { saveImage, UploadError } from "@/lib/media";
import { FORM_BY_CODE, isSignColumn, type IsoCode } from "@/lib/ops/shared/isoForms";
import { QUALITY_OBJECTIVES } from "@/lib/ops/shared/isoObjectives";

const BASE = "/operasional/rekap-iso";
const INCIDENT = "/operasional/insiden";

/** Alamat kembali setelah simpan: hanya halaman Rekap ISO (cegah pengalihan ke luar). */
function backUrl(raw: unknown) {
  const url = String(raw ?? "");
  return (url.startsWith(BASE) || url.startsWith(INCIDENT)) && !url.startsWith("//") && !url.includes("\\") && !url.includes("://") ? url : BASE;
}
const withOk = (url: string, message: string) => `${url}${url.includes("?") ? "&" : "?"}ok=${encodeURIComponent(message)}`;

/** Isian formulir: kolom putih form, diberi awalan v_ . */
function valuesFrom(form: FormData, code: string) {
  const def = FORM_BY_CODE[code as IsoCode];
  const out: Record<string, unknown> = {};
  if (def) for (const column of def.columns) if (!column.auto) { const v = form.get(`v_${column.key}`); out[column.key] = typeof v === "string" ? v : null; }
  return out;
}

const toNumber = (v: FormDataEntryValue | null) => {
  const text = typeof v === "string" ? v.trim().replace(",", ".") : "";
  if (text === "") return null;
  const n = Number(text);
  if (!Number.isFinite(n)) throw new UserError("Jumlah harus berupa angka.");
  return n;
};

/** Simpan (baru/ubah) baris form yang diisi langsung. */
export async function saveIsoRecordAction(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("iso", "insiden");
  const code = String(form.get("code") ?? "");
  const id = String(form.get("id") ?? "") || undefined;
  const res = await guard(async () => {
    const db = await getDb();
    const saved = await asUserError(() => saveIsoRecord(db, me, { code, id, values: valuesFrom(form, code), from: String(form.get("from") ?? "") || undefined }));
    await logActivity(me, { action: "iso.simpan", label: id ? "Mengubah baris form ISO" : "Menambah baris form ISO", summary: `${code}${saved.number ? ` ${saved.number}` : ""}` });
    return saved;
  });
  if ("error" in res) return res;
  redirect(withOk(backUrl(form.get("back")), res.number && res.created ? `~Tersimpan sebagai ${res.number}.` : "~Baris tersimpan."));
}

/** Lengkapi kolom putih pada baris yang datang dari data aplikasi. */
export async function saveIsoSupplementAction(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("iso");
  const code = String(form.get("code") ?? "");
  const key = String(form.get("key") ?? "");
  const res = await guard(async () => {
    const db = await getDb();
    await asUserError(() => saveIsoSupplement(db, me, { code, key, values: valuesFrom(form, code) }));
    await logActivity(me, { action: "iso.lengkapi", label: "Melengkapi baris form ISO dari data aplikasi", summary: `${code} ${key}`.slice(0, 120) });
    return { done: true };
  });
  if ("error" in res) return res;
  redirect(withOk(backUrl(form.get("back")), "~Baris dilengkapi."));
}

/** Hapus baris isian langsung (pembuat atau kantor). */
export async function deleteIsoRecordAction(id: string, back: string): Promise<FormState> {
  const me = await requirePerm("iso");
  const res = await guard(async () => {
    const db = await getDb();
    const row = await asUserError(() => deleteIsoRecord(db, me, id));
    await logActivity(me, { action: "iso.hapus", label: "Menghapus baris form ISO", summary: `${row.formCode}${row.number ? ` ${row.number}` : ""}` });
    return { done: true };
  });
  if ("error" in res) return res;
  redirect(withOk(backUrl(back), "dihapus"));
}

/** Isi/hapus angka Sasaran Mutu manual untuk satu bulan. */
export async function saveObjectiveAction(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("iso");
  const clear = form.get("intent") === "hapus";
  const res = await guard(async () => {
    const db = await getDb();
    const no = Number(form.get("no"));
    const month = String(form.get("month") ?? "");
    const total = clear ? null : toNumber(form.get("total"));
    const achieved = clear ? null : toNumber(form.get("achieved"));
    const totalAuto = QUALITY_OBJECTIVES.find((o) => o.no === no)?.manualAchieved === true;
    if (!clear && (achieved === null || (total === null && !totalAuto))) throw new UserError(totalAuto ? "Isi jumlah tercapai." : "Isi jumlah total dan jumlah tercapai.");
    await asUserError(() => setObjective(db, me, { month, no, total, achieved, note: String(form.get("note") ?? "") }));
    await logActivity(me, { action: "iso.sasaran", label: clear ? "Menghapus angka Sasaran Mutu" : "Mengisi angka Sasaran Mutu", summary: `Sasaran ${no} · ${month}` });
    return { done: true };
  });
  if ("error" in res) return res;
  redirect(withOk(backUrl(form.get("back")), clear ? "~Angka bulan itu dihapus." : "~Angka Sasaran Mutu tersimpan."));
}

/** Unggah satu foto untuk kolom foto form (maks. 5 MB); mengembalikan kunci berkas. */
export async function uploadIsoPhoto(form: FormData): Promise<{ key?: string; error?: string }> {
  await requirePerm("iso", "insiden");
  try {
    const key = await saveImage(form.get("file"), "iso");
    return key ? { key } : { error: "Pilih foto dulu." };
  } catch (e) {
    if (e instanceof UploadError) return { error: e.message };
    throw e;
  }
}

/** Tombol Paraf / TTD pada baris form. */
export async function signIsoRecordAction(id: string, column: string): Promise<FormState> {
  const me = await requirePerm("iso", "insiden", "setujui_qc", "ttd_pimpinan");
  const res = await guard(async () => {
    const db = await getDb();
    const out = await asUserError(() => signIsoRecord(db, me, { id, column }));
    await logActivity(me, { action: "iso.paraf", label: "Memaraf form ISO", summary: `${out.formCode} · ${column}` });
    return { ok: "Tersimpan." };
  });
  if (!("error" in res)) {
    revalidatePath(BASE);
    revalidatePath(INCIDENT);
  }
  return res;
}

/**
 * Tombol "Selesaikan": F-IB-06 = kalibrasi / maintenance selesai (Tgl Terakhir diperbarui, riwayat lama tersimpan,
 * jadwal berikutnya terhitung ulang); F-IB-14 = tindak lanjut rapat Closed. Keterangan Selesai terisi otomatis.
 */
export async function completeIsoRecordAction(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("iso");
  const code = String(form.get("code") ?? "");
  const id = String(form.get("id") ?? "");
  const res = await guard(async () => {
    if (code !== "F-IB-06" && code !== "F-IB-14") throw new UserError("Form ini tidak punya tombol Selesaikan.");
    const date = String(form.get("date") ?? "");
    const today = todayWib();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) throw new UserError("Tanggal selesai tidak boleh kosong atau setelah hari ini.");
    const db = await getDb();
    const row = await getManualRecord(db, code, id);
    if (!row) throw new UserError("Data tidak ditemukan.");
    const def = FORM_BY_CODE[code];
    const values: Record<string, unknown> = {};
    for (const c of def.columns) if (!c.auto && !isSignColumn(c)) values[c.key] = row.data[c.key] ?? null;
    const ket = String(form.get("keterangan") ?? "").trim().slice(0, 300);
    const pelaksana = String(form.get("pelaksana") ?? "Internal") === "Vendor" ? "Vendor" : "Internal";
    const dmy = date.split("-").reverse().join("/");
    const note = `Selesai ${dmy} oleh ${me.name}${code === "F-IB-14" ? "" : ` (${pelaksana})`}${ket ? ` — ${ket}` : ""}`;
    if (code === "F-IB-14") Object.assign(values, { status: "Closed", selesai: date, ketSelesai: note });
    else {
      const sertifikat = String(form.get("sertifikat") ?? "").trim().slice(0, 200);
      Object.assign(values, { terakhir: date, pelaksana, sertifikat: sertifikat || null, keterangan: ket || row.data.keterangan || null, ketSelesai: note });
    }
    await asUserError(() => saveIsoRecord(db, me, { code, id, values }));
    await logActivity(me, { action: "iso.selesaikan", label: code === "F-IB-14" ? "Menyelesaikan tindak lanjut rapat" : "Menyelesaikan jadwal kalibrasi / maintenance", summary: `${code} · ${String(row.data.nama ?? row.data.topik ?? "")}`.slice(0, 120) });
    return { done: true };
  });
  if ("error" in res) return res;
  redirect(withOk(backUrl(form.get("back")), "~Ditandai selesai."));
}
