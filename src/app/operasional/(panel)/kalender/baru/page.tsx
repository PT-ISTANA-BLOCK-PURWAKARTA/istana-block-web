import { redirect } from "next/navigation";
import { BackLink, PageHead } from "@/components/erp/ui";
import { EventForm } from "@/components/ops/calendar/EventForm";
import { getDb } from "@/db";
import { requirePerm } from "@/lib/auth";
import { isDate, today } from "@/lib/erp/util";
import { calendarPeople } from "@/lib/ops/calendar";
import { can } from "@/lib/roles";
import "../kalender.css";

export const metadata = { title: "Tambah acara" };

export default async function AcaraBaru({ searchParams }: { searchParams: Promise<{ tanggal?: string }> }) {
  const me = await requirePerm("kalender");
  if (!can(me.roles, "kalender_kelola")) redirect("/operasional/kalender");
  const { tanggal } = await searchParams;
  const db = await getDb();
  const people = await calendarPeople(db);
  return (
    <>
      <BackLink href="/operasional/kalender">Kalender</BackLink>
      <PageHead title="Tambah acara" sub="Rapat, training, atau acara lain. Peserta yang dipilih mendapat pengingat." />
      <EventForm people={people} date={isDate(tanggal) ? tanggal : today()} />
    </>
  );
}
