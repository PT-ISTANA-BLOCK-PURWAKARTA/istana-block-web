// Pengingat pagi Rekap ISO. Dijalankan cron (tanpa server-only/next/alias "@/"): impor relatif saja.
import * as schema from "../../../db/schema";
import { normalizeRoles } from "../../roles";
import { loadIsoAlerts } from "../iso-core";
import { pushToUsers } from "../push";
import { wibDate } from "../shared/period";
import type { CronContext } from "./types";

const WIB_MS = 7 * 3600_000;
/** Penerima: akun yang bisa masuk dan berperan QC, manajer QC, atau pemilik. */
const RECIPIENT_ROLES = ["qc", "manajer_qc", "owner"];

/** 07.00-07.04 WIB: ingatkan QC & pemilik bila ada jadwal F-IB-06 terlambat/segera, NCR Open lewat target, atau tindak lanjut rapat terlambat. */
export async function remindIsoSchedules(c: CronContext): Promise<void> {
  const wib = new Date(c.now.getTime() + WIB_MS);
  if (wib.getUTCHours() !== 7 || wib.getUTCMinutes() >= 5) return;
  const day = wibDate(c.now);
  const { late, soon, ncr, meetings } = await loadIsoAlerts(c.db, day);
  if (!late.length && !soon.length && !ncr.length && !meetings.length) return;

  const names = (list: typeof late) => list.slice(0, 3).map((row) => row.values.nama).join(", ") + (list.length > 3 ? ", …" : "");
  const lines = [
    late.length || soon.length
      ? `Kalibrasi/maintenance: ${[late.length ? `${late.length} terlambat (${names(late)})` : "", soon.length ? `${soon.length} jatuh tempo ≤ 7 hari (${names(soon)})` : ""].filter(Boolean).join(", ")}`
      : "",
    ncr.length ? `NCR lewat target: ${ncr.length}` : "",
    meetings.length ? `Tindak lanjut rapat terlambat: ${meetings.length}` : "",
  ].filter(Boolean);

  const people = await c.db.select({ id: schema.users.id, roles: schema.users.roles, passwordHash: schema.users.passwordHash, pinHash: schema.users.pinHash }).from(schema.users);
  const recipients = people.filter((u) => (u.passwordHash || u.pinHash) && normalizeRoles(u.roles).some((r) => RECIPIENT_ROLES.includes(r))).map((u) => u.id);
  if (!recipients.length) return;

  const target = late.length || soon.length ? "F-IB-06" : ncr.length ? "F-IB-15" : "F-IB-14";
  await pushToUsers(c.db, c.env, recipients, {
    title: "Pengingat form mutu ISO",
    body: lines.join("\n"),
    url: `/operasional/rekap-iso?tab=form&form=${target}`,
    tag: "iso-reminder",
  });
}
