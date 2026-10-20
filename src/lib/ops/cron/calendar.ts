// Pengingat kalender (cron tiap 5 menit). TANPA "server-only"/"@/": dibundel bersama worker.ts.
import { and, eq, inArray, isNull, lt, lte } from "drizzle-orm";
import { calendarEvents, calendarParticipants, calendarReminders } from "../../../db/schema";
import { pushToUsers } from "../push";
import type { CronContext } from "./types";

const TYPE_LABELS = { rapat: "Rapat", training: "Training", lainnya: "Acara" } as const;
/** Pengingat yang terlewat lebih dari ini ditandai saja, tidak dikirim (mis. layanan sempat mati). */
const STALE_MS = 2 * 3600_000;
/**
 * Pengingat yang diproses per tick. Batas 50 subrequest per eksekusi Workers Free: tiap pengingat memakai 1 kueri
 * langganan + 1 fetch per perangkat penerima. Sisanya diproses pada tick 5 menit berikutnya (belum ditandai terkirim).
 */
const BATCH = 10;

const wibTime = (date: Date) => date.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" });
const wibDay = (date: Date) => date.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", weekday: "long", day: "numeric", month: "long" });

function leadText(minutes: number) {
  if (minutes <= 0) return "dimulai sekarang";
  if (minutes < 60) return `${minutes} menit lagi`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} jam lagi`;
  return minutes === 1440 ? "besok" : `${Math.round(minutes / 1440)} hari lagi`;
}

/** Pengingat kalender: kirim push ke peserta untuk ops_calendar_reminders yang jatuh tempo (tandai sent_at dulu agar tak dobel). */
export async function sendDueReminders(c: CronContext): Promise<void> {
  const { db, env, now } = c;
  await db.update(calendarReminders).set({ sentAt: now }).where(and(isNull(calendarReminders.sentAt), lt(calendarReminders.remindAt, new Date(now.getTime() - STALE_MS))));
  const due = await db
    .select({
      id: calendarReminders.id, eventId: calendarReminders.eventId, minutesBefore: calendarReminders.minutesBefore,
      title: calendarEvents.title, type: calendarEvents.type, startAt: calendarEvents.startAt, location: calendarEvents.location,
    })
    .from(calendarReminders)
    .innerJoin(calendarEvents, eq(calendarReminders.eventId, calendarEvents.id))
    .where(and(isNull(calendarReminders.sentAt), lte(calendarReminders.remindAt, now)))
    .limit(BATCH);
  if (!due.length) return;
  // Tandai dulu agar tidak terkirim dua kali bila tick berikutnya berjalan bersamaan.
  await db.update(calendarReminders).set({ sentAt: now }).where(inArray(calendarReminders.id, due.map((r) => r.id)));
  const eventIds = [...new Set(due.map((r) => r.eventId))];
  const people = await db.select({ eventId: calendarParticipants.eventId, userId: calendarParticipants.userId }).from(calendarParticipants).where(inArray(calendarParticipants.eventId, eventIds));
  for (const reminder of due) {
    const userIds = people.filter((p) => p.eventId === reminder.eventId).map((p) => p.userId);
    if (!userIds.length) continue;
    await pushToUsers(db, env, userIds, {
      title: `${TYPE_LABELS[reminder.type]} ${leadText(reminder.minutesBefore)}: ${reminder.title}`,
      body: `${wibDay(reminder.startAt)}, ${wibTime(reminder.startAt)} WIB${reminder.location ? ` · ${reminder.location}` : ""}`,
      url: `/operasional/kalender?acara=${reminder.eventId}`,
      tag: `calendar-${reminder.eventId}`,
    });
  }
}
