import { getEnv } from "@/db";
import { forbidden, json, owner, quote, SCHEMA_ONLY, tableList } from "../guard";

/** Isi satu tabel per halaman: ?table=&offset=&limit= (limit maks 500) agar tiap permintaan tetap ringan. */
export async function GET(req: Request) {
  if (!(await owner())) return forbidden();
  const q = new URL(req.url).searchParams;
  const table = q.get("table") ?? "";
  const offset = Math.max(0, Math.floor(Number(q.get("offset")) || 0));
  const limit = Math.min(500, Math.max(1, Math.floor(Number(q.get("limit")) || 500)));
  const env = await getEnv();
  // Nama tabel dicocokkan dengan sqlite_master: tidak pernah memakai teks mentah dari permintaan.
  const known = (await tableList(env)).some((t) => t.name === table);
  if (!known || SCHEMA_ONLY.has(table)) return json({ error: "Tabel tidak dikenal." }, 400);
  const { results } = await env.DB.prepare(`SELECT * FROM ${quote(table)} LIMIT ?1 OFFSET ?2`).bind(limit, offset).all<Record<string, unknown>>();
  return json({ rows: results });
}
