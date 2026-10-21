import { notFound, redirect } from "next/navigation";
import { BackLink, PageHead } from "@/components/erp/ui";
import { ResultForm } from "@/components/ops/calendar/ResultForm";
import { getDb, schema } from "@/db";
import { requirePerm } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { calendarPeople, eventDecisionRows, getEvent } from "@/lib/ops/calendar";
import { can } from "@/lib/roles";
import "../../kalender.css";

export const metadata = { title: "Hasil rapat / training" };

export default async function HasilAcara({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePerm("kalender");
  if (!can(me.roles, "kalender_kelola")) redirect("/operasional/kalender?tab=rekap");
  const { id } = await params;
  const db = await getDb();
  const event = await getEvent(db, me.id, id);
  if (!event) notFound();
  if (event.type === "lainnya") redirect(`/operasional/kalender?acara=${event.id}`);
  const [row, decisions, people] = await Promise.all([
    db.query.calendarResults.findFirst({ where: eq(schema.calendarResults.eventId, id) }),
    eventDecisionRows(db, [id]),
    calendarPeople(db),
  ]);
  const result = row
    ? { leader: row.leader, category: row.category, summary: row.summary, attendees: row.attendees, guests: row.guests, durationHours: row.durationHours, evaluation: row.evaluation, notes: row.notes, files: row.files }
    : null;
  return (
    <>
      <BackLink href="/operasional/kalender?tab=rekap">Rekap rapat &amp; training</BackLink>
      <PageHead title={`Hasil ${event.type === "rapat" ? "rapat" : "training"}`} sub="Notulen, kehadiran, dan lampiran. Keputusan rapat masuk otomatis ke form F-IB-14." />
      <ResultForm event={event} result={result} decisions={decisions} names={people.map((p) => p.name)} />
    </>
  );
}
