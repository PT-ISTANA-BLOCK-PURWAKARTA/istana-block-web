import { getEnv } from "@/db";
import { forbidden, json, owner, quote, SCHEMA_ONLY, tableList } from "../guard";

/** Daftar tabel + struktur (CREATE) + jumlah baris + perintah index, untuk menyusun berkas .sql di komputer kantor. */
export async function GET() {
  if (!(await owner())) return forbidden();
  const env = await getEnv();
  const tables = await tableList(env);
  const counted = tables.filter((t) => !SCHEMA_ONLY.has(t.name));
  const counts = counted.length ? await env.DB.batch<{ total: number }>(counted.map((t) => env.DB.prepare(`SELECT count(*) AS total FROM ${quote(t.name)}`))) : [];
  const rows = new Map(counted.map((t, i) => [t.name, Number(counts[i]?.results[0]?.total ?? 0)]));
  const { results: indexes } = await env.DB.prepare("SELECT sql FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL ORDER BY name").all<{ sql: string }>();
  return json({
    generatedAt: Date.now(),
    tables: tables.map((t) => ({ name: t.name, sql: t.sql, rows: rows.get(t.name) ?? 0, schemaOnly: SCHEMA_ONLY.has(t.name) })),
    indexes: indexes.map((r) => r.sql),
  });
}
