import { PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { opsAccess } from "@/lib/erp/ops";
const rupiah = (n: number | null | undefined) => (n == null ? "-" : "Rp " + Math.round(n).toLocaleString("id-ID"));
const tanggal = (d: Date | null) => (d ? d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }) : "-");

import { desc, sql } from "drizzle-orm";
export const metadata = { title: "Uditch" };
export default async function Uditch() {
  await opsAccess();
  const db = await getDb();
  const [ringkas, rows] = await Promise.all([
    db.all<{ direction: string; n: number; total: number }>(sql`select direction, count(*) n, sum(total) total from ops_uditch_entries group by direction`),
    db.select().from(schema.uditchEntries).orderBy(desc(schema.uditchEntries.entryDate), desc(schema.uditchEntries.id)).limit(50),
  ]);
  const d = (k: string) => ringkas.find((x) => x.direction === k);
  return (<>
    <PageHead title="Uditch" />
    <p className="muted" style={{ marginTop: -8 }}>Buku kas proyek uditch. Masuk {d("masuk")?.n ?? 0} baris ({rupiah(d("masuk")?.total ?? 0)}) · keluar {d("keluar")?.n ?? 0} baris ({rupiah(d("keluar")?.total ?? 0)}). Menampilkan 50 terbaru.</p>
    <div className="admin-table"><table>
      <thead><tr><th>Tanggal</th><th>Akun</th><th>Arah</th><th>Item</th><th>Pihak</th><th style={{ textAlign: "right" }}>Total</th><th>Kategori</th><th>PIC</th></tr></thead>
      <tbody>{rows.map((r) => (<tr key={r.id}><td>{r.entryDate}</td><td>{r.account}</td><td>{r.direction}</td><td>{r.item}</td>
        <td>{r.party || "-"}</td><td style={{ textAlign: "right" }}>{rupiah(r.total)}</td><td>{r.category || "-"}</td><td>{r.pic || "-"}</td></tr>))}</tbody>
    </table></div></>);
}
