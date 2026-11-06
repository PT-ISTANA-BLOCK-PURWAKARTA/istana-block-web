import { PageHead } from "@/components/erp/ui";
import { desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { opsAccess } from "@/lib/erp/ops";
const tanggal = (d: Date | null) => (d ? d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }) : "-");
export const metadata = { title: "Jadwal sopir" };
export default async function JadwalSopir() {
  await opsAccess();
  const db = await getDb();
  const rows = await db.select().from(schema.driverSchedules).orderBy(desc(schema.driverSchedules.day));
  return (<>
    <PageHead title="Jadwal sopir" />
    <p className="muted" style={{ marginTop: -8 }}>{rows.length} jadwal. Hasil impor app lama.</p>
    <div className="admin-table"><table>
      <thead><tr><th>Hari</th><th>Sopir</th><th>Status</th><th>Sampai jam</th><th>Catatan</th><th>Diatur</th></tr></thead>
      <tbody>{rows.map((r) => (<tr key={r.id}><td>{r.day}</td><td>{r.driverId}</td><td>{r.status}</td>
        <td>{r.untilTime || "-"}</td><td>{r.note || "-"}</td><td>{r.setByName || "-"}</td></tr>))}
        {!rows.length && <tr><td colSpan={6} className="muted">Belum ada jadwal.</td></tr>}</tbody>
    </table></div></>);
}
