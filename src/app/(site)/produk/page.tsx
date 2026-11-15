import type { Metadata } from "next";
import Link from "next/link";
import { Hex } from "@/components/Hex";
import { JsonLd } from "@/components/JsonLd";
import { ProdukShowcase, type ProdukItem } from "@/components/ProdukShowcase";
import { getEnv } from "@/db";
import { listProducts } from "@/lib/queries";
import "./produk.css";

export const metadata: Metadata = {
  title: "Harga Paving, U-Ditch & Buis",
  description: "Daftar harga paving block, U-Ditch, buis beton, kanstin, genteng beton, dan jasa pasang dari pabrik Istana Block Purwakarta.",
  alternates: { canonical: "/produk" },
};

export default async function ProdukPage() {
  const [products, env] = await Promise.all([listProducts(), getEnv()]);
  const pageUrl = `${env.SITE_URL}/produk`;
  const items: ProdukItem[] = products.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    category: p.category,
    summary: p.summary,
    priceFrom: p.priceFrom,
    priceTo: p.priceTo,
    unit: p.unit,
    imageKey: p.imageKey,
    specs: p.specs.slice(0, 4),
    tkdn: p.tkdn,
  }));
  const precast = items.filter((p) => p.category !== "Jasa").length;
  const tkdn = items.filter((p) => Boolean(p.tkdn?.trim())).length;
  const jasa = items.length - precast;

  const barTop = (
    <div className="pk-bar-top">
      <div className="pk-stats">
        <Hex size={14} color="var(--oranye)" />
        <span className="tabular">
          {precast} Lini Beton Pracetak · {tkdn} Bersertifikat TKDN · {jasa} Paket Terpasang
        </span>
      </div>
      <nav className="pk-links" aria-label="Tautan cepat layanan">
        <Link prefetch={false} href="/paket-proyek" className="pk-link">
          Butuh paket proyek? <span aria-hidden="true">→</span>
        </Link>
        <Link prefetch={false} href="/pola-paving" className="pk-link">
          Kalkulator Paving <span aria-hidden="true">↗</span>
        </Link>
        <Link prefetch={false} href="/sampel" className="pk-link">
          Cek Sampel <span aria-hidden="true">↗</span>
        </Link>
      </nav>
    </div>
  );

  return (
    <div className="wrap pk-page">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Produk & Daftar Harga Istana Block Purwakarta",
            url: pageUrl,
            inLanguage: "id-ID",
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Beranda", item: env.SITE_URL },
              { "@type": "ListItem", position: 2, name: "Produk", item: pageUrl },
            ],
          },
        ]}
      />
      <nav aria-label="Lokasi halaman" className="breadcrumb">
        <ol>
          <li><Link href="/">Beranda</Link></li>
          <li>Produk</li>
        </ol>
      </nav>
      <header className="pk-head">
        <h1>Produk dan daftar harga</h1>
        <p className="pk-note">Harga belum termasuk ongkir. Penawaran tertulis yang berlaku.</p>
      </header>
      <ProdukShowcase products={items} barTop={barTop} />
    </div>
  );
}
