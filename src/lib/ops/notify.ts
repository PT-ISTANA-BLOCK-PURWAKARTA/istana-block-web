import "server-only";
import { getDb, schema } from "@/db";
import type { NotificationKind } from "@/db/erp";
import type { DB } from "@/lib/erp/server";

/**
 * Pernyataan insert ke ops_notifications (BELUM dijalankan) untuk disisipkan ke runBatch, supaya notifikasi
 * ikut atomik dengan perubahan datanya. kind: po_baru | dimuat | status_kirim | umum; refId = id PO atau SJ.
 */
export function notificationOp(db: DB, kind: NotificationKind, refId: string, title: string, message = "") {
  return db.insert(schema.notifications).values({ kind, refId, title, message });
}

/** Varian langsung (mengeksekusi sekarang) untuk kode di luar batch. */
export async function addNotification(kind: NotificationKind, refId: string, title: string, message = "") {
  const db = await getDb();
  await notificationOp(db, kind, refId, title, message);
}
