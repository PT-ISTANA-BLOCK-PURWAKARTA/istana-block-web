import { getEnv } from "@/db";
import { forbidden, json, owner, quote, SCHEMA_ONLY, tableList } from "../guard";

/**
 * Isi satu tabel per halaman: ?table=&after=&limit= (limit maks 500) agar tiap permintaan tetap ringan.
 * Paging memakai kursor rowid (urut tetap, tidak melompat/menggandakan baris bila data berubah saat backup berjalan);
 * `after` = lastRowid halaman sebelumnya. Tidak ada tabel WITHOUT ROWID di skema.
 */
export async function GET(req: Request) {
  if (!(await owner())) return forbidden();
  const q = new URL(req.url).searchParams;
  const table = q.get("table") ?? "";
  const after = Math.max(0, Math.floor(Number(q.get("after")) || 0));
  const limit = Math.min(500, Math.max(1, Math.floor(Number(q.get("limit")) || 500)));
  const env = await getEnv();
  // Nama tabel dicocokkan dengan sqlite_master: tidak pernah memakai teks mentah dari permintaan.
  const known = (await tableList(env)).some((t) => t.name === table);
  if (!known || SCHEMA_ONLY.has(table)) return json({ error: "Tabel tidak dikenal." }, 400);
  const { results } = await env.DB.prepare(`SELECT rowid AS "__rowid", * FROM ${quote(table)} WHERE rowid > ?1 ORDER BY rowid LIMIT ?2`).bind(after, limit).all<Record<string, unknown>>();
  // __rowid hanya kursor: dibuang dari isi baris supaya backup tidak memuat kolom palsu.
  const lastRowid = results.length ? Number(results[results.length - 1].__rowid) : after;
  const rows = results.map(({ __rowid, ...rest }) => rest);
  return json({ rows, lastRowid });
}
