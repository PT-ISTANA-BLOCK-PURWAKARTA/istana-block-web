import type { Metadata } from "next";
import { PanelShell, type ShellItem } from "@/components/panel/PanelShell";
import { requireModule } from "@/lib/auth";

export const metadata: Metadata = { title: { default: "Keuangan", template: "%s · Keuangan Istana Block" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const ITEMS: ShellItem[] = [
  { href: "/akuntansi", label: "Ringkasan", icon: "home" },
  { href: "/akuntansi/penjualan", label: "Faktur penjualan", group: "Penjualan", icon: "invoice" },
  { href: "/akuntansi/penerimaan", label: "Penerimaan", group: "Penjualan", icon: "receive" },
  { href: "/akuntansi/pembelian", label: "Faktur pembelian", group: "Pembelian", icon: "cart" },
  { href: "/akuntansi/pembayaran", label: "Pembayaran", group: "Pembelian", icon: "pay" },
  { href: "/akuntansi/kas", label: "Kas & bank", group: "Kas & jurnal", icon: "cash" },
  { href: "/akuntansi/jurnal", label: "Jurnal umum", group: "Kas & jurnal", icon: "book" },
  { href: "/akuntansi/laporan", label: "Laporan", group: "Laporan", icon: "chart" },
  { href: "/akuntansi/kontak", label: "Kontak", group: "Data", icon: "users" },
  { href: "/akuntansi/barang", label: "Barang & jasa", group: "Data", icon: "box" },
  { href: "/akuntansi/akun", label: "Daftar akun", group: "Data", icon: "list" },
  { href: "/akuntansi/pengaturan", label: "Pengaturan", group: "Data", icon: "gear" },
  { href: "/akuntansi/profil", label: "Akun saya", group: "Data", icon: "user" },
];

export default async function KeuanganLayout({ children }: { children: React.ReactNode }) {
  const user = await requireModule("keuangan");
  return (
    <PanelShell module="keuangan" tag="Keuangan" items={ITEMS} user={user}>
      {children}
    </PanelShell>
  );
}
