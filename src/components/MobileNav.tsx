"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV_LINKS } from "./NavLinks";

const DRAWER_EVENT = "ib:open-mobile-nav";

function NavIcon({ href }: { href: string }) {
  switch (href) {
    case "/produk":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
          <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
        </svg>
      );
    case "/paket-proyek":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3l9 4.5-9 4.5-9-4.5L12 3z" />
          <path d="M3 12l9 4.5 9-4.5M3 16.5L12 21l9-4.5" />
        </svg>
      );
    case "/pola-paving":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="4" y="3" width="16" height="18" rx="3" />
          <path d="M8 7h8M8 12h2M12 12h4M8 16h2M12 16h4" />
        </svg>
      );
    case "/galeri":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="3" />
          <circle cx="8.5" cy="9.5" r="1.5" />
          <path d="M21 15l-4.5-4.5L7 20" />
        </svg>
      );
    case "/area-pengiriman":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 21s6-5.6 6-11a6 6 0 1 0-12 0c0 5.4 6 11 6 11z" />
          <circle cx="12" cy="10" r="2.2" />
        </svg>
      );
    case "/artikel":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
          <path d="M8 9h7M8 13h7M8 17h4" />
        </svg>
      );
    default:
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.4 2.1L8 9.7a16 16 0 0 0 6.3 6.3l1.3-1.3a2 2 0 0 1 2.1-.4c.8.3 1.7.5 2.6.6A2 2 0 0 1 22 16.9z" />
        </svg>
      );
  }
}

const DOCK_TABS = [
  { href: "/produk", label: "Produk" },
  { href: "/paket-proyek", label: "Paket" },
  { href: "/pola-paving", label: "Kalkulator" },
  { href: "/galeri", label: "Galeri" },
] as const;

const DRAWER_ONLY_PATHS = ["/area-pengiriman", "/artikel", "/kontak"];

/** Tombol menu di header mobile yang membuka drawer Telegram. */
export function MobileMenuTrigger() {
  return (
    <button
      type="button"
      className="mobile-menu-btn"
      aria-label="Buka menu navigasi"
      onClick={() => window.dispatchEvent(new CustomEvent(DRAWER_EVENT))}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" aria-hidden="true">
        <path d="M4 7h16M4 12h13M4 17h16" />
      </svg>
      <span>Menu</span>
    </button>
  );
}

/**
 * Navigasi mobile bergaya Telegram:
 * 1) Bilah kapsul mengambang di bagian bawah layar (dock tab utama + pemicu drawer)
 * 2) Slide-out drawer dari sisi kiri lengkap dengan profil pabrik, seluruh 7 tautan, & tombol CTA.
 */
export function TelegramMobileNav({
  companyName,
  hours,
  phone,
  waHref,
  telHref,
}: {
  companyName: string;
  hours: string;
  phone: string;
  waHref: string;
  telHref: string;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [path]);

  useEffect(() => {
    const onOpen = () => setOpen((v) => !v);
    window.addEventListener(DRAWER_EVENT, onOpen);
    return () => window.removeEventListener(DRAWER_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const inDrawerMenu = open || DRAWER_ONLY_PATHS.some((p) => path === p || path.startsWith(p + "/"));

  return (
    <>
      <nav aria-label="Navigasi cepat seluler" className="tg-dock">
        {DOCK_TABS.map((t) => {
          const active = path === t.href || path.startsWith(t.href + "/");
          return (
            <Link
              key={t.href}
              href={t.href}
              prefetch={false}
              className={`tg-tab${active ? " is-active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <NavIcon href={t.href} />
              <span>{t.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          className={`tg-tab${inDrawerMenu ? " is-active" : ""}`}
          aria-expanded={open}
          aria-controls="tg-drawer"
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h10" />
          </svg>
          <span>Menu</span>
        </button>
      </nav>

      {open && <div className="tg-backdrop" aria-hidden="true" onClick={() => setOpen(false)} />}

      <aside
        id="tg-drawer"
        className={`tg-drawer${open ? " is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Menu navigasi Istana Block"
        aria-hidden={!open}
        inert={!open}
      >
        <div className="tg-drawer-head hexpat">
          <div className="tg-drawer-top">
            <Link href="/" prefetch={false} className="tg-drawer-brand" onClick={() => setOpen(false)}>
              <img src="/brand/logo-istana-block-putih.webp" alt={companyName} width={132} height={40} />
            </Link>
            <button type="button" className="tg-drawer-close" aria-label="Tutup menu" onClick={() => setOpen(false)}>
              ×
            </button>
          </div>
          <p className="tg-drawer-sub">Pabrik Paving &amp; Beton Precast Purwakarta</p>
          <div className="tg-drawer-meta">
            <span>{hours}</span>
            <span>·</span>
            <span>{phone}</span>
          </div>
        </div>

        <nav aria-label="Menu lengkap seluler" className="tg-drawer-list">
          <Link
            href="/"
            prefetch={false}
            className={`tg-drawer-item${path === "/" ? " is-active" : ""}`}
            onClick={() => setOpen(false)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.5z" />
            </svg>
            <span>Beranda</span>
          </Link>
          <div className="tg-drawer-sep" role="separator" />
          {NAV_LINKS.map((l) => {
            const active = path === l.href || path.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                prefetch={false}
                className={`tg-drawer-item${active ? " is-active" : ""}`}
                aria-current={active ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                <NavIcon href={l.href} />
                <span>{l.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="tg-drawer-foot">
          <a className="btn btn-primary" href={waHref} target="_blank" rel="noopener">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12a9 9 0 0 1-13.2 7.9L3 21l1.2-4.6A9 9 0 1 1 21 12z" />
            </svg>
            Minta penawaran
          </a>
          <a className="btn btn-ghost" href={telHref}>
            Telepon {phone}
          </a>
        </div>
      </aside>
    </>
  );
}
