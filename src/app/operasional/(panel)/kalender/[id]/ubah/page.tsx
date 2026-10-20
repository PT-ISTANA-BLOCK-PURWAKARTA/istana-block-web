import { notFound, redirect } from "next/navigation";
import { BackLink, PageHead } from "@/components/erp/ui";
import { EventForm } from "@/components/ops/calendar/EventForm";
import { wibKey } from "@/components/ops/calendar/common";
import { getDb } from "@/db";
import { requirePerm } from "@/lib/auth";
import { calendarPeople, getEvent } from "@/lib/ops/calendar";
import { can } from "@/lib/roles";
import "../../kalender.css";

export const metadata = { title: "Ubah acara" };

export default async function UbahAcara({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePerm("kalender");
  const { id } = await params;
  if (!can(me.roles, "kalender_kelola")) redirect(`/operasional/kalender?acara=${encodeURIComponent(id)}`);
  const db = await getDb();
  const [event, people] = await Promise.all([getEvent(db, me.id, id), calendarPeople(db)]);
  if (!event) notFound();
  // Peserta lama yang sudah tidak punya izin kalender tetap tampil sebagai pilihan agar tidak hilang diam-diam.
  const known = new Set(people.map((p) => p.id));
  const all = [...people, ...event.participants.filter((p) => !known.has(p.userId)).map((p) => ({ id: p.userId, name: p.name, role: p.role }))];
  return (
    <>
      <BackLink href={`/operasional/kalender?acara=${event.id}&bulan=${wibKey(event.startAt).slice(0, 7)}`}>Kalender</BackLink>
      <PageHead title="Ubah acara" sub={event.seriesId ? "Bagian dari jadwal berulang: perubahan hanya berlaku untuk tanggal ini." : undefined} />
      <EventForm people={all} event={event} date={wibKey(event.startAt)} />
    </>
  );
}
