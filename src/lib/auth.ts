import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, getEnv, schema } from "@/db";
import { can, canOpen, effectiveRoles, homeFor, moduleOf, normalizeRoles, type ModuleKey, type Perm, type Role, type Via } from "./roles";
import { SESSION_COOKIE, verifySession } from "./session";

export type CurrentUser = {
  id: number;
  email: string | null;
  phone: string | null;
  name: string;
  /** Peran yang berlaku untuk sesi ini (sesi PIN hanya membawa peran lapangan). */
  roles: Role[];
  /** Semua peran akun, apa pun cara masuknya. */
  allRoles: Role[];
  via: Via;
  driverId: string | null;
};

/** Ambil pengguna yang sedang login, atau null. Selalu cek ke database. */
export async function getCurrentAdmin(): Promise<CurrentUser | null> {
  const env = await getEnv();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySession(token, env.AUTH_SECRET);
  if (!session) return null;
  const db = await getDb();
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, Number(session.sub)) });
  if (!user) return null;
  // Token yang dibuat sebelum password/PIN diganti dianggap tidak berlaku.
  const changedAt = Math.floor(user.updatedAt.getTime() / 1000);
  if (session.iat && session.iat < changedAt) return null;
  // Cara masuk yang sudah dicabut (password atau PIN dihapus pemilik) ikut mengakhiri sesinya.
  if (session.via === "pin" ? !user.pinHash || !user.phone : !user.passwordHash || !user.email) return null;
  const allRoles = normalizeRoles(user.roles);
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    name: user.name,
    roles: effectiveRoles(allRoles, session.via),
    allRoles,
    via: session.via,
    driverId: user.driverId,
  };
}

function denied(user: CurrentUser): never {
  redirect(homeFor(user.roles) ?? "/internal?e=akses");
}

/** Wajib login (peran apa pun). */
export async function requireUser(login = "/internal") {
  const user = await getCurrentAdmin();
  if (!user) redirect(login);
  return user;
}

/**
 * Wajib dipanggil di setiap halaman dan server action sebuah aplikasi.
 * Belum login → halaman masuk aplikasi itu. Masuk dengan PIN tapi membuka aplikasi kantor →
 * diminta masuk dengan email. Tanpa akses → aplikasi yang memang boleh dibuka.
 */
export async function requireModule(module: ModuleKey) {
  const mod = moduleOf(module);
  const user = await requireUser(mod.login);
  if (!canOpen(user.roles, module)) {
    if (user.via === "pin" && canOpen(user.allRoles, module)) redirect(`${mod.login}?e=email`);
    denied(user);
  }
  return user;
}

/** Aplikasi situs (/situs). */
export async function requireAdmin() {
  return requireModule("web");
}

/** Hanya pemilik (masuk dengan email): kelola pengguna & peran. */
export async function requireOwner() {
  const user = await requireUser();
  if (!user.roles.includes("owner")) denied(user);
  return user;
}

/** Boleh membuka salah satu dari beberapa aplikasi (mis. data pelanggan dipakai keuangan & operasional). */
export async function requireAnyModule(...modules: ModuleKey[]) {
  const user = await requireUser();
  if (!modules.some((m) => canOpen(user.roles, m))) denied(user);
  return user;
}

/** Wajib punya salah satu izin aksi (dipakai server action & halaman di aplikasi operasional). */
export async function requirePerm(...perms: Perm[]) {
  const user = await requireUser("/operasional/masuk");
  if (!perms.some((p) => can(user.roles, p))) denied(user);
  return user;
}

/** Label akun untuk tampilan: email atau nomor HP. */
export function userHandle(u: { email: string | null; phone: string | null }) {
  if (u.email) return u.email;
  if (!u.phone) return "";
  const local = u.phone.startsWith("62") ? `0${u.phone.slice(2)}` : u.phone;
  return local.replace(/^(\d{4})(\d{4})(\d+)$/, "$1-$2-$3");
}
