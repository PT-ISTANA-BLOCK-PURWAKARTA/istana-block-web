"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "./Icon";

export type NavItem = { href: string; label: string; group?: string; icon: IconName; badge?: number | string };

/**
 * Menu samping modul. Item pertama dianggap beranda modul (aktif hanya bila path sama persis).
 * Di layar kecil menu dilipat di balik tombol "Menu" dan tertutup lagi setiap pindah halaman.
 */
export function PanelNav({ items, label, footer }: { items: NavItem[]; label: string; footer: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const root = items[0]?.href;
  // Yang aktif adalah tautan terpanjang yang cocok (mis. /stok/penyesuaian mengalahkan /stok).
  const activeHref = items
    .map((i) => i.href)
    .filter((h) => (h === root ? path === root : path === h || path.startsWith(`${h}/`)))
    .sort((a, b) => b.length - a.length)[0];
  const current = items.find((i) => i.href === activeHref);
  let lastGroup: string | undefined;
  return (
    <>
      <button type="button" className="nav-toggle" aria-expanded={open} aria-controls="panel-menu" onClick={() => setOpen((v) => !v)}>
        <Icon name={open ? "close" : "menu"} />
        <span>{open ? "Tutup menu" : current?.label ?? "Menu"}</span>
      </button>
      <div id="panel-menu" className={`side-body${open ? " is-open" : ""}`}>
        <nav aria-label={label} className="admin-nav">
          {items.map((i) => {
            const active = i.href === activeHref;
            const heading = i.group && i.group !== lastGroup ? i.group : null;
            lastGroup = i.group ?? lastGroup;
            return (
              <div key={i.href} className="admin-nav-item">
                {heading && <span className="admin-nav-group">{heading}</span>}
                <Link href={i.href} aria-current={active ? "page" : undefined}>
                  <Icon name={i.icon} size={18} />
                  <span>{i.label}</span>
                  {i.badge ? <span className="nav-badge">{i.badge}</span> : null}
                </Link>
              </div>
            );
          })}
        </nav>
        {footer}
      </div>
    </>
  );
}
