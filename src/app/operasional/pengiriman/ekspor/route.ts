import { getDb } from "@/db";
import { getCurrentAdmin } from "@/lib/auth";
import { isDate, monthStart, today } from "@/lib/erp/util";
import { deliveryReport } from "@/lib/ops/deliveries";
import { can } from "@/lib/roles";

// Data laporan pengiriman untuk ekspor Excel (xlsx dibuat di browser). Izin: pengiriman.
// Rentang menurut tanggal surat jalan (?from=&to=, default awal bulan s.d. hari ini).
export async function GET(req: Request) {
  const me = await getCurrentAdmin();
  if (!me || !can(me.roles, "pengiriman")) return new Response("Tidak diizinkan", { status: 403 });
  const url = new URL(req.url);
  const t = today();
  const from = isDate(url.searchParams.get("from")) ? (url.searchParams.get("from") as string) : monthStart(t);
  const to = isDate(url.searchParams.get("to")) ? (url.searchParams.get("to") as string) : t;
  if (from > to) return new Response("Rentang tanggal terbalik", { status: 400 });
  const db = await getDb();
  const report = await deliveryReport(db, from, to);
  return new Response(JSON.stringify({ from, to, ...report }), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
