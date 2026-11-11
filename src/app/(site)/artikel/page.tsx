import type { Metadata } from "next";
import Link from "next/link";
import { articleCategories } from "@/db/schema";
import { imageUrl, tanggal, waLink } from "@/lib/format";
import { listArticleSummaries } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { ArticleCatalog, type ArticleSort } from "./ArticleCatalog";
import type { ArticleCardItem } from "@/components/ArticleCard";

type SP = { q?: string; kategori?: string; urut?: string; hal?: string };

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const sp = await searchParams;
  const hasSearch = Boolean((sp.q ?? "").trim());
  return {
    title: "Artikel & Panduan Material Beton",
    description: "Panduan memilih, menghitung, dan memasang paving block, U-Ditch, buis beton, kanstin, dan genteng beton dari Istana Block Purwakarta.",
    alternates: { canonical: "/artikel" },
    ...(hasSearch ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function ArtikelPage({ searchParams }: { searchParams: Promise<SP> }) {
  const [sp, articles, settings] = await Promise.all([searchParams, listArticleSummaries(), getSettings()]);
  const initialQuery = (sp.q ?? "").trim().slice(0, 100);
  const initialCategory = (articleCategories as readonly string[]).includes(sp.kategori ?? "") ? (sp.kategori as string) : "";
  const initialSort: ArticleSort = sp.urut === "terlama" || sp.urut === "judul" ? sp.urut : "terbaru";
  const initialPage = Math.max(1, parseInt(sp.hal ?? "1", 10) || 1);

  const items: ArticleCardItem[] = articles.map((a) => ({
    id: a.id,
    slug: a.slug,
    title: a.title,
    category: a.category,
    excerpt: a.excerpt,
    coverSrc: imageUrl(a.coverKey),
    publishedDate: tanggal(a.publishedAt),
    publishedMs: a.publishedAt ? a.publishedAt.getTime() : 0,
    readMinutes: a.readMinutes,
  }));

  return (
    <div className="wrap section" style={{ paddingTop: 24 }}>
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
    </div>
  );
}
