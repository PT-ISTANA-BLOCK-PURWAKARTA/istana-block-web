import { PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { opsAccess } from "@/lib/erp/ops";
import { desc } from "drizzle-orm";

export const metadata = { title: "Biaya armada" };

const rupiah = (n: number | null) => (n == null ? "-" : "Rp " + Math.round(n).toLocaleString("id-ID"));
const tanggal = (d: Date | null) => (d ? d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }) : "-");
/** Tempo: jatuh tempo & pelunasan (migrasi 0099). */
const tempo = (r: { dueDate: string | null; tempoPaidAt: Date | null }) => {
  if (r.tempoPaidAt) return `lunas ${tanggal(r.tempoPaidAt)}`;
  if (r.dueDate) return `tempo ${r.dueDate}`;
  return "-";
};

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
          <thead><tr><th>Tanggal</th><th>Kendaraan</th><th>Jenis</th><th>Sub kategori</th><th>Item</th><th>Qty</th><th style={{ textAlign: "right" }}>Total</th><th>Toko / tempat</th><th>Bayar</th><th>Tempo</th><th>Persetujuan</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.entryDate}</td>
                <td>{r.vehicleLabel || r.vehicleId || "-"}</td>
                <td>{r.kind}</td>
                <td>{r.subcategory || "-"}</td>
                <td>{r.item || "-"}{r.tripRef ? <span className="muted" style={{ display: "block", fontSize: 11 }}>{r.tripRef}</span> : null}</td>
                <td>{r.qty ?? "-"}</td>
                <td style={{ textAlign: "right" }}>{rupiah(r.total)}</td>
                <td>{[r.shop, r.place].filter(Boolean).join(" · ") || "-"}</td>
                <td>{[r.payment, r.fund].filter(Boolean).join(" · ") || "-"}</td>
                <td>{tempo(r)}</td>
                <td>{r.approvalStatus}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={11} className="muted">Belum ada biaya armada.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
