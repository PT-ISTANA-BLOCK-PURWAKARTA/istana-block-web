import { BackLink, PageHead } from "@/components/erp/ui";
import { DowntimeForm, type DowntimeInitial } from "@/components/ops/qc/BetonForms";
import { requirePerm } from "@/lib/auth";
import { today } from "@/lib/erp/util";
import { DOWNTIME_AREAS } from "@/lib/ops/downtime";
import { PRODUCTION_ISSUES } from "@/lib/ops/shared/goods";

export const metadata = { title: "Catat waktu terbuang" };

export default async function WaktuTerbuangBaru() {
  await requirePerm("qc_beton");
  const back = "/operasional/qc-beton?tab=terbuang";
  const initial: DowntimeInitial = { workDate: today(), area: DOWNTIME_AREAS[0], startTime: "", endTime: "", hours: "", minutes: "", reasons: [], workersShort: "", note: "" };
  return (
    <>
      <BackLink href={back}>Waktu terbuang</BackLink>
      <PageHead title="Catat waktu terbuang" sub="Waktu produksi yang hilang karena masalah di lapangan. Alasannya sama seperti alasan produksi berhenti di hasil produksi." />
      <DowntimeForm initial={initial} areas={DOWNTIME_AREAS} issues={PRODUCTION_ISSUES} back={back} />
    </>
  );
}
