import { BackLink, PageHead } from "@/components/erp/ui";
import { DEFAULT_MATERIALS, LAYERS } from "@/components/ops/qc/labels";
import { MixLogForm, type MixLogInitial } from "@/components/ops/qc/MixLogForm";
import { getDb } from "@/db";
import { requirePerm } from "@/lib/auth";
import { today } from "@/lib/erp/util";
import { isInUse, listMixDesigns } from "@/lib/ops/qc";

export const metadata = { title: "Isi mix desain harian" };

// ?layer=&design=&perubahan=1 dari panel "Produksi hari ini" (tombol "Ada perubahan").
export default async function IsiMixDesain({ searchParams }: { searchParams: Promise<{ layer?: string; design?: string; perubahan?: string }> }) {
  await requirePerm("qc");
  const sp = await searchParams;
  const db = await getDb();
  const designs = (await listMixDesigns(db)).filter(isInUse);
  const layer = LAYERS.find((l) => l === sp.layer) ?? "badan";
  const design = designs.find((d) => d.id === sp.design && d.layer === layer);
  const change = sp.perubahan === "1";
  const base = design?.materials ?? DEFAULT_MATERIALS[layer];
  const initial: MixLogInitial = {
    workDate: today(),
    layer,
    mixDesignId: design?.id ?? "",
    product: design?.product ?? "",
    approved: base,
    actual: change ? base.map((m) => ({ ...m })) : base.map((m) => ({ ...m, qty: null })),
    mixingCount: "",
    boards: "",
    squareMeters: "",
    rejects: "",
    status: change ? "tidak_sesuai" : "sesuai",
    notes: change ? "Perubahan dari produksi: " : "",
  };
  return (
    <>
      <BackLink href="/operasional/qc?tab=harian">Mix desain harian</BackLink>
      <PageHead title="Isi mix desain harian" sub='Kolom "Mix desain disetujui" diambil dari template; isi "Mix desain actual" sesuai yang benar-benar dipakai di lapangan.' />
      <MixLogForm initial={initial} designs={designs.map((d) => ({ id: d.id, layer: d.layer, name: d.name, product: d.product, materials: d.materials }))} back="/operasional/qc?tab=harian" />
    </>
  );
}
