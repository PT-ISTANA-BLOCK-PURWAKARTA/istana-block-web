import { desc, sql } from "drizzle-orm";
import { PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { opsAccess } from "@/lib/erp/ops";

export const metadata = { title: "Dana Cepi" };

const rupiah = (n: number | null | undefined) => "Rp " + Math.round(n ?? 0).toLocaleString("id-ID");

export default async function DanaCepi() {
  await opsAccess();
  const db = await getDb();
  const [ringkas, rows] = await Promise.all([
    // Saldo = dana masuk dari kantor + pendapatan lain yang dipegang Cepi − biaya mobil bersumber "Dana Cepi".
    db.all<{ setoran: number; pendapatan: number; keluar: number }>(sql`
      select
        (select coalesce(sum(amount), 0) from ops_fleet_cash) setoran,
        (select coalesce(sum(total), 0) from ops_fleet_expenses
          where fund = 'cepi' and kind = 'pendapatan'
            and (approval_status is null or approval_status in ('ok', 'disetujui'))
            and coalesce(payment, '') not like 'belum%') pendapatan,
        (select coalesce(sum(total), 0) from ops_fleet_expenses
          where fund = 'cepi' and kind not in ('sewa', 'pendapatan')
            and (approval_status is null or approval_status in ('ok', 'disetujui'))) keluar`),
    db.select().from(schema.fleetCash).orderBy(desc(schema.fleetCash.entryDate), desc(schema.fleetCash.id)).limit(200),
  ]);
  const r = ringkas[0] ?? { setoran: 0, pendapatan: 0, keluar: 0 };
  const masuk = r.setoran + r.pendapatan;
  const saldo = masuk - r.keluar;
  return (
    <>
      <PageHead title="Dana Cepi" sub="Dana masuk dari kantor untuk operasional mobil, ditambah pendapatan lain yang diterima Cepi, dikurangi biaya mobil bersumber Dana Cepi." />
      <div className="card" style={{ padding: 16, marginBottom: 20, display: "grid", gap: 6 }}>
        <strong style={{ fontSize: 22 }}>{rupiah(saldo)}</strong>
        <p className="muted" style={{ margin: 0 }}>
          Masuk {rupiah(r.setoran)} setoran + {rupiah(r.pendapatan)} pendapatan lain · keluar {rupiah(r.keluar)}.
        </p>
        {saldo < 0 && <p style={{ margin: 0, color: "#b91c1c" }}>Saldo minus — pengeluaran Dana Cepi lebih besar dari dana masuk yang tercatat.</p>}
      </div>
      <div className="admin-table">
        <table>
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Dari / sumber</th>
              <th style={{ textAlign: "right" }}>Jumlah</th>
              <th>Catatan</th>
              <th>Dicatat oleh</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.entryDate}</td>
                <td>{row.source || "-"}</td>
                <td style={{ textAlign: "right" }}>{rupiah(row.amount)}</td>
                <td>{row.note || "-"}</td>
                <td>{row.createdByName || "-"}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="muted">Belum ada dana masuk ke Cepi.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
