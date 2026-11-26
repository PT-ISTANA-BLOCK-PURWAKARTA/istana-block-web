// Data Mata Uang: perusahaan memakai satu mata uang (Rupiah) sebagai mata uang dasar.
import { PageHead } from "@/components/erp/ui";
import { requireModule } from "@/lib/auth";

export const metadata = { title: "Data Mata Uang" };

export default async function MataUang() {
  await requireModule("keuangan");
  return (
    <>
      <PageHead title="Data Mata Uang" sub="Semua transaksi dan laporan memakai satu mata uang dasar. Laporan Zahir “Mata Uang Dasar” = Rupiah." />
      <div className="admin-table">
        <table>
          <thead><tr><th>Kode</th><th>Nama</th><th>Simbol</th><th className="num">Kurs</th><th>Keterangan</th></tr></thead>
          <tbody><tr><td><b>IDR</b></td><td>Rupiah Indonesia</td><td>Rp</td><td className="num">1</td><td>Mata uang dasar (default)</td></tr></tbody>
        </table>
      </div>
      <p className="small muted" style={{ marginTop: 10 }}>Transaksi valuta asing belum dipakai. Bila nanti ada pembelian impor, catat nilai rupiahnya sesuai kurs hari transaksi.</p>
    </>
  );
}
