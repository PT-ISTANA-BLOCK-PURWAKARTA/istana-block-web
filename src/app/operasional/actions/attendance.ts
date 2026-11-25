"use server";

// Absensi pekerja harian (PIC absensi & kantor). Setara app lama: nama bebas (huruf besar), tugas, upah harian / per jam / borongan.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import type { FormState } from "@/components/admin/FormMessage";
import { getDb, schema } from "@/db";
import { workerPayTypes, workerStatuses } from "@/db/erp";
import { requirePerm } from "@/lib/auth";
import { guard, UserError } from "@/lib/erp/server";
import { addDays, isDate } from "@/lib/erp/util";
import { logActivity } from "@/lib/ops/activity";

const BASE = "/operasional/absensi-pekerja";
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const optNum = (v: FormDataEntryValue | null, label: string, max: number) => {
  const t = typeof v === "string" ? v.trim().replace(",", ".") : "";
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > max) throw new UserError(`${label} tidak valid.`);
  return n;
};
const optText = (v: FormDataEntryValue | null, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** Lama kerja dari jam masuk–pulang (lewat tengah malam dihitung ke hari berikutnya), dibulatkan 0,1 jam. */
function hoursBetween(start: string | null, end: string | null) {
  if (!start || !end) return null;
  const [h1, m1] = start.split(":").map(Number);
  const [h2, m2] = end.split(":").map(Number);
  let minutes = h2 * 60 + m2 - (h1 * 60 + m1);
  if (minutes < 0) minutes += 24 * 60;
  return Math.round(minutes / 6) / 10;
}

function values(form: FormData) {
  const workDate = String(form.get("workDate") ?? "");
  if (!isDate(workDate)) throw new UserError("Tanggal tidak valid.");
  const workerName = String(form.get("workerName") ?? "").trim().toUpperCase().slice(0, 120);
  if (workerName.length < 2) throw new UserError("Isi nama pekerja.");
  const payType = String(form.get("payType") ?? "harian");
  const status = String(form.get("status") ?? "hadir");
  if (!workerPayTypes.includes(payType as never)) throw new UserError("Jenis upah tidak dikenal.");
  if (!workerStatuses.includes(status as never)) throw new UserError("Kehadiran tidak dikenal.");
  const present = status === "hadir";
  const startTime = optText(form.get("startTime"), 5);
  const endTime = optText(form.get("endTime"), 5);
  if ((startTime && !TIME.test(startTime)) || (endTime && !TIME.test(endTime))) throw new UserError("Jam harus berformat JJ:MM.");
  const hours = optNum(form.get("hours"), "Jam kerja", 24) ?? hoursBetween(startTime, endTime);
  return {
    workDate, workerName, task: optText(form.get("task"), 200),
    payType: payType as (typeof workerPayTypes)[number], status: status as (typeof workerStatuses)[number],
    startTime: present ? startTime : null, endTime: present ? endTime : null, hours: present ? hours : null,
    overtimeHours: present ? optNum(form.get("overtimeHours"), "Lembur", 24) : null,
    output: present && payType === "borongan" ? optNum(form.get("output"), "Hasil borongan", 10_000_000) : null,
    outputUnit: present && payType === "borongan" ? optText(form.get("outputUnit"), 30) : null,
    note: optText(form.get("note"), 300),
  };
}

/** Simpan absensi satu pekerja (baru / ubah). */
export async function saveAttendance(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("absensi_pekerja");
  const res = await guard(async () => {
    const db = await getDb();
    const v = values(form);
    const id = String(form.get("id") ?? "");
    if (id) {
      const row = await db.query.workerAttendance.findFirst({ where: eq(schema.workerAttendance.id, id) });
      if (!row) throw new UserError("Absensi tidak ditemukan.");
      await db.update(schema.workerAttendance).set({ ...v, updatedByName: me.name, updatedAt: new Date() }).where(eq(schema.workerAttendance.id, id));
    } else {
      await db.insert(schema.workerAttendance).values({ ...v, createdBy: me.id, createdByName: me.name });
    }
    await logActivity(me, { action: "absensi.simpan", label: id ? "Mengubah absensi pekerja" : "Mencatat absensi pekerja", summary: `${v.workDate} · ${v.workerName} · ${v.status}` });
    return { day: v.workDate, name: v.workerName };
  });
  if ("error" in res) return res;
  redirect(`${BASE}?hari=${res.day}&ok=${encodeURIComponent(`~Absensi ${res.name} tersimpan.`)}`);
}

export async function deleteAttendance(id: string): Promise<FormState> {
  const me = await requirePerm("absensi_pekerja");
  const res = await guard(async () => {
    const db = await getDb();
    const row = await db.query.workerAttendance.findFirst({ where: eq(schema.workerAttendance.id, id) });
    if (!row) throw new UserError("Absensi tidak ditemukan.");
    await db.delete(schema.workerAttendance).where(eq(schema.workerAttendance.id, id));
    await logActivity(me, { action: "absensi.hapus", label: "Menghapus absensi pekerja", summary: `${row.workDate} · ${row.workerName}` });
    return { ok: "Absensi dihapus." };
  });
  if (!("error" in res)) revalidatePath(BASE);
  return res;
}

/** Salin pekerja yang hadir kemarin (yang belum diabsen hari ini) dengan tugas & jenis upah yang sama. */
export async function copyYesterday(day: string): Promise<FormState> {
  const me = await requirePerm("absensi_pekerja");
  const res = await guard(async () => {
    if (!isDate(day)) throw new UserError("Tanggal tidak valid.");
    const db = await getDb();
    const t = schema.workerAttendance;
    const [prev, now] = await Promise.all([
      db.select().from(t).where(eq(t.workDate, addDays(day, -1))),
      db.select({ name: t.workerName }).from(t).where(and(eq(t.workDate, day))),
    ]);
    const have = new Set(now.map((r) => r.name));
    const rows = prev.filter((r) => !have.has(r.workerName));
    if (!rows.length) throw new UserError("Tidak ada pekerja kemarin yang belum diabsen hari ini.");
    for (const r of rows) {
      await db.insert(t).values({
        workDate: day, workerName: r.workerName, task: r.task, payType: r.payType, status: "hadir",
        startTime: r.startTime, endTime: r.endTime, hours: r.hours, createdBy: me.id, createdByName: me.name,
      });
    }
    await logActivity(me, { action: "absensi.salin", label: "Menyalin absensi kemarin", summary: `${day} · ${rows.length} pekerja` });
    return { ok: `${rows.length} pekerja disalin dari kemarin.` };
  });
  if (!("error" in res)) revalidatePath(BASE);
  return res;
}
