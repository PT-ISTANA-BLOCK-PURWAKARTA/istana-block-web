import Link from "next/link";
import { NavLinks } from "./NavLinks";
import { HexDivider } from "./HexDivider";
import type { Settings } from "@/lib/settings";
import { telLink, waLink } from "@/lib/format";

export function SiteHeader({ s }: { s: Settings }) {
  return (
    <header className="site-header">
      <a href="#isi" className="skip-link">Langsung ke isi</a>
      <div className="wrap">
        <Link prefetch={false} href="/" className="brand" aria-label={`${s.company_name}, ke beranda`}>
          <img src="/brand/logo-istana-block.webp" alt="Istana Block Purwakarta" width={147} height={44} className="brand-logo" />
        </Link>
        <nav aria-label="Menu utama" className="main-nav">
          <NavLinks />
          <a className="btn btn-primary btn-sm" href={waLink(s.whatsapp, "Halo Istana Block, saya mau minta penawaran.")} target="_blank" rel="noopener">
            Minta penawaran
          </a>
        </nav>
        <details className="mnav">
          <summary aria-label="Buka menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h12M4 17h16" /></svg>
            Menu
          </summary>
          <nav aria-label="Menu utama (ponsel)" className="mnav-panel">
            <NavLinks />
            <a href="/artikel">Artikel</a>
          </nav>
        </details>
      </div>
    </header>
  );
}

export function SiteFooter({ s }: { s: Settings }) {
  const year = new Date().getFullYear();
  return (
    <>
      <div style={{ marginTop: 40 }}>
        <HexDivider seed={11} />
      </div>
      <footer className="site-footer hexpat" id="kontak">
        <div className="wrap">
          <div className="footer-brand">
            <img src="/brand/logo-istana-block-putih.webp" alt="Istana Block Purwakarta" width={174} height={52} />
            <p>{s.legal_name} · sejak {s.founded_year}. Pabrik paving block, U-Ditch, buis beton, kanstin, dan genteng beton.</p>
          </div>
          <div>
            <b>Pabrik</b>
            <br />
            {s.address}
            <br />
            {s.hours}
            {s.maps_url && (
              <>
                <br />
                <a href={s.maps_url} target="_blank" rel="noopener">Buka di Google Maps</a>
              </>
            )}
          </div>
          <div>
            <b>Hubungi</b>
            <br />
            <a href={waLink(s.whatsapp)} target="_blank" rel="noopener">WhatsApp {s.whatsapp}</a>
            <br />
            <a href={telLink(s.phone)}>Telepon {s.phone}</a>
            <br />
            {s.phone_office && (
              <>
                <a href={telLink(s.phone_office)}>Kantor {s.phone_office}</a>
                <br />
              </>
            )}
            <a href={`mailto:${s.email}`}>{s.email}</a>
          </div>
          <div>
            <b>Produk &amp; layanan</b>
            <ul className="footer-links">
              <li><Link prefetch={false} href="/produk">Semua produk</Link></li>
              <li><Link prefetch={false} href="/pola-paving">Kalkulator pola paving</Link></li>
              <li><Link prefetch={false} href="/paket-proyek">Paket proyek</Link></li>
              <li><Link prefetch={false} href="/produk/jasa-pasang-paving">Jasa pasang paving</Link></li>
              <li><Link prefetch={false} href="/area-pengiriman">Area pengiriman</Link></li>
            </ul>
          </div>
          <div>
            <b>Informasi</b>
            <ul className="footer-links">
              <li><Link prefetch={false} href="/profil">Profil perusahaan</Link></li>
              <li><Link prefetch={false} href="/sertifikat-tkdn">Sertifikat TKDN</Link></li>
              <li><Link prefetch={false} href="/galeri">Galeri proyek</Link></li>
              <li><Link prefetch={false} href="/artikel">Artikel</Link></li>
              <li><Link prefetch={false} href="/kontak">Kontak &amp; lokasi</Link></li>
              <li><Link prefetch={false} href="/privacy-policy">Kebijakan privasi</Link></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="wrap">
            <span>© {year} {s.legal_name}</span>
            <span>Area kirim: {s.service_area}</span>
          </div>
        </div>
      </footer>
      <nav aria-label="Hubungi kami" className="mobile-bar">
        <a className="wa" href={waLink(s.whatsapp, "Halo Istana Block, saya mau minta penawaran.")} target="_blank" rel="noopener">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 0 1-13.2 7.9L3 21l1.2-4.6A9 9 0 1 1 21 12z" /></svg>
          Minta penawaran
        </a>
        <a className="tel" href={telLink(s.phone)}>Telepon</a>
      </nav>
    </>
  );
}
