import { deleteConversion } from "@/app/operasional/actions/conversions";
import { ConfirmAction } from "@/components/erp/ConfirmAction";
import { Ok, PageHead } from "@/components/erp/ui";
import { PaintForm, type PaintItem } from "@/components/ops/stock/PaintForm";
import { getDb } from "@/db";
import { requirePerm } from "@/lib/auth";
import { stockLevels } from "@/lib/erp/server";
import { listConversions, trackedFinishedItems } from "@/lib/erp/stock-ops";
import { formatQty, tgl } from "@/lib/erp/util";
import { gentengColor, gentengType } from "@/lib/ops/production-lines";
import "../../produksi/produksi.css";

export const metadata = { title: "Cat genteng" };

export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await requirePerm("cat_genteng");
  const { ok } = await searchParams;
  const db = await getDb();
  const [tracked, levels, history] = await Promise.all([trackedFinishedItems(db), stockLevels(db), listConversions(db)]);
  const items: PaintItem[] = tracked
    .filter((i) => i.line === "genteng" && i.active)
    .map((i) => ({ id: i.id, name: i.name, unit: i.unit, color: gentengColor(i.name), type: gentengType(i.name), stock: levels.get(i.id)?.qty ?? 0 }));
  const nowLocal = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 16);
  return (
    <>
      <PageHead title="Cat genteng" sub="Genteng natural yang dicat mengurangi stok natural dan menambah stok warna (hitam / merah) untuk tipe yang sama." />
      <Ok ok={ok} />
      <PaintForm items={items} nowLocal={nowLocal} />
      <div className="admin-table" style={{ marginTop: 24 }}>
        <table>
          <caption>Riwayat cat genteng</caption>
          <thead><tr><th>Nomor</th><th>Tanggal</th><th>Dari</th><th>Menjadi</th><th className="num">Jumlah</th><th>Petugas</th><th>Catatan</th><th /></tr></thead>
          <tbody>
            {history.map(({ c, fromName, toName, unit, by }) => (
              <tr key={c.id}>
                <td><b>{c.number}</b></td>
                <td>{tgl(c.date)}</td>
                <td>{fromName ?? "-"}</td>
                <td>{toName ?? "-"}</td>
                <td className="num">{formatQty(c.qty)} {unit}</td>
                <td className="small muted">{by ?? "-"}</td>
                <td className="small">{c.note || "-"}</td>
                <td><ConfirmAction action={deleteConversion.bind(null, c.id)} label="Hapus" confirmText="Hapus catatan cat ini? Stok natural dan warna dikembalikan." /></td>
              </tr>
            ))}
            {history.length === 0 && <tr><td colSpan={8} className="muted" style={{ padding: 24 }}>Belum ada catatan cat genteng.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
