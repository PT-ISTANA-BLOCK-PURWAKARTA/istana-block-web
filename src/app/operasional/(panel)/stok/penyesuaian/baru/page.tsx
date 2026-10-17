import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { BackLink, PageHead } from "@/components/erp/ui";
import { AdjustmentForm } from "@/components/ops/AdjustmentForm";
import { getDb, schema } from "@/db";
import { opsAccess } from "@/lib/erp/ops";
import { stockLevels, unitCost } from "@/lib/erp/server";
import { today } from "@/lib/erp/util";

export const metadata = { title: "Penyesuaian stok baru" };

export default async function PenyesuaianBaru({ searchParams }: { searchParams: Promise<{ barang?: string; awal?: string }> }) {
  const { canEdit } = await opsAccess();
  if (!canEdit) redirect("/operasional/stok/penyesuaian");
  const sp = await searchParams;
  const db = await getDb();
  const [items, levels] = await Promise.all([
    db.select().from(schema.items).where(eq(schema.items.trackStock, true)).orderBy(asc(schema.items.code)),
    stockLevels(db),
  ]);
  const opts = items
    .filter((i) => i.active && (i.kind === "barang_jadi" || i.kind === "bahan_baku"))
    .map((i) => ({ id: i.id, code: i.code, name: i.name, unit: i.unit, onHand: levels.get(i.id)?.qty ?? 0, avgCost: unitCost(levels.get(i.id), i) }));
  return (
    <>
      <BackLink href="/operasional/stok/penyesuaian">Penyesuaian stok</BackLink>
      <PageHead title="Penyesuaian stok" />
      <AdjustmentForm date={today()} itemId={sp.barang} opening={sp.awal === "1"} items={opts} />
    </>
  );
}
