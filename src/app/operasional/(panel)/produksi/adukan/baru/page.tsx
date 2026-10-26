import Link from "next/link";
import { redirect } from "next/navigation";
import { BackLink, PageHead } from "@/components/erp/ui";
import { BatchForm } from "@/components/ops/production/BatchForm";
import { getDb } from "@/db";
import { UserError } from "@/lib/erp/server";
import { today } from "@/lib/erp/util";
import { requireShift } from "@/lib/ops/duty";
import { activeSpecs, productionAccess, productionItems, recentLeaders } from "@/lib/ops/production";
import "../../produksi.css";

export const metadata = { title: "Input adukan cor" };

export default async function AdukanBaru() {
  const acc = await productionAccess();
  if (!acc.categories.includes("precast")) redirect("/operasional/produksi");
  const db = await getDb();
  const [all, leaders, specs] = await Promise.all([productionItems(db), recentLeaders(db), activeSpecs(db)]);
  const items = all.filter((i) => i.kind === "barang_jadi" && i.category === "precast");
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
      <PageHead title="Input adukan cor" />
      {needShift && <p className="alert alert-warn" role="status">Absen piket dulu sebelum mencatat. <Link href="/operasional/piket">Buka halaman piket</Link></p>}
      <BatchForm date={today()} rows={[]} items={items} leaders={leaders} specs={specs} />
    </>
  );
}
