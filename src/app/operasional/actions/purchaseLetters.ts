"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import type { FormState } from "@/components/admin/FormMessage";
import { getDb, schema } from "@/db";
import type { PurchaseLetterItem } from "@/db/erp";
import { requireModule } from "@/lib/auth";
import { guard, UserError } from "@/lib/erp/server";
import { isDate } from "@/lib/erp/util";
import { logActivity } from "@/lib/ops/activity";
import { canPurchaseLetters, nextPurchaseLetterNumber } from "@/lib/ops/purchaseLetters";

const BASE = "/akuntansi/dokumen/surat-pesanan";
const txt = (form: FormData, key: string, max = 300) => {
  const v = String(form.get(key) ?? "").trim();
  return v ? v.slice(0, max) : null;
};
/** "1.250.000" / "1250000,5" -> angka. */
const amount = (v: unknown) => {
  const clean = String(v ?? "").replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  return clean && Number.isFinite(Number(clean)) ? Number(clean) : null;
};

async function requireOffice() {
  const me = await requireModule("keuangan");
  if (!canPurchaseLetters(me.roles)) throw new UserError("Surat pesanan hanya dibuat Keuangan.");
  return me;
}

/** Simpan surat pesanan. intent=draft (belum bernomor resmi) atau final (nomor 001/SP-IBP/bulan-romawi/tahun). */
export async function savePurchaseLetter(_prev: FormState, form: FormData): Promise<FormState> {
  const res = await guard(async () => {
    const me = await requireOffice();
    const draft = form.get("intent") === "draft";
    const letterDate = String(form.get("letterDate") ?? "");
    if (!isDate(letterDate)) throw new UserError("Tanggal surat tidak valid.");
    let raw: unknown[] = [];
    try { raw = JSON.parse(String(form.get("items") ?? "[]")); } catch { throw new UserError("Daftar barang tidak valid."); }
    const items: PurchaseLetterItem[] = raw
      .map((r) => r as Record<string, unknown>)
      .filter((r) => String(r.name ?? "").trim())
      .slice(0, 50)
      .map((r) => ({ name: String(r.name).trim().slice(0, 200), quantity: amount(r.quantity), unit: String(r.unit ?? "").trim().slice(0, 30) || null, price: amount(r.price), total: amount(r.total), note: String(r.note ?? "").trim().slice(0, 200) || null }));
    const supplierName = String(form.get("supplierName") ?? "").trim().slice(0, 200);
    if (!draft && supplierName.length < 2) throw new UserError("Isi nama toko / pemasok (Kepada).");
    if (!draft && !items.length) throw new UserError("Isi minimal satu barang.");
    const signerId = Number(form.get("signerId")) || null;
    const signer = signerId ? await (await getDb()).query.users.findFirst({ where: eq(schema.users.id, signerId) }) : undefined;
    const days = Number(form.get("paymentDays"));
    let isoKeys: string[] = [];
    try { isoKeys = (JSON.parse(String(form.get("isoKeys") ?? "[]")) as unknown[]).map(String).slice(0, 50); } catch { isoKeys = []; }
    const values = {
      letterDate, supplierName, contactName: txt(form, "contactName", 120), contactPhone: txt(form, "contactPhone", 40), supplierAddress: txt(form, "supplierAddress"),
      items, showPrices: form.get("showPrices") === "on", deliveryTo: txt(form, "deliveryTo"), neededBy: txt(form, "neededBy", 20),
      receiverName: txt(form, "receiverName", 120), receiverPhone: txt(form, "receiverPhone", 40), payment: txt(form, "payment", 200),
      paymentDays: Number.isFinite(days) && days > 0 ? Math.round(days) : null, note: txt(form, "note", 1000), isoKeys,
      signerId: signer?.id ?? null, signerName: signer?.name ?? null, signerTitle: txt(form, "signerTitle", 80),
    };
    const db = await getDb();
    const t = schema.purchaseLetters;
    const id = String(form.get("id") ?? "");
    let number: string;
    if (id) {
      const row = await db.query.purchaseLetters.findFirst({ where: eq(t.id, id) });
      if (!row) throw new UserError("Surat tidak ditemukan.");
      // Draft -> final: baru mendapat nomor resmi. Surat final tetap final (nomor tidak berubah).
      const finalize = row.status === "draft" && !draft;
      const n = finalize ? await nextPurchaseLetterNumber(db, letterDate) : null;
      await db.update(t).set({ ...values, ...(n ? { seq: n.seq, number: n.number, status: "final" as const } : {}), updatedAt: new Date() }).where(eq(t.id, id));
      number = n?.number ?? row.number;
    } else {
      const n = draft ? { seq: 0, number: `DRAFT-${Date.now().toString(36).toUpperCase()}` } : await nextPurchaseLetterNumber(db, letterDate);
      await db.insert(t).values({ ...values, ...n, status: draft ? "draft" : "final", createdBy: me.id, createdByName: me.name });
      number = n.number;
    }
    await logActivity(me, { action: "surat_pesanan.simpan", label: draft ? "Menyimpan draft surat pesanan" : "Menyimpan surat pesanan", summary: `${number} · ${supplierName}` });
    return { number, draft };
  });
  if ("error" in res) return res;
  redirect(`${BASE}?ok=${encodeURIComponent(res.draft ? "~Draft tersimpan." : `~Surat ${res.number} tersimpan.`)}`);
}

export async function deletePurchaseLetter(id: string): Promise<FormState> {
  const res = await guard(async () => {
    const me = await requireOffice();
    const db = await getDb();
    const row = await db.query.purchaseLetters.findFirst({ where: eq(schema.purchaseLetters.id, id) });
    if (!row) throw new UserError("Surat tidak ditemukan.");
    await db.delete(schema.purchaseLetters).where(eq(schema.purchaseLetters.id, id));
    await logActivity(me, { action: "surat_pesanan.hapus", label: "Menghapus surat pesanan", summary: `${row.number} · ${row.supplierName}` });
    return { ok: "Surat dihapus." };
  });
  if (!("error" in res)) revalidatePath(BASE);
  return res;
}
