import { BackLink, PageHead } from "@/components/erp/ui";
import { newStrength } from "@/components/ops/qc/strengthInit";
import { StrengthForm } from "@/components/ops/qc/StrengthForm";
import { DEFAULT_BETON_MATERIALS } from "@/components/ops/qc/BetonForms";
import { requirePerm } from "@/lib/auth";
import { today } from "@/lib/erp/util";

export const metadata = { title: "Laporan uji mutu beton" };

export default async function UjiBetonBaru() {
  await requirePerm("qc_beton");
  const back = "/operasional/qc-beton?tab=uji";
  return (
    <>
      <BackLink href={back}>Uji mutu beton</BackLink>
      <PageHead title="Buat laporan uji tekan beton" sub="Uji mutu beton precast & genteng beton." />
      <StrengthForm initial={{ ...newStrength(today(), DEFAULT_BETON_MATERIALS), scope: "beton" }} back={back} />
    </>
  );
}
