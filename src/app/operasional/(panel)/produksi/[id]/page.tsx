import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { deleteProduction } from "@/app/operasional/actions/stock";
import { ConfirmAction } from "@/components/erp/ConfirmAction";
import { JournalView } from "@/components/erp/JournalView";
import { BackLink, Ok, PageHead, Rp } from "@/components/erp/ui";
import { categoryLabel } from "@/components/ops/production/summary";
import { getDb, schema } from "@/db";
import { isArchive } from "@/lib/erp/archive";
import { journalFor } from "@/lib/erp/server";
import { formatQty, tgl } from "@/lib/erp/util";
import { canChangeProduction, productionAccess } from "@/lib/ops/production";
import { METHOD_LABEL } from "@/lib/ops/production-lines";
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
  const signerIds = [p.rejectManagerBy, p.rejectLeaderBy].filter((x): x is number => x != null);
  const [signerRows, batch] = await Promise.all([
    signerIds.length ? db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(inArray(schema.users.id, signerIds)) : Promise.resolve([]),
    p.batchId ? db.query.productionBatches.findFirst({ where: eq(schema.productionBatches.id, p.batchId) }) : Promise.resolve(undefined),
  ]);
  const signer = new Map(signerRows.map((s) => [s.id, s.name]));
  // Tanggal WIB (UTC+7) dari waktu kejadian, untuk label TTD.
  const wib = (d: Date) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
  // Data arsip dari aplikasi lama: baca-saja.
  const archived = isArchive(p.id);
  const canEdit = canChangeProduction(acc, p) && !archived;
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
    ["Metode Buis", p.method ? METHOD_LABEL[p.method] : null],
    ["Semen curah", p.cementKg != null ? `${formatQty(p.cementKg)} kg` : null],
    ["Papan", p.boards != null ? formatQty(p.boards) : null],
    ["Grade B (masih dijual)", p.gradeB != null ? formatQty(p.gradeB) : null],
    ["Reject (tidak dijual)", p.rejects != null ? formatQty(p.rejects) : null],
    ["Dicatat oleh", creator[0]?.name ?? null],
  ];
  return (
    <>
      <BackLink href="/operasional/produksi">Hasil produksi</BackLink>
      <PageHead title={p.number} sub={tgl(p.date)}>
        {canEdit && <Link href={`/operasional/produksi/${p.id}/ubah`} className="btn btn-ghost btn-sm">Ubah</Link>}
      </PageHead>
      <Ok ok={ok} />
      {p.mixLogId && <p className="flag flag-info">Baris ini otomatis dari catatan Mix Desain harian (QC). Ubah lewat menu QC → Mix desain harian.</p>}
      {p.batchId && <p className="flag flag-info">Bagian dari adukan cor bersama{batch ? ` (${formatQty(batch.cementBags)} sak semen untuk beberapa produk)` : ""}. <Link href={`/operasional/produksi/adukan/${p.batchId}`}>Lihat / ubah adukan</Link></p>}
      {archived && <p className="flag flag-info">Arsip aplikasi lama. Catatan produksi ini hanya bisa dilihat, tidak bisa diubah atau dihapus.</p>}
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
        {((p.gradeB ?? 0) > 0 || (p.rejects ?? 0) > 0) && (
          <section className="admin-card">
            <span className="muted small">Ketidaksesuaian produksi</span>
            <p style={{ marginTop: 4 }}>
              <b>Manager in charge:</b> {p.rejectManagerAt ? `${signer.get(p.rejectManagerBy ?? -1) ?? "-"} · ${tgl(wib(p.rejectManagerAt))}` : "belum"}<br />
              <b>Pimpinan:</b> {p.rejectLeaderAt ? `${signer.get(p.rejectLeaderBy ?? -1) ?? "-"} · ${tgl(wib(p.rejectLeaderAt))}` : "belum"}
            </p>
            <p className="small muted">TTD ditandatangani dari daftar hasil produksi (Manager in charge dulu, lalu Pimpinan); mengubah jumlah / Grade B / reject mengulang TTD.</p>
            <Link href={`/operasional/cetak/ketidaksesuaian-produksi?from=${p.date}&to=${p.date}`} className="btn btn-ghost btn-sm">Dokumen ketidaksesuaian</Link>
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
