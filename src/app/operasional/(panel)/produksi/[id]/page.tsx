import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { deleteProduction } from "@/app/operasional/actions/stock";
import { ConfirmAction } from "@/components/erp/ConfirmAction";
import { JournalView } from "@/components/erp/JournalView";
import { BackLink, Ok, PageHead, Rp } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { opsAccess } from "@/lib/erp/ops";
import { journalFor } from "@/lib/erp/server";
import { formatQty, tgl } from "@/lib/erp/util";

export const metadata = { title: "Hasil produksi" };

export default async function ProduksiDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const { canEdit, canFinance } = await opsAccess();
  const { id } = await params;
  const { ok } = await searchParams;
  const db = await getDb();
  const p = await db.query.productions.findFirst({ where: eq(schema.productions.id, id) });
  if (!p) notFound();
  const [lines, moves, journal] = await Promise.all([
    db.select({ l: schema.productionLines, name: schema.items.name, unit: schema.items.unit }).from(schema.productionLines).leftJoin(schema.items, eq(schema.items.id, schema.productionLines.itemId)).where(eq(schema.productionLines.productionId, id)),
    db.select().from(schema.stockMoves).where(and(eq(schema.stockMoves.source, "produksi"), eq(schema.stockMoves.sourceId, id))),
    canFinance ? journalFor(db, "produksi", id) : [],
  ]);
  const valueOf = (itemId: string, sign: number) => moves.filter((m) => m.itemId === itemId && Math.sign(m.qty) === sign).reduce((a, m) => a + Math.abs(m.value), 0);
  const table = (role: "hasil" | "bahan", title: string) => {
    const rows = lines.filter((x) => x.l.role === role);
    if (!rows.length) return null;
    return (
      <section className="admin-table">
        <table>
          <caption>{title}</caption>
          <thead><tr><th>Barang</th><th className="num">Qty</th>{canFinance && <th className="num">Nilai</th>}</tr></thead>
          <tbody>
            {rows.map(({ l, name, unit }) => (
              <tr key={l.id}>
                <td><Link href={`/operasional/stok/${l.itemId}`}><b>{name}</b></Link></td>
                <td className="num">{formatQty(l.qty)} {unit}</td>
                {canFinance && <td className="num"><Rp n={valueOf(l.itemId, role === "hasil" ? 1 : -1)} /></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    );
  };
  return (
    <>
      <BackLink href="/operasional/produksi">Hasil produksi</BackLink>
      <PageHead title={p.number} sub={tgl(p.date)}>
        {canEdit && <Link href={`/operasional/produksi/${p.id}/ubah`} className="btn btn-ghost btn-sm">Ubah</Link>}
      </PageHead>
      <Ok ok={ok} />
      <div className="stack" style={{ gap: 20 }}>
        {p.note && <section className="admin-card"><span className="muted small">Catatan</span><p className="pre" style={{ marginTop: 4 }}>{p.note}</p></section>}
        {table("hasil", "Hasil produksi")}
        {table("bahan", "Bahan terpakai")}
        {canFinance && <section className="admin-card"><span className="muted small">Biaya produksi diserap</span><p><b><Rp n={p.laborCost} /></b></p></section>}
        {canFinance && <JournalView lines={journal} />}
        {canEdit && <div><ConfirmAction action={deleteProduction.bind(null, p.id)} label="Hapus catatan produksi" confirmText={`Hapus ${p.number}? Stok dan jurnalnya ikut dihapus.`} /></div>}
      </div>
    </>
  );
}
