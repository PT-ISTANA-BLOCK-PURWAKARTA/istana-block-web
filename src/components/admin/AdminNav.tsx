"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "Ringkasan" },
  { href: "/admin/produk", label: "Produk & harga" },
  { href: "/admin/artikel", label: "Artikel" },
  { href: "/admin/halaman", label: "Halaman" },
  { href: "/admin/testimoni", label: "Testimoni" },
  { href: "/admin/pengaturan", label: "Info & kontak" },
  { href: "/admin/pengguna", label: "Pengguna admin" },
  { href: "/admin/akun", label: "Akun saya" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Menu admin" className="admin-nav">
      {ITEMS.map((i) => {
        const active = i.href === "/admin" ? path === "/admin" : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined}>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
