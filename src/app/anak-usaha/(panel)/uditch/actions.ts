"use server";

// Operational U-Ditch: tambah/ubah/hapus transaksi buku kas proyek dan daftar kontrabon IB (sama seperti app lama).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import type { FormState } from "@/components/admin/FormMessage";
import { getDb, schema } from "@/db";
import { requireAnak } from "@/lib/auth";
import { guard, UserError } from "@/lib/erp/server";
import { isDate, parseRupiah } from "@/lib/erp/util";
import { ACCOUNT_BY_KEY, CATEGORY_BY_CODE, type UditchAccount, type UditchCategoryCode } from "@/lib/ops/uditch";
import { can } from "@/lib/roles";

const PATH = "/anak-usaha/uditch";
async function editor() {
  const user = await requireAnak("uditch", "keuangan");
  if (!can(user.roles, "keuangan") && !can(user.roles, "uditch")) throw new UserError("Hanya PIC U-Ditch (Lina) atau Keuangan yang boleh mengubah buku kas U-Ditch.");
  return user;
}
const num = (v: FormDataEntryValue | null) => { const s = String(v ?? "").trim(); if (!s) return null; const n = Number(s.replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : null; };

export async function saveUditchEntry(_prev: FormState, form: FormData): Promise<FormState> {
  const res = await guard(async () => {
    const user = await editor();
    const db = await getDb();
    const id = String(form.get("id") ?? "");
    const entryDate = String(form.get("entryDate") ?? "");
    if (!isDate(entryDate)) throw new UserError("Isi tanggal.");
    const account = String(form.get("account") ?? "") as UditchAccount;
    if (!ACCOUNT_BY_KEY[account]) throw new UserError("Pilih sumber dana.");
    const direction = String(form.get("direction")) === "masuk" ? "masuk" : "keluar";
    const item = String(form.get("item") ?? "").trim().slice(0, 300);
    if (!item) throw new UserError(direction === "masuk" ? "Isi keterangan uang masuk." : "Isi nama barang / keperluan.");
    const qty = num(form.get("qty")), price = num(form.get("price"));
    const total = parseRupiah(form.get("total")) || (qty != null && price != null ? qty * price : price ?? 0);
    if (!(total > 0)) throw new UserError("Isi total (atau jumlah × harga).");
    const categoryRaw = String(form.get("category") ?? "");
    const category = categoryRaw && CATEGORY_BY_CODE[categoryRaw as UditchCategoryCode] ? categoryRaw : null;
    const values = {
      entryDate, account, direction, item, qty, price, total: Math.round(total), category,
      party: String(form.get("party") ?? "").trim() || null, note: String(form.get("note") ?? "").trim() || null,
      remark: String(form.get("remark") ?? "").trim() || null, pic: String(form.get("pic") ?? "").trim() || null,
    };
    if (id) await db.update(schema.uditchEntries).set({ ...values, updatedByName: user.name, updatedAt: new Date() }).where(eq(schema.uditchEntries.id, id));
    else await db.insert(schema.uditchEntries).values({ ...values, createdBy: user.id, createdByName: user.name });
    return { ok: true };
  });
  if ("error" in res) return res;
  revalidatePath(PATH);
  redirect(`${PATH}?ok=1`);
}

export async function deleteUditchEntry(id: string): Promise<{ ok?: string; error?: string }> {
  const res = await guard(async () => {
    await editor();
    const db = await getDb();
    await db.delete(schema.uditchEntries).where(eq(schema.uditchEntries.id, id));
    return { ok: "Transaksi dihapus." };
  });
  revalidatePath(PATH);
  return res;
}

export async function saveKontrabon(_prev: FormState, form: FormData): Promise<FormState> {
  const res = await guard(async () => {
    const user = await editor();
    const db = await getDb();
    const id = String(form.get("id") ?? "");
    const label = String(form.get("label") ?? "").trim().slice(0, 200);
    const amount = parseRupiah(form.get("amount"));
    if (!label || !amount) throw new UserError("Isi keterangan dan jumlah.");
    const note = String(form.get("note") ?? "").trim() || null;
    const now = Math.floor(Date.now() / 1000);
    if (id) await db.run(sql`update ops_uditch_kontrabon set label = ${label}, amount = ${Math.round(amount)}, note = ${note}, updated_by_name = ${user.name}, updated_at = ${now} where id = ${id}`);
    else {
      const pos = await db.get<{ p: number }>(sql`select coalesce(max(position), 0) + 1 p from ops_uditch_kontrabon`);
      await db.run(sql`insert into ops_uditch_kontrabon (id, label, amount, note, position, updated_by_name, created_at, updated_at) values (${crypto.randomUUID()}, ${label}, ${Math.round(amount)}, ${note}, ${Number(pos?.p ?? 1)}, ${user.name}, ${now}, ${now})`);
    }
    return { ok: true };
  });
  if ("error" in res) return res;
  revalidatePath(PATH);
  redirect(`${PATH}?tab=kontrabon&ok=1`);
}

export async function deleteKontrabon(id: string): Promise<{ ok?: string; error?: string }> {
  const res = await guard(async () => {
    await editor();
    const db = await getDb();
    await db.run(sql`delete from ops_uditch_kontrabon where id = ${id}`);
    return { ok: "Kontrabon dihapus." };
  });
  revalidatePath(PATH);
  return res;
}
