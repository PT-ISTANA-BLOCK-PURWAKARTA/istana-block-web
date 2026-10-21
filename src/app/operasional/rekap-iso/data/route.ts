import { getDb } from "@/db";
import { getCurrentAdmin } from "@/lib/auth";
import { canViewForm, IsoError, isoOverview, listIsoRows, parseRange, todayWib } from "@/lib/ops/iso";
import { ISO_CODES, type IsoCode } from "@/lib/ops/shared/isoForms";
import { can } from "@/lib/roles";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

/**
 * Data Rekap ISO untuk komponen klien (ekspor Excel & kolom bulanan), per halaman kecil supaya tiap permintaan ringan.
 *   ?kind=rows&code=F-IB-02&from=&to=&offset=0  -> { rows, nextOffset }
 *   ?kind=overview&from=&to=                    -> IsoOverview
 */
export async function GET(request: Request) {
  const user = await getCurrentAdmin();
  if (!user || !can(user.roles, "iso")) return json({ error: "Akun Anda tidak berhak membuka Rekap ISO." }, 403);
  const q = new URL(request.url).searchParams;
  const from = q.get("from"), to = q.get("to");
  if (!from || !to) return json({ error: "Tanggal awal dan akhir wajib diisi." }, 400);
  const { range, error } = parseRange(from, to, todayWib());
  if (error) return json({ error }, 400);
  try {
    const db = await getDb();
    if (q.get("kind") === "overview") return json(await isoOverview(db, range));
    if (q.get("kind") === "rows") {
      const code = q.get("code") as IsoCode;
      if (!ISO_CODES.includes(code)) return json({ error: "Form tidak dikenal." }, 400);
      if (!canViewForm(user.roles, code)) return json({ error: "Akun Anda tidak memiliki akses ke form ini." }, 403);
      return json(await listIsoRows(db, { code, from: range.from, to: range.to, offset: Number(q.get("offset")) || 0 }));
    }
    return json({ error: "Permintaan tidak dikenal." }, 400);
  } catch (e) {
    if (e instanceof IsoError) return json({ error: e.message }, 400);
    throw e;
  }
}
