import { redirect } from "next/navigation";
import { BackLink, PageHead } from "@/components/erp/ui";
import { ProductionForm } from "@/components/ops/ProductionForm";
import { getDb } from "@/db";
import { opsAccess } from "@/lib/erp/ops";
import { pickLists } from "@/lib/erp/server";
import { today } from "@/lib/erp/util";

export const metadata = { title: "Catat hasil produksi" };

export default async function ProduksiBaru() {
  const { canEdit, canFinance } = await opsAccess();
  if (!canEdit) redirect("/operasional/produksi");
  const db = await getDb();
  const lists = await pickLists(db);
  return (
    <>
      <BackLink href="/operasional/produksi">Hasil produksi</BackLink>
      <PageHead title="Catat hasil produksi" />
      <ProductionForm
        date={today()}
        hasil={[]}
        bahan={[]}
        showCost={canFinance}
        items={lists.items.filter((i) => i.kind === "barang_jadi" || i.kind === "bahan_baku").map(({ id, code, name, unit, kind }) => ({ id, code, name, unit, kind }))}
      />
    </>
  );
}
