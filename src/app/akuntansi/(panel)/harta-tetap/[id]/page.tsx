// Detail harta tetap: ubah data, riwayat penyusutan, tandai dijual/dihapus, hapus (bila belum disusutkan).
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/erp/ActionButton";
import { AssetForm } from "@/components/erp/AssetForm";
import { BackLink, Kpis, PageHead } from "@/components/erp/ui";
import { deleteAsset, disposeAsset } from "@/app/akuntansi/actions/assets";
import { getDb } from "@/db";
import { requireModule } from "@/lib/auth";
import { assetFormOptions } from "@/lib/erp/assetForm";
import { assetHistory, listAssets } from "@/lib/erp/assets";
import { loadAccounts } from "@/lib/erp/server";
import { formatAmount, tgl, today } from "@/lib/erp/util";

export const metadata = { title: "Harta tetap" };
export const dynamic = "force-dynamic";

export default async function AsetDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireModule("keuangan");
  const { id } = await params;
  const db = await getDb();
  const a = (await listAssets(db)).find((x) => x.id === id);
  if (!a) notFound();
  const [hist, acc] = await Promise.all([assetHistory(db, id), loadAccounts(db)]);
  const o = assetFormOptions(acc);
  return (
    <>
      <BackLink href="/akuntansi/harta-tetap">Harta Tetap</BackLink>
      <PageHead title={`${a.code} · ${a.name}`} sub={a.disposedDate ? `Dijual/dihapus ${tgl(a.disposedDate)}${a.disposalNote ? ` — ${a.disposalNote}` : ""}` : undefined}>
        {a.disposedDate ? (
          <ActionButton action={disposeAsset.bind(null, a.id, "", "")} label="Aktifkan lagi" className="btn btn-ghost btn-sm" />
        ) : (
          <ActionButton action={disposeAsset.bind(null, a.id, today(), "Dijual/dihapus")} label="Tandai dijual/dihapus hari ini" confirmText={`Tandai ${a.name} sudah dijual/dihapus per hari ini? Penyusutan berhenti setelah bulan ini. Catat penjualannya lewat Jurnal Umum.`} className="btn btn-ghost btn-sm" />
        )}
        {!hist.length && <ActionButton action={deleteAsset.bind(null, a.id)} label="Hapus" confirmText={`Hapus ${a.name}?`} className="btn btn-ghost btn-sm" />}
      </PageHead>
      <Kpis
        items={[
          { label: "Harga perolehan", value: formatAmount(a.cost) },
          { label: "Akumulasi", value: formatAmount(a.accum), sub: a.openingAccum ? `termasuk awal ${formatAmount(a.openingAccum)}` : undefined },
          { label: "Nilai buku", value: formatAmount(a.book) },
          { label: "Penyusutan berikutnya", value: formatAmount(a.monthly), sub: "per bulan" },
        ]}
      />
      <AssetForm a={{ ...a }} {...o} locked={hist.length > 0} />
      <section className="zd-card" style={{ marginTop: 16 }}>
        <h2>Riwayat penyusutan</h2>
        {hist.length ? (
          <div className="admin-table"><table className="compact">
            <thead><tr><th>Bulan</th><th>Jurnal</th><th className="num">Penyusutan</th></tr></thead>
            <tbody>{hist.map((h) => <tr key={h.period}><td>{h.period}</td><td><Link href={`/akuntansi/jurnal/${h.journalId}`}>{h.number}</Link></td><td className="num">{formatAmount(h.amount)}</td></tr>)}</tbody>
          </table></div>
        ) : <p className="zd-empty">Belum ada penyusutan yang dibukukan di web.</p>}
      </section>
    </>
  );
}
