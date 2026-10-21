import { getCurrentAdmin } from "@/lib/auth";
import { can } from "@/lib/roles";

/** Pembantu route handler backup & log: hanya pemilik (izin "keamanan"). */

export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

/** Pengguna yang boleh memakai API ini, atau null. Dipanggil di BARIS PERTAMA setiap handler. */
export async function owner() {
  const me = await getCurrentAdmin();
  return me && can(me.roles, "keamanan") ? me : null;
}

export const forbidden = () => json({ error: "Hanya pemilik yang boleh membuka Keamanan." }, 403);

/** Permintaan tulis harus berasal dari halaman ini sendiri. */
export const sameOrigin = (req: Request) => {
  const origin = req.headers.get("origin");
  return !origin || origin === new URL(req.url).origin;
};

/**
 * Tabel yang strukturnya ikut dicadangkan tetapi isinya tidak: catatan percobaan masuk hanya noise sementara.
 * (Hash password/PIN di tabel users SENGAJA ikut, sama seperti aplikasi lama. Rahasia AUTH_SECRET bukan data D1 dan tidak pernah disertakan.)
 */
export const SCHEMA_ONLY = new Set(["login_attempts"]);

/** Daftar tabel aplikasi dari sqlite_master (tanpa tabel internal SQLite/Cloudflare). */
export async function tableList(env: CloudflareEnv) {
  const { results } = await env.DB
    .prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND sql IS NOT NULL AND substr(name, 1, 7) <> 'sqlite_' AND substr(name, 1, 4) <> '_cf_' ORDER BY name")
    .all<{ name: string; sql: string }>();
  return results;
}

export const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;
