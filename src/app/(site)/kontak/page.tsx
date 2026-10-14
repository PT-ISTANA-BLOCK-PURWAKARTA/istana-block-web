import type { Metadata } from "next";
import Link from "next/link";
import { Hex } from "@/components/Hex";
import { telLink, waLink } from "@/lib/format";
import { getSettings, isMapsEmbedUrl } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Kontak & Lokasi Pabrik",
  description: "Alamat pabrik, jam operasional, WhatsApp, dan telepon Istana Block Purwakarta.",
  alternates: { canonical: "/kontak" },
};

export default async function KontakPage() {
  const s = await getSettings();
  const rows = [
    { k: "Alamat pabrik", v: s.address },
    { k: "Jam operasional", v: s.hours },
    { k: "Area pengiriman", v: s.service_area },
  ];
  return (
    <div className="wrap section" style={{ paddingTop: 24 }}>
      <nav aria-label="Lokasi halaman" className="breadcrumb"><ol><li><Link href="/">Beranda</Link></li><li>Kontak</li></ol></nav>
      <div className="duo" style={{ paddingTop: 16 }}>
        <div className="panel" style={{ flex: "1 1 520px" }}>
          <h1 style={{ fontSize: "clamp(32px, 4vw, 46px)" }}>Kontak &amp; lokasi</h1>
          <dl className="specs" style={{ gridTemplateColumns: "1fr" }}>
            {rows.map((r) => (
              <div key={r.k} style={{ background: "var(--latar)" }}><dt>{r.k}</dt><dd>{r.v}</dd></div>
            ))}
          </dl>
          <div className="actions">
            <a className="btn btn-primary" href={waLink(s.whatsapp, "Halo Istana Block, saya mau bertanya.")} target="_blank" rel="noopener">WhatsApp {s.whatsapp}</a>
            <a className="btn btn-ghost" href={telLink(s.phone)}>Telepon {s.phone}</a>
          </div>
          {s.phone_office && <p>Telepon kantor: <a href={telLink(s.phone_office)}>{s.phone_office}</a></p>}
          <p>Email: <a href={`mailto:${s.email}`}>{s.email}</a></p>
          {s.maps_url && <a href={s.maps_url} target="_blank" rel="noopener" style={{ fontWeight: 600 }}>Buka lokasi di Google Maps →</a>}
        </div>
        {isMapsEmbedUrl(s.maps_embed_url) ? (
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
          <div className="panel hexpat-light" style={{ flex: "1 1 360px", background: "var(--biru-muda)", alignItems: "center", justifyContent: "center", minHeight: 320 }} aria-hidden="true">
            <div style={{ position: "relative", width: 260, height: 260 }}>
              <Hex size={150} color="#254186" style={{ position: "absolute", left: 55, top: 20 }} />
              <Hex size={80} color="#FE5722" style={{ position: "absolute", left: 0, top: 150, transform: "rotate(-8deg)" }} />
              <Hex size={64} color="#B5B4AF" style={{ position: "absolute", right: 0, top: 160, transform: "rotate(6deg)" }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
