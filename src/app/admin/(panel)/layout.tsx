import type { Metadata } from "next";
import { PanelShell } from "@/components/panel/PanelShell";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin Istana Block" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const items = [
    { href: "/admin", label: "Ringkasan" },
    { href: "/admin/produk", label: "Produk & harga" },
    { href: "/admin/artikel", label: "Artikel" },
    { href: "/admin/halaman", label: "Halaman" },
    { href: "/admin/testimoni", label: "Testimoni" },
    { href: "/admin/pengaturan", label: "Info & kontak" },
    ...(admin.roles.includes("owner") ? [{ href: "/admin/pengguna", label: "Pengguna & peran" }] : []),
    { href: "/admin/akun", label: "Akun saya" },
  ];
  return (
    <PanelShell module="web" tag="Panel situs" items={items} user={admin}>
      {children}
    </PanelShell>
  );
}
