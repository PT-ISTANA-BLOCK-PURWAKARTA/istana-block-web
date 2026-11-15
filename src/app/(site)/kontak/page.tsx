import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { OrderStepsIllustration, PrepChecklistIllustration } from "@/components/KontakIllustrations";
import area from "@/data/area.json";
import { getEnv } from "@/db";
import { telLink, waLink } from "@/lib/format";
import { getSettings, isMapsEmbedUrl } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Kontak & Lokasi Pabrik",
  description: "Alamat pabrik Istana Block di Purwakarta, jam operasional, nomor WhatsApp dan telepon, serta petunjuk lokasi lewat Google Maps.",
  alternates: { canonical: "/kontak" },
};

export default async function KontakPage() {
  const [s, env] = await Promise.all([getSettings(), getEnv()]);
  const hasEmbed = isMapsEmbedUrl(s.maps_embed_url);
  const sameAsMaps = s.same_as
    .split(/\r?\n/)
    .map((u) => u.trim())
    .find((u) => /maps\.google\.|google\.com\/maps|goo\.gl\/maps/i.test(u));
  const mapsHref =
    s.maps_url ||
    sameAsMaps ||
    (s.geo_lat && s.geo_lng
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${s.geo_lat},${s.geo_lng}`)}`
      : "");
  const pageUrl = `${env.SITE_URL}/kontak`;
  const rows = [
    // Alamat jadi tautan peta: pembeli yang mau datang ke pabrik langsung dapat petunjuk arah.
    { k: "Alamat pabrik", v: s.address, href: mapsHref || undefined },
    { k: "Jam operasional", v: s.hours },
    { k: "Area pengiriman", v: s.service_area },
  ];
  return (
    <div className="wrap section" style={{ paddingTop: 24 }}>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "ContactPage",
            name: `Kontak & Lokasi ${s.company_name}`,
            url: pageUrl,
            inLanguage: "id-ID",
            about: { "@id": `${env.SITE_URL}/#business` },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Beranda", item: env.SITE_URL },
              { "@type": "ListItem", position: 2, name: "Kontak", item: pageUrl },
            ],
          },
        ]}
      />
      <nav aria-label="Lokasi halaman" className="breadcrumb"><ol><li><Link href="/">Beranda</Link></li><li>Kontak</li></ol></nav>
      <div className="duo" style={{ paddingTop: 16 }}>
        <div className="panel" style={{ flex: "1 1 520px" }}>
          <h1 style={{ fontSize: "clamp(32px, 4vw, 46px)" }}>Kontak &amp; lokasi</h1>
          <dl className="specs" style={{ gridTemplateColumns: "1fr" }}>
            {rows.map((r) => (
              <div key={r.k} style={{ background: "var(--latar)" }}><dt>{r.k}</dt><dd>{r.href ? <a href={r.href} target="_blank" rel="noopener">{r.v}</a> : r.v}</dd></div>
            ))}
          </dl>
          <div className="actions">
            <a className="btn btn-primary" href={waLink(s.whatsapp, "Halo Istana Block, saya mau bertanya.")} target="_blank" rel="noopener">WhatsApp {s.whatsapp}</a>
            <a className="btn btn-ghost" href={telLink(s.phone)}>Telepon {s.phone}</a>
          </div>
          {s.phone_office && <p>Telepon kantor: <a href={telLink(s.phone_office)}>{s.phone_office}</a></p>}
          <p>Email: <a href={`mailto:${s.email}`}>{s.email}</a></p>
          {hasEmbed && mapsHref && <a href={mapsHref} target="_blank" rel="noopener" style={{ fontWeight: 600 }}>Buka lokasi di Google Maps →</a>}
        </div>
        {hasEmbed ? (
          <div className="map-embed">
            <iframe
              src={s.maps_embed_url}
              title={`Peta lokasi pabrik ${s.company_name} di Google Maps`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        ) : (
          // Tanpa URL embed: panel identitas pabrik terstruktur + tautan Google Maps yang menonjol.
          <div className="panel hexpat-light kontak-identity" style={{ flex: "1 1 360px" }}>
            <div className="kontak-id-card">
              <div className="kontak-id-head">
                <img
                  src="/brand/logo-istana-block.webp"
                  srcSet="/brand/logo-istana-block-300.webp 300w, /brand/logo-istana-block.webp 501w"
                  sizes="(max-width: 600px) 140px, 168px"
                  alt={s.company_name || "Logo PT Istana Block Purwakarta"}
                  width={168}
                  height={50}
                  className="kontak-id-logo"
                />
                <span className="kontak-id-pill">
                  Pabrik Resmi{s.founded_year ? ` · Sejak ${s.founded_year}` : ""}
                </span>
              </div>
              <div className="kontak-id-title">
                <h2>{s.legal_name || "PT Istana Block Purwakarta"}</h2>
                <p>
                  Pabrik Paving Block &amp; Beton Precast
                  {s.quality_label ? ` · Mutu ${s.quality_label}` : ""}
                </p>
              </div>
              <div className="kontak-id-badges">
                <span className="kontak-badge">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 21s-6-5.2-6-11a6 6 0 1 1 12 0c0 5.8-6 11-6 11Z" />
                    <circle cx="12" cy="10" r="2.3" />
                  </svg>
                  <span>Pasawahan, Purwakarta</span>
                </span>
                {s.hours && (
                  <span className="kontak-badge">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7.5V12l3 2" />
                    </svg>
                    <span>{s.hours}</span>
                  </span>
                )}
              </div>
              <p className="kontak-id-addr">{s.address}</p>
            </div>
            {mapsHref && (
              <a className="btn btn-primary kontak-maps-btn" href={mapsHref} target="_blank" rel="noopener">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 21s-6-5.2-6-11a6 6 0 1 1 12 0c0 5.8-6 11-6 11Z" />
                  <circle cx="12" cy="10" r="2.2" />
                </svg>
                Buka di Google Maps
              </a>
            )}
          </div>
        )}
      </div>
      <section className="duo" style={{ paddingTop: 24 }} aria-label="Cara menghubungi dan memesan">
        <div className="panel" style={{ flex: "1 1 420px" }}>
          <h2>Yang perlu disiapkan saat menghubungi</h2>
          <div className="kontak-illust">
            <PrepChecklistIllustration />
          </div>
          <p>Admin menjawab lewat WhatsApp dan telepon pada jam operasional. Supaya penawaran bisa langsung dibuat, sebutkan keterangan berikut:</p>
          <ul className="bullets">
            <li>Produk yang dibutuhkan: paving block, U-Ditch, buis beton, kanstin, atau genteng beton.</li>
            <li>Ukuran, tebal, atau warna yang diinginkan.</li>
            <li>Perkiraan jumlah dalam m², pcs, atau meter.</li>
            <li>Alamat lengkap atau titik lokasi di peta, beserta kondisi akses truk di lokasi bongkar.</li>
          </ul>
          {s.payment_terms && <p>Syarat pembayaran: {s.payment_terms}</p>}
        </div>
        <div className="panel" style={{ flex: "1 1 420px" }}>
          <h2>Cara memesan</h2>
          <div className="kontak-illust">
            <OrderStepsIllustration />
          </div>
          <ol className="bullets">{area.langkah.map((x) => <li key={x}>{x}</li>)}</ol>
          <p>Ingin melihat pabrik? Hubungi admin lebih dulu agar kunjungan bisa dijadwalkan.{s.hours && ` Pabrik buka ${s.hours}.`}</p>
        </div>
      </section>
    </div>
  );
}
