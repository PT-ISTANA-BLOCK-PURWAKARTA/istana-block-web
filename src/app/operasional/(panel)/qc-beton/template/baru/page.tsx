import { BackLink, PageHead } from "@/components/erp/ui";
import { BetonDesignForm } from "@/components/ops/qc/BetonForms";
import { requirePerm } from "@/lib/auth";
import { qcCan } from "@/lib/ops/qc";

export const metadata = { title: "Template mix beton" };

export default async function TemplateBetonBaru() {
  const me = await requirePerm("qc_beton");
  const canApprove = qcCan(me.roles, "beton").approve;
  const back = "/operasional/qc-beton?tab=mix";
  return (
    <>
      <BackLink href={back}>Mix desain beton</BackLink>
      <PageHead title={canApprove ? "Buat template mix beton" : "Ajukan template mix beton"} sub="Template diajukan QC Beton dan disetujui kantor sebelum dipakai di catatan harian." />
      <BetonDesignForm canApprove={canApprove} back={back} />
    </>
  );
}
