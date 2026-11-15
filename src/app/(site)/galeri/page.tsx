import type { Metadata } from "next";
import Link from "next/link";
import { GALLERY, GalleryGrid } from "@/components/Gallery";
import { JsonLd } from "@/components/JsonLd";
import "@/components/galeri.css";
import { getEnv } from "@/db";
import { waLink } from "@/lib/format";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Galeri Paving & Stok Pabrik",
  description: "Dokumentasi pemasangan paving block hexagon, bata, dan kombinasi warna oleh Istana Block Purwakarta serta stok U-Ditch, buis, dan kanstin di pabrik.",
  alternates: { canonical: "/galeri" },
  openGraph: {
    images: GALLERY[0]?.src
      ? [GALLERY[0].src]
      : [
          { url: "/og-default.webp", width: 1200, height: 630, type: "image/webp" },
          { url: "/og-default.jpg", width: 1200, height: 630, type: "image/jpeg" },
        ],
  },
};

const FILTERS: { id: string; label: string; kategori?: string }[] = [
  { id: "", label: "Semua" },
  { id: "pemasangan", label: "Pemasangan paving", kategori: "Pemasangan paving" },
  { id: "pabrik", label: "Pabrik & stok", kategori: "Pabrik & stok" },
];

export default async function GaleriPage({ searchParams }: { searchParams: Promise<{ k?: string }> }) {
  const [{ k = "" }, s, env] = await Promise.all([searchParams, getSettings(), getEnv()]);
  const f = FILTERS.find((x) => x.id === k) ?? FILTERS[0];
  const items = f.kategori ? GALLERY.filter((g) => g.kategori === f.kategori) : GALLERY;

  const totalCount = GALLERY.length;
  const counts = new Map<string, number>();
  for (const g of GALLERY) counts.set(g.kategori, (counts.get(g.kategori) ?? 0) + 1);
  const pasangCount = counts.get("Pemasangan paving") ?? 0;
  const pabrikCount = counts.get("Pabrik & stok") ?? 0;
  const pageUrl = `${env.SITE_URL}/galeri`;

  return (
    <div className="wrap section" style={{ paddingTop: 24 }}>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "ImageGallery",
            name: "Galeri Istana Block Purwakarta",
            url: pageUrl,
            image: GALLERY.map((g) => ({ "@type": "ImageObject", contentUrl: `${env.SITE_URL}${g.src}`, caption: g.alt })),
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Beranda", item: env.SITE_URL },
              { "@type": "ListItem", position: 2, name: "Galeri", item: pageUrl },
            ],
          },
        ]}
      />
      <nav aria-label="Lokasi halaman" className="breadcrumb">
        <ol>
          <li><Link href="/">Beranda</Link></li>
          <li>Galeri</li>
        </ol>
      </nav>

      <header className="galeri-head">
        <div className="galeri-head-copy">
          <h1>Galeri pemasangan &amp; pabrik</h1>
          <p className="muted">
            Dokumentasi hasil pemasangan paving block hexagon, bata, dan kombinasi warna di lokasi proyek, serta stok cetakan dan mesin cetak di pabrik Pasawahan, Purwakarta.
          </p>
        </div>
        <div className="galeri-summary">
          <ul className="galeri-summary-stats">
            <li><span className="galeri-dot" aria-hidden="true" />{totalCount} foto dokumentasi</li>
            <li><span className="galeri-dot is-pasang" aria-hidden="true" />{pasangCount} pemasangan lapangan</li>
            <li><span className="galeri-dot is-pabrik" aria-hidden="true" />{pabrikCount} pabrik &amp; stok</li>
          </ul>
          <span className="galeri-summary-hint">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
            </svg>
            Klik foto untuk ukuran penuh
          </span>
        </div>
      </header>

      <div className="galeri-filter-bar">
        <nav aria-label="Saring foto" className="chips galeri-chips">
          {FILTERS.map((x) => {
            const count = x.kategori ? (counts.get(x.kategori) ?? 0) : totalCount;
            return (
              <Link
                key={x.id}
                href={x.id ? `/galeri?k=${x.id}` : "/galeri"}
                className="chip-link"
                aria-current={x.id === f.id ? "true" : undefined}
                scroll={false}
              >
                {x.label} <span className="galeri-chip-count">({count})</span>
              </Link>
            );
          })}
        </nav>
        <p className="galeri-filter-status">
          {f.kategori
            ? `Menampilkan ${items.length} dari ${totalCount} foto`
            : `Menampilkan seluruh ${totalCount} foto`}
        </p>
      </div>

      <GalleryGrid key={f.id} items={items} />

      <aside className="cta-aside hexpat galeri-cta">
        <h2>Mau hasil seperti ini di lokasi Anda?</h2>
        <p>Kirim luas area dan lokasi. Admin membantu memilih jenis, motif, dan warna paving, lengkap dengan penawaran dan ongkir.</p>
        <div className="actions">
          <a
            className="btn btn-primary"
            href={waLink(s.whatsapp, "Halo Istana Block, saya lihat galeri dan ingin pasang paving. Luas: ... m², Lokasi: ...")}
            target="_blank"
            rel="noopener"
          >
            Konsultasi via WhatsApp
          </a>
          <Link className="btn btn-ghost galeri-cta-ghost" href="/pola-paving">
            Coba kalkulator pola
          </Link>
          <Link className="btn btn-ghost galeri-cta-ghost" href="/katalog">
            Lihat katalog produk
          </Link>
        </div>
        <p className="galeri-cta-sub">
          Ingin lihat fisik paving sebelum order? <Link href="/sampel">Minta sampel proyek</Link> atau cek <Link href="/produk">daftar harga pabrik</Link>.
        </p>
      </aside>
    </div>
  );
}
