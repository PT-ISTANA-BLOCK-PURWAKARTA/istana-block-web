import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { deleteAdjustment } from "@/app/operasional/actions/stock";
import { ConfirmAction } from "@/components/erp/ConfirmAction";
import { JournalView } from "@/components/erp/JournalView";
import { BackLink, Ok, PageHead } from "@/components/erp/ui";
import { AdjustmentForm } from "@/components/ops/AdjustmentForm";
import { getDb, schema } from "@/db";
import { opsAccess } from "@/lib/erp/ops";
import { journalFor, stockLevels, unitCost } from "@/lib/erp/server";
import { formatQty, tgl } from "@/lib/erp/util";

export const metadata = { title: "Penyesuaian stok" };

export default async function PenyesuaianDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const { canStock: canEdit, canFinance } = await opsAccess();
  const { id } = await params;
  const { ok } = await searchParams;
  const db = await getDb();
  const a = await db.query.adjustments.findFirst({ where: eq(schema.adjustments.id, id) });
  if (!a) notFound();
  const [item, move, journal] = await Promise.all([
    db.query.items.findFirst({ where: eq(schema.items.id, a.itemId) }),
    db.query.stockMoves.findFirst({ where: and(eq(schema.stockMoves.sourceId, id), eq(schema.stockMoves.itemId, a.itemId)) }),
    canFinance ? journalFor(db, "penyesuaian", id) : [],
  ]);
  const opening = move?.source === "saldo_awal";
  // Selisih sebuah stok opname: dikelola dari dokumen opname, bukan dari halaman ini.
  const count = a.countId ? await db.query.stockCounts.findFirst({ where: eq(schema.stockCounts.id, a.countId) }) : undefined;
  const canEditHere = canEdit && !a.countId;
  let opts: { id: string; code: string; name: string; unit: string; onHand: number; avgCost: number }[] = [];
  if (canEditHere) {
    const [items, levels] = await Promise.all([db.select().from(schema.items).where(eq(schema.items.trackStock, true)).orderBy(asc(schema.items.code)), stockLevels(db)]);
    opts = items
      .filter((i) => (i.active || i.id === a.itemId) && (i.kind === "barang_jadi" || i.kind === "bahan_baku"))
      .map((i) => ({ id: i.id, code: i.code, name: i.name, unit: i.unit, onHand: levels.get(i.id)?.qty ?? 0, avgCost: canFinance ? unitCost(levels.get(i.id), i) : 0 }));
  }
  return (
    <>
      <BackLink href="/operasional/stok/penyesuaian">Penyesuaian stok</BackLink>
      <PageHead title={a.number} sub={`${tgl(a.date)} · ${item?.name ?? ""} ${a.qty > 0 ? "+" : ""}${formatQty(a.qty)} ${item?.unit ?? ""}${opening ? " · saldo awal" : ""}`} />
      <Ok ok={ok} />
      <div className="stack" style={{ gap: 20 }}>
        {a.countId && (
          <section className="admin-card">
            <p>Selisih stok opname{count ? <> <Link href={`/operasional/stok/opname/${count.id}`}><b>{count.number}</b></Link></> : ""}. Ubah atau hapus lewat dokumen stok opname-nya.</p>
          </section>
        )}
        {canEditHere ? (
          <AdjustmentForm id={a.id} date={a.date} itemId={a.itemId} qty={a.qty} unitCost={canFinance && a.qty > 0 ? a.unitCost : undefined} reason={a.reason} opening={opening} items={opts} showCost={canFinance} />
        ) : (
          !a.countId && <section className="admin-card"><p>{a.reason}</p></section>
        )}
        {canFinance && <JournalView lines={journal} />}
        {canEditHere && <div><ConfirmAction action={deleteAdjustment.bind(null, a.id)} label="Hapus penyesuaian" confirmText={`Hapus ${a.number}? Stok dan jurnalnya ikut dihapus.`} /></div>}
      </div>
    </>
  );
}
