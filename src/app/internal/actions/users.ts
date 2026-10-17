"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { getDb, getEnv, schema } from "@/db";
import type { FormState } from "@/components/admin/FormMessage";
import { requireOwner, requireUser } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { FIELD_ROLES, formatPhone, normalizePhone, normalizeRoles, weakPin, type Role } from "@/lib/roles";
import { SESSION_COOKIE, cookieOptions, signSession } from "@/lib/session";

const Password = z.string().min(10, "Password minimal 10 karakter.").max(200);
const nowDate = () => new Date(Math.floor(Date.now() / 1000) * 1000);

function rolesFrom(form: FormData): Role[] {
  return normalizeRoles(form.getAll("roles").map(String));
}

type Db = Awaited<ReturnType<typeof getDb>>;

/** Validasi peran & sopir terkait. officeLogin = akun punya email (boleh peran kantor). */
async function checkRoles(db: Db, roles: Role[], officeLogin: boolean, driverId: string | null, userId?: number): Promise<string | null> {
  if (!roles.length) return "Pilih minimal satu peran.";
  if (!officeLogin && roles.some((r) => !FIELD_ROLES.includes(r))) return "Peran pemilik, situs, dan keuangan butuh akun email & password. Untuk akun nomor HP, pilih operasional, gudang, atau sopir.";
  if (roles.includes("sopir")) {
    if (!driverId) return "Pilih data sopir untuk akun berperan sopir.";
    const d = await db.query.drivers.findFirst({ where: eq(schema.drivers.id, driverId) });
    if (!d) return "Data sopir tidak ditemukan.";
    const taken = await db.query.users.findFirst({
      where: userId ? and(eq(schema.users.driverId, driverId), ne(schema.users.id, userId)) : eq(schema.users.driverId, driverId),
    });
    if (taken) return `Sopir ${d.name} sudah terhubung ke akun ${taken.name}.`;
  }
  return null;
}

async function checkPhonePin(db: Db, phoneRaw: unknown, pin: string, userId?: number): Promise<{ phone: string } | { error: string }> {
  const phone = normalizePhone(phoneRaw);
  if (!phone) return { error: "Nomor HP tidak valid. Contoh: 0812 3456 7890." };
  const weak = weakPin(pin);
  if (weak) return { error: weak };
  const taken = await db.query.users.findFirst({ where: userId ? and(eq(schema.users.phone, phone), ne(schema.users.id, userId)) : eq(schema.users.phone, phone) });
  if (taken) return { error: `Nomor ${formatPhone(phone)} sudah dipakai akun ${taken.name}.` };
  return { phone };
}

export async function createUser(_prev: FormState, form: FormData): Promise<FormState> {
  await requireOwner();
  const kind = form.get("kind") === "lapangan" ? "lapangan" : "kantor";
  const name = String(form.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 80) return { error: "Nama wajib diisi (2–80 huruf)." };
  const roles = rolesFrom(form);
  const driverId = String(form.get("driverId") ?? "") || null;
  const db = await getDb();

  if (kind === "kantor") {
    const parsed = z.object({ email: z.email("Email tidak valid.").trim().toLowerCase(), password: Password }).safeParse(Object.fromEntries(form));
    if (!parsed.success) return { error: parsed.error.issues[0]?.message };
    const bad = await checkRoles(db, roles, true, roles.includes("sopir") ? driverId : null);
    if (bad) return { error: bad };
    if (await db.query.users.findFirst({ where: eq(schema.users.email, parsed.data.email) })) return { error: "Email sudah terdaftar." };
    await db.insert(schema.users).values({ name, email: parsed.data.email, passwordHash: await hashPassword(parsed.data.password), roles, driverId: roles.includes("sopir") ? driverId : null });
    revalidatePath("/internal/pengguna");
    return { ok: `Akun ${parsed.data.email} dibuat. Ia masuk lewat halaman aplikasi dengan email & password itu.` };
  }

  const pin = String(form.get("pin") ?? "").trim();
  const pp = await checkPhonePin(db, form.get("phone"), pin);
  if ("error" in pp) return { error: pp.error };
  const bad = await checkRoles(db, roles, false, roles.includes("sopir") ? driverId : null);
  if (bad) return { error: bad };
  await db.insert(schema.users).values({ name, phone: pp.phone, pinHash: await hashPassword(pin), roles, driverId: roles.includes("sopir") ? driverId : null });
  revalidatePath("/internal/pengguna");
  return { ok: `Akun ${name} dibuat. Ia masuk ke Operasional dengan nomor ${formatPhone(pp.phone)} dan PIN yang Anda berikan.` };
}

export async function updateUserRoles(id: number, _prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireOwner();
  const roles = rolesFrom(form);
  if (id === me.id && !roles.includes("owner")) return { error: "Peran pemilik tidak bisa dilepas dari akun sendiri." };
  const db = await getDb();
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, id) });
  if (!user) return { error: "Pengguna tidak ditemukan." };
  const driverId = roles.includes("sopir") ? String(form.get("driverId") ?? "") || null : null;
  const bad = await checkRoles(db, roles, !!user.email, driverId, id);
  if (bad) return { error: bad };
  // Jangan ubah updatedAt agar sesi pengguna tetap berlaku; peran dibaca ulang di setiap request.
  await db.update(schema.users).set({ roles, driverId, updatedAt: user.updatedAt }).where(eq(schema.users.id, id));
  revalidatePath("/internal/pengguna");
  return { ok: `Peran ${user.name} diperbarui.` };
}

/** Pemilik mengatur ulang password staf yang lupa; semua sesi staf itu otomatis keluar. */
export async function resetUserPassword(id: number, _prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireOwner();
  if (id === me.id) return { error: "Ganti password Anda sendiri lewat Akun saya." };
  const next = Password.safeParse(form.get("password"));
  if (!next.success) return { error: next.error.issues[0]?.message };
  const db = await getDb();
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, id) });
  if (!user?.email) return { error: "Akun ini tidak memakai email." };
  await db.update(schema.users).set({ passwordHash: await hashPassword(next.data), updatedAt: nowDate() }).where(eq(schema.users.id, id));
  return { ok: `Password ${user.email} diatur ulang. Berikan ke yang bersangkutan dan minta ia menggantinya.` };
}

/** Pemilik memberi atau mengatur ulang nomor HP + PIN akun lapangan; sesi lama akun itu berakhir. */
export async function setUserPin(id: number, _prev: FormState, form: FormData): Promise<FormState> {
  await requireOwner();
  const db = await getDb();
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, id) });
  if (!user) return { error: "Pengguna tidak ditemukan." };
  const roles = normalizeRoles(user.roles);
  if (!roles.some((r) => FIELD_ROLES.includes(r))) return { error: "Beri dulu peran operasional, gudang, atau sopir. Nomor HP & PIN hanya untuk aplikasi Operasional." };
  const pin = String(form.get("pin") ?? "").trim();
  const pp = await checkPhonePin(db, form.get("phone") || user.phone, pin, id);
  if ("error" in pp) return { error: pp.error };
  await db.update(schema.users).set({ phone: pp.phone, pinHash: await hashPassword(pin), updatedAt: nowDate() }).where(eq(schema.users.id, id));
  await db.delete(schema.loginAttempts).where(eq(schema.loginAttempts.key, `pin:${pp.phone}`));
  revalidatePath("/internal/pengguna");
  return { ok: `PIN ${user.name} diatur (nomor ${formatPhone(pp.phone)}). Berikan PIN-nya langsung, jangan lewat grup chat.` };
}

/** Cabut akses nomor HP + PIN dari akun yang juga punya email. */
export async function removeUserPin(id: number) {
  await requireOwner();
  const db = await getDb();
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, id) });
  if (!user?.email) return;
  await db.update(schema.users).set({ phone: null, pinHash: null, updatedAt: user.updatedAt }).where(eq(schema.users.id, id));
  revalidatePath("/internal/pengguna");
}

export async function deleteUser(id: number) {
  const me = await requireOwner();
  if (me.id === id) return; // tidak bisa menghapus akun sendiri
  const db = await getDb();
  await db.delete(schema.users).where(eq(schema.users.id, id));
  revalidatePath("/internal/pengguna");
}

async function renewSession(userId: number, via: "pw" | "pin") {
  const env = await getEnv();
  const token = await signSession({ sub: String(userId), via }, env.AUTH_SECRET);
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions());
}

export async function changePassword(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser();
  const current = String(form.get("current") ?? "");
  const next = Password.safeParse(form.get("next"));
  if (!next.success) return { error: next.error.issues[0]?.message };
  if (next.data !== form.get("confirm")) return { error: "Konfirmasi password tidak sama." };
  const db = await getDb();
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, me.id) });
  if (!user?.passwordHash || !(await verifyPassword(current, user.passwordHash))) return { error: "Password saat ini salah." };
  // updatedAt dipakai sebagai penanda: sesi lain yang dibuat sebelum ini otomatis keluar.
  await db.update(schema.users).set({ passwordHash: await hashPassword(next.data), updatedAt: nowDate() }).where(eq(schema.users.id, me.id));
  await renewSession(me.id, me.via);
  return { ok: "Password diganti. Sesi di perangkat lain sudah dikeluarkan." };
}

/** Staf lapangan mengganti PIN sendiri. */
export async function changePin(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/operasional/masuk");
  const current = String(form.get("current") ?? "").trim();
  const next = String(form.get("next") ?? "").trim();
  const weak = weakPin(next);
  if (weak) return { error: weak };
  if (next !== String(form.get("confirm") ?? "").trim()) return { error: "Ulangi PIN baru dengan angka yang sama." };
  const db = await getDb();
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, me.id) });
  if (!user?.pinHash || !(await verifyPassword(current, user.pinHash))) return { error: "PIN saat ini salah." };
  await db.update(schema.users).set({ pinHash: await hashPassword(next), updatedAt: nowDate() }).where(eq(schema.users.id, me.id));
  await renewSession(me.id, me.via);
  return { ok: "PIN diganti. Sesi di HP lain sudah dikeluarkan." };
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
