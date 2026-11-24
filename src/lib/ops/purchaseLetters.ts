// Surat pesanan barang ke pemasok (eksternal): versi resmi dari F-IB-10 (internal), nomor urut otomatis per tahun.
import "server-only";
import { and, desc, eq, inArray, like, max } from "drizzle-orm";
import { schema } from "@/db";
import type { DB } from "@/lib/erp/server";
import type { Role } from "@/lib/roles";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

/** Contoh: 001/SP-IBP/XI/2026 (tanggal surat YYYY-MM-DD). */
export const purchaseLetterNumber = (seq: number, date: string) => `${String(seq).padStart(3, "0")}/SP-IBP/${ROMAN[Number(date.slice(5, 7)) - 1]}/${date.slice(0, 4)}`;

/** Surat pesanan hanya dibuat kantor (pemilik / operasional). */
export const canPurchaseLetters = (roles: readonly Role[]) => roles.includes("owner") || roles.includes("operasional");

export async function nextPurchaseLetterNumber(db: DB, date: string) {
  const t = schema.purchaseLetters;
  const [row] = await db.select({ seq: max(t.seq) }).from(t).where(and(like(t.number, `%/${date.slice(0, 4)}`), eq(t.status, "final")));
  const seq = (row?.seq ?? 0) + 1;
  return { seq, number: purchaseLetterNumber(seq, date) };
}

export type PurchaseLetterRow = typeof schema.purchaseLetters.$inferSelect & { signerSignatureKey: string | null };

/** Semua surat (terbaru di atas) + kunci gambar tanda tangan penanda tangan. */
export async function listPurchaseLetters(db: DB): Promise<PurchaseLetterRow[]> {
  const t = schema.purchaseLetters;
  const rows = await db.select().from(t).orderBy(desc(t.letterDate), desc(t.seq)).limit(2000);
  const ids = [...new Set(rows.flatMap((r) => (r.signerId ? [r.signerId] : [])))];
  const people = ids.length ? await db.select({ id: schema.users.id, key: schema.users.signatureKey }).from(schema.users).where(inArray(schema.users.id, ids)) : [];
  return rows.map((r) => ({ ...r, signerSignatureKey: people.find((p) => p.id === r.signerId)?.key ?? null }));
}

export async function getPurchaseLetter(db: DB, id: string): Promise<PurchaseLetterRow | null> {
  const r = await db.query.purchaseLetters.findFirst({ where: eq(schema.purchaseLetters.id, id) });
  if (!r) return null;
  const signer = r.signerId ? await db.query.users.findFirst({ where: eq(schema.users.id, r.signerId) }) : undefined;
  return { ...r, signerSignatureKey: signer?.signatureKey ?? null };
}

/** Kontak pemasok dari surat sebelumnya (terbaru per nama) untuk isi otomatis. */
export async function purchaseLetterContacts(db: DB) {
  const t = schema.purchaseLetters;
  const rows = await db.select({ supplierName: t.supplierName, contactName: t.contactName, contactPhone: t.contactPhone, supplierAddress: t.supplierAddress }).from(t).orderBy(desc(t.createdAt)).limit(500);
  const seen = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    const k = r.supplierName.trim().toLowerCase();
    if (k && !seen.has(k)) seen.set(k, r);
  }
  return [...seen.values()];
}

/** Penanda tangan: akun kantor & pimpinan yang punya gambar tanda tangan. */
export async function purchaseLetterSigners(db: DB) {
  const rows = await db.select({ id: schema.users.id, name: schema.users.name, roles: schema.users.roles, key: schema.users.signatureKey }).from(schema.users);
  return rows
    .filter((u) => u.key && (Array.isArray(u.roles) ? u.roles : []).some((r) => r === "owner" || r === "operasional" || r === "pimpinan"))
    .map((u) => ({ id: u.id, name: u.name }));
}
