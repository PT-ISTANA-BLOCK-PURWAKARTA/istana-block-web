import { getDb } from "@/db";
import { getCurrentAdmin } from "@/lib/auth";
import { isDate, today } from "@/lib/erp/util";
import { routeOf, truckBoard } from "@/lib/erp/tracking";
import { can } from "@/lib/roles";

/** Data peta lacak truk (dimuat ulang tiap 30 detik oleh halaman Lacak truk). */
export async function GET(req: Request) {
  const me = await getCurrentAdmin();
  if (!me || !can(me.roles, "lacak")) return new Response(JSON.stringify({ error: "Tidak diizinkan" }), { status: 403 });
  const url = new URL(req.url);
  const db = await getDb();
  const trucks = await truckBoard(db);
  const vehicle = url.searchParams.get("rute");
  const date = url.searchParams.get("tanggal");
  const route = vehicle && trucks.some((t) => t.id === vehicle) ? await routeOf(db, vehicle, isDate(date) ? date : today()) : null;
  return new Response(JSON.stringify({ trucks, route, now: Math.floor(Date.now() / 1000) }), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
