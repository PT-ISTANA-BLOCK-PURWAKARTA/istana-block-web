import "./sampel.css";
import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { SampelExplorer } from "@/components/SampelExplorer";
import {
  DEFAULT_SELECTION,
  getProductImage,
  SAMPEL_PRODUCTS,
} from "@/data/sampel";
import { getEnv } from "@/db";
import { telLink, waLink } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { fitTitle } from "@/lib/title";

const TITLE = "Katalog Sampel & Spesifikasi Produk";
const DESCRIPTION =
  "Cek foto, ukuran, mutu, TKDN & hitung kebutuhan paving block, U-Ditch, buis beton, gravel (greffel), kanstin, serta genteng beton Istana Block Purwakarta.";
const OG_IMAGE = "/img/sampel/paving-block-truepave-istana-block-tkdn-o.webp";

export const metadata: Metadata = {
  title: fitTitle(TITLE),
  description: DESCRIPTION,
  alternates: { canonical: "/sampel" },
  openGraph: {
    title: `${TITLE} | Istana Block Purwakarta`,
    description: DESCRIPTION,
    url: "/sampel",
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 1200,
        alt: "Katalog Sampel Paving Block dan Beton Precast Istana Block Purwakarta",
      },
    ],
  },
};

export default async function SampelPage() {
  const [s, env] = await Promise.all([getSettings(), getEnv()]);
  const url = `${env.SITE_URL}/sampel`;
  const defaultWa = waLink(
    s.whatsapp,
    "Halo Istana Block, saya baru melihat katalog sampel produk di website dan ingin minta penawaran.",
  );

  return (
    <div className="wrap sampel-page">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            "@id": url,
            url,
            name: `${TITLE} | ${s.company_name}`,
            description: DESCRIPTION,
            inLanguage: "id-ID",
            primaryImageOfPage: `${env.SITE_URL}${OG_IMAGE}`,
            isPartOf: { "@type": "WebSite", url: env.SITE_URL, name: s.company_name },
            about: { "@id": `${env.SITE_URL}/#business` },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Beranda", item: env.SITE_URL },
              { "@type": "ListItem", position: 2, name: "Katalog Produk & Sampel", item: url },
            ],
          },
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "Daftar Sampel Produk Beton Precast Istana Block Purwakarta",
            numberOfItems: SAMPEL_PRODUCTS.length,
            itemListElement: SAMPEL_PRODUCTS.map((p, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: p.full,
              description: p.sub,
              url: `${url}?k=${p.code}`,
              image: `${env.SITE_URL}${getProductImage(p, DEFAULT_SELECTION)}`,
            })),
          },
        ]}
      />

      <nav aria-label="Lokasi halaman" className="breadcrumb">
        <ol>
          <li>
            <Link href="/">Beranda</Link>
          </li>
          <li>Katalog Produk &amp; Sampel</li>
        </ol>
      </nav>

      <header className="sampel-hero">
        <div className="pills">
          <span className="pill">Katalog Sampel Interaktif</span>
          <span className="pill pill-orange">TKDN Kemenperin &amp; SNI</span>
        </div>
        <h1>Katalog Sampel &amp; Spesifikasi Produk</h1>
        <p className="hero-lead">
          Periksa foto fisik sampel, rincian dimensi, berat unit, pilihan ketebalan dan warna, hingga perkiraan kebutuhan material
          langsung dari pabrik {s.company_name} di Pasawahan, Purwakarta. Memegang sampel berlabel QR atau melihat kartu produk di
          galeri kami? Pilih kategori di bawah untuk mencocokkan spesifikasi teknis dan meminta penawaran resmi melalui WhatsApp.
        </p>
        <div className="sampel-quick-links" aria-label="Tautan cepat layanan dan dokumen">
          <Link href="/katalog" className="sampel-quick-link">
            Katalog Brosur (11 Halaman) →
          </Link>
          <Link href="/pola-paving" className="sampel-quick-link">
            Kalkulator Pola &amp; Warna Paving →
          </Link>
          <Link href="/sertifikat-tkdn" className="sampel-quick-link">
            Sertifikat TKDN Kemenperin →
          </Link>
          <Link href="/galeri" className="sampel-quick-link">
            Galeri Pemasangan &amp; Stok →
          </Link>
          <Link href="/produk/jasa-pasang-paving" className="sampel-quick-link">
            Jasa Pasang Paving →
          </Link>
        </div>
      </header>

      <SampelExplorer whatsapp={s.whatsapp} />

      <section className="sampel-ssr-guide" aria-labelledby="panduan-sampel">
        <div className="sampel-ssr-head">
          <h2 id="panduan-sampel">Ringkasan 21 Sampel Beton Precast Istana Block</h2>
          <p>
            Seluruh material konstruksi pada halaman sampel ini diproduksi langsung di pabrik PT Istana Block Purwakarta (berdiri sejak{" "}
            {s.founded_year} di {s.address}). Pengiriman menggunakan armada truk crane dan flatbed milik sendiri ke Purwakarta,
            Karawang, Cikampek, Subang, Bandung, serta pesanan skala proyek di Jabodetabek. Berikut ringkasan tiap kelompok produk yang
            dapat Anda periksa detailnya di penjelajah sampel di atas:
          </p>
        </div>

        <div className="sampel-ssr-grid">
          <article className="sampel-ssr-cat">
            <h3>1. Paving Block &amp; Grass Block</h3>
            <p>
              Mutu beton K-350 sampai K-450 berstandar SNI dan bersertifikat TKDN 91,58% (No. 9656/SJ-IND.8/TKDN/LVI/08/2026). Tersedia
              lima profil utama: Truepave bata 21 × 10,5 cm (44 pcs/m², tebal 6 &amp; 8 cm), Hexagon segi enam 20 × 20 cm (27 pcs/m²),
              Fullpave 21 × 21 cm (22 pcs/m²), Fullpave 30 × 30 cm (11 pcs/m²), dan Grass Block 45 × 30 cm (7,5 pcs/m², tebal 6 &amp; 8 cm).
            </p>
            <ul className="sampel-ssr-links">
              <li>
                <Link href="/produk/paving-block">Daftar harga Paving Block Purwakarta →</Link>
              </li>
              <li>
                <Link href="/pola-paving">Simulasi motif &amp; abu batu di Kalkulator Pola →</Link>
              </li>
              <li>
                <Link href="/produk/jasa-pasang-paving">Paket jasa pemasangan paving (min. 200 m²) →</Link>
              </li>
            </ul>
          </article>

          <article className="sampel-ssr-cat">
            <h3>2. Genteng Beton &amp; Aksesoris Atap</h3>
            <p>
              Genteng beton pracetak model Garuda gelombang (42 × 34 cm) untuk rumah klasik maupun Genteng Flat datar untuk hunian modern
              minimalis. Dilengkapi aksesoris satu pabrik agar warna dan profil sambungan seragam: Nok Garuda (36 × 25 cm), Nok Flat (42 ×
              25 cm), Lisplang tepi atap, Nok Ujung Jurai, Triway (pertemuan 3 bubungan), serta Apex 4 Arah untuk atap limas piramida.
            </p>
            <ul className="sampel-ssr-links">
              <li>
                <Link href="/produk/genteng-beton">Lihat halaman Genteng Beton &amp; aksesoris →</Link>
              </li>
              <li>
                <a href="/sampel?k=gg">Buka sampel Genteng Garuda</a> · <a href="/sampel?k=gf">Genteng Flat</a>
              </li>
            </ul>
          </article>

          <article className="sampel-ssr-cat">
            <h3>3. U-Ditch, Buis Beton &amp; Gravel (Greffel)</h3>
            <p>
              Solusi drainase jalan lingkungan dan kawasan industri dalam satu pengiriman. U-Ditch mutu K-350 wet cast bersertifikat TKDN
              78,61% dengan tulangan U-50 drawn wire &amp; BJDT tersedia ukuran 30×30 hingga 80×80 cm panjang 120 cm berikut Tutup
              U-Ditch. Buis beton K-300 (TKDN 100% tanpa tulangan) mencakup diameter 20×100 sampai 80×100 cm tipe tumbuk, cor, dan
              bertulang, plus Tutup Buis Ø100 cm dan Gravel (Greffel) setengah lingkaran Ø20–50 cm.
            </p>
            <ul className="sampel-ssr-links">
              <li>
                <Link href="/produk/u-ditch">Spesifikasi &amp; harga U-Ditch beton →</Link>
              </li>
              <li>
                <Link href="/produk/buis-beton">Daftar ukuran &amp; berat Buis Beton →</Link>
              </li>
              <li>
                <Link href="/produk/greffel-beton">Lihat halaman Gravel (Greffel) Beton →</Link>
              </li>
            </ul>
          </article>

          <article className="sampel-ssr-cat">
            <h3>4. Kanstin Jalan &amp; Stopper Ban</h3>
            <p>
              Pengunci tepi paving, pembatas trotoar, dan penahan roda parkir berbahan beton pracetak padat. Tersedia Kanstin KS dalam
              empat dimensi (40×20×10, 40×25×12/15, 40×28×12/15, dan 60×30×18/22 cm), Kanstin S profil lengkung 40×30×10/18 cm (2,5
              pcs/m), serta Kanstin Stopper Ban 60×16×7/16,5 cm untuk area parkir gedung, ruko, dan carport.
            </p>
            <ul className="sampel-ssr-links">
              <li>
                <Link href="/produk/kanstin">Lihat semua tipe &amp; harga Kanstin →</Link>
              </li>
              <li>
                <Link href="/paket-proyek">Penawaran paket material proyek &amp; tender →</Link>
              </li>
            </ul>
          </article>
        </div>

        <div className="sampel-ssr-footer-cta">
          <div className="stack" style={{ gap: 4 }}>
            <strong style={{ color: "var(--biru-tua)", fontFamily: "var(--font-judul)", fontSize: 18 }}>
              Butuh dokumen penawaran tertulis, brosur PDF, atau verifikasi TKDN?
            </strong>
            <span className="muted small">
              Jam operasional {s.hours}. Hubungi WhatsApp {s.whatsapp} atau telepon {s.phone}.
            </span>
          </div>
          <div className="actions">
            <a className="btn btn-primary" href={defaultWa} target="_blank" rel="noopener">
              Konsultasi WhatsApp
            </a>
            <Link className="btn btn-ghost" href="/katalog">
              Buka Katalog PDF
            </Link>
            <a className="btn btn-ghost" href={telLink(s.phone)}>
              Telepon {s.phone}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
