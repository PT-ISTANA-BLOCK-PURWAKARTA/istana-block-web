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
  { href: "/akuntansi/kontak", label: "Nama Alamat", group: "Data", icon: "users" },
  { href: "/akuntansi/barang", label: "Produk", group: "Data", icon: "box" },
  { href: "/akuntansi/akun", label: "Daftar Rekening", group: "Data", icon: "list" },
  { href: "/akuntansi/jurnal", label: "Jurnal Umum", group: "Buku Besar", icon: "book" },
  { href: "/akuntansi/laporan/buku-besar", label: "Buku Besar", group: "Buku Besar", icon: "ledger" },
  { href: "/akuntansi/laporan/neraca-saldo", label: "Neraca Saldo", group: "Buku Besar", icon: "adjust" },
  { href: "/akuntansi/penjualan", label: "Faktur Penjualan", group: "Penjualan", icon: "invoice" },
  { href: "/akuntansi/penerimaan", label: "Penerimaan Penjualan", group: "Penjualan", icon: "receive" },
  { href: "/akuntansi/pembelian", label: "Faktur Pembelian", group: "Pembelian", icon: "cart" },
  { href: "/akuntansi/pembayaran", label: "Pembayaran Pembelian", group: "Pembelian", icon: "pay" },
  { href: "/akuntansi/kas", label: "Daftar Kas & Bank", group: "Kas & Bank", icon: "cash" },
  { href: "/akuntansi/kas/baru?jenis=masuk", label: "Kas Masuk", group: "Kas & Bank", icon: "receive" },
  { href: "/akuntansi/kas/baru?jenis=keluar", label: "Kas Keluar", group: "Kas & Bank", icon: "pay" },
  { href: "/akuntansi/kas/baru?jenis=transfer", label: "Transfer Kas", group: "Kas & Bank", icon: "adjust" },
  { href: "/operasional/stok", label: "Stok Barang", group: "Persediaan", icon: "stack" },
  { href: "/operasional/produksi", label: "Hasil Produksi", group: "Persediaan", icon: "factory" },
  { href: "/akuntansi/laporan", label: "Daftar Laporan", group: "Laporan", icon: "chart" },
  { href: "/akuntansi/laporan/neraca-12", label: "Neraca - 12 Bulan", group: "Laporan", icon: "ledger" },
  { href: "/akuntansi/laporan/laba-rugi-12", label: "Laba Rugi - 12 Bulan", group: "Laporan", icon: "report" },
  { href: "/akuntansi/gaji", label: "Gaji & slip gaji", group: "Lainnya", icon: "report" },
  { href: "/akuntansi/kasbon", label: "Kasbon karyawan", group: "Lainnya", icon: "cash" },
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
