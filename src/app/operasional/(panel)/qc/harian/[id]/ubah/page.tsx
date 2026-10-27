import { notFound } from "next/navigation";
import { BackLink, PageHead } from "@/components/erp/ui";
import { MixLogForm, type MixLogInitial } from "@/components/ops/qc/MixLogForm";
import { numText } from "@/components/ops/qc/labels";
import { getDb } from "@/db";
import { requirePerm } from "@/lib/auth";
import { getMixLog, isInUse, listMixDesigns, qcCan } from "@/lib/ops/qc";

export const metadata = { title: "Ubah mix desain harian" };

export default async function UbahMixDesain({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePerm("qc");
  const { id } = await params;
  const db = await getDb();
  const log = await getMixLog(db, id);
  if (!log) notFound();
  const back = "/operasional/qc?tab=harian";
  const c = qcCan(me.roles);
  const problem =
    log.reviewStatus === "disetujui" ? "Data yang sudah di-ACC tidak dapat diubah." : !c.editAny && log.createdBy !== me.id ? "Hanya pembuat data atau kantor yang dapat mengubah." : null;
  if (problem) {
    return (
      <>
        <BackLink href={back}>Mix desain harian</BackLink>
        <PageHead title="Ubah mix desain harian" />
        <p className="alert alert-error" role="alert">{problem}</p>
      </>
    );
  }
  // Template yang dipilih catatan ini tetap tersedia walau sudah tidak dipakai.
  const designs = (await listMixDesigns(db)).filter((d) => isInUse(d) || d.id === log.mixDesignId);
  const initial: MixLogInitial = {
    id: log.id,
    workDate: log.workDate,
    layer: log.layer,
    mixDesignId: log.mixDesignId ?? "",
    product: log.product,
    approved: log.approvedMaterials,
    actual: log.actualMaterials,
    mixingCount: numText(log.mixingCount),
    boards: numText(log.boards),
    squareMeters: numText(log.squareMeters),
    rejects: numText(log.rejects),
    gradeB: numText(log.gradeB),
    halfPieces: numText(log.halfPieces),
    status: log.status,
    notes: log.notes,
  };
  return (
    <>
      <BackLink href={back}>Mix desain harian</BackLink>
      <PageHead title="Ubah mix desain harian" sub={log.reviewStatus === "revisi" && log.reviewNote ? `Perlu revisi: ${log.reviewNote}` : "Setelah disimpan, data kembali menunggu ACC."} />
      <MixLogForm initial={initial} designs={designs.map((d) => ({ id: d.id, layer: d.layer, name: d.name, product: d.product, materials: d.materials }))} back={back} />
    </>
  );
}
