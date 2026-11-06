import { PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { opsAccess } from "@/lib/erp/ops";
import { desc } from "drizzle-orm";

export const metadata = { title: "Surat jalan" };

export default async function SuratJalan() {
  await opsAccess();
  const db = await getDb();
  const rows = await db.select().from(schema.deliveryNotes).orderBy(desc(schema.deliveryNotes.noteDate), desc(schema.deliveryNotes.number));
  const rupiah = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");
  const nilai = (items: Record<string, unknown>[]) =>
    items.reduce((n, it) => n + (typeof it.total === "number" ? (it.total as number) : 0), 0);
  return (
    <>
      <PageHead title="Surat jalan" />
      <p className="muted" style={{ marginTop: -8 }}>{rows.length} surat jalan hasil impor app lama. Cetak & buat baru belum tersedia.</p>
      <div className="admin-table">
        <table>
          <thead><tr><th>Nomor</th><th>Tanggal</th><th>Pelanggan</th><th>PO</th><th>Sopir / plat</th><th style={{ textAlign: "right" }}>Nilai barang</th><th>Catatan</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.issuer.toUpperCase()}-{r.number}</td>
                <td>{r.noteDate}</td>
                <td>{r.customerName}</td>
                <td>{r.orderPoNumber || r.poNumber || "-"}</td>
                <td>{[r.driverName, r.plate].filter(Boolean).join(" · ") || "-"}</td>
                <td style={{ textAlign: "right" }}>{nilai(r.items) ? rupiah(nilai(r.items)) : "-"}</td>
                <td>{r.pickup ? "diambil sendiri" : r.isInternal ? "internal" : "-"}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="muted">Belum ada surat jalan.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
