import type { Metadata } from "next";
import { PanelShell } from "@/components/panel/PanelShell";
import { requireModule } from "@/lib/auth";

export const metadata: Metadata = { title: { default: "Keuangan", template: "%s · Keuangan Istana Block" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const ITEMS = [
  { href: "/keuangan", label: "Ringkasan" },
  { href: "/keuangan/penjualan", label: "Faktur penjualan", group: "Penjualan" },
  { href: "/keuangan/penerimaan", label: "Penerimaan", group: "Penjualan" },
  { href: "/keuangan/pembelian", label: "Faktur pembelian", group: "Pembelian" },
  { href: "/keuangan/pembayaran", label: "Pembayaran", group: "Pembelian" },
  { href: "/keuangan/kas", label: "Kas & bank", group: "Kas & jurnal" },
  { href: "/keuangan/jurnal", label: "Jurnal umum", group: "Kas & jurnal" },
  { href: "/keuangan/laporan", label: "Laporan", group: "Laporan" },
  { href: "/keuangan/kontak", label: "Kontak", group: "Data" },
  { href: "/keuangan/barang", label: "Barang & jasa", group: "Data" },
  { href: "/keuangan/akun", label: "Daftar akun", group: "Data" },
  { href: "/keuangan/pengaturan", label: "Pengaturan", group: "Data" },
  { href: "/keuangan/profil", label: "Akun saya", group: "Data" },
];

export default async function KeuanganLayout({ children }: { children: React.ReactNode }) {
  const user = await requireModule("keuangan");
  return (
    <PanelShell module="keuangan" tag="Keuangan" items={ITEMS} user={user}>
      {children}
    </PanelShell>
  );
}
