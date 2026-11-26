// Penanda tangan dokumen kantor (surat penawaran, invoice): akun pemilik / keuangan / pimpinan, TTD dari gambar profil.
import { sql } from "drizzle-orm";
import type { getDb } from "@/db";
import type { Signer } from "@/lib/erp/quotation";

export async function documentSigners(db: Awaited<ReturnType<typeof getDb>>): Promise<Signer[]> {
  const rows = await db.all<{ id: number; name: string; roles: string; signature_key: string | null }>(
    sql`select id, name, roles, signature_key from users where email is not null and (roles like '%"owner"%' or roles like '%"keuangan"%' or roles like '%"pimpinan"%') order by name`,
  );
  return rows.map((r) => ({ id: r.id, name: r.name, title: r.roles.includes('"pimpinan"') ? "Pimpinan" : "Head Office", hasSignature: Boolean(r.signature_key) }));
}

/** Nama barang untuk saran isian: barang aktif di data persediaan. */
export async function productNames(db: Awaited<ReturnType<typeof getDb>>): Promise<string[]> {
  const rows = await db.all<{ name: string }>(sql`select distinct name from fin_items where active = 1 order by name`);
  return rows.map((r) => r.name);
}
