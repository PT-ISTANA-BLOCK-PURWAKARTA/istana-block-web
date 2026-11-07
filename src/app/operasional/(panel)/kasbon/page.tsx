import { desc, sql } from "drizzle-orm";
import { PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { opsAccess } from "@/lib/erp/ops";

export const metadata = { title: "Kasbon karyawan" };

const rupiah = (n: number | null | undefined) => "Rp " + Math.round(n ?? 0).toLocaleString("id-ID");
const JENIS: Record<string, string> = { kasbon: "Kasbon", bayar: "Bayar" };

export default async function Kasbon() {
  await opsAccess();
  const db = await getDb();
  const [rekap, rows] = await Promise.all([
    db.all<{ employee_name: string; kasbon: number | null; bayar: number | null }>(
      sql`select employee_name,
                 sum(case when kind = 'kasbon' then amount else 0 end) kasbon,
                 sum(case when kind = 'bayar' then amount else 0 end) bayar
            from ops_kasbon_entries
           group by employee_name
           order by employee_name`,
    ),
    db.select().from(schema.kasbonEntries).orderBy(desc(schema.kasbonEntries.entryDate), desc(schema.kasbonEntries.id)).limit(200),
  ]);
  const totalKasbon = rekap.reduce((n, r) => n + (r.kasbon ?? 0), 0);
  const totalBayar = rekap.reduce((n, r) => n + (r.bayar ?? 0), 0);
  return (
    <>
      <PageHead
        title="Kasbon karyawan"
        sub={`${rows.length} catatan · kasbon ${rupiah(totalKasbon)} · dibayar ${rupiah(totalBayar)} · sisa ${rupiah(totalKasbon - totalBayar)}.`}
      />
      <div className="admin-table" style={{ marginBottom: 16 }}>
        <table>
          <thead>
            <tr>
              <th>Karyawan</th>
              <th style={{ textAlign: "right" }}>Kasbon</th>
              <th style={{ textAlign: "right" }}>Dibayar</th>
              <th style={{ textAlign: "right" }}>Sisa</th>
            </tr>
          </thead>
          <tbody>
            {rekap.map((r) => {
              const sisa = (r.kasbon ?? 0) - (r.bayar ?? 0);
              return (
                <tr key={r.employee_name}>
                  <td>{r.employee_name}</td>
                  <td style={{ textAlign: "right" }}>{rupiah(r.kasbon)}</td>
                  <td style={{ textAlign: "right" }}>{rupiah(r.bayar)}</td>
                  <td style={{ textAlign: "right" }}>{rupiah(sisa)}</td>
                </tr>
              );
            })}
            {!rekap.length && <tr><td colSpan={4} className="muted">Belum ada kasbon karyawan.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="admin-table">
        <table>
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Karyawan</th>
              <th>Jenis</th>
              <th style={{ textAlign: "right" }}>Jumlah</th>
              <th>Catatan</th>
              <th>Dicatat oleh</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.entryDate}</td>
                <td>{r.employeeName}</td>
                <td>{JENIS[r.kind] ?? r.kind}</td>
                <td style={{ textAlign: "right" }}>{rupiah(r.amount)}</td>
                <td>{r.note || "-"}</td>
                <td>{r.createdByName || "-"}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="muted">Belum ada catatan kasbon.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
