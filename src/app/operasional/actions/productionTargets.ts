"use server";

// Target produksi standar & alasan tidak tercapai (padanan production.setTarget / removeTarget / saveTargetReason app lama).
// Yang boleh: akun yang menginput hasil produksi (mandor, QC, kantor/gudang).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import type { FormState } from "@/components/admin/FormMessage";
import { getDb, schema } from "@/db";
import { guard, UserError } from "@/lib/erp/server";
import { isDate } from "@/lib/erp/util";
import { productionAccess } from "@/lib/ops/production";

const BASE = "/operasional/target-produksi";
/** "1.190" / "160,5" (format Indonesia) atau "160.5". Ada koma → titik = pemisah ribuan. */
const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  const n = s.includes(",") ? Number(s.replace(/\./g, "").replace(",", ".")) : Number(s);
  return s && Number.isFinite(n) ? n : NaN;
};
const text = (v: FormDataEntryValue | null, max: number) => String(v ?? "").trim().slice(0, max);

async function canInput() {
  const acc = await productionAccess();
  if (!acc.canEdit) throw new UserError("Hanya yang menginput hasil produksi yang boleh mengatur target.");
  return acc.user;
}

/** Simpan / ubah target standar (nilai lama masuk riwayat, maks. 20). */
export async function setTargetStandard(_prev: FormState, form: FormData): Promise<FormState> {
  const res = await guard(async () => {
    const me = await canInput();
    const key = text(form.get("key"), 200);
    const label = text(form.get("label"), 200);
    const unit = text(form.get("unit"), 20) || "pcs";
    const target = num(form.get("target"));
    if (key.length < 3 || label.length < 2) throw new UserError("Produk tidak dikenal.");
    if (!(target > 0) || target > 10_000_000) throw new UserError("Isi angka target.");
    const db = await getDb();
    const cur = await db.query.productionTargets.findFirst({ where: eq(schema.productionTargets.key, key) });
    if (cur && cur.target === target) return { ok: "Target tidak berubah." };
    if (cur) {
      const history = [{ target: cur.target, byName: cur.setByName, at: cur.setAt.toISOString() }, ...((cur.history as unknown[]) ?? [])].slice(0, 20);
      await db.update(schema.productionTargets).set({ target, label, unit, setBy: me.id, setByName: me.name, setAt: new Date(), history }).where(eq(schema.productionTargets.key, key));
    } else {
      await db.insert(schema.productionTargets).values({ key, label, unit, target, setBy: me.id, setByName: me.name, setAt: new Date(), history: [] });
    }
    return { ok: `Target standar ${label} tersimpan.` };
  });
  if ("error" in res) return res;
  revalidatePath(BASE);
  // Kembali ke daftar standar dengan isian tertutup (seperti app lama).
  const back = String(form.get("back") ?? "");
  if (back.startsWith(`${BASE}?`) && !/[<>"'\s]/.test(back)) redirect(`${back}&ok=${encodeURIComponent(res.ok ?? "Tersimpan.")}`);
  return res;
}

export async function removeTargetStandard(key: string): Promise<FormState> {
  const res = await guard(async () => {
    await canInput();
    const db = await getDb();
    await db.delete(schema.productionTargets).where(eq(schema.productionTargets.key, key));
    return { ok: "Target standar dihapus." };
  });
  if (!("error" in res)) revalidatePath(BASE);
  return res;
}

/** Alasan target tidak tercapai: satu per produk per tanggal (menimpa yang lama). */
export async function saveTargetReason(_prev: FormState, form: FormData): Promise<FormState> {
  const res = await guard(async () => {
    const me = await canInput();
    const key = text(form.get("key"), 200);
    const workDate = String(form.get("workDate") ?? "");
    const label = text(form.get("label"), 200);
    const target = num(form.get("target"));
    const actual = num(form.get("actual"));
    const reason = text(form.get("reason"), 500);
    if (key.length < 3 || !isDate(workDate)) throw new UserError("Data target tidak valid.");
    if (reason.length < 3) throw new UserError("Tulis alasannya.");
    if (!(target > 0) || !(actual >= 0)) throw new UserError("Angka target tidak valid.");
    const db = await getDb();
    const r = schema.productionTargetReasons;
    await db.delete(r).where(and(eq(r.key, key), eq(r.workDate, workDate)));
    await db.insert(r).values({ key, workDate, label, target, actual, reason, createdBy: me.id, createdByName: me.name, createdAt: new Date() });
    return { ok: "Alasan tersimpan." };
  });
  if (!("error" in res)) revalidatePath(BASE);
  return res;
}
