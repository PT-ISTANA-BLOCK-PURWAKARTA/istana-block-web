import { PageHead } from "@/components/erp/ui";
import { desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { opsAccess } from "@/lib/erp/ops";
const tanggal = (d: Date | null) => (d ? d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }) : "-");
export const metadata = { title: "Rencana pesanan" };
export default async function RencanaPesanan() {
  await opsAccess();
  const db = await getDb();
  const rows = await db.select().from(schema.plannedOrders).orderBy(desc(schema.plannedOrders.expectedDate));
  return (<>
    <PageHead title="Rencana pesanan" />
    <p className="muted" style={{ marginTop: -8 }}>{rows.length} rencana. Belum menjadi PO.</p>
    <div className="admin-table"><table>
      <thead><tr><th>Perkiraan</th><th>Pelanggan</th><th>Proyek</th><th>Baris barang</th><th>Status</th><th>Dicatat</th></tr></thead>
      <tbody>{rows.map((r) => (<tr key={r.id}><td>{tanggal(r.expectedDate)}</td><td>{r.customerName}</td>
        <td>{r.project || "-"}</td><td>{r.items.length}</td><td>{r.status}</td><td>{r.createdByName || "-"}</td></tr>))}
        {!rows.length && <tr><td colSpan={6} className="muted">Belum ada rencana pesanan.</td></tr>}</tbody>
    </table></div></>);
}
