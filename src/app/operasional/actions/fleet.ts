"use server";

import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { FormState } from "@/components/admin/FormMessage";
import { getDb, schema } from "@/db";
import { requirePerm } from "@/lib/auth";
import { logActivity } from "@/lib/ops/activity";

const str = (max: number) => z.string().trim().max(max).default("");
/** Tanggal masa berlaku dokumen (YYYY-MM-DD) atau kosong. */
const expiry = (label: string) => z.string().trim().regex(/^(\d{4}-\d{2}-\d{2})?$/, `${label}: tanggal tidak valid.`).default("");

const VehicleInput = z.object({
  plate: z.string().trim().min(3, "Isi nomor polisi.").max(20),
  name: str(80),
  capacity: str(80),
  note: str(500),
  gpsDeviceId: z.string().trim().max(64).regex(/^[\w.:\-]*$/, "ID perangkat GPS hanya huruf, angka, titik, titik dua, atau tanda hubung.").default(""),
  stnkExpiry: expiry("Masa berlaku STNK"),
  kirExpiry: expiry("Masa berlaku KIR"),
});

export async function saveVehicle(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("pengiriman");
  const p = VehicleInput.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Data tidak valid." };
  const id = String(form.get("id") ?? "");
  const db = await getDb();
  const values = {
    ...p.data,
    plate: p.data.plate.replace(/\s+/g, " ").toUpperCase(),
    gpsDeviceId: p.data.gpsDeviceId || null,
    stnkExpiry: p.data.stnkExpiry || null,
    kirExpiry: p.data.kirExpiry || null,
    active: id ? form.get("active") === "on" : true,
    updatedAt: new Date(),
  };
  const dup = await db.query.vehicles.findFirst({ where: eq(schema.vehicles.plate, values.plate) });
  if (dup && dup.id !== id) return { error: `Nomor polisi ${values.plate} sudah terdaftar.` };
  if (values.gpsDeviceId) {
    const taken = await db.query.vehicles.findFirst({ where: eq(schema.vehicles.gpsDeviceId, values.gpsDeviceId) });
    if (taken && taken.id !== id) return { error: `ID perangkat GPS itu sudah dipakai ${taken.plate}.` };
  }
  if (id) await db.update(schema.vehicles).set(values).where(eq(schema.vehicles.id, id));
  else await db.insert(schema.vehicles).values(values);
  await logActivity(me, { action: "armada.simpan", label: id ? "Mengubah kendaraan" : "Menambah kendaraan", summary: values.plate });
  redirect(`/operasional/armada?ok=${encodeURIComponent(values.plate)}`);
}

export async function deleteVehicle(id: string): Promise<FormState> {
  const me = await requirePerm("pengiriman");
  const db = await getDb();
  const v = await db.query.vehicles.findFirst({ where: eq(schema.vehicles.id, id) });
  const used = await db.get<{ n: number }>(sql`select count(*) n from ops_deliveries where vehicle_id = ${id}`);
  // Sudah dipakai surat jalan: nonaktifkan saja agar riwayat tetap utuh.
  if (Number(used?.n ?? 0) > 0) await db.update(schema.vehicles).set({ active: false, updatedAt: new Date() }).where(eq(schema.vehicles.id, id));
  else await db.delete(schema.vehicles).where(eq(schema.vehicles.id, id));
  await logActivity(me, { action: "armada.hapus", label: "Menghapus/menonaktifkan kendaraan", summary: v?.plate ?? id });
  redirect("/operasional/armada?ok=dihapus");
}

const DriverInput = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 huruf.").max(80),
  phone: str(40),
  note: str(500),
  licenseNo: str(40),
  licenseExpiry: expiry("Masa berlaku SIM"),
});

export async function saveDriver(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("pengiriman");
  const p = DriverInput.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Data tidak valid." };
  const id = String(form.get("id") ?? "");
  const db = await getDb();
  const values = { ...p.data, licenseNo: p.data.licenseNo || null, licenseExpiry: p.data.licenseExpiry || null, active: id ? form.get("active") === "on" : true, updatedAt: new Date() };
  if (id) await db.update(schema.drivers).set(values).where(eq(schema.drivers.id, id));
  else await db.insert(schema.drivers).values(values);
  await logActivity(me, { action: "sopir.simpan", label: id ? "Mengubah data sopir" : "Menambah sopir", summary: values.name });
  redirect(`/operasional/sopir?ok=${encodeURIComponent(values.name)}`);
}

export async function deleteDriver(id: string): Promise<FormState> {
  const me = await requirePerm("pengiriman");
  const db = await getDb();
  const d = await db.query.drivers.findFirst({ where: eq(schema.drivers.id, id) });
  const used = await db.get<{ n: number }>(sql`select count(*) n from ops_deliveries where driver_id = ${id}`);
  if (Number(used?.n ?? 0) > 0) await db.update(schema.drivers).set({ active: false, updatedAt: new Date() }).where(eq(schema.drivers.id, id));
  else await db.delete(schema.drivers).where(eq(schema.drivers.id, id));
  await logActivity(me, { action: "sopir.hapus", label: "Menghapus/menonaktifkan sopir", summary: d?.name ?? id });
  redirect("/operasional/sopir?ok=dihapus");
}
