"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import type { FormState } from "@/components/admin/FormMessage";
import { getDb, schema } from "@/db";
import { accountGroups, contactKinds, itemKinds } from "@/db/erp";
import { requireModule, requirePerm } from "@/lib/auth";
import { FIN_DEFAULTS, guard, UserError } from "@/lib/erp/server";
import { isDate, parseQty, parseRupiah } from "@/lib/erp/util";

const str = (max: number) => z.string().trim().max(max).default("");

/* ------------------------------------------------------------ kontak */

const ContactInput = z.object({
  kind: z.enum(contactKinds),
  name: z.string().trim().min(2, "Nama minimal 2 huruf.").max(120),
  company: str(120),
  phone: str(40),
  email: str(120),
  address: str(500),
  npwp: str(30),
  termDays: z.coerce.number().int().min(0).max(365).default(0),
  note: str(1000),
});

export async function saveContact(back: string, _prev: FormState, form: FormData): Promise<FormState> {
  await requirePerm("keuangan", "pesanan");
  const id = String(form.get("id") ?? "");
  const p = ContactInput.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Data tidak valid." };
  const db = await getDb();
  // Kotak centang yang tidak dicentang tidak terkirim; penanda active_field memastikan "Aktif" bisa dimatikan.
  const values = { ...p.data, active: form.get("active_field") ? form.get("active") === "on" : true, updatedAt: new Date() };
  if (id) await db.update(schema.contacts).set(values).where(eq(schema.contacts.id, id));
  else await db.insert(schema.contacts).values(values);
  redirect(`${back}?ok=${encodeURIComponent(p.data.name)}`);
}

export async function deleteContact(back: string, id: string) {
  await requirePerm("keuangan", "pesanan");
  const db = await getDb();
  const used = await db.get<{ n: number }>(sql`
    select (select count(*) from fin_invoices where contact_id = ${id}) + (select count(*) from fin_bills where contact_id = ${id})
      + (select count(*) from ops_orders where contact_id = ${id}) + (select count(*) from fin_receipts where contact_id = ${id})
      + (select count(*) from fin_payments where contact_id = ${id}) + (select count(*) from fin_cash_txns where contact_id = ${id}) as n`);
  if (Number(used?.n ?? 0) > 0) {
    // Sudah dipakai transaksi: nonaktifkan saja agar riwayat tetap utuh.
    await db.update(schema.contacts).set({ active: false, updatedAt: new Date() }).where(eq(schema.contacts.id, id));
  } else {
    await db.delete(schema.contacts).where(eq(schema.contacts.id, id));
  }
  revalidatePath(back);
}

/* ------------------------------------------------------------ barang & jasa */

const ItemInput = z.object({
  code: z.string().trim().min(1, "Kode wajib diisi.").max(30),
  name: z.string().trim().min(2, "Nama minimal 2 huruf.").max(160),
  kind: z.enum(itemKinds),
  unit: z.string().trim().min(1, "Satuan wajib diisi.").max(20),
  note: str(1000),
});

export async function saveItem(_prev: FormState, form: FormData): Promise<FormState> {
  await requireModule("keuangan");
  const id = String(form.get("id") ?? "");
  const p = ItemInput.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Data tidak valid." };
  const db = await getDb();
  const clash = await db.query.items.findFirst({ where: id ? and(eq(schema.items.code, p.data.code), ne(schema.items.id, id)) : eq(schema.items.code, p.data.code) });
  if (clash) return { error: `Kode "${p.data.code}" sudah dipakai "${clash.name}".` };
  const productId = Number(form.get("productId")) || null;
  const revenueAccountId = String(form.get("revenueAccountId") ?? "") || null;
  const values = {
    ...p.data,
    sellPrice: parseRupiah(form.get("sellPrice")),
    buyPrice: parseRupiah(form.get("buyPrice")),
    minStock: parseQty(form.get("minStock")),
    trackStock: p.data.kind === "jasa" ? false : form.get("trackStock") === "on",
    active: form.get("active") === "on",
    productId,
    revenueAccountId,
    updatedAt: new Date(),
  };
  if (id) {
    // Barang yang sudah punya pergerakan stok: jenis persediaan & pelacakan stok dikunci agar
    // akun persediaan dan harga pokoknya tidak terpecah.
    const old = await db.query.items.findFirst({ where: eq(schema.items.id, id) });
    const moved = await db.get<{ n: number }>(sql`select count(*) n from inv_stock_moves where item_id = ${id}`);
    if (old && Number(moved?.n ?? 0) > 0 && (old.kind !== values.kind || old.trackStock !== values.trackStock)) {
      return { error: "Barang ini sudah punya pergerakan stok, jadi jenis dan pelacakan stoknya tidak bisa diubah. Buat barang baru bila perlu." };
    }
    await db.update(schema.items).set(values).where(eq(schema.items.id, id));
  } else await db.insert(schema.items).values(values);
  redirect(`/akuntansi/barang?ok=${encodeURIComponent(p.data.name)}`);
}

export async function deleteItem(id: string) {
  await requireModule("keuangan");
  const db = await getDb();
  const used = await db.get<{ n: number }>(sql`
    select (select count(*) from fin_invoice_lines where item_id = ${id}) + (select count(*) from fin_bill_lines where item_id = ${id})
      + (select count(*) from ops_order_lines where item_id = ${id}) + (select count(*) from inv_stock_moves where item_id = ${id}) as n`);
  if (Number(used?.n ?? 0) > 0) await db.update(schema.items).set({ active: false, updatedAt: new Date() }).where(eq(schema.items.id, id));
  else await db.delete(schema.items).where(eq(schema.items.id, id));
  revalidatePath("/akuntansi/barang");
}

/**
 * Nama barang dari baris harga produk: "U-Ditch — 400 × 400 × 1200", "Kanstin KS 20", "Buis Beton — Tutup buis — Ø100 cm".
 * Grup yang hanya mengulang nama produk dibuang. (Sama dengan scripts/demo/generate.mjs.)
 */
function itemNameFrom(productName: string, group: string, variant: string) {
  const first = (x: string) => x.trim().toLowerCase().split(/[\s(/]+/)[0];
  const p = productName.trim();
  const g = group.trim();
  const v = variant.trim();
  if (v && first(v) === first(p)) return v;
  const parts = [p];
  if (g && first(g) !== first(p)) parts.push(g);
  if (v && v !== p) parts.push(v);
  return parts.join(" — ");
}

/** Buat barang dari tabel harga produk website (satu baris harga = satu barang). Barang yang kodenya sudah ada dilewati. */
export async function importItemsFromProducts(_prev: FormState): Promise<FormState> {
  await requireModule("keuangan");
  const db = await getDb();
  const products = await db.select().from(schema.products);
  const existing = new Set((await db.select({ code: schema.items.code }).from(schema.items)).map((r) => r.code));
  const prefix: Record<string, string> = { Paving: "PVG", Saluran: "UDT", Buis: "BUS", Kanstin: "KST", Atap: "GTG", Jasa: "JSA", Lainnya: "LN" };
  const rows: (typeof schema.items.$inferInsert)[] = [];
  for (const p of products) {
    const pre = prefix[p.category] ?? "LN";
    const kind = p.category === "Jasa" ? "jasa" : "barang_jadi";
    const list = p.priceRows.length ? p.priceRows : [{ group: "", variant: p.name, detail: "", price: p.priceFrom, unit: p.unit }];
    list.forEach((r, i) => {
      const code = `${pre}-${String(p.id).padStart(2, "0")}${String(i + 1).padStart(2, "0")}`;
      if (existing.has(code)) return;
      existing.add(code);
      const name = itemNameFrom(p.name, r.group ?? "", r.variant ?? "");
      rows.push({ code, name: name.slice(0, 160), kind, unit: r.unit || p.unit, sellPrice: r.price ?? 0, buyPrice: 0, trackStock: kind !== "jasa", productId: p.id, note: r.detail ?? "" });
    });
  }
  for (let i = 0; i < rows.length; i += 6) await db.insert(schema.items).values(rows.slice(i, i + 6));
  revalidatePath("/akuntansi/barang");
  return { ok: rows.length ? `${rows.length} barang dibuat dari daftar harga website. Lengkapi harga pokoknya agar HPP terhitung.` : "Tidak ada barang baru: semua baris harga sudah punya barang." };
}

/* ------------------------------------------------------------ akun */

const AccountInput = z.object({
  code: z.string().trim().regex(/^[0-9][0-9.\-]{1,14}$/, "Kode akun berupa angka, mis. 6-2400."),
  name: z.string().trim().min(2, "Nama akun minimal 2 huruf.").max(120),
  group: z.enum(accountGroups),
  note: str(500),
});

export async function saveAccount(_prev: FormState, form: FormData): Promise<FormState> {
  await requireModule("keuangan");
  const id = String(form.get("id") ?? "");
  const p = AccountInput.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Data tidak valid." };
  const db = await getDb();
  const clash = await db.query.accounts.findFirst({ where: id ? and(eq(schema.accounts.code, p.data.code), ne(schema.accounts.id, id)) : eq(schema.accounts.code, p.data.code) });
  if (clash) return { error: `Kode ${p.data.code} sudah dipakai akun "${clash.name}".` };
  const existing = id ? await db.query.accounts.findFirst({ where: eq(schema.accounts.id, id) }) : undefined;
  // Golongan akun sistem dikunci agar jurnal otomatis tetap benar.
  const group = existing?.systemKey ? existing.group : p.data.group;
  const values = { ...p.data, group, active: existing?.systemKey ? true : form.get("active") === "on", updatedAt: new Date() };
  if (existing) await db.update(schema.accounts).set(values).where(eq(schema.accounts.id, existing.id));
  else await db.insert(schema.accounts).values(values);
  redirect(`/akuntansi/akun?ok=${encodeURIComponent(`${p.data.code} ${p.data.name}`)}`);
}

export async function deleteAccount(id: string) {
  await requireModule("keuangan");
  const db = await getDb();
  const acc = await db.query.accounts.findFirst({ where: eq(schema.accounts.id, id) });
  if (!acc || acc.systemKey) return;
  const used = await db.get<{ n: number }>(sql`select count(*) as n from fin_journal_lines where account_id = ${id}`);
  if (Number(used?.n ?? 0) > 0) await db.update(schema.accounts).set({ active: false, updatedAt: new Date() }).where(eq(schema.accounts.id, id));
  else await db.delete(schema.accounts).where(eq(schema.accounts.id, id));
  revalidatePath("/akuntansi/akun");
}

/* ------------------------------------------------------------ pengaturan keuangan */

export async function saveFinSettings(_prev: FormState, form: FormData): Promise<FormState> {
  await requireModule("keuangan");
  const r = await guard(async () => {
    const vals: Record<string, string> = {};
    for (const k of Object.keys(FIN_DEFAULTS)) vals[k] = String(form.get(k) ?? "").trim();
    const rate = Number(vals.fin_ppn_rate.replace(",", "."));
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new UserError("Tarif PPN harus angka 0–100.");
    vals.fin_ppn_rate = String(rate);
    if (vals.fin_lock_date && !isDate(vals.fin_lock_date)) throw new UserError("Tanggal tutup buku tidak valid.");
    const term = Number(vals.fin_term_days);
    if (!Number.isInteger(term) || term < 0 || term > 365) throw new UserError("Termin bayar 0–365 hari.");
    const db = await getDb();
    for (const [key, value] of Object.entries(vals)) {
      await db.insert(schema.settings).values({ key, value }).onConflictDoUpdate({ target: schema.settings.key, set: { value } });
    }
    return { ok: "Pengaturan keuangan tersimpan." };
  });
  return r;
}
