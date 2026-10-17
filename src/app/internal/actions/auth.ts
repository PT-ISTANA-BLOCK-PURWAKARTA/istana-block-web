"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { getDb, getEnv, schema } from "@/db";
import { verifyPassword } from "@/lib/password";
import { canOpen, effectiveRoles, moduleHome, moduleOf, normalizePhone, normalizeRoles, safeNext, type ModuleKey } from "@/lib/roles";
import { SESSION_COOKIE, cookieOptions, signSession } from "@/lib/session";

const WINDOW = 15 * 60; // detik
const MAX_FAILS_IP = 10; // per alamat IP (semua cara masuk)
const MAX_FAILS_ACCOUNT = 5; // per email / nomor HP

export type LoginState = { error?: string } | undefined;

type Db = Awaited<ReturnType<typeof getDb>>;

async function clientIp() {
  const h = await headers();
  return h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "lokal";
}

/** Sisa menit penguncian untuk kunci-kunci ini, atau 0 bila boleh mencoba. */
async function lockedFor(db: Db, keys: [string, number][], now: number) {
  let wait = 0;
  for (const [key, max] of keys) {
    const a = await db.query.loginAttempts.findFirst({ where: eq(schema.loginAttempts.key, key) });
    if (a && now - a.windowStart < WINDOW && a.count >= max) wait = Math.max(wait, Math.ceil((WINDOW - (now - a.windowStart)) / 60));
  }
  return wait;
}

async function recordFail(db: Db, keys: string[], now: number) {
  for (const key of keys) {
    const a = await db.query.loginAttempts.findFirst({ where: eq(schema.loginAttempts.key, key) });
    const fresh = !a || now - a.windowStart >= WINDOW;
    await db
      .insert(schema.loginAttempts)
      .values({ key, count: 1, windowStart: now })
      .onConflictDoUpdate({ target: schema.loginAttempts.key, set: fresh ? { count: 1, windowStart: now } : { count: sql`${schema.loginAttempts.count} + 1` } });
  }
}

async function startSession(userId: number, via: "pw" | "pin") {
  const env = await getEnv();
  const token = await signSession({ sub: String(userId), via }, env.AUTH_SECRET);
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions());
}

const SERVER_NOT_READY = "Server belum siap: kunci AUTH_SECRET belum dipasang atau kurang dari 32 karakter.";

/** Masuk dengan email + password ke satu aplikasi (situs, keuangan, atau operasional untuk pemilik/admin). */
export async function loginEmail(module: ModuleKey, _prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Email dan password wajib diisi." };

  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  const ipKey = `login:${await clientIp()}`;
  const accKey = `email:${email}`;
  const wait = await lockedFor(db, [[ipKey, MAX_FAILS_IP], [accKey, MAX_FAILS_ACCOUNT]], now);
  if (wait) return { error: `Terlalu banyak percobaan gagal. Coba lagi dalam ${wait} menit.` };

  const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  const ok = user?.passwordHash ? await verifyPassword(password, user.passwordHash) : false;
  if (!ok || !user) {
    await recordFail(db, [ipKey, accKey], now);
    return { error: "Email atau password salah." };
  }

  const roles = normalizeRoles(user.roles);
  const mod = moduleOf(module);
  if (!canOpen(roles, module)) return { error: `Akun ini tidak punya akses ke aplikasi ${mod.label}. Kembali ke halaman awal untuk memilih aplikasi lain.` };

  await db.delete(schema.loginAttempts).where(eq(schema.loginAttempts.key, accKey));
  try {
    await startSession(user.id, "pw");
  } catch {
    return { error: SERVER_NOT_READY };
  }
  redirect(safeNext(form.get("next"), roles) ?? moduleHome(roles, module));
}

/** Masuk aplikasi operasional dengan nomor HP + PIN 6 digit (gudang, sopir, staf lapangan). */
export async function loginPin(_prev: LoginState, form: FormData): Promise<LoginState> {
  const phone = normalizePhone(form.get("phone"));
  const pin = String(form.get("pin") ?? "").trim();
  if (!phone) return { error: "Nomor HP tidak valid. Contoh: 0812 3456 7890." };
  if (!/^\d{6}$/.test(pin)) return { error: "PIN terdiri dari 6 angka." };

  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  const ipKey = `login:${await clientIp()}`;
  const accKey = `pin:${phone}`;
  const wait = await lockedFor(db, [[ipKey, MAX_FAILS_IP], [accKey, MAX_FAILS_ACCOUNT]], now);
  if (wait) return { error: `Terlalu banyak percobaan. Coba lagi dalam ${wait} menit, atau minta admin mengatur ulang PIN Anda.` };

  const user = await db.query.users.findFirst({ where: eq(schema.users.phone, phone) });
  const ok = user?.pinHash ? await verifyPassword(pin, user.pinHash) : false;
  if (!ok || !user) {
    await recordFail(db, [ipKey, accKey], now);
    return { error: "Nomor HP atau PIN salah." };
  }

  const roles = effectiveRoles(normalizeRoles(user.roles), "pin");
  if (!canOpen(roles, "operasional")) return { error: "Akun ini belum diberi peran operasional, gudang, atau sopir. Minta pemilik mengatur perannya." };

  await db.delete(schema.loginAttempts).where(eq(schema.loginAttempts.key, accKey));
  try {
    await startSession(user.id, "pin");
  } catch {
    return { error: SERVER_NOT_READY };
  }
  redirect(safeNext(form.get("next"), roles) ?? moduleHome(roles, "operasional"));
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/internal");
}
