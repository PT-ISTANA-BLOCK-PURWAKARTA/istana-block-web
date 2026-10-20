// Laporan pimpinan terjadwal. TANPA "server-only"/"@/": dibundel bersama worker.ts.
import { users } from "../../../db/schema";
import { normalizeRoles, permsOf } from "../../roles";
import { pushToUsers } from "../push";
import { addDays } from "../../erp/util";
import { PERIOD_LABELS, wibDate, type Period } from "../shared/period";
import { buildSummary, summaryMessage } from "../summary-core";
import type { CronContext } from "./types";

/**
 * 07.00-07.04 WIB: kirim laporan periode LALU ke semua akun ber-izin "laporan" (pimpinan, pemilik):
 * harian (kemarin) setiap hari, mingguan (minggu lalu) tiap Senin, bulanan (bulan lalu) tiap tanggal 1.
 * Memakai versi ringkas buildSummary supaya hemat kueri (batas 50 subrequest per eksekusi Workers Free).
 */
export async function sendScheduledSummaries(c: CronContext): Promise<void> {
  const { db, env, now } = c;
  const wib = new Date(now.getTime() + 7 * 3600_000);
  if (wib.getUTCHours() !== 7 || wib.getUTCMinutes() >= 5) return;

  const rows = await db.select({ id: users.id, roles: users.roles }).from(users);
  const recipients = rows.filter((u) => permsOf(normalizeRoles(u.roles)).has("laporan")).map((u) => u.id);
  if (!recipients.length) return;

  const yesterday = addDays(wibDate(now), -1);
  const jobs: { period: Period; day: string }[] = [{ period: "harian", day: yesterday }];
  if (wib.getUTCDay() === 1) jobs.push({ period: "mingguan", day: yesterday });
  if (wib.getUTCDate() === 1) jobs.push({ period: "bulanan", day: yesterday });

  for (const job of jobs) {
    const summary = await buildSummary(db, job, { brief: true });
    await pushToUsers(db, env, recipients, {
      title: `Laporan ${PERIOD_LABELS[job.period].toLowerCase()} · ${summary.label}`,
      body: summaryMessage(summary),
      url: `/operasional/laporan?periode=${job.period}&tanggal=${job.day}`,
      tag: `summary-${job.period}`,
    });
  }
}
