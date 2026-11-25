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
 * Item bergrup hanya tampil sebagai judul grup + panah; klik judul untuk membuka pilihan di bawahnya.
 * Beberapa grup boleh terbuka bersamaan; grup yang berisi halaman aktif terbuka otomatis.
 * Grup yang dibuka diingat selama tab browser masih terbuka (sessionStorage); sesi baru mulai dari judul saja.
 * Item tanpa grup (mis. Ringkasan) selalu tampil di atas. Grup berlabel sama digabung jadi satu.
 * Di layar kecil menu dilipat di balik tombol "Menu" dan tertutup lagi setiap pindah halaman.
 */
export function PanelNav({ items, label, footer }: { items: NavItem[]; label: string; footer: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  const root = items[0]?.href;
  // Yang aktif adalah tautan terpanjang yang cocok (mis. /stok/penyesuaian mengalahkan /stok), termasuk alamat "also".
  const scored = items.flatMap((i) => [i.href, ...(i.also ?? [])].map((h) => ({ i, h })));
  const best = scored
    .filter(({ h, i }) => (i.href === root && h === root ? path === root : matches(path, h)))
    .sort((a, b) => b.h.length - a.h.length)[0];
  const current = best?.i;
  const activeGroup = current?.group ?? null;

  // Grup yang terbuka: grup halaman aktif + grup yang dibuka sendiri (diingat per tab browser).
  const store = `nav-open:${label}`;
  const [shown, setShown] = useState<string[]>(activeGroup ? [activeGroup] : []);
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(sessionStorage.getItem(store) || "[]");
      if (Array.isArray(saved)) setShown((cur) => [...new Set([...cur, ...saved.filter((x): x is string => typeof x === "string")])]);
    } catch {
      // abaikan (mode privat)
    }
  }, [store]);
  const remember = (next: string[]) => {
    try {
      sessionStorage.setItem(store, JSON.stringify(next));
    } catch {
      // abaikan
    }
    return next;
  };
  useEffect(() => {
    setOpen(false);
    if (activeGroup) setShown((cur) => (cur.includes(activeGroup) ? cur : remember([...cur, activeGroup])));
  }, [path, activeGroup]);

  // Item tanpa grup di atas (urutan asli), lalu grup menurut urutan kemunculan pertama.
  const loose = items.filter((i) => !i.group);
  const groups: { name: string; items: NavItem[] }[] = [];
  for (const i of items) {
    if (!i.group) continue;
    const g = groups.find((x) => x.name === i.group);
    if (g) g.items.push(i);
    else groups.push({ name: i.group, items: [i] });
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
          {loose.length > 0 && <div className="admin-nav-item">{loose.map(link)}</div>}
          {groups.map((g) => {
            const isOpen = shown.includes(g.name);
            const hasActive = g.name === activeGroup;
            const badge = g.items.map((i) => i.badge).find(Boolean);
            const id = `nav-${label}-${g.name}`.replace(/\W+/g, "-");
            return (
              <div key={g.name} className={`admin-nav-item${isOpen ? " is-open" : ""}`}>
                <button
                  type="button"
                  className={`admin-nav-group${hasActive ? " has-active" : ""}`}
                  aria-expanded={isOpen}
                  aria-controls={id}
                  onClick={() => setShown((cur) => remember(cur.includes(g.name) ? cur.filter((x) => x !== g.name) : [...cur, g.name]))}
                >
                  <span>{g.name}</span>
                  {!isOpen && badge ? <span className="nav-badge">{badge}</span> : null}
                  <span aria-hidden="true" className="admin-nav-caret"><Icon name="chevron" size={16} /></span>
                </button>
                <div id={id} className="admin-nav-sub" hidden={!isOpen}>{g.items.map(link)}</div>
              </div>
            );
          })}
        </nav>
        {footer}
      </div>
    </>
  );
}
