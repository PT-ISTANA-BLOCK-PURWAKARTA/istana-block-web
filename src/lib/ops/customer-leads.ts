import "server-only";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { chunk } from "@/lib/erp/server";
import { normalizePhone, type LeadRow } from "./customer-leads-core";

export * from "./customer-leads-core";

const cl = schema.customerLeads;

/** Semua konsumen pada rentang tanggal, urut naik (terbaru dibalik di tampilan), lengkap dengan nama petugas. */
export async function loadLeads(from: string, to: string): Promise<LeadRow[]> {
  const db = await getDb();
  const rows = await db.select().from(cl).where(and(gte(cl.contactDate, from), lte(cl.contactDate, to))).orderBy(asc(cl.contactDate), asc(cl.createdAt));
  const ids = [...new Set(rows.flatMap((r) => [r.ratedBy, r.getbackBy]).filter((x): x is number => x !== null))];
  const names = new Map<number, string>();
  for (const part of chunk(ids)) {
    const us = await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(inArray(schema.users.id, part));
    for (const u of us) names.set(u.id, u.name);
  }
  return rows.map((r) => ({
    id: r.id, contactDate: r.contactDate, source: r.source, name: r.name, phone: r.phone, address: r.address, product: r.product, status: r.status,
    saleValue: r.saleValue, priceNett: r.priceNett, priceOffer: r.priceOffer, reasons: r.reasons ?? [], notes: r.notes,
    ratingService: r.ratingService, ratingQuality: r.ratingQuality, ratingSpeed: r.ratingSpeed, ratingNote: r.ratingNote,
    feedback: r.feedback, complaintDate: r.complaintDate, complaintNote: r.complaintNote, getbackDate: r.getbackDate, getbackNote: r.getbackNote,
    getbackResult: r.getbackResult, getbackByName: r.getbackBy ? (names.get(r.getbackBy) ?? null) : null, ratedByName: r.ratedBy ? (names.get(r.ratedBy) ?? null) : null,
    contactId: r.contactId,
  }));
}

/**
 * Cari pelanggan web (fin_contacts) yang HP-nya sama setelah dinormalisasi. Pelanggan didahulukan dari jenis lain.
 * Hanya dipakai saat menyimpan konsumen yang belum bertaut; hasil null = tidak ada yang cocok (tautan opsional).
 */
export async function findContactByPhone(phone: string | null): Promise<string | null> {
  const want = normalizePhone(phone);
  if (!want) return null;
  const db = await getDb();
  const rows = await db.select({ id: schema.contacts.id, phone: schema.contacts.phone, kind: schema.contacts.kind }).from(schema.contacts).where(eq(schema.contacts.active, true));
  const hit = rows.filter((c) => normalizePhone(c.phone) === want);
  return (hit.find((c) => c.kind === "pelanggan") ?? hit[0])?.id ?? null;
}
