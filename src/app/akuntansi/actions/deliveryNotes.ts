"use server";

// Surat jalan manual (tanpa harga) — dipakai untuk Surat Jalan IBN di Anak Perusahaan (proyek U-Ditch).
// Nomor urut per penerbit melanjutkan app lama (SJ-IBN-M000068 …); boleh diisi sendiri, harus unik.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import type { FormState } from "@/components/admin/FormMessage";
import { getDb, schema } from "@/db";
import { requireAnyModule } from "@/lib/auth";
import { deliveryNoteNumber } from "@/lib/erp/deliveryNote";
import { guard, parseRows, UserError } from "@/lib/erp/server";
import { isDate } from "@/lib/erp/util";
import { logActivity } from "@/lib/ops/activity";
import { can } from "@/lib/roles";

async function editor() {
  const me = await requireAnyModule("keuangan", "anak");
  if (!can(me.roles, "keuangan")) throw new UserError("Hanya kantor/keuangan yang boleh membuat surat jalan.");
  return me;
}
const pathOf = (issuer: string) => (issuer === "ibn" ? "/anak-usaha/surat-jalan-ibn" : "/akuntansi/dokumen/surat-jalan?tab=arsip");
const num = (v: unknown) => { const t = String(v ?? "").replace(/\./g, "").replace(",", ".").trim(); const n = Number(t); return t && Number.isFinite(n) ? n : 0; };

export async function saveDeliveryNote(_prev: FormState, form: FormData): Promise<FormState> {
  const issuer = ["ib", "ibn", "polos"].includes(String(form.get("issuer"))) ? String(form.get("issuer")) : "ibn";
  const res = await guard(async () => {
    const me = await editor();
    const db = await getDb();
    const id = String(form.get("id") ?? "");
    const noteDate = String(form.get("noteDate") ?? "");
    if (!isDate(noteDate)) throw new UserError("Isi tanggal surat jalan.");
    const customerName = String(form.get("customerName") ?? "").trim();
    if (!customerName) throw new UserError("Isi nama penerima (Kepada).");
    const items = parseRows(form.get("items")).map((r) => ({ name: String(r.name ?? "").trim(), quantity: num(r.quantity), unit: String(r.unit ?? "").trim() || "pcs", ...(String(r.remark ?? "").trim() ? { remark: String(r.remark).trim() } : {}) })).filter((i) => i.name);
    if (!items.length) throw new UserError("Isi minimal satu barang.");
    if (items.some((i) => !(i.quantity > 0))) throw new UserError("Isi jumlah untuk setiap barang.");
    const s = (k: string) => String(form.get(k) ?? "").trim() || null;
    const pickup = form.get("pickup") === "on";
    const signerId = Number(form.get("signerId")) || null;
    const signer = signerId ? await db.query.users.findFirst({ where: eq(schema.users.id, signerId) }) : undefined;
    const values = {
      noteDate, poNumber: s("poNumber"), terms: s("terms"), customerName, customerPhone: s("customerPhone"), address: s("address"), note: s("note"), items,
      driverName: pickup ? "DIAMBIL" : s("driverName"), plate: pickup ? null : s("plate"), pickup, isInternal: form.get("isInternal") === "on",
      signerId: signer?.id ?? null, signerName: s("signerName") ?? signer?.name ?? null, updatedAt: new Date(),
    };
    const custom = s("number")?.toUpperCase();
    if (custom) {
      const taken = await db.get<{ id: string }>(sql`select id from ops_delivery_notes where number = ${custom} limit 1`);
      if (taken && taken.id !== id) throw new UserError(`Nomor ${custom} sudah dipakai surat jalan lain.`);
    }
    if (id) {
      await db.update(schema.deliveryNotes).set({ ...values, ...(custom ? { number: custom } : {}) }).where(eq(schema.deliveryNotes.id, id));
      await logActivity(me, { action: "keuangan.surat_jalan.ubah", label: "Mengubah surat jalan manual", summary: custom ?? id });
      return { id };
    }
    const m = await db.get<{ s: number }>(sql`select coalesce(max(seq), 0) s from ops_delivery_notes where issuer = ${issuer}`);
    const seq = Number(m?.s ?? 0) + 1;
    const newId = crypto.randomUUID();
    const number = custom ?? deliveryNoteNumber(seq, issuer);
    await db.insert(schema.deliveryNotes).values({ id: newId, issuer, seq: custom ? 0 : seq, number, ...values, createdBy: me.id, createdByName: me.name });
    await logActivity(me, { action: "keuangan.surat_jalan.buat", label: "Membuat surat jalan manual", summary: number });
    return { id: newId };
  });
  if ("error" in res) return res;
  revalidatePath(pathOf(issuer).split("?")[0]);
  redirect(`${pathOf(issuer).split("?")[0]}?ok=1`);
}

export async function deleteDeliveryNote(id: string): Promise<{ ok?: string; error?: string }> {
  const res = await guard(async () => {
    const me = await editor();
    const db = await getDb();
    const n = await db.query.deliveryNotes.findFirst({ where: eq(schema.deliveryNotes.id, id) });
    if (!n) return { ok: "" };
    await db.delete(schema.deliveryNotes).where(eq(schema.deliveryNotes.id, id));
    await logActivity(me, { action: "keuangan.surat_jalan.hapus", label: "Menghapus surat jalan manual", summary: n.number });
    revalidatePath(pathOf(n.issuer).split("?")[0]);
    return { ok: `Surat jalan ${n.number} dihapus.` };
  });
  return res;
}
