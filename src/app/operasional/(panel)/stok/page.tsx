import Link from "next/link";
import { asc, sql } from "drizzle-orm";
import { PageHead, Rp } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { ITEM_KIND_LABEL } from "@/lib/erp/accounting";
import { opsAccess } from "@/lib/erp/ops";
import { stockLevels, unitCost } from "@/lib/erp/server";
import { formatQty } from "@/lib/erp/util";

export const metadata = { title: "Stok barang" };

export default async function Stok({ searchParams }: { searchParams: Promise<{ jenis?: string }> }) {
  const { canEdit, canFinance } = await opsAccess();
  const { jenis } = await searchParams;
  const db = await getDb();
  const [items, levels, pending] = await Promise.all([
    db.select().from(schema.items).where(sql`${schema.items.trackStock} = 1 and (${schema.items.active} = 1 or exists (select 1 from inv_stock_moves m where m.item_id = ${schema.items.id}))`).orderBy(asc(schema.items.kind), asc(schema.items.code)),
    stockLevels(db),
    db.all<{ itemId: string; qty: number }>(sql`
      select dl.item_id itemId, sum(dl.qty) qty from ops_delivery_lines dl join ops_deliveries d on d.id = dl.delivery_id
      where d.status = 'dijadwalkan' group by dl.item_id`),
  ]);
  const pend = new Map(pending.map((p) => [p.itemId, Number(p.qty)]));
  const rows = items.filter((i) => !jenis || i.kind === jenis);
  const total = rows.reduce((a, i) => a + (levels.get(i.id)?.value ?? 0), 0);
  return (
    <>
      <PageHead title="Stok barang" sub="Stok bertambah dari hasil produksi, pembelian, dan penyesuaian; berkurang saat surat jalan berangkat.">
        {canEdit && <Link href="/operasional/produksi/baru" className="btn btn-primary btn-sm">+ Hasil produksi</Link>}
        {canEdit && <Link href="/operasional/stok/penyesuaian/baru" className="btn btn-ghost btn-sm">+ Penyesuaian / saldo awal</Link>}
      </PageHead>
      <form className="filter-bar" method="get">
        <nav className="seg" aria-label="Jenis barang">
          <Link href="/operasional/stok" aria-current={!jenis ? "page" : undefined}>Semua</Link>
          <Link href="/operasional/stok?jenis=barang_jadi" aria-current={jenis === "barang_jadi" ? "page" : undefined}>Barang jadi</Link>
          <Link href="/operasional/stok?jenis=bahan_baku" aria-current={jenis === "bahan_baku" ? "page" : undefined}>Bahan baku</Link>
        </nav>
      </form>
      <div className="admin-table">
        <table>
          <thead><tr><th>Barang</th><th>Jenis</th><th className="num">Stok</th><th className="num">Dijadwalkan kirim</th><th className="num">Bebas</th>{canFinance && <th className="num">Harga pokok</th>}{canFinance && <th className="num">Nilai</th>}</tr></thead>
          <tbody>
            {rows.map((i) => {
              const lv = levels.get(i.id);
              const qty = lv?.qty ?? 0;
              const p = pend.get(i.id) ?? 0;
              const free = qty - p;
              const low = i.minStock > 0 && qty < i.minStock;
              return (
                <tr key={i.id} className={i.active ? undefined : "row-muted"}>
                  <td><Link href={`/operasional/stok/${i.id}`}><b>{i.name}</b></Link><div className="small muted">{i.code}{!i.active && " · nonaktif"}</div></td>
                  <td className="small">{ITEM_KIND_LABEL[i.kind]}</td>
                  <td className={`num${low || qty < 0 ? " text-bahaya" : ""}`}><b>{formatQty(qty)}</b> {i.unit}{low && <div className="small">min. {formatQty(i.minStock)}</div>}</td>
                  <td className="num">{p ? `${formatQty(p)} ${i.unit}` : "—"}</td>
                  <td className={`num${free < 0 ? " text-bahaya" : ""}`}>{formatQty(free)} {i.unit}</td>
                  {canFinance && <td className="num"><Rp n={Math.round(unitCost(lv, i))} /></td>}
                  {canFinance && <td className="num"><Rp n={lv?.value ?? 0} /></td>}
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={7} className="muted" style={{ padding: 24 }}>Belum ada barang yang dilacak stoknya. Atur di Keuangan → Barang &amp; jasa (centang “lacak stok”).</td></tr>}
          </tbody>
          {canFinance && rows.length > 0 && <tfoot><tr><th colSpan={6}>Total nilai persediaan</th><th className="num"><Rp n={total} /></th></tr></tfoot>}
        </table>
      </div>
      <p className="small muted" style={{ marginTop: 12 }}>Stok minus berarti barang dikirim sebelum hasil produksinya dicatat. Catat hasil produksi atau saldo awal agar angkanya benar.</p>
    </>
  );
}
