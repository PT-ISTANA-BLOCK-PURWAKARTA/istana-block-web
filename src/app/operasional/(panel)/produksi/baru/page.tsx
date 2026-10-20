import Link from "next/link";
import { redirect } from "next/navigation";
import { BackLink, PageHead } from "@/components/erp/ui";
import { ProductionForm } from "@/components/ops/ProductionForm";
import { getDb } from "@/db";
import { UserError } from "@/lib/erp/server";
import { today } from "@/lib/erp/util";
import { requireShift } from "@/lib/ops/duty";
import { productionAccess, productionItems, recentLeaders } from "@/lib/ops/production";
import "../produksi.css";

export const metadata = { title: "Catat hasil produksi" };

export default async function ProduksiBaru() {
  const acc = await productionAccess();
  if (!acc.canEdit) redirect("/operasional/produksi");
  const db = await getDb();
  const [items, leaders] = await Promise.all([productionItems(db), recentLeaders(db)]);
  // Mandor/satpam wajib sedang piket: beri tahu di depan, bukan setelah mengisi semuanya.
  let needShift = false;
  try {
    await requireShift(acc.user);
  } catch (e) {
    if (e instanceof UserError) needShift = true;
    else throw e;
  }
  return (
    <>
      <BackLink href="/operasional/produksi">Hasil produksi</BackLink>
      <PageHead title="Catat hasil produksi" />
      {needShift && <p className="alert alert-warn" role="status">Absen piket dulu sebelum mencatat. <Link href="/operasional/piket">Buka halaman piket</Link></p>}
      <ProductionForm date={today()} category={acc.categories[0]} categories={acc.categories} hasil={[]} bahan={[]} showCost={acc.canFinance} items={items} leaders={leaders} />
    </>
  );
}
