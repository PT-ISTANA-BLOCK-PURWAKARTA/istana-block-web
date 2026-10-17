import type { Metadata } from "next";
import { PanelShell } from "@/components/panel/PanelShell";
import { opsAccess } from "@/lib/erp/ops";

export const metadata: Metadata = { title: { default: "Operasional", template: "%s · Operasional Istana Block" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const ITEMS = [
  { href: "/operasional", label: "Ringkasan" },
  { href: "/operasional/pesanan", label: "Pesanan (PO)", group: "Penjualan" },
  { href: "/operasional/pengiriman", label: "Pengiriman", group: "Penjualan" },
  { href: "/operasional/pelanggan", label: "Pelanggan", group: "Penjualan" },
  { href: "/operasional/stok", label: "Stok barang", group: "Gudang" },
  { href: "/operasional/produksi", label: "Hasil produksi", group: "Gudang" },
  { href: "/operasional/stok/penyesuaian", label: "Penyesuaian stok", group: "Gudang" },
  { href: "/operasional/armada", label: "Armada", group: "Data" },
  { href: "/operasional/sopir", label: "Sopir", group: "Data" },
  { href: "/operasional/profil", label: "Akun saya", group: "Data" },
];

export default async function OperasionalLayout({ children }: { children: React.ReactNode }) {
  const { user } = await opsAccess();
  return (
    <PanelShell module="operasional" tag="Operasional" items={ITEMS} user={user}>
      {children}
    </PanelShell>
  );
}
