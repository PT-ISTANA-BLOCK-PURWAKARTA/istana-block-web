"use server";

import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { FormState } from "@/components/admin/FormMessage";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";

const str = (max: number) => z.string().trim().max(max).default("");

const VehicleInput = z.object({ plate: z.string().trim().min(3, "Isi nomor polisi.").max(20), name: str(80), capacity: str(80), note: str(500) });

export async function saveVehicle(_prev: FormState, form: FormData): Promise<FormState> {
  await requireModule("operasional");
  const p = VehicleInput.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Data tidak valid." };
  const id = String(form.get("id") ?? "");
  const db = await getDb();
  const values = { ...p.data, plate: p.data.plate.toUpperCase(), active: id ? form.get("active") === "on" : true, updatedAt: new Date() };
  if (id) await db.update(schema.vehicles).set(values).where(eq(schema.vehicles.id, id));
  else await db.insert(schema.vehicles).values(values);
  redirect(`/operasional/armada?ok=${encodeURIComponent(values.plate)}`);
}

export async function deleteVehicle(id: string): Promise<FormState> {
  await requireModule("operasional");
  const db = await getDb();
  const used = await db.get<{ n: number }>(sql`select count(*) n from ops_deliveries where vehicle_id = ${id}`);
  // Sudah dipakai surat jalan: nonaktifkan saja agar riwayat tetap utuh.
  if (Number(used?.n ?? 0) > 0) await db.update(schema.vehicles).set({ active: false, updatedAt: new Date() }).where(eq(schema.vehicles.id, id));
  else await db.delete(schema.vehicles).where(eq(schema.vehicles.id, id));
  redirect("/operasional/armada?ok=dihapus");
}

const DriverInput = z.object({ name: z.string().trim().min(2, "Nama minimal 2 huruf.").max(80), phone: str(40), note: str(500) });

export async function saveDriver(_prev: FormState, form: FormData): Promise<FormState> {
  await requireModule("operasional");
  const p = DriverInput.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Data tidak valid." };
  const id = String(form.get("id") ?? "");
  const db = await getDb();
  const values = { ...p.data, active: id ? form.get("active") === "on" : true, updatedAt: new Date() };
  if (id) await db.update(schema.drivers).set(values).where(eq(schema.drivers.id, id));
  else await db.insert(schema.drivers).values(values);
  redirect(`/operasional/sopir?ok=${encodeURIComponent(values.name)}`);
}

export async function deleteDriver(id: string): Promise<FormState> {
  await requireModule("operasional");
  const db = await getDb();
  const used = await db.get<{ n: number }>(sql`select count(*) n from ops_deliveries where driver_id = ${id}`);
  if (Number(used?.n ?? 0) > 0) await db.update(schema.drivers).set({ active: false, updatedAt: new Date() }).where(eq(schema.drivers.id, id));
  else await db.delete(schema.drivers).where(eq(schema.drivers.id, id));
  redirect("/operasional/sopir?ok=dihapus");
}
