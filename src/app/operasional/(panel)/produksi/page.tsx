import Link from "next/link";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { Ok, PageHead, Rp } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { opsAccess } from "@/lib/erp/ops";
import { formatQty, tgl } from "@/lib/erp/util";

export const metadata = { title: "Hasil produksi" };

export default async function Produksi({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { canEdit, canFinance } = await opsAccess();
  const { ok } = await searchParams;
  const db = await getDb();
  const rows = await db.select().from(schema.productions).orderBy(desc(schema.productions.date), desc(schema.productions.number)).limit(300);
  const ids = rows.map((r) => r.id);
  const [outs, vals] = ids.length
    ? await Promise.all([
        db
          .select({ productionId: schema.productionLines.productionId, qty: schema.productionLines.qty, name: schema.items.name, unit: schema.items.unit })
          .from(schema.productionLines)
          .leftJoin(schema.items, eq(schema.items.id, schema.productionLines.itemId))
          .where(and(eq(schema.productionLines.role, "hasil"), inArray(schema.productionLines.productionId, ids))),
        db.all<{ id: string; value: number }>(sql`select source_id id, coalesce(sum(value),0) value from inv_stock_moves where source = 'produksi' and qty > 0 group by source_id`),
      ])
    : [[], []];
  const outBy = new Map<string, string[]>();
  for (const o of outs) outBy.set(o.productionId, [...(outBy.get(o.productionId) ?? []), `${o.name ?? "?"} ${formatQty(o.qty)} ${o.unit ?? ""}`]);
  const valBy = new Map(vals.map((v) => [v.id, Number(v.value)]));
  return (
    <>
      <PageHead title="Hasil produksi" sub="Barang jadi masuk gudang; bahan baku yang terpakai keluar.">
        {canEdit && <Link href="/operasional/produksi/baru" className="btn btn-primary btn-sm">+ Hasil produksi</Link>}
      </PageHead>
      <Ok ok={ok} />
      <div className="admin-table">
        <table>
          <thead><tr><th>Nomor</th><th>Tanggal</th><th>Hasil</th><th>Catatan</th>{canFinance && <th className="num">Nilai</th>}</tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td><Link href={`/operasional/produksi/${p.id}`}><b>{p.number}</b></Link></td>
                <td>{tgl(p.date)}</td>
                <td className="small">{(outBy.get(p.id) ?? []).join(" · ")}</td>
                <td className="small muted">{p.note}</td>
                {canFinance && <td className="num"><Rp n={valBy.get(p.id) ?? 0} /></td>}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="muted" style={{ padding: 24 }}>Belum ada catatan produksi.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
