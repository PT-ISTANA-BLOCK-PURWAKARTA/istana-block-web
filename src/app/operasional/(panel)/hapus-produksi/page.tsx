import { PageHead } from "@/components/erp/ui";
import { desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { opsAccess } from "@/lib/erp/ops";
const tanggal = (d: Date | null) => (d ? d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }) : "-");
export const metadata = { title: "Produksi dihapus" };
export default async function HapusProduksi() {
  await opsAccess();
  const db = await getDb();
  const rows = await db.select().from(schema.productionDeletions).orderBy(desc(schema.productionDeletions.deletedAt));
  return (<>
    <PageHead title="Produksi dihapus" />
    <p className="muted" style={{ marginTop: -8 }}>{rows.length} catatan penghapusan produksi (arsip + alasan).</p>
    <div className="admin-table"><table>
      <thead><tr><th>Dihapus</th><th>Tanggal kerja</th><th>Jenis</th><th>Barang</th><th style={{ textAlign: "right" }}>Jumlah</th><th>Alasan</th><th>Oleh</th></tr></thead>
      <tbody>{rows.map((r) => (<tr key={r.id}><td>{tanggal(r.deletedAt)}</td><td>{r.workDate || "-"}</td><td>{r.kind}</td>
        <td>{r.label}</td><td style={{ textAlign: "right" }}>{r.qty ?? "-"} {r.unit || ""}</td><td>{r.reason || "-"}</td><td>{r.deletedByName || "-"}</td></tr>))}
        {!rows.length && <tr><td colSpan={7} className="muted">Tidak ada produksi yang dihapus.</td></tr>}</tbody>
    </table></div></>);
}
