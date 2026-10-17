import type { Metadata } from "next";
import { PanelShell, type ShellItem } from "@/components/panel/PanelShell";
import { requireModule } from "@/lib/auth";

export const metadata: Metadata = { title: { default: "Keuangan", template: "%s · Keuangan Istana Block" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const ITEMS: ShellItem[] = [
  { href: "/keuangan", label: "Ringkasan", icon: "home" },
  { href: "/keuangan/penjualan", label: "Faktur penjualan", group: "Penjualan", icon: "invoice" },
  { href: "/keuangan/penerimaan", label: "Penerimaan", group: "Penjualan", icon: "receive" },
  { href: "/keuangan/pembelian", label: "Faktur pembelian", group: "Pembelian", icon: "cart" },
  { href: "/keuangan/pembayaran", label: "Pembayaran", group: "Pembelian", icon: "pay" },
  { href: "/keuangan/kas", label: "Kas & bank", group: "Kas & jurnal", icon: "cash" },
  { href: "/keuangan/jurnal", label: "Jurnal umum", group: "Kas & jurnal", icon: "book" },
  { href: "/keuangan/laporan", label: "Laporan", group: "Laporan", icon: "chart" },
  { href: "/keuangan/kontak", label: "Kontak", group: "Data", icon: "users" },
  { href: "/keuangan/barang", label: "Barang & jasa", group: "Data", icon: "box" },
  { href: "/keuangan/akun", label: "Daftar akun", group: "Data", icon: "list" },
  { href: "/keuangan/pengaturan", label: "Pengaturan", group: "Data", icon: "gear" },
  { href: "/keuangan/profil", label: "Akun saya", group: "Data", icon: "user" },
];

export default async function KeuanganLayout({ children }: { children: React.ReactNode }) {
  const user = await requireModule("keuangan");
  return (
    <PanelShell module="keuangan" tag="Keuangan" items={ITEMS} user={user}>
      {children}
    </PanelShell>
  );
}
