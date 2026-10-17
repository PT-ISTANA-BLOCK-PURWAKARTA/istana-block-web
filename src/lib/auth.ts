import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, getEnv, schema } from "@/db";
import { can, canOpen, homeFor, normalizeRoles, type ModuleKey, type Perm, type Role } from "./roles";
import { SESSION_COOKIE, verifySession } from "./session";

export type CurrentUser = { id: number; email: string; name: string; roles: Role[] };

/** Ambil pengguna yang sedang login, atau null. Selalu cek ke database. */
export async function getCurrentAdmin(): Promise<CurrentUser | null> {
  const env = await getEnv();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySession(token, env.AUTH_SECRET);
  if (!session) return null;
  const db = await getDb();
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, Number(session.sub)) });
  if (!user) return null;
  // Token yang dibuat sebelum password diganti dianggap tidak berlaku.
  const changedAt = Math.floor(user.updatedAt.getTime() / 1000);
  if (session.iat && session.iat < changedAt) return null;
  return { id: user.id, email: user.email, name: user.name, roles: normalizeRoles(user.roles) };
}

/** Wajib login (peran apa pun). */
export async function requireUser() {
  const user = await getCurrentAdmin();
  if (!user) redirect("/admin/login");
  return user;
}

/**
 * Wajib dipanggil di setiap halaman dan server action sebuah modul.
 * Pengguna tanpa akses diarahkan ke modul yang memang boleh ia buka.
 */
export async function requireModule(module: ModuleKey) {
  const user = await requireUser();
  if (!canOpen(user.roles, module)) redirect(homeFor(user.roles) ?? "/admin/login?e=akses");
  return user;
}

/** Panel situs (/admin). */
export async function requireAdmin() {
  return requireModule("web");
}

/** Hanya pemilik: kelola pengguna & peran. */
export async function requireOwner() {
  const user = await requireUser();
  if (!user.roles.includes("owner")) redirect(homeFor(user.roles) ?? "/admin/login?e=akses");
  return user;
}

/** Boleh membuka salah satu dari beberapa modul (mis. data pelanggan dipakai keuangan & operasional). */
export async function requireAnyModule(...modules: ModuleKey[]) {
  const user = await requireUser();
  if (!modules.some((m) => canOpen(user.roles, m))) redirect(homeFor(user.roles) ?? "/admin/login?e=akses");
  return user;
}

/** Wajib punya salah satu izin aksi (dipakai server action & halaman ubah di modul operasional). */
export async function requirePerm(...perms: Perm[]) {
  const user = await requireUser();
  if (!perms.some((p) => can(user.roles, p))) redirect(homeFor(user.roles) ?? "/admin/login?e=akses");
  return user;
}
