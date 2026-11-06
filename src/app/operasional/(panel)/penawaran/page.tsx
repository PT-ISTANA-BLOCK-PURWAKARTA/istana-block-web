import { PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { opsAccess } from "@/lib/erp/ops";
import { desc } from "drizzle-orm";

const tanggal = (d: Date | null) => (d ? d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }) : "-");

export const metadata = { title: "Penawaran" };

export default async function Penawaran() {
  await opsAccess();
  const db = await getDb();
  const rows = await db.select().from(schema.quotations).orderBy(desc(schema.quotations.quoteDate));
  return (
    <>
      <PageHead title="Penawaran" />
      <p className="muted" style={{ marginTop: -8 }}>{rows.length} penawaran hasil impor app lama.</p>
      <div className="admin-table">
        <table>
          <thead><tr><th>Nomor</th><th>Tanggal</th><th>Pelanggan</th><th>Proyek</th><th>Pekerjaan</th><th>Status</th><th>Penanda tangan</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.number}</td>
                <td>{tanggal(r.quoteDate)}</td>
                <td>{r.customerName}</td>
                <td>{r.projectName || "-"}</td>
                <td>{r.work || "-"}</td>
                <td>{r.status}</td>
                <td>{r.signerName || "-"}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="muted">Belum ada penawaran.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
