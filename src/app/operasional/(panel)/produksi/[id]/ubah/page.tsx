import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { BackLink, PageHead } from "@/components/erp/ui";
import { ProductionForm } from "@/components/ops/ProductionForm";
import { getDb, schema } from "@/db";
import { opsAccess } from "@/lib/erp/ops";
import { pickLists } from "@/lib/erp/server";
import { formatQty } from "@/lib/erp/util";

export const metadata = { title: "Ubah hasil produksi" };

export default async function UbahProduksi({ params }: { params: Promise<{ id: string }> }) {
  const { canStock: canEdit, canFinance } = await opsAccess();
  const { id } = await params;
  if (!canEdit) redirect(`/operasional/produksi/${id}`);
  const db = await getDb();
  const p = await db.query.productions.findFirst({ where: eq(schema.productions.id, id) });
  if (!p) notFound();
  const lines = await db.select().from(schema.productionLines).where(eq(schema.productionLines.productionId, id));
  const lists = await pickLists(db, lines.map((l) => l.itemId));
  const row = (l: (typeof lines)[number]) => ({ itemId: l.itemId, qty: formatQty(l.qty) });
  return (
    <>
      <BackLink href={`/operasional/produksi/${id}`}>{p.number}</BackLink>
      <PageHead title={`Ubah ${p.number}`} sub="Stok dan jurnalnya dihitung ulang saat disimpan." />
      <ProductionForm
        id={p.id}
        date={p.date}
        note={p.note}
        laborCost={canFinance ? p.laborCost : undefined}
        showCost={canFinance}
        hasil={lines.filter((l) => l.role === "hasil").map(row)}
        bahan={lines.filter((l) => l.role === "bahan").map(row)}
        items={lists.items.filter((i) => i.kind === "barang_jadi" || i.kind === "bahan_baku").map(({ id, code, name, unit, kind }) => ({ id, code, name, unit, kind }))}
      />
    </>
  );
}
