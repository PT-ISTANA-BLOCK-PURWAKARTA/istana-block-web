import "server-only";
import { eq } from "drizzle-orm";
import { getEnv, schema } from "@/db";
import { deliveryItems } from "@/lib/erp/ops";
import type { DB } from "@/lib/erp/server";
import { formatQty, tgl } from "@/lib/erp/util";
import { hidePrices } from "./shared/prices";
import { pushToUsers } from "./push";

export type DriverNotice = "baru" | "dialihkan" | "dibatalkan" | "dimuat";

/** Akun (users.id) yang terhubung ke seorang sopir. */
export async function userIdsOfDriver(db: DB, driverId: string) {
  const rows = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.driverId, driverId));
  return rows.map((r) => r.id);
}

/**
 * Push ke HP sopir: tugas baru, tugas dialihkan, dibatalkan, atau sudah dimuat. Tanpa nominal harga.
 * Tidak pernah melempar error (kegagalan push tidak boleh menggagalkan perubahan data); tanpa kunci VAPID = no-op.
 */
export async function notifyDriver(db: DB, driverId: string | null | undefined, kind: DriverNotice, deliveryId: string, reason?: string) {
  if (!driverId) return;
  try {
    const d = await db.query.deliveries.findFirst({ where: eq(schema.deliveries.id, deliveryId) });
    if (!d) return;
    const [ids, items, order, vehicle] = await Promise.all([
      userIdsOfDriver(db, driverId),
      deliveryItems(db, [deliveryId]),
      db.query.orders.findFirst({ where: eq(schema.orders.id, d.orderId) }),
      d.vehicleId ? db.query.vehicles.findFirst({ where: eq(schema.vehicles.id, d.vehicleId) }) : undefined,
    ]);
    if (!ids.length) return;
    const load = (items.get(deliveryId) ?? []).map((l) => `${formatQty(l.qty)} ${l.unit} ${l.name}`.trim()).join(", ");
    const where = order?.project || order?.address?.split("\n")[0] || "";
    const base = [load, where && `ke ${where}`, d.date && tgl(d.date), vehicle?.plate].filter(Boolean).join(" · ");
    const title =
      kind === "baru" ? `Tugas baru: ${d.number}` : kind === "dialihkan" ? `Tugas dialihkan: ${d.number}` : kind === "dibatalkan" ? `Dibatalkan: ${d.number}` : `Sudah dimuat: ${d.number}`;
    const body =
      kind === "dialihkan" ? "Surat jalan ini dialihkan ke sopir lain. Anda tidak perlu mengantarnya."
      : kind === "dibatalkan" ? (reason ? `Alasan: ${hidePrices(reason)}` : "Surat jalan dibatalkan oleh kantor.")
      : kind === "dimuat" ? `Barang sudah dimuat. ${base}`
      : base;
    const env = await getEnv();
    await pushToUsers(db, env, ids, { title, body, url: `/operasional/tugas/${deliveryId}`, tag: `delivery-${deliveryId}` });
  } catch {
    // push bersifat tambahan; abaikan
  }
}
