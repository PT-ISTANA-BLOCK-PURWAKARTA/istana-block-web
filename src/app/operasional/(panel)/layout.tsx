import type { Metadata } from "next";
import { PanelShell, type ShellItem } from "@/components/panel/PanelShell";
import { opsAccess } from "@/lib/erp/ops";
import { DutyBar } from "@/components/ops/duty/DutyBar";
import { myTodayCount } from "@/lib/ops/calendar";
import { backupOverdue } from "@/lib/ops/security";
import { qcPending } from "@/lib/ops/qc";
import { can } from "@/lib/roles";

export const metadata: Metadata = { title: { default: "Operasional", template: "%s · Operasional Istana Block" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// Menu tanpa "perm" tampil untuk semua yang boleh membuka operasional (termasuk staf keuangan, hanya baca).
const ITEMS: ShellItem[] = [
  { href: "/operasional", label: "Ringkasan", icon: "home" },
  { href: "/operasional/pesanan", label: "Pesanan (PO)", group: "Penjualan", icon: "clipboard" },
  { href: "/operasional/pengiriman", label: "Pengiriman", group: "Penjualan", icon: "truck" },
  { href: "/operasional/lacak", label: "Lacak truk", group: "Penjualan", icon: "pin", perm: "lacak" },
  { href: "/operasional/tugas", label: "Tugas antar saya", group: "Penjualan", icon: "route", perm: "antar" },
  { href: "/operasional/muatan", label: "Muatan", group: "Penjualan", icon: "box", perm: "muat" },
  { href: "/operasional/pelanggan", label: "Pelanggan", group: "Penjualan", icon: "users", perm: ["pesanan", "pengiriman", "keuangan"] },
  { href: "/operasional/rekap-pelanggan", label: "Rekap Pelanggan", group: "Penjualan", icon: "star", perm: "rekap_pelanggan" },
  { href: "/operasional/stok", label: "Stok barang", group: "Gudang", icon: "stack" },
  { href: "/operasional/barang-masuk", label: "Barang masuk", group: "Gudang", icon: "inbox", perm: ["barang_masuk", "lihat_barang_masuk"] },
  { href: "/operasional/produksi", label: "Hasil produksi", group: "Gudang", icon: "factory", perm: ["stok", "keuangan", "produksi_lapangan", "setujui_qc", "ttd_pimpinan"] },
  { href: "/operasional/stok/penyesuaian", label: "Penyesuaian stok", group: "Gudang", icon: "adjust", perm: ["stok", "keuangan"] },
  { href: "/operasional/stok/opname", label: "Stok opname", group: "Gudang", icon: "list", perm: "opname" },
  { href: "/operasional/stok/cat-genteng", label: "Cat genteng", group: "Gudang", icon: "box", perm: "cat_genteng" },
  { href: "/operasional/qc", label: "QC", group: "Mutu", icon: "flask", perm: ["qc", "setujui_qc", "ttd_pimpinan"] },
  { href: "/operasional/uji-pasir", label: "Uji lumpur pasir", group: "Mutu", icon: "sand", perm: ["uji_pasir", "lihat_uji_pasir", "ttd_sekretaris"] },
  { href: "/operasional/bahan-baku", label: "Bahan baku & supplier", group: "Mutu", icon: "chart", perm: ["lihat_uji_pasir", "nilai_mutu", "nilai_kirim", "nilai_harga"] },
  { href: "/operasional/spesifikasi-produk", label: "Spesifikasi produk", group: "Mutu", icon: "doc", perm: "spesifikasi_produk" },
  { href: "/operasional/rekap-iso", label: "Rekap ISO", group: "Mutu", icon: "award", perm: "iso" },
  { href: "/operasional/kalender", label: "Kalender", group: "Kantor", icon: "calendar", perm: "kalender" },
  { href: "/operasional/laporan", label: "Laporan pimpinan", group: "Kantor", icon: "report", perm: "laporan" },
  { href: "/operasional/piket", label: "Piket", group: "Kantor", icon: "clock", perm: ["piket", "selesaikan", "kalender_kelola"] },
  { href: "/operasional/keamanan", label: "Keamanan", group: "Kantor", icon: "shield", perm: "keamanan" },
  { href: "/operasional/armada", label: "Armada", group: "Data", icon: "car", perm: ["pengiriman", "keuangan"] },
  { href: "/operasional/sopir", label: "Sopir", group: "Data", icon: "id", perm: ["pengiriman", "keuangan"] },
  { href: "/operasional/profil", label: "Akun saya", group: "Data", icon: "user" },
];

export default async function OperasionalLayout({ children }: { children: React.ReactNode }) {
  const { user } = await opsAccess();
  // Angka di menu: pekerjaan QC yang menunggu & acara saya hari ini. Kueri hanya jalan bila akun berhak.
  const [qc, today, overdue] = await Promise.all([
    qcPending(user).catch(() => null),
    can(user.roles, "kalender") ? myTodayCount(user).catch(() => 0) : 0,
    can(user.roles, "keamanan") ? backupOverdue().catch(() => false) : false,
  ]);
  const badges: Record<string, number | string> = { "/operasional/qc": qc?.total ?? 0, "/operasional/kalender": today, "/operasional/keamanan": overdue ? "!" : 0 };
  const items = ITEMS.map((i) => (badges[i.href] ? { ...i, badge: badges[i.href] } : i));
  return (
    <PanelShell module="operasional" tag="Operasional" items={items} user={user}>
      <DutyBar me={user} />
      {children}
    </PanelShell>
  );
}
