"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const NAV_LINKS = [
  { href: "/produk", label: "Produk" },
  { href: "/pola-paving", label: "Kalkulator" },
  { href: "/paket-proyek", label: "Paket proyek" },
  { href: "/galeri", label: "Galeri" },
  { href: "/area-pengiriman", label: "Area kirim" },
  { href: "/kontak", label: "Kontak" },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <>
      {NAV_LINKS.map((l) => {
        const active = path === l.href || path.startsWith(l.href + "/");
        return (
          // prefetch mati: menu tampil di setiap halaman; tiap prefetch = satu request ke Worker.
          <Link
            key={l.href}
            href={l.href}
            prefetch={false}
            aria-current={active ? "page" : undefined}
            onClick={(e) => e.currentTarget.closest("details")?.removeAttribute("open")}
          >
            {l.label}
          </Link>
        );
      })}
    </>
  );
}
