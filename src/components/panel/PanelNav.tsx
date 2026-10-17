"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; group?: string };

/** Menu samping modul. Item pertama dianggap beranda modul (aktif hanya bila path sama persis). */
export function PanelNav({ items, label }: { items: NavItem[]; label: string }) {
  const path = usePathname();
  const root = items[0]?.href;
  // Yang aktif adalah tautan terpanjang yang cocok (mis. /stok/penyesuaian mengalahkan /stok).
  const activeHref = items
    .map((i) => i.href)
    .filter((h) => (h === root ? path === root : path === h || path.startsWith(`${h}/`)))
    .sort((a, b) => b.length - a.length)[0];
  let lastGroup: string | undefined;
  return (
    <nav aria-label={label} className="admin-nav">
      {items.map((i) => {
        const active = i.href === activeHref;
        const heading = i.group && i.group !== lastGroup ? i.group : null;
        lastGroup = i.group ?? lastGroup;
        return (
          <div key={i.href} className="admin-nav-item">
            {heading && <span className="admin-nav-group">{heading}</span>}
            <Link href={i.href} aria-current={active ? "page" : undefined}>
              {i.label}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}
