import type { Metadata } from "next";
import Link from "next/link";
import "@/app/ui.css";
import { JsonLd } from "@/components/JsonLd";
import { getEnv } from "@/db";
import { articleCategories } from "@/db/schema";
import { imageUrl, tanggal, waLink } from "@/lib/format";
import { listArticleSummaries } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { ArticleCatalog, type ArticlePerPage, type ArticleSort } from "./ArticleCatalog";
import type { ArticleCardItem } from "@/components/ArticleCard";

type SP = { q?: string; kategori?: string; urut?: string; tampil?: string; hal?: string };

const ARTIKEL_TITLE = "Artikel & Panduan Beton";
const ARTIKEL_DESC =
  "Panduan memilih, menghitung, dan memasang paving block, U-Ditch, buis beton, kanstin, dan genteng beton dari pabrik Istana Block Purwakarta.";

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const sp = await searchParams;
  const hasSearch = Boolean((sp.q ?? "").trim());
  return {
    title: ARTIKEL_TITLE,
    description: ARTIKEL_DESC,
    alternates: { canonical: "/artikel" },
    openGraph: {
      title: ARTIKEL_TITLE,
      description: ARTIKEL_DESC,
      url: "/artikel",
      images: [{ url: "/og-default.jpg", width: 1200, height: 630 }],
    },
    ...(hasSearch ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function ArtikelPage({ searchParams }: { searchParams: Promise<SP> }) {
  const [sp, articles, settings, env] = await Promise.all([searchParams, listArticleSummaries(), getSettings(), getEnv()]);
  const initialQuery = (sp.q ?? "").trim().slice(0, 100);
  const initialCategory = (articleCategories as readonly string[]).includes(sp.kategori ?? "") ? (sp.kategori as string) : "";
  const initialSort: ArticleSort = sp.urut === "terlama" || sp.urut === "judul" ? sp.urut : "terbaru";
  const initialPerPage: ArticlePerPage =
    sp.tampil === "12" || sp.tampil === "24" || sp.tampil === "48" || sp.tampil === "semua" ? sp.tampil : "auto";
  const initialPage = Math.max(1, parseInt(sp.hal ?? "1", 10) || 1);
  const pageUrl = `${env.SITE_URL}/artikel`;

  const byCategory = articleCategories
    .map((cat) => ({ cat, rows: articles.filter((a) => a.category === cat) }))
    .filter((g) => g.rows.length > 0);

  const items: ArticleCardItem[] = articles.map((a) => ({
    id: a.id,
    slug: a.slug,
    title: a.title,
    category: a.category,
    excerpt: a.excerpt,
    coverSrc: imageUrl(a.coverKey),
    coverMeta: a.coverMeta,
    publishedDate: tanggal(a.publishedAt),
    publishedMs: a.publishedAt ? a.publishedAt.getTime() : 0,
    readMinutes: a.readMinutes,
  }));

  return (
    <div className="wrap section" style={{ paddingTop: 24 }}>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: `${ARTIKEL_TITLE} | ${settings.company_name}`,
            description: ARTIKEL_DESC,
            url: pageUrl,
            inLanguage: "id-ID",
            isPartOf: { "@type": "WebSite", url: env.SITE_URL, name: settings.company_name },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Beranda", item: env.SITE_URL },
              { "@type": "ListItem", position: 2, name: "Artikel", item: pageUrl },
            ],
          },
        ]}
      />
      <nav aria-label="Lokasi halaman" className="breadcrumb">
        <ol>
          <li><Link href="/">Beranda</Link></li>
          <li>Artikel</li>
        </ol>
      </nav>

      <header className="artikel-head">
        <div className="artikel-head-top">
          <h1 style={{ fontSize: "clamp(34px, 4vw, 52px)" }}>Artikel &amp; panduan</h1>
          <span className="artikel-total-pill">{items.length} panduan · {articleCategories.length} topik material</span>
        </div>
        <p className="hero-lead" style={{ fontSize: 18, maxWidth: 780 }}>
          Kumpulan panduan memilih jenis dan mutu, menghitung kebutuhan volume, serta pemasangan paving block, U-Ditch, buis beton, kanstin, dan genteng beton langsung dari pabrik Purwakarta.
        </p>
      </header>

      <ArticleCatalog
        items={items}
        categories={articleCategories}
        initialQuery={initialQuery}
        initialCategory={initialCategory}
        initialSort={initialSort}
        initialPerPage={initialPerPage}
        initialPage={initialPage}
      />

      {/* Panduan pengantar dipindah ke bawah daftar agar artikel langsung tampil di layar pertama, namun tetap tersedia untuk pembaca & SEO. */}
      <section className="artikel-guide panel" aria-labelledby="panduan-pakai-artikel">
        <div className="artikel-guide-copy">
          <h2 id="panduan-pakai-artikel">Memakai panduan ini sebelum memesan material</h2>
          <p>
            Setiap artikel disusun supaya pemilik rumah, kontraktor, dan tim pengadaan bisa menentukan spesifikasi sebelum meminta penawaran resmi: mulai dari pemilihan mutu K-300 hingga K-450, estimasi isi per m², sampai syarat akses truk bongkar di lokasi proyek.
          </p>
          <p>
            Untuk membandingkan spesifikasi dan harga terkini, buka halaman <Link href="/produk">Produk</Link>, hitung kombinasi motif di <Link href="/pola-paving">Kalkulator pola paving</Link>, atau periksa jangkauan armada di <Link href="/area-pengiriman">Area pengiriman</Link>.
          </p>
        </div>
        <aside className="cta-aside hexpat artikel-guide-cta">
          <h2>Butuh penawaran proyek?</h2>
          <p>Kirim produk, perkiraan volume, dan titik lokasi proyek — admin membalas dengan rincian harga dan ongkir.</p>
          <div className="actions">
            <a className="btn btn-primary" href={waLink(settings.whatsapp, "Halo Istana Block, saya membaca artikel panduan dan ingin minta penawaran.")} target="_blank" rel="noopener">
              Minta penawaran
            </a>
            <Link className="btn btn-ghost" style={{ borderColor: "#fff", color: "#fff" }} href="/kontak">
              Halaman kontak
            </Link>
          </div>
        </aside>
      </section>

      {byCategory.length > 0 && (
        <details className="artikel-archive-panel panel">
          <summary>Direktori indeks seluruh {items.length} panduan menurut topik</summary>
          <div className="artikel-archive-grid">
            {byCategory.map((g) => (
              <div key={g.cat} className="artikel-archive-group">
                <h3>{g.cat} ({g.rows.length})</h3>
                <ul>
                  {g.rows.map((row) => (
                    <li key={row.id}>
                      <Link prefetch={false} href={`/artikel/${row.slug}`}>
                        {row.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
