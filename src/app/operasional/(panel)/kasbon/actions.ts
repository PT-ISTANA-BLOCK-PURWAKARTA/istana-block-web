"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { opsAccess } from "@/lib/erp/ops";
import { can } from "@/lib/roles";

const TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
const JENIS = ["kasbon", "bayar"] as const;

async function boleh() {
  const { user } = await opsAccess();
  if (!can(user.roles, "keuangan")) throw new Error("Tidak berhak mengelola kasbon karyawan.");
  return user;
}

/** "1.250.000" / "1250000" → 1250000. */
const rupiah = (v: FormDataEntryValue | null) => Math.round(Number(String(v ?? "").replace(/[^\d.-]/g, "")) || 0);

export async function tambahKasbon(fd: FormData) {
  const user = await boleh();
  const karyawan = String(fd.get("karyawan") || "").trim().toUpperCase();
  const tanggal = String(fd.get("tanggal") || "").trim();
  const jenis = String(fd.get("jenis") || "kasbon").trim();
  const jumlah = rupiah(fd.get("jumlah"));
  if (!karyawan || !TANGGAL.test(tanggal)) throw new Error("Nama karyawan dan tanggal wajib diisi.");
  if (!JENIS.includes(jenis as (typeof JENIS)[number])) throw new Error("Jenis harus kasbon atau bayar.");
  if (!jumlah) throw new Error("Jumlah harus lebih dari nol.");
  const db = await getDb();
  await db.insert(schema.kasbonEntries).values({
    employeeName: karyawan,
    entryDate: tanggal,
    kind: jenis,
    amount: jumlah,
    note: String(fd.get("catatan") || "").trim() || null,
    createdBy: user.id,
    createdByName: user.name,
  });
  revalidatePath("/operasional/kasbon");
}

export async function hapusKasbon(fd: FormData) {
  await boleh();
  const id = String(fd.get("id") || "");
  if (!id) return;
  const db = await getDb();
  await db.delete(schema.kasbonEntries).where(eq(schema.kasbonEntries.id, id));
  revalidatePath("/operasional/kasbon");
}
