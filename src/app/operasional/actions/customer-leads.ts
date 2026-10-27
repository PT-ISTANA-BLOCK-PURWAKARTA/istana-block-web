"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import type { FormState } from "@/components/admin/FormMessage";
import { getDb, schema } from "@/db";
import { leadReasons, leadStatuses, type LeadReason, type LeadStatus } from "@/db/erp";
import { requirePerm } from "@/lib/auth";
import { chunk, guard, insertMany, runBatch, UserError } from "@/lib/erp/server";
import { isDate, today } from "@/lib/erp/util";
import { logActivity } from "@/lib/ops/activity";
import {
  digitsToInt, findContactByPhone, isChip, loadLeads, matchChip, matchQuery, monthlySummary, normalizePhone,
  type ImportLead, type LeadChip, type LeadRow, type MonthlyRow,
} from "@/lib/ops/customer-leads";

const cl = schema.customerLeads;

/** Muat ulang halaman Rekap Pelanggan dan Rekap ISO (Sasaran Mutu ikut berubah). */
function refresh() {
  revalidatePath("/operasional/rekap-pelanggan");
  revalidatePath("/operasional/rekap-iso");
}

function str(form: FormData, key: string, label: string, max: number, required = false) {
  const v = String(form.get(key) ?? "").trim();
  if (required && !v) throw new UserError(`Isi ${label}.`);
  if (v.length > max) throw new UserError(`${label} maksimal ${max} huruf.`);
  return v;
}

function optDate(form: FormData, key: string, label: string): string | null {
  const v = String(form.get(key) ?? "").trim();
  if (!v) return null;
  if (!isDate(v)) throw new UserError(`${label} tidak valid.`);
  return v;
}

/** Bintang 1-5; kosong = null. */
function star(form: FormData, key: string): number | null {
  const v = String(form.get(key) ?? "").trim();
  if (!v) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 5) throw new UserError("Bintang harus 1 sampai 5.");
  return n;
}

function reasonsOf(raw: unknown): LeadReason[] {
  let list: unknown;
  try {
    list = JSON.parse(String(raw ?? "[]"));
  } catch {
    list = [];
  }
  return leadReasons.filter((c) => Array.isArray(list) && list.includes(c));
}

/** Tambah / ubah konsumen (id terisi = ubah). */
export async function saveLeadAction(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("rekap_pelanggan");
  const res = await guard(async () => {
    const db = await getDb();
    const id = String(form.get("id") ?? "").trim();
    const contactDate = String(form.get("contactDate") ?? "").trim();
    if (!isDate(contactDate)) throw new UserError("Tanggal wajib diisi dengan benar.");
    const status = String(form.get("status") ?? "");
    if (!leadStatuses.includes(status as LeadStatus)) throw new UserError("Status tidak valid.");
    const name = str(form, "name", "Nama pelanggan", 120, true);
    const rawPhone = str(form, "phone", "No. WA", 30);
    const phone = rawPhone ? (normalizePhone(rawPhone) ?? rawPhone) : null;
    const buyer = status === "membeli";
    const values = {
      contactDate,
      source: str(form, "source", "Sumber", 40) || "Lainnya",
      name,
      phone,
      address: str(form, "address", "Alamat", 300) || null,
      product: str(form, "product", "Produk", 200) || null,
      status: status as LeadStatus,
      saleValue: buyer ? digitsToInt(form.get("saleValue")) : null,
      priceNett: digitsToInt(form.get("priceNett")),
      priceOffer: digitsToInt(form.get("priceOffer")),
      // Alasan tidak membeli hanya bermakna untuk yang tidak jadi membeli.
      reasons: buyer ? [] : reasonsOf(form.get("reasons")),
      notes: str(form, "notes", "Keterangan", 500) || null,
      updatedAt: new Date(),
    };
    if (id) {
      const [row] = await db.select({ id: cl.id, contactId: cl.contactId }).from(cl).where(eq(cl.id, id)).limit(1);
      if (!row) throw new UserError("Data konsumen tidak ditemukan.");
      const contactId = row.contactId ?? (await findContactByPhone(phone));
      await db.update(cl).set({ ...values, contactId }).where(eq(cl.id, id));
      await logActivity(me, { action: "pelanggan.ubah", label: "Mengubah data konsumen", summary: `${name} · ${contactDate}` });
    } else {
      const contactId = await findContactByPhone(phone);
      await db.insert(cl).values({ ...values, contactId, createdBy: me.id });
      await logActivity(me, { action: "pelanggan.tambah", label: "Menambah data konsumen", summary: `${name} · ${contactDate}` });
    }
    refresh();
    return { ok: "Data konsumen tersimpan" };
  });
  return res;
}

/** Penilaian pembeli: bintang 3 aspek, Puas / Komplain, dan get back. */
export async function rateLeadAction(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("rekap_pelanggan");
  return guard(async () => {
    const db = await getDb();
    const id = String(form.get("id") ?? "").trim();
    const [row] = await db.select().from(cl).where(eq(cl.id, id)).limit(1);
    if (!row) throw new UserError("Data konsumen tidak ditemukan.");
    if (row.status !== "membeli") throw new UserError("Hanya konsumen berstatus Membeli yang bisa dinilai.");
    const ratingService = star(form, "ratingService");
    const ratingQuality = star(form, "ratingQuality");
    const ratingSpeed = star(form, "ratingSpeed");
    const ratingNote = str(form, "ratingNote", "Catatan pembeli", 500) || null;
    const fb = String(form.get("feedback") ?? "");
    if (fb && fb !== "puas" && fb !== "komplain") throw new UserError("Keterangan pembeli tidak valid.");
    const feedback = (fb || null) as "puas" | "komplain" | null;

    let complaintDate: string | null = null, complaintNote: string | null = null;
    let getbackDate: string | null = null, getbackNote: string | null = null;
    let getbackResult: "puas" | "tidak_puas" | null = null;
    if (feedback === "komplain") {
      complaintNote = str(form, "complaintNote", "Isi komplain", 500) || null;
      if (!complaintNote) throw new UserError("Tulis isi komplain pembeli.");
      complaintDate = optDate(form, "complaintDate", "Tanggal komplain") ?? today();
      getbackDate = optDate(form, "getbackDate", "Tanggal get back");
      getbackNote = str(form, "getbackNote", "Catatan get back", 500) || null;
      const gr = String(form.get("getbackResult") ?? "");
      if (gr && gr !== "puas" && gr !== "tidak_puas") throw new UserError("Hasil get back tidak valid.");
      if (gr && !getbackDate) throw new UserError("Isi tanggal get back dulu.");
      if (getbackDate && getbackDate < complaintDate) throw new UserError("Tanggal get back tidak boleh sebelum tanggal komplain.");
      getbackResult = (gr || null) as typeof getbackResult;
    }
    const nothing = ratingService === null && ratingQuality === null && ratingSpeed === null && !feedback && !ratingNote;
    const getbackChanged = getbackDate !== row.getbackDate || getbackNote !== row.getbackNote || getbackResult !== row.getbackResult;
    await db.update(cl).set({
      ratingService, ratingQuality, ratingSpeed, ratingNote, feedback,
      complaintDate, complaintNote, getbackDate, getbackNote, getbackResult,
      ratedBy: nothing ? null : me.id,
      ratedAt: nothing ? null : new Date(),
      getbackBy: !getbackDate ? null : getbackChanged ? me.id : row.getbackBy,
      updatedAt: new Date(),
    }).where(eq(cl.id, id));
    await logActivity(me, { action: "pelanggan.nilai", label: "Menilai pembeli", summary: `${row.name}${feedback ? ` · ${feedback}` : ""}` });
    refresh();
    return { ok: "Penilaian tersimpan" };
  });
}

export async function deleteLeadAction(id: string): Promise<FormState> {
  const me = await requirePerm("rekap_pelanggan");
  return guard(async () => {
    const db = await getDb();
    const [row] = await db.select({ name: cl.name, contactDate: cl.contactDate }).from(cl).where(eq(cl.id, id)).limit(1);
    if (!row) throw new UserError("Data konsumen tidak ditemukan.");
    await db.delete(cl).where(eq(cl.id, id));
    await logActivity(me, { action: "pelanggan.hapus", label: "Menghapus data konsumen", summary: `${row.name} · ${row.contactDate}` });
    refresh();
    return { ok: "Data dihapus" };
  });
}

/** Impor potongan (<= 300) konsumen hasil baca Excel. Kunci impor yang sudah ada dilewati (penilaian tidak tertimpa). */
export async function importLeadsAction(input: ImportLead[]): Promise<{ added: number; skipped: number } | { error: string }> {
  const me = await requirePerm("rekap_pelanggan");
  return guard(async () => {
    if (!Array.isArray(input) || !input.length) throw new UserError("Tidak ada data konsumen yang terbaca.");
    if (input.length > 300) throw new UserError("Maksimal 300 konsumen per kiriman.");
    const db = await getDb();
    const clean = new Map<string, typeof cl.$inferInsert>();
    for (const x of input) {
      const key = String(x?.importKey ?? "").trim().slice(0, 120);
      const name = String(x?.name ?? "").trim().slice(0, 120);
      if (!key || !name || !isDate(x?.contactDate) || !leadStatuses.includes(x.status)) throw new UserError("Ada baris impor yang tidak valid.");
      if (clean.has(key)) continue;
      const buyer = x.status === "membeli";
      clean.set(key, {
        importKey: key, contactDate: x.contactDate, source: "Google Ads", name,
        phone: normalizePhone(x.phone), address: String(x.address ?? "").trim().slice(0, 300) || null, product: String(x.product ?? "").trim().slice(0, 200) || null,
        status: x.status, saleValue: buyer ? digitsToInt(x.saleValue) : null, priceNett: digitsToInt(x.priceNett), priceOffer: digitsToInt(x.priceOffer),
        reasons: buyer ? [] : reasonsOf(JSON.stringify(x.reasons ?? [])), notes: String(x.notes ?? "").trim().slice(0, 500) || null, createdBy: me.id,
      });
    }
    const exists = new Set<string>();
    for (const part of chunk([...clean.keys()])) {
      const rows = await db.select({ k: cl.importKey }).from(cl).where(inArray(cl.importKey, part));
      for (const r of rows) if (r.k) exists.add(r.k);
    }
    const fresh = [...clean.entries()].filter(([k]) => !exists.has(k)).map(([, v]) => v);
    await runBatch(db, insertMany(db, cl, fresh));
    const added = fresh.length;
    await logActivity(me, { action: "pelanggan.impor", label: "Impor konsumen dari Excel", summary: `${added} ditambahkan, ${input.length - added} dilewati` });
    refresh();
    return { added, skipped: input.length - added };
  });
}

/** Data untuk ekspor Excel: daftar tersaring (chip + cari) + ringkasan per bulan dari SELURUH periode. */
export async function exportLeadsAction(input: { from: string; to: string; chip: LeadChip; q: string }): Promise<{ rows: LeadRow[]; monthly: MonthlyRow[] } | { error: string }> {
  await requirePerm("rekap_pelanggan");
  return guard(async () => {
    if (!isDate(input.from) || !isDate(input.to) || input.from > input.to) throw new UserError("Periode tidak valid.");
    const all = await loadLeads(input.from, input.to);
    const chip = isChip(input.chip) ? input.chip : "semua";
    const q = String(input.q ?? "").slice(0, 100);
    return { rows: all.filter((r) => matchChip(r, chip) && matchQuery(r, q)), monthly: monthlySummary(all) };
  });
}
