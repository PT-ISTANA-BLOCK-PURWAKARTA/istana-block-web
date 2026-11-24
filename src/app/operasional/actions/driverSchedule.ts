"use server";

// Jadwal / status sopir harian (satpam, mandor, PIC kendaraan, kantor): Aktif, Istirahat (sampai jam), Libur/Non-aktif dengan alasan.
// Padanan monitor.setDriverSchedule di app lama. "hapus" = kosongkan (kembali "belum diisi").
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import type { FormState } from "@/components/admin/FormMessage";
import { getDb, schema } from "@/db";
import { requirePerm } from "@/lib/auth";
import { guard, UserError } from "@/lib/erp/server";
import { isDate } from "@/lib/erp/util";
import { requireShift } from "@/lib/ops/duty";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function setDriverSchedule(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("muat", "pengiriman", "ekspedisi");
  const res = await guard(async () => {
    const shift = await requireShift(me);
    const db = await getDb();
    const driverId = String(form.get("driverId") ?? "");
    const driver = await db.query.drivers.findFirst({ where: eq(schema.drivers.id, driverId) });
    if (!driver) throw new UserError("Pilih sopir.");
    const days = [...new Set(form.getAll("day").map(String))].filter(isDate).slice(0, 31);
    if (!days.length) throw new UserError("Pilih minimal satu hari.");
    let status = String(form.get("status") ?? "");
    const reason = String(form.get("reason") ?? "").trim();
    // Tombol "Non-aktif" mengirim alasan: Istirahat → istirahat; selain itu → libur dengan alasan di catatan.
    if (status === "nonaktif") status = reason === "Istirahat" ? "istirahat" : "libur";
    if (!["aktif", "istirahat", "libur", "hapus"].includes(status)) throw new UserError("Status tidak dikenal.");
    const untilRaw = String(form.get("untilTime") ?? "").trim();
    if (untilRaw && !TIME.test(untilRaw)) throw new UserError("Jam istirahat tidak valid.");
    const extra = String(form.get("note") ?? "").trim().slice(0, 200);
    const note = [status === "libur" && reason && reason !== "Istirahat" ? reason : null, extra || null].filter(Boolean).join(" · ") || null;
    const by = shift?.userName && shift.userName !== me.name ? `${shift.userName} (${me.name})` : me.name;
    await db.delete(schema.driverSchedules).where(and(eq(schema.driverSchedules.driverId, driverId), inArray(schema.driverSchedules.day, days)));
    if (status !== "hapus") {
      await db.insert(schema.driverSchedules).values(days.map((day) => ({
        driverId, day, status, untilTime: status === "istirahat" && untilRaw ? untilRaw : null, note, setBy: me.id, setByName: by,
      })));
    }
    return { ok: status === "hapus" ? `Jadwal ${driver.name} dikosongkan.` : `${driver.name} ditandai ${status === "aktif" ? "AKTIF" : status === "istirahat" ? "ISTIRAHAT" : "NON-AKTIF"} (${days.length} hari).` };
  });
  if (!("error" in res)) revalidatePath("/operasional/muatan");
  return res;
}
