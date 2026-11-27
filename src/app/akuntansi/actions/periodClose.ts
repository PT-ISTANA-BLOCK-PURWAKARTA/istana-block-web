"use server";

// Tutup buku & buka kembali periode. Hanya pemilik & pengguna berperan "Tutup Buku" (izin tutup_buku).
// Kunci transaksi = pengaturan fin_lock_date (dipakai assertOpen di semua posting jurnal/stok).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import type { FormState } from "@/components/admin/FormMessage";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { analyzePeriod, auditData, auditLines, buildSnapshot, closeState } from "@/lib/erp/periodClose";
import { isPeriod, MIN_REASON, periodRange } from "@/lib/erp/periodCloseCore";
import { guard, runBatch, UserError } from "@/lib/erp/server";
import { addDays, tgl, today } from "@/lib/erp/util";
import { logActivity } from "@/lib/ops/activity";
import { can } from "@/lib/roles";

async function closer() {
  const me = await requireModule("keuangan");
  if (!can(me.roles, "tutup_buku")) throw new UserError("Hanya pengguna dengan peran Tutup Buku (diberikan pemilik) yang boleh menutup atau membuka kembali buku.");
  return me;
}

const lockOp = (db: Awaited<ReturnType<typeof getDb>>, value: string) =>
  db.insert(schema.settings).values({ key: "fin_lock_date", value }).onConflictDoUpdate({ target: schema.settings.key, set: { value } });

export async function closePeriod(_prev: FormState, form: FormData): Promise<FormState> {
  const period = String(form.get("period") ?? "");
  const res = await guard(async () => {
    const me = await closer();
    if (!isPeriod(period)) throw new UserError("Periode tidak valid.");
    const db = await getDb();
    const st = await closeState(db);
    if (period !== st.next) throw new UserError(`Tutup buku harus berurutan. Periode yang bisa ditutup sekarang: ${periodRange(st.next).label}.`);
    const { to, label } = periodRange(period);
    if (to >= today()) throw new UserError(`Periode ${label} belum selesai (berakhir ${tgl(to)}). Tutup buku bisa dilakukan mulai ${tgl(addDays(to, 1))}.`);
    const a = await analyzePeriod(db, period);
    const note = String(form.get("note") ?? "").trim().slice(0, 2000);
    if (a.counts.masalah > 0) {
      if (form.get("ack") !== "on") throw new UserError(`Masih ada ${a.counts.masalah} masalah. Centang persetujuan untuk tetap menutup buku.`);
      if (note.length < MIN_REASON) throw new UserError(`Tulis alasan tetap menutup walau ada masalah (minimal ${MIN_REASON} huruf). Alasan ini masuk paket audit.`);
    }
    const snapshot = await buildSnapshot(db, a);
    await runBatch(db, [
      db.insert(schema.periodCloses).values({
        period, periodStart: a.from, periodEnd: to, status: "ditutup", lockBefore: st.lockDate, issues: a.counts.masalah, warnings: a.counts.perhatian,
        note, snapshot: JSON.stringify(snapshot), closedBy: me.id, closedByName: me.name,
      }),
      lockOp(db, to),
    ]);
    await logActivity(me, { action: "keuangan.tutup_buku", label: "Menutup buku", summary: `${label} · kunci s.d. ${to} · ${a.counts.masalah} masalah, ${a.counts.perhatian} perhatian`, details: note ? { alasan: note } : undefined });
    return { ok: label };
  });
  if ("error" in res) return res;
  revalidatePath("/akuntansi/tutup-buku");
  redirect(`/akuntansi/tutup-buku/${period}?ok=${encodeURIComponent(`Buku ${res.ok} ditutup.`)}`);
}

export async function reopenPeriod(_prev: FormState, form: FormData): Promise<FormState> {
  const id = String(form.get("id") ?? "");
  const res = await guard(async () => {
    const me = await closer();
    const reason = String(form.get("reason") ?? "").trim().slice(0, 2000);
    if (reason.length < MIN_REASON) throw new UserError(`Tulis alasan membuka kembali (minimal ${MIN_REASON} huruf). Alasan ini masuk jejak audit.`);
    const db = await getDb();
    const st = await closeState(db);
    if (id === "kunci-lama") {
      // Kunci lama dari Pengaturan (tanpa catatan): dikembalikan ke akhir periode terakhir yang benar-benar ditutup.
      if (!st.legacyLock) throw new UserError("Tidak ada kunci lama.");
      const back = st.records.find((r) => r.status === "ditutup" && r.periodEnd < st.lockDate)?.periodEnd ?? "";
      await runBatch(db, [lockOp(db, back)]);
      await logActivity(me, { action: "keuangan.buka_buku", label: "Membuka kunci lama", summary: `kunci ${st.lockDate} → ${back || "tanpa kunci"}`, details: { alasan: reason } });
      return { ok: "Kunci lama dibuka." };
    }
    const rec = await db.query.periodCloses.findFirst({ where: eq(schema.periodCloses.id, id) });
    if (!rec || rec.status !== "ditutup") throw new UserError("Catatan tutup buku tidak ditemukan atau sudah dibuka.");
    if (!st.latest || st.latest.id !== rec.id) throw new UserError("Hanya periode terakhir yang ditutup yang bisa dibuka kembali. Buka dari periode paling akhir dulu.");
    await runBatch(db, [
      db.update(schema.periodCloses).set({ status: "dibuka", reopenedBy: me.id, reopenedByName: me.name, reopenedAt: new Date(), reopenReason: reason }).where(eq(schema.periodCloses.id, rec.id)),
      lockOp(db, rec.lockBefore),
    ]);
    const label = periodRange(rec.period).label;
    await logActivity(me, { action: "keuangan.buka_buku", label: "Membuka kembali buku", summary: `${label} · kunci kembali ke ${rec.lockBefore || "tanpa kunci"}`, details: { alasan: reason } });
    return { ok: `Buku ${label} dibuka kembali.` };
  });
  if ("error" in res) return res;
  revalidatePath("/akuntansi/tutup-buku");
  redirect(`/akuntansi/tutup-buku?ok=${encodeURIComponent(res.ok)}`);
}

/** Data paket audit tanpa baris jurnal (Excel dirangkai di browser). Semua pengguna Keuangan boleh mengunduh. */
export async function getAuditPackage(period: string) {
  const me = await requireModule("keuangan");
  if (!isPeriod(period)) return { error: "Periode tidak valid." } as const;
  const db = await getDb();
  const data = await auditData(db, period);
  await logActivity(me, { action: "keuangan.paket_audit", label: "Mengunduh paket audit", summary: periodRange(period).label });
  return { data, printedBy: me.name, printedAt: new Date().toISOString() } as const;
}

const AUDIT_PAGE = 2000;

/** Baris jurnal paket audit per halaman (offset kelipatan AUDIT_PAGE). */
export async function getAuditLines(period: string, offset: number) {
  await requireModule("keuangan");
  if (!isPeriod(period) || !Number.isInteger(offset) || offset < 0) return { error: "Permintaan tidak valid." } as const;
  const db = await getDb();
  return { lines: await auditLines(db, period, offset, AUDIT_PAGE) } as const;
}
