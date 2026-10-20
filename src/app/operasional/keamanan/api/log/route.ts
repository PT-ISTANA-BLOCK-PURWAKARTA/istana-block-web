import { getDb } from "@/db";
import { isDate } from "@/lib/erp/util";
import { ACTIVITY_LIMIT, listActivity, wibRange } from "@/lib/ops/security";
import { forbidden, json, owner } from "../guard";

/**
 * Log aktivitas lengkap (maks 2000 baris, termasuk kolom detail) untuk ekspor Excel.
 * Filter sama dengan halaman: ?dari=&sampai=&pengguna=&modul=&cari=&gagal=1
 */
export async function GET(req: Request) {
  if (!(await owner())) return forbidden();
  const q = new URL(req.url).searchParams;
  const from = q.get("dari"), to = q.get("sampai");
  if (!isDate(from) || !isDate(to)) return json({ error: "Tanggal awal dan akhir wajib diisi." }, 400);
  const range = wibRange(from, to);
  const userId = Number(q.get("pengguna")) || undefined;
  const db = await getDb();
  const rows = await listActivity(db, { ...range, userId, module: q.get("modul") || undefined, search: q.get("cari")?.trim() || undefined, failedOnly: q.get("gagal") === "1" }, ACTIVITY_LIMIT);
  return json({ rows: rows.map((r) => ({ ...r, at: r.at.getTime() })) });
}
