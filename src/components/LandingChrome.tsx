import { HexDivider } from "./HexDivider";
import type { Settings } from "@/lib/settings";
import { telLink, waLink } from "@/lib/format";

export function LandingHeader({ s, waHref }: { s: Settings; waHref: string }) {
  return (
    <header className="site-header landing-header" id="top">
      <a href="#isi" className="skip-link">Langsung ke isi</a>
      <div className="wrap landing-header-wrap">
        <a href="#top" className="brand" aria-label={`${s.company_name}, kembali ke atas`}>
          <img
            src="/brand/logo-istana-block.webp"
            srcSet="/brand/logo-istana-block-300.webp 300w, /brand/logo-istana-block.webp 501w"
            sizes="147px"
            alt="Istana Block Purwakarta"
            width={147}
            height={44}
            className="brand-logo"
          />
        </a>
        <div className="landing-header-action">
          <a
            className="btn btn-primary btn-sm landing-cta-btn"
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            Penawaran
          </a>
        </div>
      </div>
    </header>
  );
}

export function LandingFooter({ s }: { s: Settings }) {
  const year = new Date().getFullYear();
  const telHref = telLink(s.phone);

  return (
    <>
      <div style={{ marginTop: 40 }}>
        <HexDivider seed={11} />
      </div>
      <footer className="site-footer hexpat landing-footer" id="kontak">
        <div className="wrap landing-footer-wrap">
          <div className="footer-brand">
            <img
              src="/brand/logo-istana-block-putih.webp"
              srcSet="/brand/logo-istana-block-putih-300.webp 300w, /brand/logo-istana-block-putih.webp 501w"
              sizes="174px"
              alt="Istana Block Purwakarta"
              width={174}
              height={52}
            />
            <p style={{ marginTop: 12 }}>
              {s.legal_name} · sejak {s.founded_year}. Pabrik paving block, U-Ditch, buis beton, kanstin, dan genteng beton bersertifikat TKDN Kemenperin.
            </p>
          </div>
          <div>
            <b>Pabrik &amp; Workshop</b>
            <br />
            {s.address}
            <br />
            {s.hours}
            {s.maps_url && (
              <>
                <br />
                <a href={s.maps_url} target="_blank" rel="noopener noreferrer">Buka di Google Maps</a>
              </>
            )}
          </div>
          <div>
            <b>Layanan Penawaran Proyek</b>
            <br />
            <a href={waLink(s.whatsapp)} target="_blank" rel="noopener noreferrer">WhatsApp {s.whatsapp}</a>
            <br />
            <a href={telHref}>Telepon {s.phone}</a>
            <br />
            {s.phone_office && (
              <>
                <a href={telLink(s.phone_office)}>Kantor {s.phone_office}</a>
                <br />
              </>
            )}
            <a href={`mailto:${s.email}`}>{s.email}</a>
          </div>
        </div>
        <div className="wrap landing-footer-bottom">
          <p className="small">
            © {year} {s.legal_name}. Seluruh hak cipta dilindungi undang-undang. Penawaran harga resmi berlaku sesuai dokumen tertulis dari pabrik.
          </p>
        </div>
      </footer>
    </>
  );
}

export function LandingStickyBar({
  priceLabel,
  waHref,
  productName,
}: {
  priceLabel?: string;
  waHref: string;
  productName: string;
}) {
  return (
    <aside className="landing-sticky-bar" aria-label="Aksi Cepat Penawaran">
      <div className="landing-sticky-inner">
        {priceLabel && (
          <div className="landing-sticky-info">
            <span className="landing-sticky-label">Harga acuan:</span>
            <b className="landing-sticky-price">{priceLabel}</b>
          </div>
        )}
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary landing-sticky-btn"
        >
          Minta Penawaran WA
        </a>
      </div>
    </aside>
  );
}
