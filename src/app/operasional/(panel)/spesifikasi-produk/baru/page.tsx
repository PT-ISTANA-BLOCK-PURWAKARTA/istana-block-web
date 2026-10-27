import { BackLink, PageHead } from "@/components/erp/ui";
import { SpecForm } from "@/components/ops/specs/SpecForm";
import { getDb, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import { requirePerm } from "@/lib/auth";
import "../../produksi/produksi.css";

export const metadata = { title: "Tambah spesifikasi produk" };

export default async function Page({ searchParams }: { searchParams: Promise<{ kategori?: string }> }) {
  await requirePerm("spesifikasi_produk");
  const sp = await searchParams;
  const db = await getDb();
  const items = await db.select({ id: schema.items.id, name: schema.items.name, code: schema.items.code }).from(schema.items).where(and(eq(schema.items.kind, "barang_jadi"), eq(schema.items.active, true))).orderBy(schema.items.name);
  const line = sp.kategori === "genteng" || sp.kategori === "buis" || sp.kategori === "uditch" ? sp.kategori : "paving";
  return (
    <>
      <BackLink href="/operasional/spesifikasi-produk">Spesifikasi produk</BackLink>
      <PageHead title="Tambah spesifikasi produk" />
      <SpecForm initial={{ line, name: "", variant: "", weightKg: "", specs: [], notes: "", active: true, itemId: "" }} items={items} />
    </>
  );
}
