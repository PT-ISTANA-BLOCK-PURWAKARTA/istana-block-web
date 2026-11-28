import Link from "next/link";
import { PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { opsAccess } from "@/lib/erp/ops";
import { desc, notInArray } from "drizzle-orm";

const tanggal = (d: Date | null) => (d ? d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }) : "-");

export const metadata = { title: "Faktur penjualan" };

const rupiah = (n: number | null) => (n == null ? "-" : "Rp " + Math.round(n).toLocaleString("id-ID"));

export default async function FakturJual() {
  await opsAccess();
  const db = await getDb();
  // Invoice U-Ditch (IN-UD-…) terpisah dari IB: hanya di Anak Perusahaan.
  const rows = await db.select().from(schema.salesInvoices).where(notInArray(schema.salesInvoices.issuer, ["ud", "eib"])).orderBy(desc(schema.salesInvoices.invoiceDate));
  return (
    <>
      <PageHead title="Faktur penjualan" />
      <p className="muted" style={{ marginTop: -8 }}>
        {rows.length} faktur penjualan PT. Istana Block (tanpa invoice U-Ditch & angkutan Ekspedisi). Klik nomor atau pelanggan untuk melihat invoice lengkap.
      </p>
      <div className="admin-table">
        <table>
          <thead><tr><th>Nomor</th><th>Tanggal</th><th>Pelanggan</th><th>PO</th><th>PPN</th><th>Status</th><th style={{ textAlign: "right" }}>Dibayar</th><th>Cara bayar</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/akuntansi/cetak/invoice/${r.id}?dari=ops`}><b>{r.number}</b></Link></td>
                <td>{tanggal(r.invoiceDate)}</td>
                <td><Link href={`/akuntansi/cetak/invoice/${r.id}?dari=ops`}>{r.customerName}</Link></td>
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
