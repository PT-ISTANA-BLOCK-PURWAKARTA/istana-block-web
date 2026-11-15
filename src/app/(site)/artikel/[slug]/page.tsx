import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleCard } from "@/components/ArticleCard";
import { ArticleCover } from "@/components/ArticleCover";
import { JsonLd } from "@/components/JsonLd";
import { Markdown } from "@/components/Markdown";
import { getEnv } from "@/db";
import { isRealArticleCover, resolveArticleCover } from "@/lib/article-cover";
import { imageUrl, tanggal, waLink } from "@/lib/format";
import { getArticleBySlug, getRelatedArticles, listArticleSummaries } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { clampDescription, clampTitle, fitTitle } from "@/lib/title";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await getArticleBySlug((await params).slug);
  if (!a) return { title: "Artikel tidak ditemukan", robots: { index: false } };
  const title = clampTitle(a.seoTitle || a.title);
  const description = clampDescription(a.seoDescription || a.excerpt);
  const img = imageUrl(a.coverKey);
  const ogImg = isRealArticleCover(img) ? img : null;
  return {
    // seoTitle dari panel sudah lengkap dengan merek; "absolute" mencegah template layout menempelkan akhiran merek kedua.
    title: a.seoTitle ? { absolute: clampTitle(a.seoTitle) } : fitTitle(a.title),
    description,
    alternates: { canonical: `/artikel/${a.slug}` },
    openGraph: {
      type: "article",
      title,
      description,
      url: `/artikel/${a.slug}`,
      publishedTime: a.publishedAt?.toISOString(),
      modifiedTime: a.updatedAt.toISOString(),
      images: ogImg
        ? [ogImg]
        : [
            { url: "/og-default.webp", width: 1200, height: 630, type: "image/webp" },
            { url: "/og-default.jpg", width: 1200, height: 630, type: "image/jpeg" },
          ],
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const [a, s, env, related, allSummaries] = await Promise.all([
    getArticleBySlug(slug),
    getSettings(),
    getEnv(),
    getRelatedArticles("", slug, 6), // fallback sementara di bawah setelah kategori diketahui
    listArticleSummaries(),
  ]);
  if (!a) notFound();
  const catRelated = await getRelatedArticles(a.category, a.slug, 6);
  const shownRelated = catRelated.length ? catRelated : related;
  const curIdx = allSummaries.findIndex((x) => x.slug === a.slug);
  const prevArticle = curIdx > 0 ? allSummaries[curIdx - 1] : null;
  const nextArticle = curIdx >= 0 && curIdx + 1 < allSummaries.length ? allSummaries[curIdx + 1] : null;
  const img = imageUrl(a.coverKey);
  const ogImg = isRealArticleCover(img) ? img : null;
  const pageUrl = `${env.SITE_URL}/artikel/${a.slug}`;
  const jsonLdImage = ogImg ? (ogImg.startsWith("http") ? ogImg : `${env.SITE_URL}${ogImg}`) : `${env.SITE_URL}/og-default.jpg`;
  const cover = resolveArticleCover({
    title: a.title,
    category: a.category,
    excerpt: a.excerpt,
    content: a.content,
    coverMeta: a.coverMeta,
  });
  const readMinutes = Math.max(1, Math.round(a.content.length / 1200));

  return (
    <article className="wrap" style={{ paddingBottom: 56 }}>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: a.title,
            description: clampDescription(a.seoDescription || a.excerpt),
            articleSection: a.category,
            datePublished: a.publishedAt?.toISOString(),
            dateModified: a.updatedAt.toISOString(),
            url: pageUrl,
            mainEntityOfPage: pageUrl,
            image: jsonLdImage,
            author: { "@type": "Organization", name: s.company_name },
            publisher: { "@id": `${env.SITE_URL}/#business` },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Beranda", item: env.SITE_URL },
              { "@type": "ListItem", position: 2, name: "Artikel", item: `${env.SITE_URL}/artikel` },
              { "@type": "ListItem", position: 3, name: a.title, item: pageUrl },
            ],
          },
        ]}
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
      <div className="article-cover-wrap">
        <ArticleCover
          variant="hero"
          title={cover.title}
          category={cover.badgeCategory}
          themeCategory={cover.themeCategory}
          excerpt={cover.excerpt}
          coverSrc={ogImg}
          topics={ogImg ? [] : cover.topics}
          sizes="(max-width: 960px) 92vw, 820px"
          priority
        />
      </div>
      <Markdown>{a.content}</Markdown>
      {(prevArticle || nextArticle) && (
        <nav className="artikel-pager-siblings" aria-label="Navigasi artikel berurutan" style={{ maxWidth: 720 }}>
          {prevArticle ? (
            <Link prefetch={false} href={`/artikel/${prevArticle.slug}`} className="artikel-sibling-card">
              <span className="small muted">← Panduan lebih baru</span>
              <b>{prevArticle.title}</b>
            </Link>
          ) : (
            <span />
          )}
          {nextArticle && (
            <Link prefetch={false} href={`/artikel/${nextArticle.slug}`} className="artikel-sibling-card is-next">
              <span className="small muted">Panduan berikutnya →</span>
              <b>{nextArticle.title}</b>
            </Link>
          )}
        </nav>
      )}
      <aside className="cta-aside hexpat" style={{ marginTop: 40, maxWidth: 720 }}>
        <h2>Butuh material untuk proyek Anda?</h2>
        <p>Kirim ukuran dan lokasi, admin kami kirim penawaran lengkap dengan ongkir.</p>
        <a className="btn btn-primary" style={{ alignSelf: "flex-start" }} href={waLink(s.whatsapp, `Halo Istana Block, saya baca artikel "${a.title}" dan mau minta penawaran.`)} target="_blank" rel="noopener">
          Minta penawaran
        </a>
      </aside>
      {shownRelated.length > 0 && (
        <section style={{ marginTop: 56 }} aria-labelledby="related-articles-title">
          <div className="section-head" style={{ marginBottom: 20 }}>
            <h2 id="related-articles-title" style={{ fontSize: "clamp(24px, 3vw, 32px)" }}>Panduan terkait lainnya</h2>
            <Link href={`/artikel?kategori=${encodeURIComponent(a.category)}`} style={{ fontWeight: 600 }}>Lihat topik {a.category} →</Link>
          </div>
          <div className="grid-cards artikel-grid">
            {shownRelated.map((r) => (
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
                  coverMeta: r.coverMeta,
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
