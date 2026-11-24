/** Waktu produksi terbuang (QC Beton): daftar, rekap per alasan, dan aturan ubah. */
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { schema } from "@/db";
import type { QcScope } from "@/db/erp";
import type { DB } from "@/lib/erp/server";
import type { Role } from "@/lib/roles";

export const DOWNTIME_AREAS = ["Semua precast", "Genteng Beton", "Buis Beton", "U-Ditch", "Kanstin", "Grass Block", "Greffel", "Lainnya"];

/** 135 menit → "2 jam 15 mnt". */
export const durationText = (minutes: number) => {
  const m = Math.round(minutes);
  return m >= 60 ? `${Math.floor(m / 60)} jam${m % 60 ? ` ${m % 60} mnt` : ""}` : `${m} mnt`;
};

export type DowntimeRow = typeof schema.downtimes.$inferSelect;

export function listDowntimes(db: DB, from: string, to: string, scope: QcScope = "beton") {
  const d = schema.downtimes;
  return db.select().from(d).where(and(eq(d.scope, scope), gte(d.workDate, from), lte(d.workDate, to))).orderBy(desc(d.workDate), desc(d.createdAt));
}

/** Menit tiap catatan dibagi rata ke alasannya, supaya total per alasan = total keseluruhan. Urut terbesar. */
export function downtimeByReason(rows: Pick<DowntimeRow, "minutes" | "reasons">[]) {
  const by = new Map<string, number>();
  for (const r of rows) for (const reason of r.reasons) by.set(reason, (by.get(reason) ?? 0) + r.minutes / Math.max(1, r.reasons.length));
  return [...by.entries()].sort((a, b) => b[1] - a[1]);
}

/** Pencatat sendiri, atau kantor (pemilik / operasional). */
export function canEditDowntime(me: { id: number; roles: readonly Role[] }, row: Pick<DowntimeRow, "createdBy">) {
  return me.roles.includes("owner") || me.roles.includes("operasional") || row.createdBy === me.id;
}
