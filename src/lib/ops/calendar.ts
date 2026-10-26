import "server-only";
import { and, asc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { getDb, schema } from "@/db";
import type { CalendarAttendee, CalendarFile, CalendarType, IsoValues } from "@/db/erp";
import { chunk, type DB } from "@/lib/erp/server";
import { normalizeRoles, can, ROLE_SHORT } from "@/lib/roles";
import type { EventView } from "@/components/ops/calendar/common";
import { FORM_BY_CODE, computeIsoValues } from "./shared/isoForms";
import { wibDate } from "./shared/period";

const { calendarEvents, calendarParticipants, calendarResults, isoRecords, users } = schema;
const creator = alias(users, "calendar_creator");

export type { CalendarAttendee, CalendarFile, EventView };

/** Label peran utama sebuah akun (untuk pengelompokan peserta). */
export function roleLabel(roles: unknown) {
  const first = normalizeRoles(roles)[0];
  return first ? ROLE_SHORT[first] : "-";
}

/**
 * Orang yang bisa diundang: akun yang punya izin `kalender` dan masih bisa masuk (punya password atau PIN).
 * Izin dihitung dari semua peran akun, apa pun cara masuknya.
 */
export async function calendarPeople(db: DB) {
  const rows = await db
    .select({ id: users.id, name: users.name, roles: users.roles, canLogin: sql<number>`(${users.passwordHash} is not null or ${users.pinHash} is not null)` })
    .from(users)
    .orderBy(asc(users.name));
  return rows
    .filter((u) => u.canLogin && can(normalizeRoles(u.roles), "kalender"))
    .map((u) => ({ id: u.id, name: u.name, role: roleLabel(u.roles) }));
}

async function participantsOf(db: DB, eventIds: string[]) {
  if (!eventIds.length) return [];
  return (
    await Promise.all(
      chunk(eventIds).map((part) =>
        db
          .select({ eventId: calendarParticipants.eventId, userId: users.id, name: users.name, roles: users.roles, signedAt: calendarParticipants.attendanceSignedAt })
          .from(calendarParticipants)
          .innerJoin(users, eq(calendarParticipants.userId, users.id))
          .where(inArray(calendarParticipants.eventId, part)),
      ),
    )
  ).flat();
}

const eventColumns = {
  id: calendarEvents.id, title: calendarEvents.title, type: calendarEvents.type, startAt: calendarEvents.startAt, endAt: calendarEvents.endAt,
  location: calendarEvents.location, description: calendarEvents.description, reminderMinutes: calendarEvents.reminderMinutes, seriesId: calendarEvents.seriesId,
  createdByName: creator.name,
};

async function toViews(db: DB, rows: { id: string; title: string; type: CalendarType; startAt: Date; endAt: Date | null; location: string; description: string; reminderMinutes: number[]; seriesId: string | null; createdByName: string | null }[], meId: number): Promise<EventView[]> {
  const people = await participantsOf(db, rows.map((r) => r.id));
  return rows.map((r) => {
    const participants = people.filter((p) => p.eventId === r.id).map((p) => ({ userId: p.userId, name: p.name, role: roleLabel(p.roles), signedAt: p.signedAt?.toISOString() ?? null }));
    return { ...r, startAt: r.startAt.toISOString(), endAt: r.endAt?.toISOString() ?? null, participants, isMine: participants.some((p) => p.userId === meId) };
  });
}

/** Acara yang beririsan dengan rentang waktu (termasuk acara beberapa hari yang mulai sebelum rentang). Maks 1000. */
export async function listEvents(db: DB, meId: number, from: Date, to: Date): Promise<EventView[]> {
  const rows = await db
    .select(eventColumns)
    .from(calendarEvents)
    .leftJoin(creator, eq(calendarEvents.createdBy, creator.id))
    .where(and(lte(calendarEvents.startAt, to), or(gte(calendarEvents.startAt, from), gte(calendarEvents.endAt, from))))
    .orderBy(asc(calendarEvents.startAt))
    .limit(1000);
  return toViews(db, rows, meId);
}

export async function getEvent(db: DB, meId: number, id: string): Promise<EventView | null> {
  const rows = await db.select(eventColumns).from(calendarEvents).leftJoin(creator, eq(calendarEvents.createdBy, creator.id)).where(eq(calendarEvents.id, id)).limit(1);
  return (await toViews(db, rows, meId))[0] ?? null;
}

/** Acara saya yang berlangsung hari ini (WIB) dan belum selesai: angka lencana menu. */
export async function myTodayCount(me: { id: number }): Promise<number> {
  const db = await getDb();
  const now = new Date();
  const rows = await db
    .select({ startAt: calendarEvents.startAt, endAt: calendarEvents.endAt })
    .from(calendarEvents)
    .innerJoin(calendarParticipants, and(eq(calendarParticipants.eventId, calendarEvents.id), eq(calendarParticipants.userId, me.id)))
    .where(and(gte(calendarEvents.startAt, new Date(now.getTime() - 12 * 3600_000)), lte(calendarEvents.startAt, new Date(now.getTime() + 24 * 3600_000))));
  const today = wibDate(now);
  return rows.filter((r) => wibDate(r.startAt) === today && (r.endAt ?? r.startAt).getTime() >= now.getTime()).length;
}

/* ------------------------------------------------------------ rekap rapat & training */

const fromKey = sql<string>`json_extract(${isoRecords.data}, '$._from')`;

/** Baris form F-IB-14 yang berasal dari sebuah acara (data._from = "event:<id>"). */
export async function eventDecisionRows(db: DB, eventIds: string[]) {
  if (!eventIds.length) return [];
  const keys = eventIds.map((id) => `event:${id}`);
  const rows = (
    await Promise.all(
      chunk(keys).map((part) =>
        db
          .select({ id: isoRecords.id, data: isoRecords.data, from: fromKey })
          .from(isoRecords)
          .where(and(eq(isoRecords.formCode, "F-IB-14"), eq(isoRecords.kind, "record"), inArray(fromKey, part)))
          .orderBy(asc(isoRecords.createdAt), asc(isoRecords.id)),
      ),
    )
  ).flat();
  const today = wibDate(new Date());
  return rows.map((r) => ({ id: r.id, eventId: String(r.from).slice("event:".length), values: computeIsoValues(FORM_BY_CODE["F-IB-14"], r.data, today) as IsoValues }));
}

export type RecapItem = EventView & {
  result: { leader: string; category: string; summary: string; attendees: CalendarAttendee[]; guests: string; durationHours: number | null; evaluation: string; notes: string; files: CalendarFile[]; filledByName: string | null } | null;
  decisions: { id: string; values: IsoValues }[];
};

/** Guest tambahan: "Budi, Andi" / satu nama per baris. */
export const guestNames = (guests: string | null | undefined) => (guests ?? "").split(/[,\n;]+/).map((n) => n.trim()).filter(Boolean);

/** Rapat & training dalam rentang waktu, lengkap dengan hasil dan keputusan F-IB-14-nya. */
export async function listRecap(db: DB, meId: number, from: Date, to: Date): Promise<RecapItem[]> {
  const rows = await db
    .select(eventColumns)
    .from(calendarEvents)
    .leftJoin(creator, eq(calendarEvents.createdBy, creator.id))
    .where(and(inArray(calendarEvents.type, ["rapat", "training"]), gte(calendarEvents.startAt, from), lte(calendarEvents.startAt, to)))
    .orderBy(asc(calendarEvents.startAt))
    .limit(500);
  const events = await toViews(db, rows, meId);
  const ids = events.map((e) => e.id);
  const [results, decisions] = await Promise.all([
    Promise.all(chunk(ids).map((part) => db.select().from(calendarResults).where(inArray(calendarResults.eventId, part)))).then((l) => l.flat()),
    eventDecisionRows(db, ids),
  ]);
  return events.map((e) => {
    const r = results.find((x) => x.eventId === e.id);
    return {
      ...e,
      result: r ? { leader: r.leader, category: r.category, summary: r.summary, attendees: r.attendees, guests: r.guests, durationHours: r.durationHours, evaluation: r.evaluation, notes: r.notes, files: r.files, filledByName: r.filledByName } : null,
      decisions: decisions.filter((d) => d.eventId === e.id).map(({ eventId: _e, ...d }) => d),
    };
  });
}
