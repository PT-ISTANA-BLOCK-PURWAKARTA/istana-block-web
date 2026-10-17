import type { Metadata } from "next";
import { PanelShell, type ShellItem } from "@/components/panel/PanelShell";
import { opsAccess } from "@/lib/erp/ops";

export const metadata: Metadata = { title: { default: "Operasional", template: "%s · Operasional Istana Block" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// Menu tanpa "perm" tampil untuk semua yang boleh membuka operasional (termasuk staf keuangan, hanya baca).
const ITEMS: ShellItem[] = [
  { href: "/operasional", label: "Ringkasan", icon: "home" },
  { href: "/operasional/pesanan", label: "Pesanan (PO)", group: "Penjualan", icon: "clipboard" },
  { href: "/operasional/pengiriman", label: "Pengiriman", group: "Penjualan", icon: "truck" },
  { href: "/operasional/lacak", label: "Lacak truk", group: "Penjualan", icon: "pin", perm: "lacak" },
  { href: "/operasional/tugas", label: "Tugas antar saya", group: "Penjualan", icon: "route", perm: "antar" },
  { href: "/operasional/pelanggan", label: "Pelanggan", group: "Penjualan", icon: "users", perm: ["pesanan", "pengiriman", "keuangan"] },
  { href: "/operasional/stok", label: "Stok barang", group: "Gudang", icon: "stack" },
  { href: "/operasional/produksi", label: "Hasil produksi", group: "Gudang", icon: "factory", perm: ["stok", "keuangan"] },
  { href: "/operasional/stok/penyesuaian", label: "Penyesuaian stok", group: "Gudang", icon: "adjust", perm: ["stok", "keuangan"] },
  { href: "/operasional/armada", label: "Armada", group: "Data", icon: "car", perm: ["pengiriman", "keuangan"] },
  { href: "/operasional/sopir", label: "Sopir", group: "Data", icon: "id", perm: ["pengiriman", "keuangan"] },
  { href: "/operasional/profil", label: "Akun saya", group: "Data", icon: "user" },
];

export default async function OperasionalLayout({ children }: { children: React.ReactNode }) {
  const { user } = await opsAccess();
  return (
    <PanelShell module="operasional" tag="Operasional" items={ITEMS} user={user}>
      {children}
    </PanelShell>
  );
}
