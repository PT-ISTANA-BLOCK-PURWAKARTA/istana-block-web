"use client";

// Menu atas horizontal (gaya Zahir Online) untuk modul Keuangan: logo, menu per modul dengan dropdown,
// pindah aplikasi, dan akun. Di HP menjadi tombol "Menu" yang membuka daftar bertingkat.
// Juga menampilkan tombol bulat hijau "+" (transaksi baru) di halaman daftar transaksi.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "./Icon";
import type { NavItem } from "./PanelNav";

type Mod = { key: string; href: string; label: string };

/** Halaman daftar → alamat transaksi baru untuk tombol "+". */
const FAB: Record<string, { href: string; label: string }> = {
  "/akuntansi/penjualan": { href: "/akuntansi/penjualan/baru", label: "Faktur Penjualan baru" },
  "/akuntansi/penerimaan": { href: "/akuntansi/penerimaan/baru", label: "Penerimaan baru" },
  "/akuntansi/pembelian": { href: "/akuntansi/pembelian/baru", label: "Faktur Pembelian baru" },
  "/akuntansi/pembayaran": { href: "/akuntansi/pembayaran/baru", label: "Pembayaran baru" },
  "/akuntansi/kas": { href: "/akuntansi/kas/baru?jenis=keluar", label: "Transaksi kas baru" },
  "/akuntansi/jurnal": { href: "/akuntansi/jurnal/baru", label: "Jurnal Umum baru" },
  "/akuntansi/kontak": { href: "/akuntansi/kontak/baru", label: "Nama Alamat baru" },
  "/akuntansi/barang": { href: "/akuntansi/barang/baru", label: "Produk baru" },
  "/akuntansi/akun": { href: "/akuntansi/akun/baru", label: "Rekening baru" },
};

const matches = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

export function TopNav({ items, modules, current, user, homeHref, logout }: { items: NavItem[]; modules: Mod[]; current: string; user: { name: string; role: string }; homeHref: string; logout: (fd: FormData) => void }) {
  const path = usePathname();
  const [open, setOpen] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { setOpen(null); setMobile(false); }, [path]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null); };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const root = items[0]?.href;
  const best = items
    .flatMap((i) => [i.href, ...(i.also ?? [])].map((h) => ({ i, h })))
    .filter(({ h, i }) => (i.href === root && h === root ? path === root : matches(path, h)))
    .sort((a, b) => b.h.length - a.h.length)[0]?.i;
  const loose = items.filter((i) => !i.group);
  const groups: { name: string; items: NavItem[] }[] = [];
  for (const i of items) {
    if (!i.group) continue;
    const g = groups.find((x) => x.name === i.group);
    if (g) g.items.push(i);
    else groups.push({ name: i.group, items: [i] });
  }
  const fab = Object.entries(FAB).find(([p]) => path === p)?.[1];
  const toggle = (name: string) => setOpen((o) => (o === name ? null : name));
  const link = (i: NavItem) => (
    <Link key={i.href} href={i.href} aria-current={i === best ? "page" : undefined} className="tn-item">
      <Icon name={i.icon as IconName} size={16} /> <span>{i.label}</span>
      {i.badge ? <span className="nav-badge">{i.badge}</span> : null}
    </Link>
  );

  return (
    <>
      <header className="tn" ref={ref}>
        <div className="tn-bar">
          <Link href={homeHref} className="tn-brand">
            <img src="/brand/lambang-istana-block-putih.webp" alt="" width={129} height={150} />
            <span>Istana Block <small>Keuangan</small></span>
          </Link>
          <button type="button" className="tn-burger" aria-expanded={mobile} aria-controls="tn-menu" onClick={() => setMobile((v) => !v)}>
            <Icon name={mobile ? "close" : "menu"} size={20} /> <span>{best?.label ?? "Menu"}</span>
          </button>
          <nav id="tn-menu" className={`tn-menu${mobile ? " is-open" : ""}`} aria-label="Menu keuangan">
            {loose.map((i) => (
              <Link key={i.href} href={i.href} className="tn-top" aria-current={i === best ? "page" : undefined}><Icon name={i.icon as IconName} size={16} /> {i.label}</Link>
            ))}
            {groups.map((g) => {
              const active = g.items.includes(best as NavItem);
              const isOpen = open === g.name;
              return (
                <div key={g.name} className={`tn-group${isOpen ? " is-open" : ""}`}>
                  <button type="button" className={`tn-top${active ? " is-active" : ""}`} aria-expanded={isOpen} onClick={(e) => { e.stopPropagation(); toggle(g.name); }}>
                    {g.name} <span className="tn-caret" aria-hidden="true">▾</span>
                  </button>
                  <div className="tn-drop" hidden={!isOpen}>{g.items.map(link)}</div>
                </div>
              );
            })}
          </nav>
          <div className="tn-right">
            <div className={`tn-group${open === "__app" ? " is-open" : ""}`}>
              <button type="button" className="tn-top" aria-expanded={open === "__app"} onClick={(e) => { e.stopPropagation(); toggle("__app"); }}>
                <Icon name="globe" size={16} /> <span className="tn-hide-sm">Aplikasi</span> <span className="tn-caret">▾</span>
              </button>
              <div className="tn-drop tn-drop-right" hidden={open !== "__app"}>
                {modules.map((m) => <Link key={m.key} href={m.href} className="tn-item" aria-current={m.key === current ? "page" : undefined}>{m.label}</Link>)}
                <Link href="/internal" className="tn-item"><Icon name="home" size={16} /> Semua aplikasi</Link>
              </div>
            </div>
            <div className={`tn-group${open === "__me" ? " is-open" : ""}`}>
              <button type="button" className="tn-top tn-me" aria-expanded={open === "__me"} onClick={(e) => { e.stopPropagation(); toggle("__me"); }}>
                <span className="tn-avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span>
                <span className="tn-hide-sm">{user.name}</span> <span className="tn-caret">▾</span>
              </button>
              <div className="tn-drop tn-drop-right" hidden={open !== "__me"}>
                <div className="tn-who"><b>{user.name}</b><span>{user.role}</span></div>
                <Link href="/akuntansi/profil" className="tn-item"><Icon name="user" size={16} /> Akun saya</Link>
                <form action={logout}><button type="submit" className="tn-item"><Icon name="logout" size={16} /> Keluar</button></form>
              </div>
            </div>
          </div>
        </div>
      </header>
      {fab && (
        <Link href={fab.href} className="tn-fab" aria-label={fab.label} title={fab.label}>+</Link>
      )}
    </>
  );
}
