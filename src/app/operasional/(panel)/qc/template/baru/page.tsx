import { BackLink, PageHead } from "@/components/erp/ui";
import { MixDesignForm } from "@/components/ops/qc/MixDesignForm";
import { requirePerm } from "@/lib/auth";
import { qcCan } from "@/lib/ops/qc";

export const metadata = { title: "Template mix desain" };

export default async function TemplateBaru() {
  const me = await requirePerm("qc");
  const approve = qcCan(me.roles).approve;
  return (
    <>
      <BackLink href="/operasional/qc?tab=template">Template</BackLink>
      <PageHead title={approve ? "Buat template mix desain" : "Ajukan template mix desain"} sub={approve ? "Template yang Anda buat langsung dipakai sebagai pilihan saat QC mengisi data harian." : "Template menunggu persetujuan manajer QC / pemilik sebelum bisa dipakai."} />
      <MixDesignForm canApprove={approve} back="/operasional/qc?tab=template" />
    </>
  );
}
