import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { deleteSpec } from "@/app/operasional/actions/product-specs";
import { ConfirmAction } from "@/components/erp/ConfirmAction";
import { BackLink, PageHead } from "@/components/erp/ui";
import { SpecForm } from "@/components/ops/specs/SpecForm";
import { getDb, schema } from "@/db";
import { requirePerm } from "@/lib/auth";
import { formatQty } from "@/lib/erp/util";
import "../../produksi/produksi.css";

export const metadata = { title: "Ubah spesifikasi produk" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requirePerm("spesifikasi_produk");
  const { id } = await params;
  const db = await getDb();
  const s = await db.query.productSpecs.findFirst({ where: eq(schema.productSpecs.id, id) });
  if (!s) notFound();
  const items = await db.select({ id: schema.items.id, name: schema.items.name, code: schema.items.code }).from(schema.items).where(and(eq(schema.items.kind, "barang_jadi"), eq(schema.items.active, true))).orderBy(schema.items.name);
  // Barang tertaut yang sudah nonaktif tetap muncul di pilihan.
  if (s.itemId && !items.some((i) => i.id === s.itemId)) {
    const cur = await db.query.items.findFirst({ where: eq(schema.items.id, s.itemId) });
    if (cur) items.push({ id: cur.id, name: cur.name, code: cur.code });
  }
  return (
    <>
      <BackLink href="/operasional/spesifikasi-produk">Spesifikasi produk</BackLink>
      <PageHead title={`Ubah ${s.name}`} />
      <SpecForm
        initial={{ id: s.id, line: s.line, name: s.name, variant: s.variant ?? "", weightKg: s.weightKg != null ? formatQty(s.weightKg) : "", specs: Object.entries(s.specs ?? {}).map(([k, v]) => ({ k, v })), notes: s.notes, active: s.active, itemId: s.itemId ?? "" }}
        items={items}
      />
      <div style={{ marginTop: 16 }}><ConfirmAction action={deleteSpec.bind(null, s.id)} label="Hapus spesifikasi" confirmText={`Hapus spesifikasi ${s.name}?`} /></div>
    </>
  );
}
