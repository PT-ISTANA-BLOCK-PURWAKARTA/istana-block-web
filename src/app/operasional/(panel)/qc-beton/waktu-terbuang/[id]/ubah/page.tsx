import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { BackLink, PageHead } from "@/components/erp/ui";
import { DowntimeForm, type DowntimeInitial } from "@/components/ops/qc/BetonForms";
import { getDb, schema } from "@/db";
import { requirePerm } from "@/lib/auth";
import { canEditDowntime, DOWNTIME_AREAS } from "@/lib/ops/downtime";
import { PRODUCTION_ISSUES } from "@/lib/ops/shared/goods";

export const metadata = { title: "Ubah waktu terbuang" };

export default async function WaktuTerbuangUbah({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePerm("qc_beton");
  const back = "/operasional/qc-beton?tab=terbuang";
  const { id } = await params;
  const db = await getDb();
  const row = await db.query.downtimes.findFirst({ where: eq(schema.downtimes.id, id) });
  if (!row || !canEditDowntime(me, row)) notFound();
  const initial: DowntimeInitial = { id: row.id, workDate: row.workDate, area: row.area ?? "", startTime: row.startTime ?? "", endTime: row.endTime ?? "", hours: row.minutes >= 60 ? String(Math.floor(row.minutes / 60)) : "", minutes: String(row.minutes % 60 || ""), reasons: row.reasons, workersShort: row.workersShort ? String(row.workersShort) : "", note: row.note };
  return (
    <>
      <BackLink href={back}>Waktu terbuang</BackLink>
      <PageHead title="Ubah waktu terbuang" sub="Waktu produksi yang hilang karena masalah di lapangan. Alasannya sama seperti alasan produksi berhenti di hasil produksi." />
      <DowntimeForm initial={initial} areas={DOWNTIME_AREAS} issues={PRODUCTION_ISSUES} back={back} />
    </>
  );
}
