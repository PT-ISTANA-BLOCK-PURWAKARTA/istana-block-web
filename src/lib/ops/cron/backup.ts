// Pengingat backup mingguan. TANPA "server-only"/"@/": dibundel bersama worker.ts.
import { desc } from "drizzle-orm";
import { backupRuns, users } from "../../../db/schema";
import { normalizeRoles } from "../../roles";
import { pushToUsers } from "../push";
import type { CronContext } from "./types";

/** Senin 08.00-08.04 WIB: ingatkan pemilik bila backup terakhir >= 6 hari atau belum pernah. */
export async function remindBackup(c: CronContext): Promise<void> {
  const { db, env, now } = c;
  const wib = new Date(now.getTime() + 7 * 3600_000);
  if (wib.getUTCDay() !== 1 || wib.getUTCHours() !== 8 || wib.getUTCMinutes() >= 5) return;

  const [last] = await db.select({ at: backupRuns.at }).from(backupRuns).orderBy(desc(backupRuns.at)).limit(1);
  const days = last ? Math.floor((now.getTime() - last.at.getTime()) / 86_400_000) : null;
  if (days !== null && days < 6) return;

  const rows = await db.select({ id: users.id, roles: users.roles }).from(users);
  const owners = rows.filter((u) => normalizeRoles(u.roles).includes("owner")).map((u) => u.id);
  if (!owners.length) return;

  await pushToUsers(db, env, owners, {
    title: "Pengingat backup mingguan",
    body: `${days === null ? "Data aplikasi belum pernah di-backup." : `Backup terakhir ${days} hari lalu.`} Buka menu Keamanan dari komputer kantor, lalu klik Backup sekarang.`,
    url: "/operasional/keamanan",
    tag: "backup-reminder",
  }, c.budget);
}
