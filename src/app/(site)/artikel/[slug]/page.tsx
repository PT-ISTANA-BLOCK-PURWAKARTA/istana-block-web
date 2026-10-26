import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { Markdown } from "@/components/Markdown";
import { getEnv } from "@/db";
import { imageUrl, tanggal, waLink } from "@/lib/format";
import { getArticleBySlug } from "@/lib/queries";
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
  const img = imageUrl(a.coverKey);
  return (
    <article className="wrap" style={{ paddingBottom: 56 }}>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: a.title,
          description: a.excerpt,
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
        <span className="small muted">{tanggal(a.publishedAt)}</span>
        <h1 style={{ fontSize: "clamp(32px, 4vw, 50px)" }}>{a.title}</h1>
        {a.excerpt && <p className="hero-lead">{a.excerpt}</p>}
      </header>
      {img && <img className="article-cover hexlong" src={img} alt="" width={1200} height={675} fetchPriority="high" decoding="async" style={{ marginBottom: 32 }} />}
      <Markdown>{a.content}</Markdown>
      <aside className="cta-aside hexpat" style={{ marginTop: 40, maxWidth: 720 }}>
        <h2>Butuh material untuk proyek Anda?</h2>
        <p>Kirim ukuran dan lokasi, admin kami kirim penawaran lengkap dengan ongkir.</p>
        <a className="btn btn-primary" style={{ alignSelf: "flex-start" }} href={waLink(s.whatsapp, `Halo Istana Block, saya baca artikel "${a.title}" dan mau minta penawaran.`)} target="_blank" rel="noopener">
          Minta penawaran
        </a>
      </aside>
    </article>
  );
}
