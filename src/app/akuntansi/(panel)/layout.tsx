import type { Metadata } from "next";
import { PanelShell, type ShellItem } from "@/components/panel/PanelShell";
import { requireModule } from "@/lib/auth";

export const metadata: Metadata = { title: { default: "Keuangan", template: "%s · Keuangan Istana Block" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Menu Keuangan di bar atas seperti Zahir Online:
 * Dashboard · Data · Buku Besar · Penjualan · Pembelian · Kas & Bank · Persediaan · Laporan.
 * (Gaji & kasbon tambahan dari app lama, bukan modul Zahir.)
 */
const ITEMS: ShellItem[] = [
  { href: "/akuntansi", label: "Dashboard", icon: "home" },
  { href: "/akuntansi/menu/data", label: "Semua menu Data", group: "Data", icon: "menu" },
  { href: "/akuntansi/kontak", label: "Nama Alamat", group: "Data", icon: "users" },
  { href: "/akuntansi/barang", label: "Produk", group: "Data", icon: "box" },
  { href: "/akuntansi/akun", label: "Daftar Rekening", group: "Data", icon: "list" },
  { href: "/akuntansi/harta-tetap", label: "Harta Tetap", group: "Data", icon: "factory" },
  { href: "/akuntansi/data/proyek", label: "Proyek", group: "Data", icon: "clipboard" },
  { href: "/akuntansi/data/departemen", label: "Departemen", group: "Data", icon: "id" },
  { href: "/akuntansi/data/pajak", label: "Pajak", group: "Data", icon: "doc" },
  { href: "/akuntansi/data/satuan", label: "Satuan", group: "Data", icon: "adjust" },
  { href: "/akuntansi/data/mata-uang", label: "Mata Uang", group: "Data", icon: "cash" },
  { href: "/akuntansi/menu/buku-besar", label: "Semua menu Buku Besar", group: "Buku Besar", icon: "menu" },
  { href: "/akuntansi/jurnal", label: "Jurnal Umum", group: "Buku Besar", icon: "book" },
  { href: "/akuntansi/laporan/buku-besar", label: "Buku Besar", group: "Buku Besar", icon: "ledger" },
  { href: "/akuntansi/laporan/neraca-saldo", label: "Neraca Saldo", group: "Buku Besar", icon: "adjust" },
  { href: "/akuntansi/anggaran", label: "Anggaran", group: "Buku Besar", icon: "chart" },
  { href: "/akuntansi/harta-tetap/penyusutan", label: "Penyusutan Bulanan", group: "Buku Besar", icon: "calendar" },
  { href: "/akuntansi/menu/penjualan", label: "Semua menu Penjualan", group: "Penjualan", icon: "menu" },
  { href: "/akuntansi/dokumen/penawaran", label: "Surat Penawaran", group: "Penjualan", icon: "mail" },
  { href: "/akuntansi/dokumen/invoice", label: "Invoice (surat tagihan)", group: "Penjualan", icon: "doc" },
  { href: "/akuntansi/dokumen/surat-jalan", label: "Surat Jalan", group: "Penjualan", icon: "truck" },
  { href: "/akuntansi/penjualan", label: "Faktur Penjualan", group: "Penjualan", icon: "invoice" },
  { href: "/akuntansi/penerimaan", label: "Penerimaan Penjualan", group: "Penjualan", icon: "receive" },
  { href: "/akuntansi/uang-muka", label: "Uang Muka Penjualan", group: "Penjualan", icon: "pay" },
  { href: "/akuntansi/retur", label: "Retur Penjualan", group: "Penjualan", icon: "undo" },
  { href: "/akuntansi/menu/pembelian", label: "Semua menu Pembelian", group: "Pembelian", icon: "menu" },
  { href: "/akuntansi/pesanan-pembelian?jenis=rfq", label: "Permintaan Penawaran", group: "Pembelian", icon: "mail" },
  { href: "/akuntansi/pesanan-pembelian", label: "Pesanan Pembelian", group: "Pembelian", icon: "clipboard" },
  { href: "/akuntansi/dokumen/surat-pesanan", label: "Surat Pesanan Barang", group: "Pembelian", icon: "mail" },
  { href: "/akuntansi/pembelian", label: "Faktur Pembelian", group: "Pembelian", icon: "cart" },
  { href: "/akuntansi/pembayaran", label: "Pembayaran Pembelian", group: "Pembelian", icon: "pay" },
  { href: "/akuntansi/uang-muka?jenis=pembelian", label: "Uang Muka Pembelian", group: "Pembelian", icon: "receive" },
  { href: "/akuntansi/retur?jenis=pembelian", label: "Retur Pembelian", group: "Pembelian", icon: "undo" },
  { href: "/akuntansi/menu/kas-bank", label: "Semua menu Kas & Bank", group: "Kas & Bank", icon: "menu" },
  { href: "/akuntansi/kas", label: "Daftar Kas & Bank", group: "Kas & Bank", icon: "cash" },
  { href: "/akuntansi/kas?jenis=masuk", label: "Kas Masuk", group: "Kas & Bank", icon: "receive" },
  { href: "/akuntansi/kas?jenis=keluar", label: "Kas Keluar", group: "Kas & Bank", icon: "pay" },
  { href: "/akuntansi/kas?jenis=transfer", label: "Transfer Kas", group: "Kas & Bank", icon: "adjust" },
  { href: "/akuntansi/kas/rekonsiliasi", label: "Rekonsiliasi Bank", group: "Kas & Bank", icon: "check" },
  { href: "/akuntansi/giro", label: "Giro Masuk", group: "Kas & Bank", icon: "doc" },
  { href: "/akuntansi/giro?jenis=keluar", label: "Giro Keluar", group: "Kas & Bank", icon: "doc" },
  { href: "/akuntansi/menu/persediaan", label: "Semua menu Persediaan", group: "Persediaan", icon: "menu" },
  { href: "/akuntansi/ops/barang-masuk", label: "Penerimaan Barang", group: "Persediaan", icon: "inbox" },
  { href: "/akuntansi/ops/rencana", label: "Rencana Pesanan", group: "Persediaan", icon: "calendar" },
  { href: "/akuntansi/laporan", label: "Pusat Laporan", group: "Laporan", icon: "chart" },
  { href: "/akuntansi/laporan/neraca-12", label: "Neraca - 12 Bulan", group: "Laporan", icon: "ledger" },
  { href: "/akuntansi/laporan/kartu?jenis=piutang", label: "Kartu Piutang / Hutang", group: "Laporan", icon: "book" },
  { href: "/akuntansi/laporan/laba-rugi-12", label: "Laba Rugi - 12 Bulan", group: "Laporan", icon: "report" },
  { href: "/akuntansi/menu/lainnya", label: "Semua menu Lainnya", group: "Lainnya", icon: "menu" },
  { href: "/akuntansi/gaji", label: "Gaji & slip gaji", group: "Lainnya", icon: "report" },
  { href: "/akuntansi/kasbon", label: "Kasbon karyawan", group: "Lainnya", icon: "cash" },
  { href: "/akuntansi/tutup-buku", label: "Tutup Buku & Audit", group: "Lainnya", icon: "check" },
  { href: "/akuntansi/pengaturan", label: "Pengaturan", group: "Lainnya", icon: "gear" },
];

export default async function KeuanganLayout({ children }: { children: React.ReactNode }) {
  const user = await requireModule("keuangan");
  return (
    <PanelShell module="keuangan" tag="Keuangan" items={ITEMS} user={user} layout="top">
      {children}
    </PanelShell>
  );
}
