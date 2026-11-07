"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { opsAccess } from "@/lib/erp/ops";
import { can } from "@/lib/roles";

/** Satpam mencatat OUT/IN; operasional, keuangan, dan pemilik boleh mengoreksi. */
async function boleh() {
  const { user } = await opsAccess();
  const { roles } = user;
  if (!can(roles, "muat") && !can(roles, "pengiriman") && !can(roles, "keuangan"))
    throw new Error("Tidak berhak mencatat buku gerbang.");
  return user;
}

/** "2026-11-08T07:30" dari input datetime-local → Date (input dibaca sebagai jam WIB, bukan UTC). */
function waktu(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s);
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - 7 * 3600 * 1000);
}

export async function catatKeluar(fd: FormData) {
  const user = await boleh();
  const plate = String(fd.get("plat") || "").trim().toUpperCase();
  if (!plate) throw new Error("Nomor polisi wajib diisi.");
  const db = await getDb();
  await db.insert(schema.vehicleTrips).values({
    plate,
    driverName: String(fd.get("sopir") || "").trim() || null,
    purpose: String(fd.get("keperluan") || "lain").trim() || "lain",
    cargo: String(fd.get("barang") || "").trim() || null,
    destination: String(fd.get("tujuan") || "").trim() || null,
    note: String(fd.get("catatan") || "").trim() || null,
    outAt: waktu(fd.get("keluar")) ?? new Date(),
    outByName: user.name,
    createdBy: user.id,
  });
  revalidatePath("/operasional/gerbang");
}

export async function catatMasuk(fd: FormData) {
  const user = await boleh();
  const id = String(fd.get("id") || "");
  if (!id) return;
  const db = await getDb();
  await db
    .update(schema.vehicleTrips)
    .set({ inAt: waktu(fd.get("masuk")) ?? new Date(), inByName: user.name })
    .where(eq(schema.vehicleTrips.id, id));
  revalidatePath("/operasional/gerbang");
}

export async function hapusTrip(fd: FormData) {
  await boleh();
  const id = String(fd.get("id") || "");
  if (!id) return;
  const db = await getDb();
  const [row] = await db
    .select({ deliveryId: schema.vehicleTrips.deliveryId })
    .from(schema.vehicleTrips)
    .where(eq(schema.vehicleTrips.id, id))
    .limit(1);
  if (row?.deliveryId) throw new Error("Rit yang lahir dari surat jalan tidak bisa dihapus di sini.");
  await db.delete(schema.vehicleTrips).where(eq(schema.vehicleTrips.id, id));
  revalidatePath("/operasional/gerbang");
}
