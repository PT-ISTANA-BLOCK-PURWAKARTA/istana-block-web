import type { CronContext } from "./types";

/** Pengingat kalender: kirim push ke peserta untuk ops_calendar_reminders yang jatuh tempo (tandai sent_at dulu agar tak dobel). */
export async function sendDueReminders(_c: CronContext): Promise<void> {
  // TODO (subagen kalender): ambil <=50 pengingat remind_at<=now & sent_at null; abaikan yang terlewat >2 jam; kirim push ke peserta.
}
