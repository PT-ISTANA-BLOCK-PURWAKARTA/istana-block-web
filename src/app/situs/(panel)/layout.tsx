import type { Metadata } from "next";
import { PanelShell, type ShellItem } from "@/components/panel/PanelShell";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: { default: "Situs", template: "%s · Situs Istana Block" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const items: ShellItem[] = [
    { href: "/situs", label: "Ringkasan", icon: "home" },
    { href: "/situs/produk", label: "Produk & harga", group: "Isi situs", icon: "box" },
    { href: "/situs/artikel", label: "Artikel", group: "Isi situs", icon: "doc" },
    { href: "/situs/halaman", label: "Halaman", group: "Isi situs", icon: "page" },
    { href: "/situs/testimoni", label: "Testimoni", group: "Isi situs", icon: "star" },
    { href: "/situs/pengaturan", label: "Info & kontak", group: "Isi situs", icon: "info" },
    ...(admin.roles.includes("owner") ? [{ href: "/internal/pengguna", label: "Pengguna & peran", group: "Akun", icon: "users" } as ShellItem] : []),
    { href: "/situs/akun", label: "Akun saya", group: "Akun", icon: "user" },
  ];
  return (
    <PanelShell module="web" tag="Situs" items={items} user={admin}>
      {children}
    </PanelShell>
  );
}
