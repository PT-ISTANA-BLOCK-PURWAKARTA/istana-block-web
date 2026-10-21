"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/components/admin/FormMessage";
import { getDb } from "@/db";
import { requirePerm } from "@/lib/auth";
import { guard, UserError } from "@/lib/erp/server";
import { logActivity } from "@/lib/ops/activity";
import { asUserError, deleteIsoRecord, saveIsoRecord, saveIsoSupplement, setObjective } from "@/lib/ops/iso";
import { FORM_BY_CODE, type IsoCode } from "@/lib/ops/shared/isoForms";

const BASE = "/operasional/rekap-iso";

/** Alamat kembali setelah simpan: hanya halaman Rekap ISO (cegah pengalihan ke luar). */
function backUrl(raw: unknown) {
  const url = String(raw ?? "");
  return url.startsWith(BASE) && !url.startsWith("//") && !url.includes("\\") && !url.includes("://") ? url : BASE;
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
  const me = await requirePerm("iso");
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
    if (!clear && (total === null || achieved === null)) throw new UserError("Isi jumlah total dan jumlah tercapai.");
    await asUserError(() => setObjective(db, me, { month, no, total, achieved, note: String(form.get("note") ?? "") }));
    await logActivity(me, { action: "iso.sasaran", label: clear ? "Menghapus angka Sasaran Mutu" : "Mengisi angka Sasaran Mutu", summary: `Sasaran ${no} · ${month}` });
    return { done: true };
  });
  if ("error" in res) return res;
  redirect(withOk(backUrl(form.get("back")), clear ? "~Angka bulan itu dihapus." : "~Angka Sasaran Mutu tersimpan."));
}
