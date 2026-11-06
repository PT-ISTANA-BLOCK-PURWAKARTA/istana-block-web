import { PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { opsAccess } from "@/lib/erp/ops";
const rupiah = (n: number | null | undefined) => (n == null ? "-" : "Rp " + Math.round(n).toLocaleString("id-ID"));
const tanggal = (d: Date | null) => (d ? d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }) : "-");

import { desc } from "drizzle-orm";
export const metadata = { title: "Target produksi" };
export default async function TargetProduksi() {
  await opsAccess();
  const db = await getDb();
  const [rows, alasan] = await Promise.all([
    db.select().from(schema.productionTargets).orderBy(desc(schema.productionTargets.setAt)),
    db.select().from(schema.productionTargetReasons).orderBy(desc(schema.productionTargetReasons.workDate)),
  ]);
  return (<>
    <PageHead title="Target produksi" />
    <p className="muted" style={{ marginTop: -8 }}>{rows.length} target · {alasan.length} catatan alasan tidak tercapai.</p>
    <div className="admin-table"><table>
      <thead><tr><th>Target</th><th>Satuan</th><th style={{ textAlign: "right" }}>Angka</th><th>Ditetapkan</th></tr></thead>
      <tbody>{rows.map((r) => (<tr key={r.key}><td>{r.label}</td><td>{r.unit}</td>
        <td style={{ textAlign: "right" }}>{r.target.toLocaleString("id-ID")}</td><td>{r.setByName || "-"} · {tanggal(r.setAt)}</td></tr>))}
        {!rows.length && <tr><td colSpan={4} className="muted">Belum ada target.</td></tr>}</tbody>
    </table></div>
    <div className="admin-table" style={{ marginTop: 20 }}><table>
      <thead><tr><th>Tanggal</th><th>Target</th><th style={{ textAlign: "right" }}>Target</th><th style={{ textAlign: "right" }}>Realisasi</th><th>Alasan</th><th>Dicatat</th></tr></thead>
      <tbody>{alasan.map((r) => (<tr key={r.id}><td>{r.workDate}</td><td>{r.label}</td>
        <td style={{ textAlign: "right" }}>{r.target.toLocaleString("id-ID")}</td>
        <td style={{ textAlign: "right" }}>{r.actual.toLocaleString("id-ID")}</td>
        <td>{r.reason}</td><td>{r.createdByName || "-"}</td></tr>))}
        {!alasan.length && <tr><td colSpan={6} className="muted">Belum ada catatan alasan.</td></tr>}</tbody>
    </table></div></>);
}
