import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Ok, PageHead, Rp } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { opsAccess } from "@/lib/erp/ops";
import { formatQty, tgl } from "@/lib/erp/util";

export const metadata = { title: "Penyesuaian stok" };

export default async function Penyesuaian({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { canEdit, canFinance } = await opsAccess();
  const { ok } = await searchParams;
  const db = await getDb();
  const rows = await db
    .select({ a: schema.adjustments, name: schema.items.name, unit: schema.items.unit })
    .from(schema.adjustments)
    .leftJoin(schema.items, eq(schema.items.id, schema.adjustments.itemId))
    .orderBy(desc(schema.adjustments.date), desc(schema.adjustments.number))
    .limit(300);
  return (
    <>
      <PageHead title="Penyesuaian stok" sub="Saldo awal, hasil stok opname, barang rusak atau hilang.">
        {canEdit && <Link href="/operasional/stok/penyesuaian/baru" className="btn btn-primary btn-sm">+ Penyesuaian</Link>}
      </PageHead>
      <Ok ok={ok} />
      <div className="admin-table">
        <table>
          <thead><tr><th>Nomor</th><th>Tanggal</th><th>Barang</th><th>Alasan</th><th className="num">Qty</th>{canFinance && <th className="num">Nilai</th>}</tr></thead>
          <tbody>
            {rows.map(({ a, name, unit }) => (
              <tr key={a.id}>
                <td><Link href={`/operasional/stok/penyesuaian/${a.id}`}><b>{a.number}</b></Link></td>
                <td>{tgl(a.date)}</td>
                <td>{name}</td>
                <td className="small">{a.reason}</td>
                <td className={`num${a.qty < 0 ? " text-bahaya" : ""}`}>{a.qty > 0 ? "+" : ""}{formatQty(a.qty)} {unit}</td>
                {canFinance && <td className="num"><Rp n={Math.round(a.qty * a.unitCost)} /></td>}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="muted" style={{ padding: 24 }}>Belum ada penyesuaian. Mulai dengan mencatat saldo awal stok tiap barang.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
