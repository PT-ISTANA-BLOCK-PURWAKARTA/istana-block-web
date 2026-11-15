import type { Metadata } from "next";
import Link from "next/link";
import { ClientLogos } from "@/components/ClientLogos";
import { FaqList } from "@/components/FaqList";
import { Hex } from "@/components/Hex";
import { JsonLd } from "@/components/JsonLd";
import { AlurProyekDiagram, PaketSatuPintuDiagram } from "@/components/PaketProyekDiagrams";
import paket from "@/data/paket-proyek.json";
import wa from "@/data/wa-templates.json";
import { getEnv } from "@/db";
import { priceLabel, waLink } from "@/lib/format";
import { listProducts } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import "./paket.css";

export const metadata: Metadata = {
  title: "Paket Material Proyek & TKDN",
  description:
    "Paving block, kanstin, U-Ditch, buis, dan genteng beton dalam satu penawaran tertulis. Harga acuan pabrik, sertifikat TKDN, dan armada sendiri.",
  alternates: { canonical: "/paket-proyek" },
};

export default async function PaketProyekPage() {
  const [s, env, products] = await Promise.all([getSettings(), getEnv(), listProducts()]);
  const materials = products.filter((p) => p.category !== "Jasa");
  const jasa = products.find((p) => p.category === "Jasa");
  const pageUrl = `${env.SITE_URL}/paket-proyek`;

  const findTkdn = (slug: string, fallback: string) =>
    products.find((p) => p.slug === slug)?.tkdn ?? fallback;
  const tkdnValues = {
    paving: findTkdn("paving-block", "91,58"),
    uditch: findTkdn("u-ditch", "78,61"),
    buis: findTkdn("buis-beton", "100"),
  };

  return (
    <div className="wrap paket-page">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            "@id": pageUrl,
            url: pageUrl,
            name: "Paket Material Proyek & TKDN | Istana Block Purwakarta",
            description:
              "Paving block, kanstin, U-Ditch, buis beton, dan genteng beton dalam satu penawaran tertulis. Harga acuan pabrik, sertifikat TKDN Kemenperin, dan armada sendiri.",
            inLanguage: "id-ID",
            isPartOf: { "@type": "WebSite", url: env.SITE_URL, name: s.company_name },
            about: { "@id": `${env.SITE_URL}/#business` },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Beranda", item: env.SITE_URL },
              { "@type": "ListItem", position: 2, name: "Paket proyek", item: pageUrl },
            ],
          },
        ]}
      />

      <nav aria-label="Lokasi halaman" className="breadcrumb">
        <ol>
          <li>
            <Link href="/">Beranda</Link>
          </li>
          <li>Paket proyek</li>
        </ol>
      </nav>

      {/* Hero + Ringkasan Pengadaan */}
      <header className="paket-hero">
        <div className="paket-hero-copy">
          <span className="paket-eyebrow">
            <span className="paket-eyebrow-dot" aria-hidden="true" />
            Kontraktor &amp; pengadaan · Pabrik sejak {s.founded_year}
          </span>
          <h1>Paket material proyek</h1>
          <p className="hero-lead">{paket.intro}</p>
          <div className="actions">
            <a className="btn btn-primary" href={waLink(s.whatsapp, wa.proyek)} target="_blank" rel="noopener">
              Minta penawaran proyek
            </a>
            <a className="btn btn-ghost" href="#harga">
              Lihat harga acuan
            </a>
          </div>
        </div>

        <aside className="paket-kpi-panel" aria-label="Ringkasan spesifikasi pengadaan">
          <div className="paket-kpi-head">
            <span>Kesiapan Pengadaan</span>
            <span>Pasawahan, Purwakarta</span>
          </div>
          <div className="paket-kpi-cell">
            <span className="paket-kpi-label">Skema Order</span>
            <strong className="paket-kpi-val">1 Pintu</strong>
            <span className="paket-kpi-sub">1 penawaran tertulis &amp; 1 PIC</span>
          </div>
          <div className="paket-kpi-cell">
            <span className="paket-kpi-label">Mutu Beton</span>
            <strong className="paket-kpi-val">{s.quality_label}</strong>
            <span className="paket-kpi-sub">Precast pabrik berstandar SNI</span>
          </div>
          <div className="paket-kpi-cell">
            <span className="paket-kpi-label">TKDN Kemenperin</span>
            <strong className="paket-kpi-val">78,61%–100%</strong>
            <span className="paket-kpi-sub">Paving, U-Ditch &amp; buis beton</span>
          </div>
          <div className="paket-kpi-cell">
            <span className="paket-kpi-label">Armada Pabrik</span>
            <strong className="paket-kpi-val">Crane &amp; Flatbed</strong>
            <span className="paket-kpi-sub">Kirim langsung tanpa perantara</span>
          </div>
        </aside>
      </header>

      {/* Diagram 1: Arsitektur Pengadaan 1 Pintu */}
      <section className="paket-section" aria-labelledby="arsitektur-proyek-title">
        <div className="paket-sec-head">
          <div className="paket-sec-head-text">
            <span className="paket-sec-kicker">Arsitektur 1 pintu</span>
            <h2 id="arsitektur-proyek-title">Semua material sipil proyek dalam satu jadwal</h2>
            <p>
              Dari perkerasan akses, saluran drainase, sampai atap beton diproses dalam satu penawaran tertulis dan satu jadwal armada pabrik.
            </p>
          </div>
        </div>
        <PaketSatuPintuDiagram tkdn={tkdnValues} />
      </section>

      {/* Diagram 2: Alur Pemesanan 5 Langkah */}
      <section className="paket-section" aria-labelledby="alur-proyek-title">
        <div className="paket-sec-head">
          <div className="paket-sec-head-text">
            <span className="paket-sec-kicker">Proses pengadaan</span>
            <h2 id="alur-proyek-title">Alur pemesanan dari BoQ ke lokasi</h2>
            <p>
              Tahapan pemesanan terstruktur dari pengiriman BoQ lewat WhatsApp hingga pelunasan saat armada pabrik tiba di proyek.
            </p>
          </div>
        </div>
        <AlurProyekDiagram langkah={paket.langkah} />
      </section>

      {/* Keunggulan 1 Pintu (Kartu Gestalt) + Highlight TKDN & Katalog */}
      <section id="keunggulan" className="paket-section" aria-labelledby="keunggulan-title">
        <div className="paket-sec-head">
          <div className="paket-sec-head-text">
            <span className="paket-sec-kicker">Keunggulan satu pintu</span>
            <h2 id="keunggulan-title">Efisiensi tender &amp; logistik lapangan</h2>
            <p>
              Satu kontrak pabrik untuk mengurangi risiko keterlambatan antar-vendor sekaligus mempermudah verifikasi dokumen TKDN.
            </p>
          </div>
        </div>

        <div className="paket-keunggulan-grid">
          <div className="paket-benefit-cards">
            <article className="paket-benefit-card">
              <span className="paket-card-cat">
                <Hex size={12} color="#fe5722" />
                Administrasi
              </span>
              <h3>Satu penawaran &amp; satu kontak</h3>
              <p>{paket.manfaat[0]}</p>
              <a className="paket-card-link" href={waLink(s.whatsapp, wa.proyek)} target="_blank" rel="noopener">
                Minta penawaran tertulis →
              </a>
            </article>

            <article className="paket-benefit-card">
              <span className="paket-card-cat">
                <Hex size={12} color="#254186" />
                Logistik pabrik
              </span>
              <h3>Satu jadwal armada sendiri</h3>
              <p>{paket.manfaat[1]}</p>
              <Link className="paket-card-link" href="/area-pengiriman">
                Cek jangkauan armada →
              </Link>
            </article>

            <article className="paket-benefit-card">
              <span className="paket-card-cat">
                <Hex size={12} color="#0e2a6b" />
                Perencanaan RAB
              </span>
              <h3>Harga acuan terbuka di situs</h3>
              <p>{paket.manfaat[3]}</p>
              <a className="paket-card-link" href="#harga">
                Lihat harga acuan pabrik →
              </a>
            </article>

            <article className="paket-benefit-card">
              <span className="paket-card-cat">
                <Hex size={12} color="#b5b4af" />
                Layanan lapangan
              </span>
              <h3>Jasa pasang &amp; survei gratis</h3>
              <p>{paket.manfaat[4]}</p>
              <Link className="paket-card-link" href="/produk/jasa-pasang-paving">
                Detail jasa pasang paving →
              </Link>
            </article>
          </div>

          <aside className="paket-tkdn-card" aria-labelledby="tkdn-card-title">
            <div className="paket-tkdn-head">
              <span className="paket-card-cat">
                <Hex size={13} color="#fe5722" />
                Dokumen tender Kemenperin
              </span>
              <h3 id="tkdn-card-title">Sertifikat TKDN &amp; katalog resmi</h3>
              <p className="small muted">{paket.manfaat[2]}</p>
            </div>

            <div className="paket-tkdn-list">
              <Link href="/sertifikat-tkdn" className="paket-tkdn-row">
                <div className="paket-tkdn-name">
                  <strong>Paving Block</strong>
                  <span>Mutu K-350–K-450 · Tebal 6 &amp; 8 cm</span>
                </div>
                <span className="paket-tkdn-badge is-paving">{tkdnValues.paving}%</span>
              </Link>
              <Link href="/sertifikat-tkdn" className="paket-tkdn-row">
                <div className="paket-tkdn-name">
                  <strong>U-Ditch Beton</strong>
                  <span>Ukuran 30×30 s.d. 80×80 cm · K-350</span>
                </div>
                <span className="paket-tkdn-badge is-uditch">{tkdnValues.uditch}%</span>
              </Link>
              <Link href="/sertifikat-tkdn" className="paket-tkdn-row">
                <div className="paket-tkdn-name">
                  <strong>Buis Beton Tanpa Tulangan</strong>
                  <span>Diameter 20–80 cm · Tumbuk &amp; cor</span>
                </div>
                <span className="paket-tkdn-badge is-buis">{tkdnValues.buis}%</span>
              </Link>
            </div>

            <p className="paket-tkdn-note">{s.tkdn_note}</p>

            <div className="paket-tkdn-actions">
              <Link href="/sertifikat-tkdn" className="btn btn-blue btn-sm">
                Detail sertifikat TKDN →
              </Link>
              <Link href="/katalog" className="btn btn-ghost btn-sm">
                Buka katalog produk →
              </Link>
            </div>
          </aside>
        </div>
      </section>

      {/* Tabel Harga Acuan Pabrik (#harga & #harga-acuan) */}
      <section id="harga" className="paket-section paket-anchor" aria-labelledby="harga-acuan-title">
        <div id="harga-acuan" className="paket-sec-head paket-anchor">
          <div className="paket-sec-head-text">
            <span className="paket-sec-kicker">Acuan penyusunan RAB</span>
            <h2 id="harga-acuan-title">Harga acuan pabrik</h2>
            <p>Belum termasuk ongkir. Rincian ukuran, berat, dan mutu tersedia di halaman tiap produk.</p>
          </div>
          <Link href="/katalog" className="btn btn-ghost btn-sm">
            Lihat katalog lengkap →
          </Link>
        </div>

        <div className="table-card">
          <table className="price-ref">
            <caption className="sr-only">Harga acuan per produk</caption>
            <thead>
              <tr>
                <th scope="col">Produk</th>
                <th scope="col">Harga</th>
                <th scope="col">TKDN</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/produk/${p.slug}`}>{p.name}</Link>
                    <div className="small muted">{p.summary.split(".")[0]}.</div>
                  </td>
                  <td className="tabular" style={{ whiteSpace: "nowrap" }}>
                    {priceLabel(p)}
                  </td>
                  <td className="tabular">
                    {p.tkdn ? <b>{p.tkdn}%</b> : <span className="muted">—</span>}
                  </td>
                </tr>
              ))}
              {jasa && (
                <tr>
                  <td>
                    <Link href={`/produk/${jasa.slug}`}>{jasa.name}</Link>
                    <div className="small muted">{jasa.summary.split(".")[0]}.</div>
                  </td>
                  <td className="tabular" style={{ whiteSpace: "nowrap" }}>
                    {priceLabel(jasa)}
                  </td>
                  <td>
                    <span className="muted">—</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="paket-price-foot">
          <p className="small muted">{s.tkdn_note}</p>
          <div className="paket-price-links">
            <Link href="/sertifikat-tkdn">Detail sertifikat TKDN →</Link>
            <Link href="/katalog">Buka katalog produk →</Link>
          </div>
        </div>
      </section>

      {/* Strip Klien */}
      <section className="paket-section" aria-label="Klien proyek">
        <ClientLogos />
      </section>

      {/* Syarat & Ketentuan (Gestalt Rules) + CTA Kirim BoQ */}
      <section id="syarat" className="paket-section" aria-labelledby="syarat-title">
        <div className="paket-syarat-layout">
          <div className="paket-syarat-card">
            <div className="paket-sec-head" style={{ marginBottom: 4 }}>
              <div className="paket-sec-head-text">
                <span className="paket-sec-kicker">Ketentuan pengadaan</span>
                <h2 id="syarat-title">Syarat &amp; ketentuan proyek</h2>
              </div>
            </div>

            <div className="paket-syarat-list">
              <div className="paket-syarat-group">
                <div className="paket-syarat-meta">
                  <span className="paket-syarat-code">01 · Pembayaran</span>
                  <h3>Termin PO &amp; pelunasan</h3>
                </div>
                <div className="paket-syarat-body">
                  <p>{paket.syarat[0]}</p>
                  <div className="paket-syarat-tags">
                    <span className="paket-rule-chip">DP saat PO</span>
                    <span className="paket-rule-chip">Pelunasan saat tiba</span>
                  </div>
                </div>
              </div>

              <div className="paket-syarat-group">
                <div className="paket-syarat-meta">
                  <span className="paket-syarat-code">02 · Harga &amp; Ongkir</span>
                  <h3>Acuan situs vs penawaran</h3>
                </div>
                <div className="paket-syarat-body">
                  <p>{paket.syarat[1]}</p>
                  <div className="paket-syarat-tags">
                    <span className="paket-rule-chip">Harga pabrik belum ongkir</span>
                    <span className="paket-rule-chip">Mengikat di penawaran tertulis</span>
                  </div>
                </div>
              </div>

              <div className="paket-syarat-group">
                <div className="paket-syarat-meta">
                  <span className="paket-syarat-code">03 · Jabodetabek</span>
                  <h3>Minimal order proyek</h3>
                </div>
                <div className="paket-syarat-body">
                  <p>{paket.syarat[2]}</p>
                  <div className="paket-syarat-tags">
                    <Link href="/area-pengiriman" className="paket-rule-chip">
                      Cek wilayah kirim →
                    </Link>
                  </div>
                </div>
              </div>

              <div className="paket-syarat-group">
                <div className="paket-syarat-meta">
                  <span className="paket-syarat-code">04 · Jasa Pasang</span>
                  <h3>Luas &amp; kesiapan lahan</h3>
                </div>
                <div className="paket-syarat-body">
                  <p>{paket.syarat[3]}</p>
                  <p className="small muted">{paket.syarat[4]}</p>
                  <div className="paket-syarat-tags">
                    <span className="paket-rule-chip">Minimal 200 m²</span>
                    <span className="paket-rule-chip">Survei lokasi gratis</span>
                    <span className="paket-rule-chip">Galian &amp; stamper &lt; 200 m² terpisah</span>
                  </div>
                </div>
              </div>

              <div className="paket-syarat-group">
                <div className="paket-syarat-meta">
                  <span className="paket-syarat-code">05 · Tender TKDN</span>
                  <h3>Salinan dokumen resmi</h3>
                </div>
                <div className="paket-syarat-body">
                  <p>{paket.syarat[5]}</p>
                  <div className="paket-syarat-tags">
                    <Link href="/sertifikat-tkdn" className="paket-rule-chip">
                      Sertifikat TKDN →
                    </Link>
                    <Link href="/katalog" className="paket-rule-chip">
                      Katalog produk →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside className="cta-aside hexpat paket-cta-box">
            <h2>Kirim BoQ atau daftar kebutuhan</h2>
            <p>
              Penawaran tertulis berisi harga, ongkir, dan jadwal kirim. Salinan sertifikat TKDN tersedia untuk dokumen tender.
            </p>
            <a className="btn btn-primary" href={waLink(s.whatsapp, wa.proyek)} target="_blank" rel="noopener">
              WhatsApp {s.whatsapp}
            </a>
            <a href={waLink(s.whatsapp, wa.jabodetabek)} target="_blank" rel="noopener">
              Proyek di Jabodetabek? Tanya minimal order →
            </a>
            <div className="paket-cta-links">
              <Link href="/katalog">Buka katalog produk →</Link>
              <Link href="/sertifikat-tkdn">Detail sertifikat TKDN →</Link>
            </div>
          </aside>
        </div>
      </section>

      {/* FAQ Proyek (memancarkan JSON-LD FAQPage) */}
      <section className="paket-section" aria-labelledby="faq-proyek-title">
        <div className="paket-sec-head">
          <div className="paket-sec-head-text">
            <span className="paket-sec-kicker">Tanya jawab pengadaan</span>
            <h2 id="faq-proyek-title">Pertanyaan umum</h2>
          </div>
        </div>
        <FaqList items={paket.faq} />
      </section>
    </div>
  );
}
