import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { deleteItem } from "@/app/keuangan/actions/master";
import { ConfirmAction } from "@/components/erp/ConfirmAction";
import { ItemForm } from "@/components/erp/ItemForm";
import { BackLink, PageHead, Rp } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { stockLevels, unitCost } from "@/lib/erp/server";
import { formatQty, tgl } from "@/lib/erp/util";

export const metadata = { title: "Barang" };

export default async function BarangDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireModule("keuangan");
  const { id } = await params;
  const db = await getDb();
  const item = await db.query.items.findFirst({ where: eq(schema.items.id, id) });
  if (!item) notFound();
  const [products, revenue, moves, levels] = await Promise.all([
    db.select({ id: schema.products.id, name: schema.products.name }).from(schema.products).orderBy(asc(schema.products.sortOrder)),
    db.select({ id: schema.accounts.id, code: schema.accounts.code, name: schema.accounts.name }).from(schema.accounts).where(eq(schema.accounts.group, "pendapatan")).orderBy(asc(schema.accounts.code)),
    db.select().from(schema.stockMoves).where(eq(schema.stockMoves.itemId, id)).orderBy(desc(schema.stockMoves.date), desc(schema.stockMoves.createdAt)).limit(20),
    stockLevels(db),
  ]);
  const lv = levels.get(id);
  async function remove() {
    "use server";
    await deleteItem(id);
    redirect("/keuangan/barang?ok=dihapus");
  }
  return (
    <>
      <BackLink href="/keuangan/barang">Barang &amp; jasa</BackLink>
      <PageHead title={item.name} sub={`${item.code}${item.trackStock ? ` · stok ${formatQty(lv?.qty ?? 0)} ${item.unit} · harga pokok rata-rata Rp${Math.round(unitCost(lv, item)).toLocaleString("id-ID")}` : ""}`} />
      <div className="stack" style={{ gap: 20 }}>
        <ItemForm item={item} products={products} revenueAccounts={revenue} />
        {item.trackStock && (
          <section className="admin-table">
            <table>
              <caption>Kartu stok (20 terakhir) · <Link href={`/operasional/stok/${item.id}`}>lengkap</Link></caption>
              <thead><tr><th>Tanggal</th><th>Sumber</th><th>Keterangan</th><th className="num">Qty</th><th className="num">Nilai</th></tr></thead>
              <tbody>
                {moves.map((m) => (
                  <tr key={m.id}><td>{tgl(m.date)}</td><td>{m.source}</td><td className="small">{m.note}</td><td className="num">{formatQty(m.qty)}</td><td className="num"><Rp n={m.value} /></td></tr>
                ))}
                {moves.length === 0 && <tr><td colSpan={5} className="muted">Belum ada pergerakan stok.</td></tr>}
              </tbody>
            </table>
          </section>
        )}
        <div><ConfirmAction action={remove} label="Hapus / nonaktifkan barang" confirmText={`Hapus ${item.name}? Bila sudah dipakai transaksi, barang hanya dinonaktifkan.`} /></div>
      </div>
    </>
  );
}
