// Ekspor satu acara ke berkas .ics (dengan VALARM) agar bisa masuk kalender HP. Hanya dipakai di klien.
import { TYPE_LABEL, type EventView } from "./common";

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (v: string) => v.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

export function buildIcs(event: EventView, host: string) {
  const start = new Date(event.startAt);
  const end = event.endAt ? new Date(event.endAt) : new Date(start.getTime() + 3600_000);
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//PT Istana Block//Kalender//ID", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
    `UID:acara-${event.id}@${host}`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(`${TYPE_LABEL[event.type]}: ${event.title}`)}`,
    ...(event.location ? [`LOCATION:${esc(event.location)}`] : []),
    ...(event.description ? [`DESCRIPTION:${esc(event.description)}`] : []),
    ...event.reminderMinutes.flatMap((minutes) => ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(event.title)}`, `TRIGGER:-PT${minutes}M`, "END:VALARM"]),
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadIcs(event: EventView) {
  const url = URL.createObjectURL(new Blob([buildIcs(event, window.location.host)], { type: "text/calendar;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: `${event.title.replace(/[^\w\- ]+/g, "").trim() || "acara"}.ics` });
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
