import { sql } from "drizzle-orm";
import { BackLink, PageHead } from "@/components/erp/ui";
import { CountForm, type CountItem } from "@/components/ops/stock/CountForm";
import { getDb, schema } from "@/db";
import { requirePerm } from "@/lib/auth";
import { lastCountPerItem } from "@/lib/erp/stock-ops";
import { stockLevels } from "@/lib/erp/server";
import { LINE_LABEL, lineOfItem } from "@/lib/ops/production-lines";
import "../../../produksi/produksi.css";

export const metadata = { title: "Stok opname baru" };

export default async function Page() {
  await requirePerm("opname");
  const db = await getDb();
  const [items, levels, last] = await Promise.all([
    db
      .select()
      .from(schema.items)
      .where(sql`${schema.items.trackStock} = 1 and ${schema.items.kind} in ('barang_jadi','bahan_baku') and (${schema.items.active} = 1 or exists (select 1 from inv_stock_moves m where m.item_id = ${schema.items.id}))`)
      .orderBy(schema.items.code),
    stockLevels(db),
    lastCountPerItem(db),
  ]);
  const list: CountItem[] = items
    .map((i) => {
      const bahan = i.kind === "bahan_baku";
      const line = lineOfItem(i);
      return { id: i.id, code: i.code, name: i.name, unit: i.unit, group: bahan ? "bahan" : line, groupLabel: bahan ? "Bahan baku" : LINE_LABEL[line], system: levels.get(i.id)?.qty ?? 0, last: last.get(i.id) ?? null };
    })
    .sort((a, b) => a.groupLabel.localeCompare(b.groupLabel) || a.name.localeCompare(b.name));
  // Waktu sekarang WIB untuk isian datetime-local.
  const nowLocal = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 16);
  return (
    <>
      <BackLink href="/operasional/stok/opname">Stok opname</BackLink>
      <PageHead title="Stok opname baru" />
      <CountForm items={list} nowLocal={nowLocal} />
    </>
  );
}
