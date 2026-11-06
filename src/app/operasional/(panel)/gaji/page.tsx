import { desc } from "drizzle-orm";
import { PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { opsAccess } from "@/lib/erp/ops";

export const metadata = { title: "Gaji" };

/** Daftar slip gaji hasil impor app lama (baca saja sampai modul gaji penuh diport). */
const total = (rows: Record<string, unknown>[], key: string) =>
  rows.reduce((n, r) => n + (typeof r[key] === "number" ? (r[key] as number) : 0), 0);

const rupiah = (n: number) => "Rp " + n.toLocaleString("id-ID");

export default async function Gaji() {
  await opsAccess();
  const db = await getDb();
  const rows = await db.select().from(schema.payslips).orderBy(desc(schema.payslips.slipDate));
  return (
    <>
      <PageHead title="Gaji" />
      <p className="muted" style={{ marginTop: -8 }}>
        {rows.length} slip gaji. Sumber: impor app lama; menunggu halaman buat/cetak slip.
      </p>
      <div className="admin-table">
        <table>
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Karyawan</th>
              <th style={{ textAlign: "right" }}>Pendapatan</th>
              <th style={{ textAlign: "right" }}>Potongan</th>
              <th style={{ textAlign: "right" }}>Diterima</th>
              <th>Kasbon</th>
              <th>Ditandatangani</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const masuk = total(r.earnings, "amount");
              const keluar = total(r.deductions, "amount");
              return (
                <tr key={r.id}>
                  <td>{r.slipDate}</td>
                  <td>{r.employeeName}</td>
                  <td style={{ textAlign: "right" }}>{masuk ? rupiah(masuk) : "-"}</td>
                  <td style={{ textAlign: "right" }}>{keluar ? rupiah(keluar) : "-"}</td>
                  <td style={{ textAlign: "right" }}>{masuk || keluar ? rupiah(masuk - keluar) : "-"}</td>
                  <td style={{ maxWidth: 260 }}>{r.kasbonNote || "-"}</td>
                  <td>{r.signerName || "-"}</td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={7} className="muted">
                  Belum ada slip gaji.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
