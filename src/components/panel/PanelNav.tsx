"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "./Icon";

/** also = alamat lain yang ikut menandai menu ini aktif (mis. tab-tab satu kelompok halaman). */
export type NavItem = { href: string; label: string; group?: string; icon: IconName; badge?: number | string; also?: string[] };

const matches = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

/**
 * Menu samping modul. Item pertama dianggap beranda modul (aktif hanya bila path sama persis).
 * Judul grup bisa diciutkan (tersimpan per perangkat); grup yang berisi halaman aktif selalu terbuka.
 * Di layar kecil menu dilipat di balik tombol "Menu" dan tertutup lagi setiap pindah halaman.
 */
export function PanelNav({ items, label, footer }: { items: NavItem[]; label: string; footer: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  const store = `nav-folded:${label}`;
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    try {
      setFolded(JSON.parse(localStorage.getItem(store) || "{}"));
    } catch {
      setFolded({});
    }
  }, [store]);
  const toggle = (g: string) =>
    setFolded((cur) => {
      const next = { ...cur, [g]: !cur[g] };
      try {
        localStorage.setItem(store, JSON.stringify(next));
      } catch {
        // abaikan (mode privat)
      }
      return next;
    });

  const root = items[0]?.href;
  // Yang aktif adalah tautan terpanjang yang cocok (mis. /stok/penyesuaian mengalahkan /stok), termasuk alamat "also".
  const scored = items.flatMap((i) => [i.href, ...(i.also ?? [])].map((h) => ({ i, h })));
  const best = scored
    .filter(({ h, i }) => (i.href === root && h === root ? path === root : matches(path, h)))
    .sort((a, b) => b.h.length - a.h.length)[0];
  const current = best?.i;

  // Kelompokkan item berurutan per grup; item tanpa grup tampil di atas tanpa judul.
  const sections: { group?: string; items: NavItem[] }[] = [];
  for (const i of items) {
    const last = sections[sections.length - 1];
    if (last && last.group === i.group) last.items.push(i);
    else sections.push({ group: i.group, items: [i] });
  }

  const link = (i: NavItem) => (
    <Link key={i.href} href={i.href} aria-current={i === current ? "page" : undefined}>
      <Icon name={i.icon} size={18} />
      <span>{i.label}</span>
      {i.badge ? <span className="nav-badge">{i.badge}</span> : null}
    </Link>
  );

  return (
    <>
      <button type="button" className="nav-toggle" aria-expanded={open} aria-controls="panel-menu" onClick={() => setOpen((v) => !v)}>
        <Icon name={open ? "close" : "menu"} />
        <span>{open ? "Tutup menu" : current?.label ?? "Menu"}</span>
      </button>
      <div id="panel-menu" className={`side-body${open ? " is-open" : ""}`}>
        <nav aria-label={label} className="admin-nav">
          {sections.map((s, n) => {
            if (!s.group) return <div key={`s${n}`} className="admin-nav-item">{s.items.map(link)}</div>;
            const hasActive = s.items.some((i) => i === current);
            const shut = !hasActive && folded[s.group];
            return (
              <div key={`${s.group}${n}`} className="admin-nav-item">
                <button type="button" className="admin-nav-group" aria-expanded={!shut} onClick={() => toggle(s.group!)} title={shut ? "Buka grup" : "Ciutkan grup"}>
                  <span>{s.group}</span>
                  <span aria-hidden="true" className="admin-nav-caret">{shut ? "▸" : "▾"}</span>
                </button>
                {!shut && s.items.map(link)}
              </div>
            );
          })}
        </nav>
        {footer}
      </div>
    </>
  );
}
