"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/roles";

const TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
const JENIS = ["kasbon", "bayar"] as const;
const KATEGORI = ["utama", "bulanan", "mingguan"] as const;

/** Kasbon karyawan: izin keuangan. Kasbon sopir: PIC Kendaraan (ekspedisi) atau keuangan. */
async function boleh(sopir: boolean) {
  const user = await requireUser();
  const ok = can(user.roles, "keuangan") || (sopir && can(user.roles, "ekspedisi"));
  if (!ok) throw new Error(sopir ? "Tidak berhak mengelola kasbon sopir." : "Tidak berhak mengelola kasbon karyawan.");
  return user;
}
const pathOf = (sopir: boolean) => (sopir ? "/anak-usaha/kasbon-sopir" : "/akuntansi/kasbon");

/** "1.250.000" / "1250000" → 1250000. */
const rupiah = (v: FormDataEntryValue | null) => Math.round(Number(String(v ?? "").replace(/[^\d.-]/g, "")) || 0);

export async function tambahKasbon(fd: FormData) {
  const sopir = fd.get("sopir") === "1";
  const user = await boleh(sopir);
  const karyawan = String(fd.get("karyawan") || "").trim().toUpperCase();
  const tanggal = String(fd.get("tanggal") || "").trim();
  const jenis = String(fd.get("jenis") || "kasbon").trim();
  const kategori = String(fd.get("kategori") || "utama").trim();
  const cara = fd.get("cara") === "transfer" ? "transfer" : "cash";
  const jumlah = rupiah(fd.get("jumlah"));
  if (!karyawan || !TANGGAL.test(tanggal)) throw new Error("Nama dan tanggal wajib diisi.");
  if (!JENIS.includes(jenis as (typeof JENIS)[number])) throw new Error("Jenis harus kasbon atau bayar.");
  if (!jumlah) throw new Error("Jumlah harus lebih dari nol.");
  const db = await getDb();
  await db.insert(schema.kasbonEntries).values({
    employeeName: karyawan,
    entryDate: tanggal,
    kind: jenis,
    amount: jumlah,
    note: String(fd.get("catatan") || "").trim() || null,
    category: KATEGORI.includes(kategori as (typeof KATEGORI)[number]) ? kategori : "utama",
    payMethod: cara,
    isDriver: sopir,
    createdBy: user.id,
    createdByName: user.name,
  });
  revalidatePath(pathOf(sopir));
}

export async function hapusKasbon(fd: FormData) {
  const sopir = fd.get("sopir") === "1";
  await boleh(sopir);
  const id = String(fd.get("id") || "");
  if (!id) return;
  const db = await getDb();
  const row = await db.query.kasbonEntries.findFirst({ where: eq(schema.kasbonEntries.id, id) });
  if (!row || row.isDriver !== sopir) return;
  await db.delete(schema.kasbonEntries).where(eq(schema.kasbonEntries.id, id));
  revalidatePath(pathOf(sopir));
}
