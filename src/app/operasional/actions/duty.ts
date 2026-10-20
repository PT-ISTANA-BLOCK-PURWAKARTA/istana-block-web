"use server";

import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import type { FormState } from "@/components/admin/FormMessage";
import { getDb, schema } from "@/db";
import { requirePerm } from "@/lib/auth";
import { guard, UserError } from "@/lib/erp/server";
import { logActivity } from "@/lib/ops/activity";
import { closeStaleShifts, currentShift } from "@/lib/ops/duty";
import { formatDateTime } from "@/lib/ops/shared/format";

const s = schema.dutyShifts;

/** Mulai piket (absen). Tiap akun hanya boleh punya satu shift yang berjalan; shift basi (> 24 jam) ditutup dulu. */
export async function startDuty(_prev: FormState, _form: FormData): Promise<FormState> {
  const me = await requirePerm("piket");
  const res = await guard(async () => {
    const db = await getDb();
    await closeStaleShifts(db, me.id);
    const open = await currentShift(db, me.id);
    if (open) throw new UserError(`Anda sudah piket sejak ${formatDateTime(open.startedAt)}.`);
    await db.insert(s).values({ userId: me.id, userName: me.name, startedAt: new Date() });
    return true;
  });
  if (typeof res === "object" && "error" in res) return res;
  await logActivity(me, { action: "piket.mulai", label: "Mulai piket" });
  redirect(`/operasional/piket?ok=${encodeURIComponent("~Piket dimulai. Selamat bertugas.")}`);
}

/** Selesai piket dengan catatan serah terima untuk petugas berikutnya (opsional, maks 500 huruf). */
export async function endDuty(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("piket");
  const note = String(form.get("handoverNote") ?? "").trim().slice(0, 500);
  const res = await guard(async () => {
    const db = await getDb();
    await closeStaleShifts(db, me.id);
    const open = await currentShift(db, me.id);
    if (!open) throw new UserError("Anda tidak sedang piket (shift sebelumnya mungkin sudah ditutup otomatis setelah 24 jam).");
    // Semua shift berjalan milik akun ini ditutup sekaligus (menyembuhkan bila ada dua yang terbuka karena klik ganda).
    await db.update(s).set({ endedAt: new Date(), handoverNote: note }).where(and(eq(s.userId, me.id), isNull(s.endedAt)));
    return true;
  });
  if (typeof res === "object" && "error" in res) return res;
  await logActivity(me, { action: "piket.selesai", label: "Selesai piket", summary: note || undefined });
  redirect(`/operasional/piket?ok=${encodeURIComponent("~Piket selesai. Terima kasih.")}`);
}
