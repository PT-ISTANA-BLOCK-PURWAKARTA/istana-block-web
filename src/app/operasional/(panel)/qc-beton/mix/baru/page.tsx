import { BackLink, PageHead } from "@/components/erp/ui";
import { BetonMixForm, DEFAULT_BETON_MATERIALS, type BetonLogInitial } from "@/components/ops/qc/BetonForms";
import { getDb } from "@/db";
import { requirePerm } from "@/lib/auth";
import { today } from "@/lib/erp/util";
import { isInUse, listMixDesigns } from "@/lib/ops/qc";

export const metadata = { title: "Isi mix desain beton" };

export default async function MixBetonBaru() {
  await requirePerm("qc_beton");
  const db = await getDb();
  const back = "/operasional/qc-beton?tab=mix";
  const designs = (await listMixDesigns(db, "beton")).filter(isInUse).map((d) => ({ id: d.id, name: d.name, product: d.product, materials: d.materials }));
  const initial: BetonLogInitial = { workDate: today(), mixDesignId: "", product: "", approved: DEFAULT_BETON_MATERIALS, actual: DEFAULT_BETON_MATERIALS, mixingCount: "", leader: "Sumitra", notes: "" };
  return (
    <>
      <BackLink href={back}>Mix desain beton</BackLink>
      <PageHead title="Isi mix desain beton" sub={'"Disetujui" dari template; isi "Actual" sesuai takaran yang benar-benar dipakai di lapangan.'} />
      <BetonMixForm initial={initial} designs={designs} back={back} />
    </>
  );
}
