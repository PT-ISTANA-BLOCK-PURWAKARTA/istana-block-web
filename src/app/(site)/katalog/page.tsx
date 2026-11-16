import type { Metadata } from "next";
import Link from "next/link";
import { CatalogCarousel, ORIGINAL_PDF_URL, type CatalogSlide } from "@/components/CatalogCarousel";
import { JsonLd } from "@/components/JsonLd";
import "@/components/katalog.css";
import katalogData from "@/data/katalog.json";
import wa from "@/data/wa-templates.json";
import { getEnv } from "@/db";
import { telLink, waLink } from "@/lib/format";
import { getSettings } from "@/lib/settings";

const SEO_TITLE = "Katalog Produk Beton SNI & TKDN";
const SEO_DESCRIPTION =
  "Lihat katalog resmi Istana Block Purwakarta (11 halaman): paving block, kanstin, U-Ditch, buis beton, gravel (greffel), genteng beton SNI, TKDN & jasa pasang.";

export const metadata: Metadata = {
  title: SEO_TITLE,
  description: SEO_DESCRIPTION,
  alternates: { canonical: "/katalog" },
  openGraph: {
    title: SEO_TITLE,
    description: SEO_DESCRIPTION,
    url: "/katalog",
    images: [
      {
        url: "/img/katalog/katalog-01.webp",
        width: 1100,
        height: 1556,
        alt: "Sampul Katalog Produk Beton Precast SNI & TKDN Istana Block Purwakarta",
      },
    ],
  },
};

type SlideRouteLink = { href: string; label: string };

const SLIDE_ROUTES: Record<number, SlideRouteLink[]> = {
  1: [
    { href: "/produk", label: "Semua produk & harga" },
    { href: "/sampel", label: "Minta sampel fisik" },
  ],
  2: [
    { href: "/profil", label: "Profil perusahaan" },
    { href: "/sertifikat-tkdn", label: "Sertifikat TKDN" },
  ],
  3: [
    { href: "/produk/paving-block", label: "Harga paving block" },
    { href: "/pola-paving", label: "Kalkulator pola paving" },
  ],
  4: [{ href: "/produk/jasa-pasang-paving", label: "Paket jasa pemasangan" }],
  5: [{ href: "/produk/kanstin", label: "Spesifikasi & jenis kanstin" }],
  6: [{ href: "/produk/buis-beton", label: "Daftar harga buis beton" }],
  7: [{ href: "/produk/greffel-beton", label: "Detail gravel (greffel) beton" }],
  8: [
    { href: "/galeri", label: "Galeri proyek lapangan" },
    { href: "/produk/buis-beton", label: "Detail buis beton" },
  ],
  9: [
    { href: "/produk/u-ditch", label: "Harga & ukuran U-Ditch" },
    { href: "/sertifikat-tkdn", label: "Sertifikat TKDN U-Ditch" },
  ],
  10: [{ href: "/produk/genteng-beton", label: "Harga genteng beton" }],
  11: [
    { href: "/produk/genteng-beton", label: "Detail aksesoris genteng" },
    { href: "/sampel", label: "Pesan sampel produk" },
  ],
};

const SLIDES: CatalogSlide[] = katalogData;

type Props = {
  searchParams: Promise<{ halaman?: string }>;
};

export default async function KatalogPage({ searchParams }: Props) {
  const [params, s, env] = await Promise.all([searchParams, getSettings(), getEnv()]);
  const base = env.SITE_URL;
  const pageUrl = `${base}/katalog`;

  const parsedPage = Number.parseInt(params.halaman ?? "", 10);
  const initialPage = Number.isFinite(parsedPage) && parsedPage >= 1 && parsedPage <= SLIDES.length ? parsedPage : 1;

  return (
    <div className="wrap section" style={{ paddingTop: 24 }}>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "DigitalDocument",
            "@id": `${pageUrl}#document`,
            name: "Katalog Produk & Layanan PT Istana Block Purwakarta",
            description: SEO_DESCRIPTION,
            url: pageUrl,
            inLanguage: "id-ID",
            encodingFormat: "application/pdf",
            numberOfPages: SLIDES.length,
            thumbnailUrl: `${base}/img/katalog/katalog-01-thumb.webp`,
            image: SLIDES.map((slide) => `${base}${slide.src}`),
            publisher: { "@id": `${base}/#business` },
            hasPart: SLIDES.map((slide) => ({
              "@type": "DigitalDocument",
              name: `Halaman ${slide.page}: ${slide.title}`,
              description: slide.summary,
              position: slide.page,
              image: `${base}${slide.src}`,
              url: `${pageUrl}?halaman=${slide.page}`,
            })),
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Beranda", item: base },
              { "@type": "ListItem", position: 2, name: "Katalog Produk", item: pageUrl },
            ],
          },
        ]}
      />

      <nav aria-label="Lokasi halaman" className="breadcrumb">
        <ol>
          <li>
            <Link href="/">Beranda</Link>
          </li>
          <li>Katalog Produk</li>
        </ol>
      </nav>

      <header className="katalog-hero">
        <div className="pills">
          <span className="pill pill-orange">11 Halaman · Katalog Interaktif</span>
          <span className="pill">Standar SNI &amp; TKDN Kemenperin</span>
          <span className="pill">Mutu {s.quality_label}</span>
        </div>

        <h1>Katalog Produk &amp; Layanan Istana Block</h1>

        <div className="katalog-intro">
          <p>
            Jelajahi seluruh 11 halaman katalog resmi <strong>{s.legal_name}</strong> langsung di peramban tanpa harus
            mengunduh berkas PDF berukuran 61 MB terlebih dahulu. Katalog ini merangkum lini produk beton pracetak
            berstandar SNI dari pabrik kami di Pasawahan, Purwakarta (berdiri sejak {s.founded_year}), mulai dari
            paving block Truepave, Hexagon, Fullpave 21/30, dan Grass Block, layanan jasa pemasangan paving bergaransi
            untuk area minimal 200 m², hingga kanstin jalan (KS, S, stopper ban, dan tali air).
          </p>
          <p>
            Untuk kebutuhan infrastruktur drainase dan atap, tersedia rincian dimensi buis beton Ø20×100 hingga
            Ø80×100 cm (tumbuk, cor, dan bertulang), saluran gravel (greffel) setengah lingkaran, dokumentasi pemasangan
            lapangan, saluran beton U-Ditch ukuran 30×30 sampai 80×80 cm dengan cover heavy duty dan light duty, serta
            genteng beton Flat dan Garuda lengkap dengan aksesoris nok, apex, triway, starter, dan lisplang. Produk
            unggulan kami telah mengantongi sertifikat TKDN resmi dari Kementerian Perindustrian ({s.tkdn_note}) dan
            dikirim menggunakan armada truk crane serta flatbed milik pabrik sendiri.
          </p>
        </div>

        <div className="katalog-quick-bar">
          <a className="btn btn-primary" href={waLink(s.whatsapp, wa.proyek)} target="_blank" rel="noopener">
            Minta Penawaran via WhatsApp
          </a>
          <Link className="btn btn-ghost" href="/sampel">
            Ajukan Sampel Produk
          </Link>
          <a className="btn btn-ghost" href={ORIGINAL_PDF_URL} target="_blank" rel="noopener noreferrer">
            Unduh PDF Asli (Google Drive)
          </a>
        </div>
      </header>

      <section className="katalog-viewer-sec" aria-label="Penampil katalog interaktif">
        <CatalogCarousel whatsapp={s.whatsapp} initialPage={initialPage} />
      </section>

      <section className="katalog-index-sec" aria-labelledby="indeks-halaman">
        <div className="section-head" style={{ marginBottom: 20 }}>
          <div>
            <h2 id="indeks-halaman" style={{ fontSize: "clamp(26px, 3vw, 36px)" }}>
              Daftar Isi 11 Halaman Katalog
            </h2>
            <p className="muted" style={{ marginTop: 6 }}>
              Klik halaman untuk melompat langsung di penampil katalog, atau buka halaman produk untuk melihat daftar
              harga dan tabel ukuran lengkap.
            </p>
          </div>
          <Link className="btn btn-ghost btn-sm" href="/pola-paving">
            Buka Kalkulator Pola Paving
          </Link>
        </div>

        <div className="katalog-index-grid">
          {SLIDES.map((slide) => {
            const links = SLIDE_ROUTES[slide.page] ?? [];
            return (
              <article key={slide.page} className="katalog-page-card" id={`halaman-${slide.page}`}>
                <Link
                  href={`/katalog?halaman=${slide.page}#katalog-viewer`}
                  className="katalog-page-thumb"
                  aria-label={`Buka halaman ${slide.page} di penampil katalog: ${slide.title}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={slide.thumb}
                    alt={`Pratinjau halaman ${slide.page}: ${slide.title}`}
                    width={160}
                    height={226}
                    loading="lazy"
                    decoding="async"
                  />
                </Link>

                <div className="katalog-page-info">
                  <span className="katalog-page-num">Hal. {String(slide.page).padStart(2, "0")}</span>
                  <h3>{slide.title}</h3>
                  <p>{slide.summary}</p>

                  <div className="katalog-page-links">
                    <Link href={`/katalog?halaman=${slide.page}#katalog-viewer`}>Lihat di katalog</Link>
                    {links.map((l) => (
                      <Link key={`${slide.page}-${l.href}-${l.label}`} href={l.href}>
                        {l.label} →
                      </Link>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="duo" style={{ paddingTop: 8 }}>
        <div className="panel" style={{ flex: "1 1 460px" }}>
          <h2>Dokumen Tender, Sampel Fisik &amp; Konsultasi</h2>
          <p style={{ color: "var(--teks)" }}>
            Kontraktor dan bagian pengadaan dapat menggabungkan kebutuhan paving block, kanstin, U-Ditch, buis beton,
            gravel (greffel), dan genteng beton dalam satu surat penawaran resmi lengkap dengan salinan sertifikat TKDN
            Kemenperin serta jadwal pengiriman armada pabrik.
          </p>
          <ul className="bullets">
            <li>
              <Link href="/paket-proyek">Lihat Paket Material Proyek &amp; Harga Acuan</Link>
            </li>
            <li>
              <Link href="/sertifikat-tkdn">Rincian Sertifikat TKDN Kemenperin (91,58% · 78,61% · 100%)</Link>
            </li>
            <li>
              <Link href="/sampel">Ajukan Sampel Fisik Material Sebelum PO</Link>
            </li>
            <li>
              <Link href="/area-pengiriman">Cek Jangkauan Armada Purwakarta, Jawa Barat &amp; Jabodetabek</Link>
            </li>
          </ul>
        </div>

        <aside className="cta-aside hexpat" style={{ flex: "1 1 340px", minWidth: 0 }}>
          <h2>Butuh Penawaran Resmi dari Katalog?</h2>
          <p>
            Sebutkan jenis produk, ukuran atau ketebalan, perkiraan volume, serta lokasi proyek. Admin mengirim
            penawaran harga pabrik + ongkir tertulis pada jam kerja ({s.hours}).
          </p>
          <a
            className="btn btn-primary"
            style={{ alignSelf: "flex-start" }}
            href={waLink(s.whatsapp, wa.proyek)}
            target="_blank"
            rel="noopener"
          >
            WhatsApp {s.whatsapp}
          </a>
          <a href={telLink(s.phone)}>atau telepon {s.phone}</a>
        </aside>
      </section>
    </div>
  );
}
