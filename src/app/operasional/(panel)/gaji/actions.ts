"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { opsAccess } from "@/lib/erp/ops";
import { can } from "@/lib/roles";

/** "1000000|GENTENG" per baris -> [{ amount, description }] */
function baris(teks: string) {
  return teks
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [a, ...d] = l.split("|");
      return { amount: Number(a.replace(/[^\d.-]/g, "")) || 0, description: d.join("|").trim() };
    });
}

async function pastikanBoleh() {
  const { user } = await opsAccess();
  if (!can(user.roles, "keuangan")) throw new Error("Tidak berhak mengelola gaji.");
  return user;
}

export async function buatPayslip(fd: FormData) {
  const user = await pastikanBoleh();
  const karyawan = String(fd.get("karyawan") || "").trim();
  const tanggal = String(fd.get("tanggal") || "").trim();
  if (!karyawan || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) throw new Error("Nama dan tanggal wajib diisi.");
  const db = await getDb();
  await db.insert(schema.payslips).values({
    employeeName: karyawan,
    slipDate: tanggal,
    earnings: baris(String(fd.get("pendapatan") || "")),
    deductions: baris(String(fd.get("potongan") || "")),
    kasbonNote: String(fd.get("kasbon") || "").trim() || null,
    signerName: String(fd.get("penandaTangan") || "").trim() || null,
    createdBy: user.id,
  });
  revalidatePath("/operasional/gaji");
}

export async function hapusPayslip(fd: FormData) {
  await pastikanBoleh();
  const id = String(fd.get("id") || "");
  if (!id) return;
  const db = await getDb();
  await db.delete(schema.payslips).where(eq(schema.payslips.id, id));
  revalidatePath("/operasional/gaji");
}
