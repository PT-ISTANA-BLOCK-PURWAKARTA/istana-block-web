import type { Metadata } from "next";
import { ClusterTabs, type Cluster } from "@/components/panel/ClusterTabs";
import type { IconName } from "@/components/panel/Icon";
import { PanelShell, type ShellItem } from "@/components/panel/PanelShell";
import { opsAccess } from "@/lib/erp/ops";
import { DutyBar } from "@/components/ops/duty/DutyBar";
import { OpsAlarmListener } from "@/components/ops/OpsAlarmListener";
import { myTodayCount } from "@/lib/ops/calendar";
import { backupOverdue } from "@/lib/ops/security";
import { qcPending } from "@/lib/ops/qc";
import { can, type Perm, type Role } from "@/lib/roles";

export const metadata: Metadata = { title: { default: "Operasional", template: "%s · Operasional Istana Block" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Tab = { href: string; label: string; perm?: Perm | Perm[] };
type Entry = { label: string; icon: IconName; group?: string; tabs: Tab[] };

/**
 * Menu ringkas: halaman yang sejenis disatukan jadi satu menu dengan tab di atas halaman.
 * Tab tanpa "perm" tampil untuk semua yang boleh membuka operasional (termasuk staf keuangan, hanya baca).
 * Tautan menu = tab pertama yang boleh dibuka akun ini.
 */
const MENU: Entry[] = [
  { label: "Ringkasan", icon: "home", tabs: [{ href: "/operasional" }].map((t) => ({ ...t, label: "Ringkasan" })) },
  { label: "Produksi & target", icon: "factory", tabs: [
    { href: "/operasional/produksi", label: "Hasil produksi", perm: ["stok", "keuangan", "lihat_produksi", "produksi_lapangan", "setujui_qc", "ttd_pimpinan"] },
    { href: "/operasional/target-produksi", label: "Target produksi", perm: ["stok", "keuangan", "produksi_lapangan", "lihat_produksi"] },
  ] },
  { label: "Pesanan", icon: "clipboard", group: "Penjualan", tabs: [
    { href: "/operasional/pesanan", label: "Pesanan (PO)" },
    { href: "/operasional/rencana-pesanan", label: "Rencana pesanan", perm: ["pesanan", "keuangan"] },
    { href: "/operasional/penawaran", label: "Penawaran", perm: ["pesanan", "keuangan"] },
  ] },
  { label: "Pengiriman", icon: "truck", group: "Penjualan", tabs: [
    { href: "/operasional/pengiriman", label: "Pengiriman" },
    { href: "/operasional/muatan", label: "Muatan", perm: "muat" },
    { href: "/operasional/lacak", label: "Lacak truk", perm: "lacak" },
    { href: "/operasional/surat-jalan", label: "Surat jalan", perm: ["pesanan", "pengiriman", "keuangan"] },
  ] },
  { label: "Tugas antar saya", icon: "route", group: "Penjualan", tabs: [{ href: "/operasional/tugas", label: "Tugas antar saya", perm: "antar" }] },
  { label: "Pelanggan", icon: "users", group: "Penjualan", tabs: [
    { href: "/operasional/pelanggan", label: "Pelanggan", perm: ["pesanan", "pengiriman", "keuangan"] },
    { href: "/operasional/rekap-pelanggan", label: "Rekap Pelanggan", perm: "rekap_pelanggan" },
  ] },
  { label: "Faktur penjualan", icon: "invoice", group: "Penjualan", tabs: [{ href: "/operasional/faktur-jual", label: "Faktur penjualan", perm: "keuangan" }] },
  { label: "Stok", icon: "stack", group: "Gudang", tabs: [
    { href: "/operasional/stok", label: "Stok barang" },
    { href: "/operasional/stok/penyesuaian", label: "Penyesuaian", perm: ["stok", "keuangan"] },
    { href: "/operasional/stok/opname", label: "Opname", perm: "opname" },
    { href: "/operasional/transfer-stok", label: "Transfer", perm: ["stok", "keuangan"] },
    { href: "/operasional/stok/cat-genteng", label: "Cat genteng", perm: "cat_genteng" },
    { href: "/operasional/hapus-produksi", label: "Produksi dihapus", perm: ["stok", "keuangan"] },
  ] },
  { label: "Barang masuk", icon: "inbox", group: "Gudang", tabs: [{ href: "/operasional/barang-masuk", label: "Barang masuk", perm: ["barang_masuk", "lihat_barang_masuk"] }] },
  { label: "QC", icon: "flask", group: "Mutu", tabs: [
    { href: "/operasional/qc", label: "QC paving", perm: ["qc", "setujui_qc", "ttd_pimpinan"] },
    { href: "/operasional/qc-beton", label: "QC Beton", perm: "qc_beton" },
  ] },
  { label: "Uji & bahan baku", icon: "sand", group: "Mutu", tabs: [
    { href: "/operasional/uji-pasir", label: "Uji lumpur pasir", perm: ["uji_pasir", "lihat_uji_pasir", "ttd_sekretaris"] },
    { href: "/operasional/bahan-baku", label: "Bahan baku & supplier", perm: ["lihat_uji_pasir", "nilai_mutu", "nilai_kirim", "nilai_harga"] },
    { href: "/operasional/spesifikasi-produk", label: "Spesifikasi produk", perm: "spesifikasi_produk" },
  ] },
  { label: "Form ISO", icon: "award", group: "Mutu", tabs: [
    { href: "/operasional/rekap-iso", label: "Rekap ISO", perm: "iso" },
    { href: "/operasional/insiden", label: "Lapor Insiden", perm: "insiden" },
    { href: "/operasional/surat-pesanan", label: "Surat pesanan", perm: "pesanan" },
  ] },
  { label: "Kalender", icon: "calendar", group: "Kantor", tabs: [{ href: "/operasional/kalender", label: "Kalender", perm: "kalender" }] },
  { label: "Laporan pimpinan", icon: "report", group: "Kantor", tabs: [{ href: "/operasional/laporan", label: "Laporan pimpinan", perm: "laporan" }] },
  { label: "Absensi pekerja", icon: "users", group: "Kantor", tabs: [{ href: "/operasional/absensi-pekerja", label: "Absensi pekerja", perm: "absensi_pekerja" }] },
  { label: "Piket & keamanan", icon: "shield", group: "Kantor", tabs: [
    { href: "/operasional/piket", label: "Piket", perm: ["piket", "selesaikan", "kalender_kelola"] },
    { href: "/operasional/keamanan", label: "Keamanan data", perm: "keamanan" },
  ] },
  { label: "Armada & sopir", icon: "car", group: "Armada", tabs: [
    { href: "/operasional/armada", label: "Armada", perm: ["pengiriman", "keuangan", "ekspedisi"] },
    { href: "/operasional/sopir", label: "Sopir", perm: ["pengiriman", "keuangan", "ekspedisi"] },
    { href: "/operasional/jadwal-sopir", label: "Jadwal sopir", perm: ["pengiriman", "keuangan", "ekspedisi"] },
    { href: "/operasional/gerbang", label: "Buku gerbang", perm: ["muat", "pengiriman", "keamanan", "keuangan"] },
  ] },
  { label: "Akun saya", icon: "user", group: "Akun", tabs: [{ href: "/operasional/profil", label: "Akun saya" }] },
];

const allowed = (roles: readonly Role[], t: Tab) => !t.perm || (Array.isArray(t.perm) ? t.perm : [t.perm]).some((p) => can(roles, p));

export default async function OperasionalLayout({ children }: { children: React.ReactNode }) {
  const { user } = await opsAccess();
  // Angka di menu: pekerjaan QC yang menunggu & acara saya hari ini. Kueri hanya jalan bila akun berhak.
  const [qc, today, overdue] = await Promise.all([
    qcPending(user).catch(() => null),
    can(user.roles, "kalender") ? myTodayCount(user).catch(() => 0) : 0,
    can(user.roles, "keamanan") ? backupOverdue().catch(() => false) : false,
  ]);
  const badges: Record<string, number | string> = { "/operasional/qc": qc?.total ?? 0, "/operasional/kalender": today, "/operasional/keamanan": overdue ? "!" : 0 };

  const items: ShellItem[] = [];
  const clusters: Cluster[] = [];
  for (const e of MENU) {
    const tabs = e.tabs.filter((t) => allowed(user.roles, t));
    if (!tabs.length) continue;
    const badge = tabs.map((t) => badges[t.href]).find(Boolean);
    items.push({ href: tabs[0].href, label: e.label, icon: e.icon, group: e.group, also: tabs.slice(1).map((t) => t.href), ...(badge ? { badge } : {}) });
    if (tabs.length > 1) clusters.push({ tabs: tabs.map((t) => ({ href: t.href, label: t.label })) });
  }
  return (
    <PanelShell module="operasional" tag="Operasional" items={items} user={user}>
      <DutyBar me={user} />
      <OpsAlarmListener />
      <ClusterTabs clusters={clusters} />
      {children}
    </PanelShell>
  );
}
