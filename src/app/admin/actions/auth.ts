"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { getDb, getEnv, schema } from "@/db";
import { verifyPassword } from "@/lib/password";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from "@/lib/session";

const MAX_FAILS = 5;
const WINDOW = 15 * 60; // detik

export type LoginState = { error?: string } | undefined;

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Email dan password wajib diisi." };

  const h = await headers();
  const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "lokal";
  const key = `login:${ip}`;
  const now = Math.floor(Date.now() / 1000);
  const db = await getDb();

  const attempt = await db.query.loginAttempts.findFirst({ where: eq(schema.loginAttempts.key, key) });
  if (attempt && now - attempt.windowStart < WINDOW && attempt.count >= MAX_FAILS) {
    const menit = Math.ceil((WINDOW - (now - attempt.windowStart)) / 60);
    return { error: `Terlalu banyak percobaan gagal. Coba lagi dalam ${menit} menit.` };
  }

  const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  const ok = user ? await verifyPassword(password, user.passwordHash) : false;

  if (!ok || !user) {
    const fresh = !attempt || now - attempt.windowStart >= WINDOW;
    await db
      .insert(schema.loginAttempts)
      .values({ key, count: 1, windowStart: now })
      .onConflictDoUpdate({
        target: schema.loginAttempts.key,
        set: fresh ? { count: 1, windowStart: now } : { count: sql`${schema.loginAttempts.count} + 1` },
      });
    return { error: "Email atau password salah." };
  }

  await db.delete(schema.loginAttempts).where(eq(schema.loginAttempts.key, key));
  const env = await getEnv();
  const token = await signSession({ sub: String(user.id), email: user.email, name: user.name }, env.AUTH_SECRET);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  redirect("/admin");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/admin/login");
}
