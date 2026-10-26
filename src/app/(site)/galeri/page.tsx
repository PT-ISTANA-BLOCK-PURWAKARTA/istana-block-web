import type { Metadata } from "next";
import Link from "next/link";
import { GALLERY, GalleryGrid } from "@/components/Gallery";
import { JsonLd } from "@/components/JsonLd";
import { getEnv } from "@/db";
import { waLink } from "@/lib/format";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Galeri Pemasangan Paving & Stok Pabrik",
  description: "Dokumentasi pemasangan paving block hexagon, bata, dan kombinasi warna oleh Istana Block Purwakarta, serta stok U-Ditch, buis, kanstin, dan greffel di pabrik.",
  alternates: { canonical: "/galeri" },
  openGraph: { images: [GALLERY[0]?.src ?? { url: "/og-default.jpg", width: 1200, height: 630 }] },
};

const FILTERS = [
  { id: "", label: "Semua" },
  { id: "pemasangan", label: "Pemasangan paving", kategori: "Pemasangan paving" },
  { id: "pabrik", label: "Pabrik & stok", kategori: "Pabrik & stok" },
];

export default async function GaleriPage({ searchParams }: { searchParams: Promise<{ k?: string }> }) {
  const [{ k = "" }, s, env] = await Promise.all([searchParams, getSettings(), getEnv()]);
  const f = FILTERS.find((x) => x.id === k) ?? FILTERS[0];
  const items = f.kategori ? GALLERY.filter((g) => g.kategori === f.kategori) : GALLERY;
  return (
    <div className="wrap section" style={{ paddingTop: 24 }}>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ImageGallery",
          name: "Galeri Istana Block Purwakarta",
          url: `${env.SITE_URL}/galeri`,
          image: GALLERY.map((g) => ({ "@type": "ImageObject", contentUrl: `${env.SITE_URL}${g.src}`, caption: g.alt })),
        }}
      />
      <nav aria-label="Lokasi halaman" className="breadcrumb"><ol><li><Link href="/">Beranda</Link></li><li>Galeri</li></ol></nav>
      <div className="section-head" style={{ marginTop: 12, marginBottom: 18 }}>
        <div className="stack" style={{ gap: 10, maxWidth: 720 }}>
          <h1 style={{ fontSize: "clamp(34px, 4vw, 52px)" }}>Galeri pemasangan &amp; pabrik</h1>
          <p className="muted">Foto hasil pemasangan paving dan stok produk di pabrik Pasawahan, Purwakarta. Klik foto untuk melihat ukuran penuh.</p>
        </div>
      </div>
      <nav aria-label="Saring foto" className="chips" style={{ marginBottom: 20 }}>
        {FILTERS.map((x) => (
          <Link key={x.id} href={x.id ? `/galeri?k=${x.id}` : "/galeri"} className="chip-link" aria-current={x.id === f.id ? "true" : undefined} scroll={false}>
            {x.label}
          </Link>
        ))}
      </nav>
      <GalleryGrid items={items} />
      <aside className="cta-aside hexpat" style={{ marginTop: 40, maxWidth: 760 }}>
        <h2>Mau hasil seperti ini di lokasi Anda?</h2>
        <p>Kirim luas area dan lokasi. Admin membantu memilih jenis, motif, dan warna paving, lengkap dengan penawaran dan ongkir.</p>
        <div className="actions">
          <a className="btn btn-primary" href={waLink(s.whatsapp, "Halo Istana Block, saya lihat galeri dan ingin pasang paving. Luas: ... m², Lokasi: ...")} target="_blank" rel="noopener">Konsultasi via WhatsApp</a>
          <Link className="btn btn-ghost" style={{ borderColor: "#fff", color: "#fff" }} href="/pola-paving">Coba kalkulator pola</Link>
        </div>
      </aside>
    </div>
  );
}
