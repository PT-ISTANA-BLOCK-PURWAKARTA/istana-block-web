import type { Metadata } from "next";
import { PanelShell, type ShellItem } from "@/components/panel/PanelShell";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin Istana Block" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const items: ShellItem[] = [
    { href: "/admin", label: "Ringkasan", icon: "home" },
    { href: "/admin/produk", label: "Produk & harga", group: "Isi situs", icon: "box" },
    { href: "/admin/artikel", label: "Artikel", group: "Isi situs", icon: "doc" },
    { href: "/admin/halaman", label: "Halaman", group: "Isi situs", icon: "page" },
    { href: "/admin/testimoni", label: "Testimoni", group: "Isi situs", icon: "star" },
    { href: "/admin/pengaturan", label: "Info & kontak", group: "Isi situs", icon: "info" },
    ...(admin.roles.includes("owner") ? [{ href: "/admin/pengguna", label: "Pengguna & peran", group: "Akun", icon: "users" } as ShellItem] : []),
    { href: "/admin/akun", label: "Akun saya", group: "Akun", icon: "user" },
  ];
  return (
    <PanelShell module="web" tag="Panel situs" items={items} user={admin}>
      {children}
    </PanelShell>
  );
}
