import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { deleteProduction } from "@/app/operasional/actions/stock";
import { ConfirmAction } from "@/components/erp/ConfirmAction";
import { JournalView } from "@/components/erp/JournalView";
import { BackLink, Ok, PageHead, Rp } from "@/components/erp/ui";
import { categoryLabel } from "@/components/ops/production/summary";
import { getDb, schema } from "@/db";
import { journalFor } from "@/lib/erp/server";
import { formatQty, tgl } from "@/lib/erp/util";
import { canChangeProduction, productionAccess } from "@/lib/ops/production";
import "../produksi.css";

export const metadata = { title: "Hasil produksi" };

export default async function ProduksiDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const acc = await productionAccess();
  const { id } = await params;
  const { ok } = await searchParams;
  const db = await getDb();
  const p = await db.query.productions.findFirst({ where: eq(schema.productions.id, id) });
  if (!p) notFound();
  const [lines, moves, journal, creator] = await Promise.all([
    db.select({ l: schema.productionLines, name: schema.items.name, unit: schema.items.unit }).from(schema.productionLines).leftJoin(schema.items, eq(schema.items.id, schema.productionLines.itemId)).where(eq(schema.productionLines.productionId, id)),
    acc.canFinance ? db.select().from(schema.stockMoves).where(and(eq(schema.stockMoves.source, "produksi"), eq(schema.stockMoves.sourceId, id))) : Promise.resolve([]),
    acc.canFinance ? journalFor(db, "produksi", id) : Promise.resolve([]),
    p.createdBy != null ? db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, p.createdBy)).limit(1) : Promise.resolve([]),
  ]);
  const canEdit = canChangeProduction(acc, p);
  const valueOf = (itemId: string, sign: number) => moves.filter((m) => m.itemId === itemId && Math.sign(m.qty) === sign).reduce((a, m) => a + Math.abs(m.value), 0);
  const table = (role: "hasil" | "bahan", title: string) => {
    const rows = lines.filter((x) => x.l.role === role);
    if (!rows.length) return null;
    return (
      <section className="admin-table">
        <table>
          <caption>{title}</caption>
          <thead><tr><th>Barang</th><th className="num">Qty</th>{acc.canFinance && <th className="num">Nilai</th>}</tr></thead>
          <tbody>
            {rows.map(({ l, name, unit }) => (
              <tr key={l.id}>
                <td>{acc.hasStok || acc.canFinance ? <Link href={`/operasional/stok/${l.itemId}`}><b>{name}</b></Link> : <b>{name}</b>}</td>
                <td className="num">{formatQty(l.qty)} {unit}{l.qty === 0 && <span className="small muted"> (tidak memposting stok)</span>}</td>
                {acc.canFinance && <td className="num"><Rp n={valueOf(l.itemId, role === "hasil" ? 1 : -1)} /></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    );
  };
  const issues = Array.isArray(p.issues) ? p.issues : [];
  const meta: [string, string | null][] = [
    ["Kategori", p.category ? categoryLabel(p.category) : null],
    ["Kode batch", p.batchCode],
    ["Ketua regu", p.leader],
    ["Target", p.target != null ? formatQty(p.target) : null],
    ["Semen terpakai", p.cementBags != null ? `${formatQty(p.cementBags)} sak` : null],
    ["Papan", p.boards != null ? formatQty(p.boards) : null],
    ["Reject", p.rejects != null ? formatQty(p.rejects) : null],
    ["Dicatat oleh", creator[0]?.name ?? null],
  ];
  return (
    <>
      <BackLink href="/operasional/produksi">Hasil produksi</BackLink>
      <PageHead title={p.number} sub={tgl(p.date)}>
        {canEdit && <Link href={`/operasional/produksi/${p.id}/ubah`} className="btn btn-ghost btn-sm">Ubah</Link>}
      </PageHead>
      <Ok ok={ok} />
      <div className="stack" style={{ gap: 20 }}>
        <section className="admin-card doc-head">
          {meta.filter(([, v]) => v).map(([k, v]) => (
            <div key={k}><span className="muted small">{k}</span><p><b>{v}</b></p></div>
          ))}
        </section>
        {issues.length > 0 && (
          <section className="admin-card">
            <span className="muted small">Kendala produksi</span>
            <div className="prd-issues">{issues.map((i) => <span key={i} className="prd-issue-chip">{i}</span>)}</div>
          </section>
        )}
        {p.note && <section className="admin-card"><span className="muted small">Catatan</span><p className="pre" style={{ marginTop: 4 }}>{p.note}</p></section>}
        {p.photoKey && (
          <section className="admin-card">
            <span className="muted small">Foto produksi</span>
            <a href={`/operasional/berkas/${p.photoKey}`} target="_blank" rel="noreferrer" className="prd-photo" style={{ marginTop: 6 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/operasional/berkas/${p.photoKey}`} alt="Foto produksi" />
            </a>
          </section>
        )}
        {table("hasil", "Hasil produksi")}
        {table("bahan", "Bahan terpakai")}
        {acc.canFinance && <section className="admin-card"><span className="muted small">Biaya produksi diserap</span><p><b><Rp n={p.laborCost} /></b></p></section>}
        {acc.canFinance && <JournalView lines={journal} />}
        {canEdit && <div><ConfirmAction action={deleteProduction.bind(null, p.id)} label="Hapus catatan produksi" confirmText={`Hapus ${p.number}? Stok dan jurnalnya ikut dihapus.`} /></div>}
      </div>
    </>
  );
}
