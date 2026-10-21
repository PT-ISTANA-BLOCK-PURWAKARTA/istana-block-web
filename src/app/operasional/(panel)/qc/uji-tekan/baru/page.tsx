import { BackLink, PageHead } from "@/components/erp/ui";
import { DEFAULT_COMPOSITION } from "@/components/ops/qc/labels";
import { newStrength } from "@/components/ops/qc/strengthInit";
import { StrengthForm } from "@/components/ops/qc/StrengthForm";
import { requirePerm } from "@/lib/auth";
import { today } from "@/lib/erp/util";

export const metadata = { title: "Laporan uji kuat tekan" };

export default async function UjiTekanBaru() {
  await requirePerm("qc");
  return (
    <>
      <BackLink href="/operasional/qc?tab=uji-tekan">Uji kuat tekan</BackLink>
      <PageHead title="Buat laporan uji kuat tekan" />
      <StrengthForm initial={newStrength(today(), DEFAULT_COMPOSITION)} back="/operasional/qc?tab=uji-tekan" />
    </>
  );
}
