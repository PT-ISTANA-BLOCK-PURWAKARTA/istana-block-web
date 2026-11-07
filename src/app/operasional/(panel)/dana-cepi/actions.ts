"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { opsAccess } from "@/lib/erp/ops";
import { can } from "@/lib/roles";

const TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

async function boleh() {
  const { user } = await opsAccess();
  if (!can(user.roles, "keuangan")) throw new Error("Tidak berhak mencatat dana Cepi.");
  return user;
}

/** "1.250.000" / "1250000" → 1250000. */
const rupiah = (v: FormDataEntryValue | null) => Math.round(Number(String(v ?? "").replace(/[^\d.-]/g, "")) || 0);

export async function tambahDanaCepi(fd: FormData) {
  const user = await boleh();
  const tanggal = String(fd.get("tanggal") || "").trim();
  const jumlah = rupiah(fd.get("jumlah"));
  if (!TANGGAL.test(tanggal)) throw new Error("Tanggal wajib diisi.");
  if (jumlah <= 0) throw new Error("Jumlah harus lebih dari nol.");
  const db = await getDb();
  await db.insert(schema.fleetCash).values({
    entryDate: tanggal,
    amount: jumlah,
    source: String(fd.get("sumber") || "").trim() || null,
    note: String(fd.get("catatan") || "").trim() || null,
    createdBy: user.id,
    createdByName: user.name,
  });
  revalidatePath("/operasional/dana-cepi");
}

export async function hapusDanaCepi(fd: FormData) {
  await boleh();
  const id = String(fd.get("id") || "");
  if (!id) return;
  const db = await getDb();
  await db.delete(schema.fleetCash).where(eq(schema.fleetCash.id, id));
  revalidatePath("/operasional/dana-cepi");
}
