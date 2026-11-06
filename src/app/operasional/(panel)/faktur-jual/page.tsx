import { PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { opsAccess } from "@/lib/erp/ops";
import { desc } from "drizzle-orm";

const tanggal = (d: Date | null) => (d ? d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }) : "-");

export const metadata = { title: "Faktur penjualan" };

const rupiah = (n: number | null) => (n == null ? "-" : "Rp " + Math.round(n).toLocaleString("id-ID"));

export default async function FakturJual() {
  await opsAccess();
  const db = await getDb();
  const rows = await db.select().from(schema.salesInvoices).orderBy(desc(schema.salesInvoices.invoiceDate));
  return (
    <>
      <PageHead title="Faktur penjualan" />
      <p className="muted" style={{ marginTop: -8 }}>
        {rows.length} faktur penjualan hasil impor app lama. Belum masuk ke piutang keuangan (masih menunggu keputusan alur).
      </p>
      <div className="admin-table">
        <table>
          <thead><tr><th>Nomor</th><th>Tanggal</th><th>Pelanggan</th><th>PO</th><th>PPN</th><th>Status</th><th style={{ textAlign: "right" }}>Dibayar</th><th>Cara bayar</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.number}</td>
                <td>{tanggal(r.invoiceDate)}</td>
                <td>{r.customerName}</td>
                <td>{r.orderPoNumber || r.poNumber || "-"}</td>
                <td>{r.ppnPercent ? r.ppnPercent + "%" : "-"}</td>
                <td>{r.status}</td>
                <td style={{ textAlign: "right" }}>{rupiah(r.paidAmount)}</td>
                <td>{r.paymentMethod || "-"}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} className="muted">Belum ada faktur penjualan.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
