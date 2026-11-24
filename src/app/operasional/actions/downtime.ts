"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import type { FormState } from "@/components/admin/FormMessage";
import { getDb, schema } from "@/db";
import { requirePerm } from "@/lib/auth";
import { guard, UserError } from "@/lib/erp/server";
import { isDate } from "@/lib/erp/util";
import { logActivity } from "@/lib/ops/activity";
import { canEditDowntime, DOWNTIME_AREAS, durationText } from "@/lib/ops/downtime";
import { PRODUCTION_ISSUES } from "@/lib/ops/shared/goods";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Selisih menit dua jam "HH:MM"; null bila tidak lengkap atau selesai <= mulai. */
function diffMinutes(from: string, to: string) {
  if (!TIME.test(from) || !TIME.test(to)) return null;
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  const v = th * 60 + tm - (fh * 60 + fm);
  return v > 0 ? v : null;
}

function values(form: FormData) {
  const workDate = String(form.get("workDate") ?? "");
  if (!isDate(workDate)) throw new UserError("Tanggal tidak valid.");
  const area = String(form.get("area") ?? "").trim();
  if (area && !DOWNTIME_AREAS.includes(area)) throw new UserError("Area / produk tidak dikenal.");
  const startTime = String(form.get("startTime") ?? "").trim();
  const endTime = String(form.get("endTime") ?? "").trim();
  if ((startTime && !TIME.test(startTime)) || (endTime && !TIME.test(endTime))) throw new UserError("Jam harus berformat JJ:MM.");
  const typed = (Number(form.get("hours")) || 0) * 60 + (Number(form.get("minutes")) || 0);
  const minutes = typed > 0 ? Math.round(typed) : diffMinutes(startTime, endTime) ?? 0;
  if (!minutes) throw new UserError("Isi lama waktu (jam mulai–selesai, atau jam & menit).");
  if (minutes > 24 * 60) throw new UserError("Lama waktu terbuang maksimal 24 jam per catatan.");
  const reasons = form.getAll("reasons").map(String).filter((r) => PRODUCTION_ISSUES.includes(r));
  if (!reasons.length) throw new UserError("Pilih minimal satu alasan.");
  const ws = String(form.get("workersShort") ?? "").trim();
  const workersShort = reasons.includes("Kurang tenaga kerja") && ws ? Math.max(0, Math.round(Number(ws))) || null : null;
  const note = String(form.get("note") ?? "").trim().slice(0, 1000);
  return { workDate, area: area || null, startTime: startTime || null, endTime: endTime || null, minutes, reasons, workersShort, note };
}

function back(date: string, ok: string): never {
  redirect(`/operasional/qc-beton?tab=terbuang&from=${date.slice(0, 7)}-01&to=${date}&ok=${encodeURIComponent(ok)}`);
}

/** Catat / ubah waktu produksi terbuang (QC Beton & kantor). */
export async function saveDowntime(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("qc_beton");
  const res = await guard(async () => {
    const db = await getDb();
    const v = values(form);
    const id = String(form.get("id") ?? "");
    if (id) {
      const row = await db.query.downtimes.findFirst({ where: eq(schema.downtimes.id, id) });
      if (!row) throw new UserError("Catatan tidak ditemukan.");
      if (!canEditDowntime(me, row)) throw new UserError("Hanya pencatat atau kantor yang dapat mengubah.");
      await db.update(schema.downtimes).set({ ...v, updatedAt: new Date() }).where(eq(schema.downtimes.id, id));
    } else {
      await db.insert(schema.downtimes).values({ ...v, scope: "beton", createdBy: me.id, createdByName: me.name });
    }
    await logActivity(me, { action: "qc.waktu_terbuang", label: id ? "Mengubah waktu terbuang" : "Mencatat waktu terbuang", summary: `${v.workDate} · ${durationText(v.minutes)} · ${v.reasons.join(", ")}` });
    return { date: v.workDate };
  });
  if ("error" in res) return res;
  back(res.date, "~Waktu terbuang tersimpan.");
}

export async function deleteDowntime(id: string): Promise<FormState> {
  const me = await requirePerm("qc_beton");
  const res = await guard(async () => {
    const db = await getDb();
    const row = await db.query.downtimes.findFirst({ where: eq(schema.downtimes.id, id) });
    if (!row) throw new UserError("Catatan tidak ditemukan.");
    if (!canEditDowntime(me, row)) throw new UserError("Hanya pencatat atau kantor yang dapat menghapus.");
    await db.delete(schema.downtimes).where(eq(schema.downtimes.id, id));
    await logActivity(me, { action: "qc.waktu_terbuang_hapus", label: "Menghapus waktu terbuang", summary: `${row.workDate} · ${durationText(row.minutes)}` });
    return { ok: "Catatan dihapus." };
  });
  if (!("error" in res)) revalidatePath("/operasional/qc-beton");
  return res;
}
