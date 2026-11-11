import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleCard } from "@/components/ArticleCard";
import { JsonLd } from "@/components/JsonLd";
import { Markdown } from "@/components/Markdown";
import { getEnv } from "@/db";
import { imageUrl, tanggal, waLink } from "@/lib/format";
import { getArticleBySlug, getRelatedArticles } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { fitTitle } from "@/lib/title";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await getArticleBySlug((await params).slug);
  if (!a) return { title: "Artikel tidak ditemukan", robots: { index: false } };
  const title = a.seoTitle || a.title;
  const description = a.seoDescription || a.excerpt;
  const img = imageUrl(a.coverKey);
  return {
    // seoTitle dari panel sudah lengkap dengan merek; "absolute" mencegah template layout menempelkan akhiran merek kedua.
    title: a.seoTitle ? { absolute: a.seoTitle } : fitTitle(a.title),
    description,
    alternates: { canonical: `/artikel/${a.slug}` },
    openGraph: {
      type: "article",
      title,
      description,
      url: `/artikel/${a.slug}`,
      publishedTime: a.publishedAt?.toISOString(),
      modifiedTime: a.updatedAt.toISOString(),
      images: img ? [img] : [{ url: "/og-default.jpg", width: 1200, height: 630 }],
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const [a, s, env] = await Promise.all([getArticleBySlug(slug), getSettings(), getEnv()]);
  if (!a) notFound();
  const [related] = await Promise.all([getRelatedArticles(a.category, a.slug, 3)]);
  const img = imageUrl(a.coverKey);
  const readMinutes = Math.max(1, Math.round(a.content.length / 1200));

  return (
    <article className="wrap" style={{ paddingBottom: 56 }}>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: a.title,
          description: a.excerpt,
          articleSection: a.category,
          datePublished: a.publishedAt?.toISOString(),
          dateModified: a.updatedAt.toISOString(),
          mainEntityOfPage: `${env.SITE_URL}/artikel/${a.slug}`,
          ...(img ? { image: img.startsWith("http") ? img : `${env.SITE_URL}${img}` } : {}),
          author: { "@type": "Organization", name: s.company_name },
          publisher: { "@id": `${env.SITE_URL}/#business` },
        }}
      />
      <nav aria-label="Lokasi halaman" className="breadcrumb">
        <ol><li><Link href="/">Beranda</Link></li><li><Link href="/artikel">Artikel</Link></li><li>{a.title}</li></ol>
      </nav>
      <header className="stack" style={{ gap: 14, padding: "24px 0 28px", maxWidth: 820 }}>
        <div className="artikel-card-meta">
          <Link href={`/artikel?kategori=${encodeURIComponent(a.category)}`} className="artikel-cat-link">
            {a.category}
          </Link>
          {a.publishedAt && <span className="small muted">{tanggal(a.publishedAt)}</span>}
          <span className="small muted">· {readMinutes} mnt baca</span>
        </div>
        <h1 style={{ fontSize: "clamp(32px, 4vw, 50px)" }}>{a.title}</h1>
        {a.excerpt && <p className="hero-lead">{a.excerpt}</p>}
      </header>
      {img && <img className="article-cover hexlong" src={img} alt={a.title} width={1200} height={675} fetchPriority="high" decoding="async" style={{ marginBottom: 32 }} />}
      <Markdown>{a.content}</Markdown>
      <aside className="cta-aside hexpat" style={{ marginTop: 40, maxWidth: 720 }}>
        <h2>Butuh material untuk proyek Anda?</h2>
        <p>Kirim ukuran dan lokasi, admin kami kirim penawaran lengkap dengan ongkir.</p>
        <a className="btn btn-primary" style={{ alignSelf: "flex-start" }} href={waLink(s.whatsapp, `Halo Istana Block, saya baca artikel "${a.title}" dan mau minta penawaran.`)} target="_blank" rel="noopener">
          Minta penawaran
        </a>
      </aside>
      {related.length > 0 && (
        <section style={{ marginTop: 56 }} aria-labelledby="related-articles-title">
          <div className="section-head" style={{ marginBottom: 20 }}>
            <h2 id="related-articles-title" style={{ fontSize: "clamp(24px, 3vw, 32px)" }}>Panduan terkait lainnya</h2>
            <Link href={`/artikel?kategori=${encodeURIComponent(a.category)}`} style={{ fontWeight: 600 }}>Lihat topik {a.category} →</Link>
          </div>
          <div className="grid-cards artikel-grid">
            {related.map((r) => (
              <ArticleCard
                key={r.id}
                headingLevel="h3"
                item={{
                  id: r.id,
                  slug: r.slug,
                  title: r.title,
                  category: r.category,
                  excerpt: r.excerpt,
                  coverSrc: imageUrl(r.coverKey),
                  publishedDate: tanggal(r.publishedAt),
                  publishedMs: r.publishedAt ? r.publishedAt.getTime() : 0,
                  readMinutes: r.readMinutes,
                }}
              />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
