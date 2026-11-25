import type { Metadata } from "next";
import { PanelShell, type ShellItem } from "@/components/panel/PanelShell";
import { requireModule } from "@/lib/auth";

export const metadata: Metadata = { title: { default: "Keuangan", template: "%s · Keuangan Istana Block" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Menu Keuangan disusun seperti modul Zahir Accounting 6:
 * Beranda · Data-Data · Buku Besar · Penjualan · Pembelian · Kas & Bank · Persediaan · Laporan.
 * (Gaji & kasbon tambahan dari app lama, bukan modul Zahir.)
 */
const ITEMS: ShellItem[] = [
  { href: "/akuntansi", label: "Beranda", icon: "home" },
  { href: "/akuntansi/kontak", label: "Data Nama Alamat", group: "Data-Data", icon: "users" },
  { href: "/akuntansi/barang", label: "Data Produk", group: "Data-Data", icon: "box" },
  { href: "/akuntansi/akun", label: "Daftar Rekening Perkiraan", group: "Data-Data", icon: "list" },
  { href: "/akuntansi/jurnal", label: "Jurnal Umum", group: "Buku Besar", icon: "book" },
  { href: "/akuntansi/laporan/buku-besar", label: "Buku Besar", group: "Buku Besar", icon: "ledger" },
  { href: "/akuntansi/laporan/neraca-saldo", label: "Neraca Saldo", group: "Buku Besar", icon: "adjust" },
  { href: "/akuntansi/penjualan", label: "Faktur Penjualan", group: "Penjualan", icon: "invoice" },
  { href: "/akuntansi/penerimaan", label: "Penerimaan Penjualan", group: "Penjualan", icon: "receive" },
  { href: "/akuntansi/pembelian", label: "Faktur Pembelian", group: "Pembelian", icon: "cart" },
  { href: "/akuntansi/pembayaran", label: "Pembayaran Pembelian", group: "Pembelian", icon: "pay" },
  { href: "/akuntansi/kas", label: "Kas & Bank", group: "Kas & Bank", icon: "cash" },
  { href: "/operasional/stok", label: "Stok Barang", group: "Persediaan", icon: "stack" },
  { href: "/operasional/produksi", label: "Hasil Produksi", group: "Persediaan", icon: "factory" },
  { href: "/akuntansi/laporan", label: "Daftar Laporan", group: "Laporan", icon: "chart" },
  { href: "/akuntansi/laporan/neraca-12", label: "Neraca - 12 Bulan", group: "Laporan", icon: "ledger" },
  { href: "/akuntansi/laporan/laba-rugi-12", label: "Laba Rugi - 12 Bulan", group: "Laporan", icon: "report" },
  { href: "/akuntansi/gaji", label: "Gaji & slip gaji", group: "Gaji & kasbon", icon: "report" },
  { href: "/akuntansi/kasbon", label: "Kasbon karyawan", group: "Gaji & kasbon", icon: "cash" },
  { href: "/akuntansi/pengaturan", label: "Pengaturan", group: "Pengaturan", icon: "gear" },
  { href: "/akuntansi/profil", label: "Akun saya", group: "Pengaturan", icon: "user" },
];

export default async function KeuanganLayout({ children }: { children: React.ReactNode }) {
  const user = await requireModule("keuangan");
  return (
    <PanelShell module="keuangan" tag="Keuangan" items={ITEMS} user={user}>
      {children}
    </PanelShell>
  );
}
