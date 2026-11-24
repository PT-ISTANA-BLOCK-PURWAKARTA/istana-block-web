import { notFound } from "next/navigation";
import { BackLink, PageHead } from "@/components/erp/ui";
import { BetonMixForm, type BetonLogInitial } from "@/components/ops/qc/BetonForms";
import { numText } from "@/components/ops/qc/labels";
import { getDb } from "@/db";
import { requirePerm } from "@/lib/auth";
import { getMixLog, qcCan, isInUse, listMixDesigns } from "@/lib/ops/qc";

export const metadata = { title: "Ubah mix desain beton" };

export default async function MixBetonUbah({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePerm("qc_beton");
  const db = await getDb();
  const back = "/operasional/qc-beton?tab=mix";
  const designs = (await listMixDesigns(db, "beton")).filter(isInUse).map((d) => ({ id: d.id, name: d.name, product: d.product, materials: d.materials }));
  const { id } = await params;
  const log = await getMixLog(db, id);
  if (!log || log.scope !== "beton") notFound();
  const c = qcCan(me.roles, "beton");
  const problem = log.reviewStatus === "disetujui" ? "Data yang sudah di-ACC tidak dapat diubah." : !c.editAny && log.createdBy !== me.id ? "Hanya pembuat data atau kantor yang dapat mengubah." : null;
  if (problem) {
    return (
      <>
        <BackLink href={back}>Mix desain beton</BackLink>
        <PageHead title="Ubah mix desain beton" />
        <p className="alert alert-error" role="alert">{problem}</p>
      </>
    );
  }
  const initial: BetonLogInitial = { id: log.id, workDate: log.workDate, mixDesignId: log.mixDesignId ?? "", product: log.product, approved: log.approvedMaterials, actual: log.actualMaterials, mixingCount: numText(log.mixingCount), leader: log.leader ?? "", notes: log.notes };
  return (
    <>
      <BackLink href={back}>Mix desain beton</BackLink>
      <PageHead title="Ubah mix desain beton" sub={log.reviewStatus === "revisi" && log.reviewNote ? `Perlu revisi: ${log.reviewNote}` : "Setelah disimpan, data kembali menunggu ACC."} />
      <BetonMixForm initial={initial} designs={designs} back={back} />
    </>
  );
}
