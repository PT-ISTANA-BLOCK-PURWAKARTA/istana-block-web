import "server-only";
import { getDb } from "@/db";
import { buildSummary, type Period } from "./summary-core";

export { summaryMessage, type Summary, type QtyItem, type Issue } from "./summary-core";

/** Laporan pimpinan untuk satu periode (halaman /operasional/laporan). `day` = tanggal acuan YYYY-MM-DD (WIB). */
export async function getSummary(period: Period, day: string) {
  const db = await getDb();
  return buildSummary(db, { period, day });
}
