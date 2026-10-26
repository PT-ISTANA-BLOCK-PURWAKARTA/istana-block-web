import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { BackLink, PageHead } from "@/components/erp/ui";
import { ProductionForm } from "@/components/ops/ProductionForm";
import { getDb, schema } from "@/db";
import { isArchive } from "@/lib/erp/archive";
import { formatQty } from "@/lib/erp/util";
import { canChangeProduction, productionAccess, productionItems, recentLeaders } from "@/lib/ops/production";
import "../../produksi.css";

export const metadata = { title: "Ubah hasil produksi" };

export default async function UbahProduksi({ params }: { params: Promise<{ id: string }> }) {
  const acc = await productionAccess();
  const { id } = await params;
  const db = await getDb();
  const p = await db.query.productions.findFirst({ where: eq(schema.productions.id, id) });
  if (!p) notFound();
  if (isArchive(p.id) || !canChangeProduction(acc, p)) redirect(`/operasional/produksi/${id}`);
  const lines = await db.select().from(schema.productionLines).where(eq(schema.productionLines.productionId, id));
  const [items, leaders] = await Promise.all([productionItems(db, lines.map((l) => l.itemId)), recentLeaders(db)]);
  const row = (l: (typeof lines)[number]) => ({ itemId: l.itemId, qty: formatQty(l.qty) });
  const num = (n: number | null) => (n == null ? "" : formatQty(n));
  // Catatan lama (sebelum kolom lapangan) belum punya kategori: mulai dari kategori pertama yang boleh.
  const category = p.category && acc.categories.includes(p.category) ? p.category : acc.categories[0];
  return (
    <>
      <BackLink href={`/operasional/produksi/${id}`}>{p.number}</BackLink>
      <PageHead title={`Ubah ${p.number}`} sub="Stok dan jurnalnya dihitung ulang saat disimpan." />
      <ProductionForm
        id={p.id}
        date={p.date}
        category={category}
        categories={acc.categories}
        note={p.note}
        laborCost={acc.canFinance ? p.laborCost : undefined}
        showCost={acc.canFinance}
        leader={p.leader ?? ""}
        target={num(p.target)}
        cementBags={num(p.cementBags)}
        boards={num(p.boards)}
        rejects={num(p.rejects)}
        batchCode={p.batchCode ?? ""}
        issues={Array.isArray(p.issues) ? p.issues : []}
        photoKey={p.photoKey}
        hasil={lines.filter((l) => l.role === "hasil").map(row)}
        bahan={lines.filter((l) => l.role === "bahan").map(row)}
        items={items}
        leaders={leaders}
      />
    </>
  );
}
