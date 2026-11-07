"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { opsAccess } from "@/lib/erp/ops";
import { can } from "@/lib/roles";

const TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
const JENIS = ["pinjam", "bayar"] as const;

async function boleh() {
  const { user } = await opsAccess();
  if (!can(user.roles, "keuangan")) throw new Error("Tidak berhak mencatat piutang Cepi.");
  return user;
}

/** "1.250.000" / "1250000" → 1250000. */
const rupiah = (v: FormDataEntryValue | null) => Math.round(Number(String(v ?? "").replace(/[^\d.-]/g, "")) || 0);

export async function tambahPiutangCepi(fd: FormData) {
  const user = await boleh();
  const tanggal = String(fd.get("tanggal") || "").trim();
  const jenis = String(fd.get("jenis") || "pinjam").trim();
  const jumlah = rupiah(fd.get("jumlah"));
  if (!TANGGAL.test(tanggal)) throw new Error("Tanggal wajib diisi.");
  if (!JENIS.includes(jenis as (typeof JENIS)[number])) throw new Error("Jenis harus pinjam atau bayar.");
  if (jumlah <= 0) throw new Error("Jumlah harus lebih dari nol.");
  const db = await getDb();
  await db.insert(schema.cepiLoans).values({
    entryDate: tanggal,
    kind: jenis,
    amount: jumlah,
    method: String(fd.get("cara") || "").trim() || null,
    note: String(fd.get("catatan") || "").trim() || null,
    createdBy: user.id,
    createdByName: user.name,
  });
  revalidatePath("/operasional/piutang-cepi");
}

export async function hapusPiutangCepi(fd: FormData) {
  await boleh();
  const id = String(fd.get("id") || "");
  if (!id) return;
  const db = await getDb();
  await db.delete(schema.cepiLoans).where(eq(schema.cepiLoans.id, id));
  revalidatePath("/operasional/piutang-cepi");
}
