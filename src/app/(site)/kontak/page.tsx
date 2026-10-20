import type { Metadata } from "next";
import Link from "next/link";
import { Hex } from "@/components/Hex";
import area from "@/data/area.json";
import { telLink, waLink } from "@/lib/format";
import { getSettings, isMapsEmbedUrl } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Kontak & Lokasi Pabrik",
  description: "Alamat pabrik, jam operasional, WhatsApp, dan telepon Istana Block Purwakarta.",
  alternates: { canonical: "/kontak" },
};

export default async function KontakPage() {
  const s = await getSettings();
  const hasEmbed = isMapsEmbedUrl(s.maps_embed_url);
  const rows = [
    // Alamat jadi tautan peta: pembeli yang mau datang ke pabrik langsung dapat petunjuk arah.
    { k: "Alamat pabrik", v: s.address, href: s.maps_url },
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
              <div key={r.k} style={{ background: "var(--latar)" }}><dt>{r.k}</dt><dd>{r.href ? <a href={r.href} target="_blank" rel="noopener">{r.v}</a> : r.v}</dd></div>
            ))}
          </dl>
          <div className="actions">
            <a className="btn btn-primary" href={waLink(s.whatsapp, "Halo Istana Block, saya mau bertanya.")} target="_blank" rel="noopener">WhatsApp {s.whatsapp}</a>
            <a className="btn btn-ghost" href={telLink(s.phone)}>Telepon {s.phone}</a>
          </div>
          {s.phone_office && <p>Telepon kantor: <a href={telLink(s.phone_office)}>{s.phone_office}</a></p>}
          <p>Email: <a href={`mailto:${s.email}`}>{s.email}</a></p>
          {hasEmbed && s.maps_url && <a href={s.maps_url} target="_blank" rel="noopener" style={{ fontWeight: 600 }}>Buka lokasi di Google Maps →</a>}
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
          // Tanpa URL embed: dekorasi diganti tautan peta yang menonjol (URL embed tidak dikarang dari tautan biasa).
          <div className="panel hexpat-light" style={{ flex: "1 1 360px", background: "var(--biru-muda)", alignItems: "center", justifyContent: "center", minHeight: 320 }}>
            <div style={{ position: "relative", width: 260, height: 260 }} aria-hidden="true">
              <Hex size={150} color="#254186" style={{ position: "absolute", left: 55, top: 20 }} />
              <Hex size={80} color="#FE5722" style={{ position: "absolute", left: 0, top: 150, transform: "rotate(-8deg)" }} />
              <Hex size={64} color="#B5B4AF" style={{ position: "absolute", right: 0, top: 160, transform: "rotate(6deg)" }} />
            </div>
            {s.maps_url && <a className="btn btn-primary" href={s.maps_url} target="_blank" rel="noopener">Buka di Google Maps</a>}
          </div>
        )}
      </div>
      <section className="duo" style={{ paddingTop: 24 }} aria-label="Cara menghubungi dan memesan">
        <div className="panel" style={{ flex: "1 1 420px" }}>
          <h2>Yang perlu disiapkan saat menghubungi</h2>
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
          <ol className="bullets">{area.langkah.map((x) => <li key={x}>{x}</li>)}</ol>
          <p>Ingin melihat pabrik? Hubungi admin lebih dulu agar kunjungan bisa dijadwalkan.{s.hours && ` Pabrik buka ${s.hours}.`}</p>
        </div>
      </section>
    </div>
  );
}
