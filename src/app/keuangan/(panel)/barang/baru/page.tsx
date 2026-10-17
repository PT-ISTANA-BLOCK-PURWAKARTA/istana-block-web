import { asc, eq } from "drizzle-orm";
import { ItemForm } from "@/components/erp/ItemForm";
import { BackLink, PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";

export const metadata = { title: "Barang baru" };

export default async function BarangBaru() {
  await requireModule("keuangan");
  const db = await getDb();
  const [products, revenue] = await Promise.all([
    db.select({ id: schema.products.id, name: schema.products.name }).from(schema.products).orderBy(asc(schema.products.sortOrder)),
    db.select({ id: schema.accounts.id, code: schema.accounts.code, name: schema.accounts.name }).from(schema.accounts).where(eq(schema.accounts.group, "pendapatan")).orderBy(asc(schema.accounts.code)),
  ]);
  return (
    <>
      <BackLink href="/keuangan/barang">Barang &amp; jasa</BackLink>
      <PageHead title="Barang baru" />
      <ItemForm products={products} revenueAccounts={revenue} />
    </>
  );
}
