// Halaman bergaya jendela Zahir (sama dengan Kas Masuk/Keluar & Buku Besar di Keuangan) untuk halaman daftar/laporan
// Anak Perusahaan: ← Kembali · judul · aksi di kanan atas, keterangan, isi, tombol bawah dan Tutup di kanan bawah.
// Tabel .admin-table & kotak .card / .admin-card di dalamnya ikut bergaya Zahir (header biru, panel abu) lewat CSS .zpg.
// (Form transaksi Keuangan memakai ZahirWindow; ini untuk halaman daftar.)
import Link from "next/link";
import { BackButton } from "./BackButton";

export function ZahirPage({
  title,
  sub,
  hub,
  actions,
  foot,
  children,
}: {
  title: string;
  sub?: React.ReactNode;
  /** Menu bagiannya: tujuan Tutup, dan Kembali bila halaman dibuka langsung. */
  hub: string;
  actions?: React.ReactNode;
  foot?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="zd zpg">
      <div className="zd-top">
        <BackButton fallback={hub} />
        <h1>{title}</h1>
        {actions && <div className="zpg-actions">{actions}</div>}
      </div>
      {sub && <p className="zpg-sub">{sub}</p>}
      <div className="zpg-body">{children}</div>
      <div className="zd-foot">
        {foot}
        <span className="zd-total" aria-hidden />
        <Link href={hub} className="btn btn-ghost btn-sm">Tutup</Link>
      </div>
    </div>
  );
}
