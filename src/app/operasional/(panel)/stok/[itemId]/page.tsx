import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { BackLink, PageHead, RangeForm, Rp } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { opsAccess } from "@/lib/erp/ops";
import { unitCost } from "@/lib/erp/server";
import { formatQty, isDate, monthStart, tgl, tglPanjang, today } from "@/lib/erp/util";

export const metadata = { title: "Kartu stok" };

const SRC: Record<string, string> = { pengiriman: "Surat jalan", produksi: "Hasil produksi", pembelian: "Pembelian", penyesuaian: "Penyesuaian", saldo_awal: "Saldo awal" };

function href(source: string, id: string | null) {
  if (!id) return null;
  if (source === "pengiriman") return `/operasional/pengiriman/${id}`;
  if (source === "produksi") return `/operasional/produksi/${id}`;
  if (source === "pembelian") return `/akuntansi/pembelian/${id}`;
  return `/operasional/stok/penyesuaian/${id}`;
}

export default async function KartuStok({ params, searchParams }: { params: Promise<{ itemId: string }>; searchParams: Promise<{ from?: string; to?: string }> }) {
  const { canFinance } = await opsAccess();
  const { itemId } = await params;
  const sp = await searchParams;
  const to = isDate(sp.to) ? sp.to : today();
  const from = isDate(sp.from) ? sp.from : monthStart(to);
  const db = await getDb();
  const item = await db.query.items.findFirst({ where: eq(schema.items.id, itemId) });
  if (!item) notFound();
  const [open, moves, now] = await Promise.all([
    db.get<{ q: number; v: number }>(sql`select coalesce(sum(qty),0) q, coalesce(sum(value),0) v from inv_stock_moves where item_id = ${itemId} and date < ${from}`),
    db.select().from(schema.stockMoves).where(and(eq(schema.stockMoves.itemId, itemId), gte(schema.stockMoves.date, from), lte(schema.stockMoves.date, to))).orderBy(asc(schema.stockMoves.date), asc(schema.stockMoves.createdAt)),
    db.get<{ q: number; v: number }>(sql`select coalesce(sum(qty),0) q, coalesce(sum(value),0) v from inv_stock_moves where item_id = ${itemId}`),
  ]);
  let q = Number(open?.q ?? 0);
  let v = Number(open?.v ?? 0);
  const rows = moves.map((m) => {
    q += m.qty;
    v += m.value;
    return { ...m, balQ: q, balV: v };
  });
  const lv = { qty: Number(now?.q ?? 0), value: Number(now?.v ?? 0) };
  return (
    <>
      <BackLink href="/operasional/stok">Stok barang</BackLink>
      <PageHead title={`Kartu stok · ${item.name}`} sub={`${item.code} · stok sekarang ${formatQty(lv.qty)} ${item.unit}${canFinance ? ` · harga pokok rata-rata Rp${Math.round(unitCost(lv, item)).toLocaleString("id-ID")}` : ""}`} />
      <RangeForm from={from} to={to} />
      <div className="admin-table report">
        <table>
          <thead><tr><th>Tanggal</th><th>Sumber</th><th className="num">Masuk</th><th className="num">Keluar</th><th className="num">Saldo</th>{canFinance && <th className="num">Nilai</th>}{canFinance && <th className="num">Saldo nilai</th>}</tr></thead>
          <tbody>
            <tr className="r-sub"><td colSpan={4}>Saldo per {tglPanjang(from)}</td><td className="num">{formatQty(Number(open?.q ?? 0))}</td>{canFinance && <td />}{canFinance && <td className="num"><Rp n={Number(open?.v ?? 0)} /></td>}</tr>
            {rows.map((m) => {
              const h = href(m.source, m.sourceId);
              return (
                <tr key={m.id}>
                  <td>{tgl(m.date)}</td>
                  <td>{h ? <Link href={h}>{m.note || SRC[m.source]}</Link> : m.note}<div className="small muted">{SRC[m.source] ?? m.source}</div></td>
                  <td className="num">{m.qty > 0 ? formatQty(m.qty) : ""}</td>
                  <td className="num">{m.qty < 0 ? formatQty(-m.qty) : ""}</td>
                  <td className={`num${m.balQ < 0 ? " text-bahaya" : ""}`}>{formatQty(m.balQ)}</td>
                  {canFinance && <td className="num"><Rp n={m.value} /></td>}
                  {canFinance && <td className="num"><Rp n={m.balV} /></td>}
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={7} className="muted">Tidak ada pergerakan pada periode ini.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
