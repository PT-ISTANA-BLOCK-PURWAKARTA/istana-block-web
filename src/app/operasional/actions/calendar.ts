"use server";

import { redirect } from "next/navigation";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { FormState } from "@/components/admin/FormMessage";
import { getDb, schema } from "@/db";
import { calendarTypes, type CalendarAttendee, type CalendarFile, type CalendarType } from "@/db/erp";
import { requirePerm } from "@/lib/auth";
import { chunk, guard, insertMany, requireDate, runBatch, UserError } from "@/lib/erp/server";
import { addDays, parseQty } from "@/lib/erp/util";
import { logActivity } from "@/lib/ops/activity";
import { calendarPeople, eventDecisionRows } from "@/lib/ops/calendar";
import { cleanIsoValues, FORM_BY_CODE, LISTS } from "@/lib/ops/shared/isoForms";
import { wibDate } from "@/lib/ops/shared/period";
import { FILE_TYPES, MAX_FILE_UPLOAD } from "@/lib/media";

const { calendarEvents, calendarParticipants, calendarReminders, calendarResults, isoRecords } = schema;

const MAX_OCCURRENCES = 52;
const BASE = "/operasional/kalender";

/* ------------------------------------------------------------ pembantu */

function requireTime(v: FormDataEntryValue | null, label: string) {
  const s = String(v ?? "").trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) throw new UserError(`${label} tidak valid (contoh 09:30).`);
  return s;
}

/** Tanggal + jam WIB menjadi waktu absolut. */
const wibInstant = (date: string, time: string) => new Date(`${date}T${time}:00+07:00`);

function addMonths(date: string, n: number): string | null {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7)) - 1;
  const d = Number(date.slice(8, 10));
  const t = new Date(Date.UTC(y, m + n, d));
  return t.getUTCDate() === d ? t.toISOString().slice(0, 10) : null; // tanggal tak ada di bulan itu: dilewati
}

/** Tanggal-tanggal acara berulang (mingguan/bulanan) sampai batas tanggal, maksimal 52 kali. */
function occurrenceDays(date: string, mode: string, until: string | null) {
  if (mode === "none" || !until) return [date];
  const days: string[] = [];
  for (let i = 0; i < MAX_OCCURRENCES; i++) {
    const day = mode === "weekly" ? addDays(date, 7 * i) : addMonths(date, i);
    if (!day) continue;
    if (day > until) break;
    days.push(day);
  }
  return days;
}

function reminderRows(eventId: string, startAt: Date, minutes: number[]) {
  const now = Date.now();
  return minutes
    .map((minutesBefore) => ({ eventId, minutesBefore, remindAt: new Date(startAt.getTime() - minutesBefore * 60_000) }))
    .filter((r) => r.remindAt.getTime() > now);
}

function parseJsonList(v: FormDataEntryValue | null, max: number, label: string): Record<string, unknown>[] {
  let list: unknown;
  try {
    list = JSON.parse(String(v ?? "[]"));
  } catch {
    list = [];
  }
  const rows = Array.isArray(list) ? list.filter((r): r is Record<string, unknown> => !!r && typeof r === "object") : [];
  if (rows.length > max) throw new UserError(`${label}: maksimal ${max}.`);
  return rows;
}

const str = (v: unknown, max: number, label: string) => {
  const s = typeof v === "string" ? v.trim() : "";
  if (s.length > max) throw new UserError(`${label} terlalu panjang (maks ${max} huruf).`);
  return s;
};

/* ------------------------------------------------------------ acara */

/** Buat acara (opsional berulang) atau ubah SATU acara. Izin: kalender_kelola. */
export async function saveEvent(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("kalender_kelola");
  const res = await guard(async () => {
    const db = await getDb();
    const id = String(form.get("id") ?? "");
    const existing = id ? await db.query.calendarEvents.findFirst({ where: eq(calendarEvents.id, id) }) : undefined;
    if (id && !existing) throw new UserError("Acara tidak ditemukan.");

    const title = str(form.get("title"), 120, "Judul");
    if (title.length < 2) throw new UserError("Judul minimal 2 huruf.");
    const type = String(form.get("type") ?? "") as CalendarType;
    if (!calendarTypes.includes(type)) throw new UserError("Pilih jenis acara.");
    const date = requireDate(form.get("date"), "Tanggal mulai");
    const startTime = requireTime(form.get("startTime"), "Jam mulai");
    const startAt = wibInstant(date, startTime);
    const endTimeRaw = String(form.get("endTime") ?? "").trim();
    let endAt: Date | null = null;
    if (endTimeRaw) {
      const endDate = String(form.get("endDate") ?? "").trim() ? requireDate(form.get("endDate"), "Tanggal selesai") : date;
      endAt = wibInstant(endDate, requireTime(endTimeRaw, "Jam selesai"));
      if (endAt.getTime() <= startAt.getTime()) throw new UserError("Waktu selesai harus setelah waktu mulai.");
    }
    const location = str(form.get("location"), 120, "Tempat");
    const description = str(form.get("description"), 2000, "Agenda");

    const reminders = [...new Set(form.getAll("reminder").map((v) => Number(v)))];
    if (reminders.some((m) => !Number.isInteger(m) || m < 0 || m > 10080)) throw new UserError("Pengingat tidak valid.");
    if (reminders.length > 6) throw new UserError("Pengingat maksimal 6.");
    reminders.sort((a, b) => b - a);

    const wanted = [...new Set(form.getAll("participant").map((v) => Number(v)))];
    if (wanted.length > 200) throw new UserError("Peserta maksimal 200 orang.");
    const allowed = new Set((await calendarPeople(db)).map((p) => p.id));
    const participantIds = wanted.filter((p) => allowed.has(p));

    if (existing) {
      await runBatch(db, [
        db.update(calendarEvents).set({ title, type, startAt, endAt, location, description, reminderMinutes: reminders, updatedAt: new Date() }).where(eq(calendarEvents.id, existing.id)),
        db.delete(calendarParticipants).where(eq(calendarParticipants.eventId, existing.id)),
        db.delete(calendarReminders).where(and(eq(calendarReminders.eventId, existing.id), isNull(calendarReminders.sentAt))),
        ...insertMany(db, calendarParticipants, participantIds.map((userId) => ({ eventId: existing.id, userId }))),
        ...insertMany(db, calendarReminders, reminderRows(existing.id, startAt, reminders)),
      ]);
      return { id: existing.id, date, ok: "~Acara diperbarui." };
    }

    const mode = String(form.get("repeat") ?? "none");
    if (!["none", "weekly", "monthly"].includes(mode)) throw new UserError("Pilihan pengulangan tidak dikenal.");
    const until = mode === "none" ? null : requireDate(form.get("until"), "Tanggal terakhir pengulangan");
    if (until && until < date) throw new UserError("Tanggal terakhir pengulangan harus setelah tanggal mulai.");
    const days = occurrenceDays(date, mode, until);
    const duration = endAt ? endAt.getTime() - startAt.getTime() : null;
    const seriesId = days.length > 1 ? crypto.randomUUID() : null;
    const events = days.map((day) => {
      const at = wibInstant(day, startTime);
      return {
        id: crypto.randomUUID(), title, type, startAt: at, endAt: duration === null ? null : new Date(at.getTime() + duration),
        location, description, reminderMinutes: reminders, seriesId, createdBy: me.id,
      };
    });
    await runBatch(db, [
      ...insertMany(db, calendarEvents, events),
      ...insertMany(db, calendarParticipants, events.flatMap((e) => participantIds.map((userId) => ({ eventId: e.id, userId })))),
      ...insertMany(db, calendarReminders, events.flatMap((e) => reminderRows(e.id, e.startAt, reminders))),
    ]);
    return { id: events[0].id, date, ok: events.length > 1 ? `~${events.length} jadwal berulang dibuat.` : "~Acara tersimpan." };
  });
  if ("error" in res) return res;
  await logActivity(me, { action: "kalender.simpan", label: "Menyimpan acara kalender", summary: String(form.get("title") ?? "").slice(0, 120) });
  redirect(`${BASE}?bulan=${res.date.slice(0, 7)}&tanggal=${res.date}&acara=${res.id}&ok=${encodeURIComponent(res.ok)}`);
}

/** Hapus satu acara, atau seluruh jadwal berulangnya. Hasil rapat ikut terhapus; baris F-IB-14 hasil keputusan tetap (catatan mutu). */
export async function deleteEvent(id: string, wholeSeries = false): Promise<FormState> {
  const me = await requirePerm("kalender_kelola");
  const res = await guard(async () => {
    const db = await getDb();
    const event = await db.query.calendarEvents.findFirst({ where: eq(calendarEvents.id, id) });
    if (!event) return { count: 0, title: "" };
    const ids =
      wholeSeries && event.seriesId
        ? (await db.select({ id: calendarEvents.id }).from(calendarEvents).where(eq(calendarEvents.seriesId, event.seriesId))).map((r) => r.id)
        : [event.id];
    await runBatch(
      db,
      chunk(ids).flatMap((part) => [
        db.delete(calendarReminders).where(inArray(calendarReminders.eventId, part)),
        db.delete(calendarParticipants).where(inArray(calendarParticipants.eventId, part)),
        db.delete(calendarResults).where(inArray(calendarResults.eventId, part)),
        db.delete(calendarEvents).where(inArray(calendarEvents.id, part)),
      ]),
    );
    return { count: ids.length, title: event.title };
  });
  if ("error" in res) return res;
  if (res.count) await logActivity(me, { action: "kalender.hapus", label: "Menghapus acara kalender", summary: `${res.title} (${res.count} acara)` });
  redirect(`${BASE}?ok=${encodeURIComponent(res.count > 1 ? `~${res.count} acara dihapus.` : "dihapus")}`);
}

/* ------------------------------------------------------------ hasil rapat / training */

const FILE_KEY = /^kalender\/\d{4}\/[A-Za-z0-9][A-Za-z0-9._-]{0,150}$/;
const FILE_MIMES = new Set(Object.keys(FILE_TYPES));

/** Simpan notulen/hasil rapat atau training. Untuk RAPAT, keputusan disinkronkan ke baris F-IB-14 (data._from = "event:<id>"). */
export async function saveResult(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("kalender_kelola");
  const res = await guard(async () => {
    const db = await getDb();
    const event = await db.query.calendarEvents.findFirst({ where: eq(calendarEvents.id, String(form.get("eventId") ?? "")) });
    if (!event) throw new UserError("Acara tidak ditemukan.");
    if (event.type === "lainnya") throw new UserError("Rekap hanya untuk rapat dan training.");
    const rapat = event.type === "rapat";

    const leader = str(form.get("leader"), 120, "Pimpinan/pemateri");
    const category = str(form.get("category"), 60, "Jenis");
    const summary = str(form.get("summary"), 4000, "Ringkasan");
    const evaluation = str(form.get("evaluation"), 2000, "Evaluasi");
    const notes = str(form.get("notes"), 2000, "Catatan");
    const guests = str(form.get("guests"), 500, "Peserta lain");
    const durationRaw = String(form.get("durationHours") ?? "").trim();
    const durationHours = durationRaw ? parseQty(durationRaw) : null;
    if (durationHours !== null && (durationHours < 0 || durationHours > 240)) throw new UserError("Durasi harus angka jam yang wajar.");

    const attendees: CalendarAttendee[] = parseJsonList(form.get("attendees"), 200, "Peserta").map((a) => {
      const name = str(a.name, 120, "Nama peserta");
      if (!name) throw new UserError("Ada peserta tanpa nama.");
      const userId = typeof a.userId === "number" && Number.isInteger(a.userId) ? a.userId : null;
      return { userId, name, present: a.present === true, score: str(a.score, 40, "Nilai") || null, note: str(a.note, 200, "Catatan peserta") || null };
    });

    const seen = new Set<string>();
    const files: CalendarFile[] = parseJsonList(form.get("files"), 10, "Lampiran").flatMap((f) => {
      const key = typeof f.key === "string" ? f.key : "";
      if (!FILE_KEY.test(key)) throw new UserError("Lampiran tidak dikenal. Unggah ulang filenya.");
      if (seen.has(key)) return [];
      seen.add(key);
      const contentType = typeof f.contentType === "string" ? f.contentType : "";
      const size = Number(f.size);
      if (!FILE_MIMES.has(contentType) || !(size >= 0 && size <= MAX_FILE_UPLOAD)) throw new UserError("Lampiran tidak dikenal. Unggah ulang filenya.");
      return [{ key, name: str(f.name, 200, "Nama lampiran") || "lampiran", contentType, size }];
    });

    const decisions = rapat ? parseJsonList(form.get("decisions"), 50, "Keputusan") : [];
    const formDef = FORM_BY_CODE["F-IB-14"];
    const kind = (LISTS.jenisRapat as readonly string[]).includes(category) ? category : "Koordinasi";
    const present = attendees.filter((a) => a.present).length + guests.split(/[,\n;]+/).map((n) => n.trim()).filter(Boolean).length;
    const day = wibDate(event.startAt);
    const current = rapat ? await eventDecisionRows(db, [event.id]) : [];
    const keep = new Set<string>();
    const isoOps: unknown[] = [];
    let counted = 0;
    for (const d of decisions) {
      const keputusan = typeof d.keputusan === "string" ? d.keputusan.trim() : "";
      if (!keputusan) continue;
      const status = d.status === "Closed" ? "Closed" : "Open";
      const { values, error } = cleanIsoValues(formDef, {
        tanggal: day, jenis: kind, pimpinan: leader || null, peserta: present || null,
        topik: (typeof d.topik === "string" && d.topik.trim()) || event.title, keputusan, pj: d.pj ?? null, target: d.target || null,
        status, selesai: status === "Closed" ? d.selesai || null : null,
      });
      if (error) throw new UserError(`Keputusan "${keputusan.slice(0, 40)}": ${error}`);
      const data = { ...values, _from: `event:${event.id}` };
      const match = typeof d.id === "string" ? current.find((c) => c.id === d.id) : undefined;
      counted++;
      if (match) {
        keep.add(match.id);
        isoOps.push(db.update(isoRecords).set({ data, recordDate: day, updatedByName: me.name, updatedAt: new Date() }).where(eq(isoRecords.id, match.id)));
      } else {
        isoOps.push(db.insert(isoRecords).values({ formCode: "F-IB-14", kind: "record", recordDate: day, data, createdBy: me.id, createdByName: me.name }));
      }
    }
    for (const c of current) if (!keep.has(c.id)) isoOps.push(db.delete(isoRecords).where(eq(isoRecords.id, c.id)));

    const fields = { leader, category, summary, attendees, guests, durationHours, evaluation, notes, files, filledBy: me.id, filledByName: me.name };
    await runBatch(db, [
      db.insert(calendarResults).values({ eventId: event.id, ...fields }).onConflictDoUpdate({ target: calendarResults.eventId, set: { ...fields, updatedAt: new Date() } }),
      ...isoOps,
    ]);
    return { month: day.slice(0, 7), title: event.title, rapat, counted };
  });
  if ("error" in res) return res;
  await logActivity(me, { action: "kalender.hasil", label: "Mengisi hasil rapat/training", summary: res.title.slice(0, 120) });
  const [y, m] = res.month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const note = res.rapat && res.counted ? `~Hasil rapat tersimpan. ${res.counted} keputusan masuk form F-IB-14.` : "~Hasil tersimpan.";
  redirect(`${BASE}?tab=rekap&from=${res.month}-01&to=${res.month}-${String(last).padStart(2, "0")}&ok=${encodeURIComponent(note)}`);
}
