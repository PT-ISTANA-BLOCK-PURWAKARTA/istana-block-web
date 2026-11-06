import { PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { opsAccess } from "@/lib/erp/ops";
const rupiah = (n: number | null | undefined) => (n == null ? "-" : "Rp " + Math.round(n).toLocaleString("id-ID"));
const tanggal = (d: Date | null) => (d ? d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }) : "-");

import { desc } from "drizzle-orm";
export const metadata = { title: "Transfer stok" };
export default async function TransferStok() {
  await opsAccess();
  const db = await getDb();
  const rows = await db.select().from(schema.transfers).orderBy(desc(schema.transfers.movedAt));
  return (<>
    <PageHead title="Transfer stok" />
    <p className="muted" style={{ marginTop: -8 }}>{rows.length} perpindahan stok hasil impor app lama.</p>
    <div className="admin-table"><table>
      <thead><tr><th>Tanggal</th><th>Jenis</th><th>Dari</th><th>Ke</th><th style={{ textAlign: "right" }}>Jumlah</th><th>Catatan</th><th>Oleh</th></tr></thead>
      <tbody>{rows.map((r) => (
        <tr key={r.id}><td>{tanggal(r.movedAt)}</td><td>{r.kind}</td><td>{r.fromKey}</td><td>{r.toKey}</td>
        <td style={{ textAlign: "right" }}>{r.qty}</td><td>{r.note || "-"}</td><td>{r.movedByName || "-"}</td></tr>))}
        {!rows.length && <tr><td colSpan={7} className="muted">Belum ada transfer.</td></tr>}</tbody>
    </table></div></>);
}
