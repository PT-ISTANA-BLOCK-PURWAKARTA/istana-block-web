import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, getEnv, schema } from "@/db";
import { SESSION_COOKIE, verifySession } from "./session";

/** Ambil admin yang sedang login, atau null. Selalu cek ke database. */
export async function getCurrentAdmin() {
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
  return { id: user.id, email: user.email, name: user.name };
}

/** Wajib dipanggil di setiap halaman admin dan setiap server action admin. */
export async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
