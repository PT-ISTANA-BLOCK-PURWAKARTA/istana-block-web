import { notFound } from "next/navigation";
import { BackLink, PageHead } from "@/components/erp/ui";
import { DEFAULT_COMPOSITION, numText } from "@/components/ops/qc/labels";
import type { StrengthInitial } from "@/components/ops/qc/strengthInit";
import { StrengthForm } from "@/components/ops/qc/StrengthForm";
import { getDb } from "@/db";
import { requirePerm } from "@/lib/auth";
import { getStrengthTest, qcCan } from "@/lib/ops/qc";

export const metadata = { title: "Ubah laporan uji kuat tekan" };

export default async function UjiTekanUbah({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePerm("qc");
  const { id } = await params;
  const db = await getDb();
  const test = await getStrengthTest(db, id);
  if (!test) notFound();
  const back = "/operasional/qc?tab=uji-tekan";
  const problem =
    test.reviewStatus === "disetujui" ? "Laporan yang sudah di-ACC tidak dapat diubah." : !qcCan(me.roles).editAny && test.createdBy !== me.id ? "Hanya pembuat laporan atau kantor yang dapat mengubah." : null;
  if (problem) {
    return (
      <>
        <BackLink href={back}>Uji kuat tekan</BackLink>
        <PageHead title="Ubah laporan uji kuat tekan" />
        <p className="alert alert-error" role="alert">{problem}</p>
      </>
    );
  }
  const initial: StrengthInitial = {
    id: test.id,
    reportDate: test.reportDate,
    companyName: test.companyName,
    address: test.address,
    concreteGrade: test.concreteGrade,
    addressedTo: test.addressedTo,
    composition: test.composition.length ? test.composition : DEFAULT_COMPOSITION,
    notes: test.notes,
    samples: test.samples.map((s) => ({ sampleName: s.sampleName, madeAt: s.madeAt ?? "", testedAt: s.testedAt ?? "", weightKg: numText(s.weightKg), areaCm2: numText(s.areaCm2), maxLoadKn: numText(s.maxLoadKn) })),
  };
  return (
    <>
      <BackLink href={back}>Uji kuat tekan</BackLink>
      <PageHead title="Ubah laporan uji kuat tekan" sub={test.reviewStatus === "revisi" && test.reviewNote ? `Perlu revisi: ${test.reviewNote}` : "Setelah disimpan, laporan kembali menunggu ACC."} />
      <StrengthForm initial={initial} back={back} />
    </>
  );
}
