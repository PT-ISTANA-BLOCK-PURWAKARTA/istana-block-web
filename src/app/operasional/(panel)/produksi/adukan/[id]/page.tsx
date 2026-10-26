import { notFound, redirect } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { deleteBatch } from "@/app/operasional/actions/stock";
import { ConfirmAction } from "@/components/erp/ConfirmAction";
import { BackLink, PageHead } from "@/components/erp/ui";
import { BatchForm } from "@/components/ops/production/BatchForm";
import { getDb, schema } from "@/db";
import { formatQty, tgl } from "@/lib/erp/util";
import { activeSpecs, canChangeProduction, productionAccess, productionItems, recentLeaders } from "@/lib/ops/production";
import "../../produksi.css";

export const metadata = { title: "Ubah adukan cor" };

export default async function AdukanUbah({ params }: { params: Promise<{ id: string }> }) {
  const acc = await productionAccess();
  const { id } = await params;
  const db = await getDb();
  const b = await db.query.productionBatches.findFirst({ where: eq(schema.productionBatches.id, id) });
  if (!b) notFound();
  const docs = await db.select().from(schema.productions).where(eq(schema.productions.batchId, id)).orderBy(asc(schema.productions.number));
  if (!acc.categories.includes("precast") || docs.some((d) => !canChangeProduction(acc, d))) redirect("/operasional/produksi");
  const lines = docs.length ? await db.select().from(schema.productionLines).where(and(inArray(schema.productionLines.productionId, docs.map((d) => d.id)), eq(schema.productionLines.role, "hasil"))) : [];
  const first = new Map(lines.map((l) => [l.productionId, l]));
  const num = (n: number | null) => (n == null ? "" : formatQty(n));
  const [all, leaders, specs] = await Promise.all([productionItems(db, [...first.values()].map((l) => l.itemId)), recentLeaders(db), activeSpecs(db)]);
  const items = all.filter((i) => i.kind === "barang_jadi" && i.category === "precast");
  return (
    <>
      <BackLink href="/operasional/produksi">Hasil produksi</BackLink>
      <PageHead title="Ubah adukan cor" sub={`${tgl(b.date)} · ${formatQty(b.cementBags)} sak · ${docs.length} produk`} />
      <BatchForm
        id={b.id}
        date={b.date}
        cementBags={num(b.cementBags)}
        leader={b.leader ?? ""}
        note={b.note}
        rows={docs.map((d) => ({ docId: d.id, itemId: first.get(d.id)?.itemId ?? "", qty: num(first.get(d.id)?.qty ?? null), gradeB: num(d.gradeB), rejects: num(d.rejects), target: num(d.target), method: d.method ?? "" }))}
        items={items}
        leaders={leaders}
        specs={specs}
      />
      <div style={{ marginTop: 16 }}><ConfirmAction action={deleteBatch.bind(null, b.id)} label="Hapus adukan" confirmText="Hapus adukan ini beserta semua hasil produksinya? Stok dan jurnalnya ikut dihapus." /></div>
    </>
  );
}
