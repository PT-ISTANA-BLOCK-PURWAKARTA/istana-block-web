import { PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { opsAccess } from "@/lib/erp/ops";
import { desc } from "drizzle-orm";

export const metadata = { title: "Biaya armada" };

const rupiah = (n: number | null) => (n == null ? "-" : "Rp " + Math.round(n).toLocaleString("id-ID"));

export default async function BiayaArmada() {
  await opsAccess();
  const db = await getDb();
  const rows = await db.select().from(schema.fleetExpenses).orderBy(desc(schema.fleetExpenses.entryDate));
  const total = rows.reduce((n, r) => n + (r.total || 0), 0);
  return (
    <>
      <PageHead title="Biaya armada" />
      <p className="muted" style={{ marginTop: -8 }}>
        {rows.length} catatan · total {rupiah(total)}. Hasil impor app lama; input & persetujuan belum tersedia.
      </p>
      <div className="admin-table">
        <table>
          <thead><tr><th>Tanggal</th><th>Kendaraan</th><th>Jenis</th><th>Item</th><th>Qty</th><th style={{ textAlign: "right" }}>Total</th><th>Toko / tempat</th><th>Bayar</th><th>Persetujuan</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.entryDate}</td>
                <td>{r.vehicleLabel || r.vehicleId || "-"}</td>
                <td>{r.kind}</td>
                <td>{r.item || "-"}</td>
                <td>{r.qty ?? "-"}</td>
                <td style={{ textAlign: "right" }}>{rupiah(r.total)}</td>
                <td>{[r.shop, r.place].filter(Boolean).join(" · ") || "-"}</td>
                <td>{[r.payment, r.fund].filter(Boolean).join(" · ") || "-"}</td>
                <td>{r.approvalStatus}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={9} className="muted">Belum ada biaya armada.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
