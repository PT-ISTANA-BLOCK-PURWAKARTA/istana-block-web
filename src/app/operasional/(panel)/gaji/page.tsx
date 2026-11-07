import { desc } from "drizzle-orm";
import { PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { opsAccess } from "@/lib/erp/ops";
import { can } from "@/lib/roles";
import { buatPayslip, hapusPayslip } from "./actions";

export const metadata = { title: "Gaji" };

/** Daftar slip gaji hasil impor app lama (baca saja sampai modul gaji penuh diport). */
const total = (rows: Record<string, unknown>[], key: string) =>
  rows.reduce((n, r) => n + (typeof r[key] === "number" ? (r[key] as number) : 0), 0);

const rupiah = (n: number) => "Rp " + n.toLocaleString("id-ID");

const PAY_KIND: Record<string, string> = { mingguan: "Mingguan", bulanan: "Bulanan" };
/** Jenis gajian + periode (gajian mingguan dihitung Jumat–Kamis). */
const periode = (r: { payKind: string | null; periodFrom: string | null; periodTo: string | null }) => {
  const jenis = r.payKind ? (PAY_KIND[r.payKind] ?? r.payKind) : "";
  const rentang = r.periodFrom && r.periodTo ? `${r.periodFrom} → ${r.periodTo}` : "";
  return [jenis, rentang].filter(Boolean).join(" · ") || "-";
};

export default async function Gaji() {
  const { user } = await opsAccess();
  const boleh = can(user.roles, "keuangan");
  const db = await getDb();
  const rows = await db.select().from(schema.payslips).orderBy(desc(schema.payslips.slipDate));
  return (
    <>
      <PageHead title="Gaji" />
      <p className="muted" style={{ marginTop: -8 }}>
        {rows.length} slip gaji. Sumber: impor app lama; menunggu halaman buat/cetak slip.
      </p>
      {boleh && (
        <form action={buatPayslip} className="card" style={{ padding: 16, marginBottom: 20, display: "grid", gap: 10 }}>
          <strong>Slip gaji baru</strong>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input name="karyawan" placeholder="Nama karyawan" required style={{ flex: 2, minWidth: 200 }} />
            <input name="tanggal" type="date" required style={{ flex: 1, minWidth: 150 }} />
            <input name="penandaTangan" placeholder="Penanda tangan" style={{ flex: 1, minWidth: 160 }} />
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <textarea name="pendapatan" rows={3} placeholder="Pendapatan per baris: 1000000|GENTENG" style={{ flex: 1, minWidth: 240 }} />
            <textarea name="potongan" rows={3} placeholder="Potongan per baris: 50000|KASBON" style={{ flex: 1, minWidth: 240 }} />
            <textarea name="kasbon" rows={3} placeholder="Catatan kasbon" style={{ flex: 1, minWidth: 200 }} />
          </div>
          <div><button type="submit" className="btn">Simpan slip</button></div>
        </form>
      )}
      <div className="admin-table">
        <table>
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Karyawan</th>
              <th>Jenis · periode</th>
              <th style={{ textAlign: "right" }}>Pendapatan</th>
              <th style={{ textAlign: "right" }}>Potongan</th>
              <th style={{ textAlign: "right" }}>Diterima</th>
              <th>Kasbon</th>
              <th>Ditandatangani</th>{boleh && <th />}
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
                  <td>{periode(r)}</td>
                  <td style={{ textAlign: "right" }}>{masuk ? rupiah(masuk) : "-"}</td>
                  <td style={{ textAlign: "right" }}>{keluar ? rupiah(keluar) : "-"}</td>
                  <td style={{ textAlign: "right" }}>{masuk || keluar ? rupiah(masuk - keluar) : "-"}</td>
                  <td style={{ maxWidth: 260 }}>{r.kasbonNote || "-"}</td>
                  <td>{r.signerName || "-"}</td>{boleh && <td><form action={hapusPayslip}><input type="hidden" name="id" value={r.id} /><button type="submit" className="link">Hapus</button></form></td>}
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={boleh ? 9 : 8} className="muted">
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
