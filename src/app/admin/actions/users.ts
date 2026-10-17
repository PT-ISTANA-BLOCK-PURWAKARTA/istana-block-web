"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, getEnv, schema } from "@/db";
import type { FormState } from "@/components/admin/FormMessage";
import { requireOwner, requireUser } from "@/lib/auth";
import { normalizeRoles, type Role } from "@/lib/roles";
import { hashPassword, verifyPassword } from "@/lib/password";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from "@/lib/session";

const Password = z.string().min(10, "Password minimal 10 karakter.").max(200);

function rolesFrom(form: FormData): Role[] {
  return normalizeRoles(form.getAll("roles").map(String));
}

export async function createUser(_prev: FormState, form: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = z
    .object({ name: z.string().trim().min(2, "Nama wajib diisi.").max(80), email: z.email("Email tidak valid.").trim().toLowerCase(), password: Password })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const roles = rolesFrom(form);
  if (!roles.length) return { error: "Pilih minimal satu peran." };
  const db = await getDb();
  const exists = await db.query.users.findFirst({ where: eq(schema.users.email, parsed.data.email) });
  if (exists) return { error: "Email sudah terdaftar." };
  await db.insert(schema.users).values({ name: parsed.data.name, email: parsed.data.email, passwordHash: await hashPassword(parsed.data.password), roles });
  revalidatePath("/admin/pengguna");
  return { ok: `Pengguna ${parsed.data.email} ditambahkan.` };
}

export async function updateUserRoles(id: number, _prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireOwner();
  const roles = rolesFrom(form);
  if (!roles.length) return { error: "Pilih minimal satu peran." };
  if (id === me.id && !roles.includes("owner")) return { error: "Peran pemilik tidak bisa dilepas dari akun sendiri." };
  const db = await getDb();
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, id) });
  if (!user) return { error: "Pengguna tidak ditemukan." };
  // Jangan ubah updatedAt agar sesi pengguna tetap berlaku; peran dibaca ulang di setiap request.
  await db.update(schema.users).set({ roles, updatedAt: user.updatedAt }).where(eq(schema.users.id, id));
  revalidatePath("/admin/pengguna");
  return { ok: `Peran ${user.email} diperbarui.` };
}

export async function deleteUser(id: number) {
  const me = await requireOwner();
  if (me.id === id) return; // tidak bisa menghapus akun sendiri
  const db = await getDb();
  await db.delete(schema.users).where(eq(schema.users.id, id));
  revalidatePath("/admin/pengguna");
}

export async function changePassword(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser();
  const current = String(form.get("current") ?? "");
  const next = Password.safeParse(form.get("next"));
  if (!next.success) return { error: next.error.issues[0]?.message };
  if (next.data !== form.get("confirm")) return { error: "Konfirmasi password tidak sama." };
  const db = await getDb();
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, me.id) });
  if (!user || !(await verifyPassword(current, user.passwordHash))) return { error: "Password saat ini salah." };
  // updatedAt dipakai sebagai penanda: sesi lain yang dibuat sebelum ini otomatis keluar.
  const now = new Date(Math.floor(Date.now() / 1000) * 1000);
  await db.update(schema.users).set({ passwordHash: await hashPassword(next.data), updatedAt: now }).where(eq(schema.users.id, me.id));
  const env = await getEnv();
  const token = await signSession({ sub: String(me.id), email: me.email, name: me.name }, env.AUTH_SECRET);
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE });
  return { ok: "Password diganti. Sesi di perangkat lain sudah dikeluarkan." };
}

export async function updateProfile(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser();
  const name = String(form.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Nama minimal 2 huruf." };
  const db = await getDb();
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, me.id) });
  if (!user) return { error: "Akun tidak ditemukan." };
  // Jangan ubah updatedAt agar sesi tetap berlaku.
  await db.update(schema.users).set({ name, updatedAt: user.updatedAt }).where(eq(schema.users.id, me.id));
  revalidatePath("/", "layout");
  return { ok: "Nama diperbarui." };
}
