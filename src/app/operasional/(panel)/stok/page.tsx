import Link from "next/link";
import { asc, desc, sql } from "drizzle-orm";
import { PageHead, Rp } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { productLines } from "@/db/erp";
import { ITEM_KIND_LABEL } from "@/lib/erp/accounting";
import { opsAccess, SQL_AT_YARD } from "@/lib/erp/ops";
import { stockLevels, unitCost } from "@/lib/erp/server";
import { conversionNet, lastCountPerItem } from "@/lib/erp/stock-ops";
import { formatQty, tgl } from "@/lib/erp/util";
import { LINE_LABEL, lineOfItem } from "@/lib/ops/production-lines";

export const metadata = { title: "Stok barang" };

export default async function Stok({ searchParams }: { searchParams: Promise<{ jenis?: string; kelompok?: string }> }) {
  const { canStock: canEdit, canFinance, perms } = await opsAccess();
  const { jenis, kelompok } = await searchParams;
  const db = await getDb();
  const [items, levels, pending, painted, counts] = await Promise.all([
    db.select().from(schema.items).where(sql`${schema.items.trackStock} = 1 and (${schema.items.active} = 1 or exists (select 1 from inv_stock_moves m where m.item_id = ${schema.items.id}))`).orderBy(desc(schema.items.kind), asc(schema.items.code)),
    stockLevels(db),
    db.all<{ itemId: string; qty: number }>(sql`
      select dl.item_id itemId, sum(dl.qty) qty from ops_delivery_lines dl join ops_deliveries d on d.id = dl.delivery_id
      where ${sql.raw(SQL_AT_YARD)} group by dl.item_id`),
    conversionNet(db),
    lastCountPerItem(db),
  ]);
  const pend = new Map(pending.map((p) => [p.itemId, Number(p.qty)]));
  const lineOf = (i: (typeof items)[number]) => (i.kind === "barang_jadi" ? lineOfItem(i) : null);
  // Kelompok barang jadi yang ada (untuk saringan), sesuai urutan baku.
  const presentLines = productLines.filter((l) => items.some((i) => lineOf(i) === l));
  const rows = items.filter((i) => (!jenis || i.kind === jenis) && (!kelompok || lineOf(i) === kelompok));
  const total = rows.reduce((a, i) => a + (levels.get(i.id)?.value ?? 0), 0);
  const q = (j?: string, k?: string) => {
    const p = new URLSearchParams();
    if (j) p.set("jenis", j);
    if (k) p.set("kelompok", k);
    const s = p.toString();
    return `/operasional/stok${s ? `?${s}` : ""}`;
  };
  return (
    <>
      <PageHead title="Stok barang" sub="Stok bertambah dari hasil produksi (Grade A), pembelian, dan penyesuaian; berkurang saat surat jalan berangkat. Cat genteng memindahkan stok natural ke warna.">
        {canEdit && <Link href="/operasional/produksi/baru" className="btn btn-primary btn-sm">+ Hasil produksi</Link>}
        {perms.has("opname") && <Link href="/operasional/stok/opname/baru" className="btn btn-ghost btn-sm">Stok opname</Link>}
        {perms.has("cat_genteng") && <Link href="/operasional/stok/cat-genteng" className="btn btn-ghost btn-sm">Cat genteng</Link>}
        {canEdit && <Link href="/operasional/stok/penyesuaian/baru" className="btn btn-ghost btn-sm">+ Penyesuaian / saldo awal</Link>}
      </PageHead>
      <form className="filter-bar" method="get">
        <nav className="seg" aria-label="Jenis barang">
          <Link href={q(undefined, kelompok)} aria-current={!jenis ? "page" : undefined}>Semua</Link>
          <Link href={q("barang_jadi", kelompok)} aria-current={jenis === "barang_jadi" ? "page" : undefined}>Barang jadi</Link>
          <Link href={q("bahan_baku", kelompok)} aria-current={jenis === "bahan_baku" ? "page" : undefined}>Bahan baku</Link>
        </nav>
      </form>
      {presentLines.length > 0 && (
        <nav className="seg" aria-label="Kelompok barang jadi" style={{ marginBottom: 12 }}>
          <Link href={q(jenis)} aria-current={!kelompok ? "page" : undefined}>Semua kelompok</Link>
          {presentLines.map((l) => (
            <Link key={l} href={q("barang_jadi", l)} aria-current={kelompok === l ? "page" : undefined}>{LINE_LABEL[l]}</Link>
          ))}
        </nav>
      )}
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
              const dicat = painted.get(i.id) ?? 0;
              const op = counts.get(i.id);
              const line = lineOf(i);
              return (
                <tr key={i.id} className={i.active ? undefined : "row-muted"}>
                  <td>
                    <Link href={`/operasional/stok/${i.id}`}><b>{i.name}</b></Link>
                    <div className="small muted">{i.code}{line && line !== "lainnya" ? ` · ${LINE_LABEL[line]}` : ""}{!i.active && " · nonaktif"}</div>
                    {i.kind === "barang_jadi" && <div className="small muted">{op ? `Opname ${formatQty(op.counted)} (${tgl(op.date)})` : "Belum opname"}{dicat !== 0 && <> · {dicat > 0 ? "+" : "−"} dicat {formatQty(Math.abs(dicat))}</>}</div>}
                  </td>
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
      <p className="small muted" style={{ marginTop: 12 }}>Stok minus berarti barang dikirim sebelum hasil produksinya dicatat. Catat hasil produksi, stok opname, atau saldo awal agar angkanya benar. Kelompok barang jadi diambil dari data barang (atau dari namanya bila belum diisi).</p>
    </>
  );
}
