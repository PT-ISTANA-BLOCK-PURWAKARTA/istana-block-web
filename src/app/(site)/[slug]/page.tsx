import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { Markdown } from "@/components/Markdown";
import { getEnv } from "@/db";
import { imageUrl, telLink, waLink } from "@/lib/format";
import { PAGE_SLUG_RE } from "@/lib/pages";
import { getPageBySlug } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { fitTitle } from "@/lib/title";

type Props = { params: Promise<{ slug: string }> };

// Slug di luar format slugify (mis. /favicon.ico) langsung 404 tanpa query ke database.
async function load(slug: string) {
  return PAGE_SLUG_RE.test(slug) ? getPageBySlug(slug) : undefined;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const pg = await load((await params).slug);
  if (!pg) return { title: "Halaman tidak ditemukan", robots: { index: false } };
  const title = pg.seoTitle || pg.title;
  const description = pg.seoDescription || pg.excerpt || undefined;
  const img = imageUrl(pg.coverKey);
  return {
    // seoTitle dari panel sudah lengkap dengan merek; "absolute" mencegah template layout menempelkan akhiran merek kedua.
    title: pg.seoTitle ? { absolute: pg.seoTitle } : fitTitle(pg.title),
    description,
    alternates: { canonical: `/${pg.slug}` },
    openGraph: { title, description, url: `/${pg.slug}`, images: img ? [img] : [{ url: "/og-default.jpg", width: 1200, height: 630 }] },
  };
}

export default async function StaticPage({ params }: Props) {
  const { slug } = await params;
  const [pg, s, env] = await Promise.all([load(slug), getSettings(), getEnv()]);
  if (!pg) notFound();
  const isArea = pg.kind === "area";
  const img = imageUrl(pg.coverKey);
  const url = `${env.SITE_URL}/${pg.slug}`;
  // Nama area untuk tombol dan pesan WhatsApp: judul tanpa awalan produk ("Paving Block Subang" jadi "Subang").
  const areaName = pg.title.replace(/^paving block\s+/i, "").trim() || pg.title;
  const waText = isArea
    ? `Halo Istana Block, saya ingin cek harga + ongkir ke ${areaName}. Produk: ..., Volume: ..., Lokasi: ...`
    : `Halo Istana Block, saya membaca halaman "${pg.title}" dan ingin bertanya.`;
  const crumbs = [
    { name: "Beranda", item: env.SITE_URL },
    ...(isArea ? [{ name: "Area pengiriman", item: `${env.SITE_URL}/area-pengiriman` }] : []),
    { name: pg.title, item: url },
  ];

  return (
    <article className="wrap" style={{ paddingBottom: 56 }}>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            "@id": url,
            url,
            name: pg.seoTitle || pg.title,
            ...(pg.seoDescription || pg.excerpt ? { description: pg.seoDescription || pg.excerpt } : {}),
            inLanguage: "id-ID",
            dateModified: pg.updatedAt.toISOString(),
            ...(img ? { primaryImageOfPage: img.startsWith("http") ? img : `${env.SITE_URL}${img}` } : {}),
            isPartOf: { "@type": "WebSite", url: env.SITE_URL, name: s.company_name },
            about: { "@id": `${env.SITE_URL}/#business` },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: c.item })),
          },
        ]}
      />
      <nav aria-label="Lokasi halaman" className="breadcrumb">
        <ol>
          <li><Link href="/">Beranda</Link></li>
          {isArea && <li><Link href="/area-pengiriman">Area pengiriman</Link></li>}
          <li>{pg.title}</li>
        </ol>
      </nav>
      <header className="stack" style={{ gap: 14, padding: "24px 0 28px", maxWidth: 820 }}>
        {isArea && (
          <div className="pills">
            <span className="pill pill-orange">Area pengiriman</span>
          </div>
        )}
        <h1 style={{ fontSize: "clamp(32px, 4vw, 50px)" }}>{pg.title}</h1>
        {pg.excerpt && <p className="hero-lead">{pg.excerpt}</p>}
        {/* Halaman area adalah pintu masuk trafik geo: CTA di atas lipatan, tidak menunggu akhir artikel. */}
        {isArea && (
          <a
            className="btn btn-primary"
            style={{ alignSelf: "flex-start", lineHeight: 1.25, paddingBlock: 10 }}
            href={waLink(s.whatsapp, waText)}
            target="_blank"
            rel="noopener"
          >
            Cek harga + ongkir ke {areaName}
          </a>
        )}
      </header>
      {img && <img className="article-cover hexlong" src={img} alt="" width={1200} height={675} fetchPriority="high" decoding="async" style={{ marginBottom: 32 }} />}
      <Markdown>{pg.content}</Markdown>
      <aside className="cta-aside hexpat" style={{ marginTop: 40, maxWidth: 720 }}>
        {isArea ? (
          <>
            <h2>Cek harga + ongkir ke lokasi Anda</h2>
            <p>Sebutkan produk, volume, dan titik lokasi proyek. Admin mengirim penawaran tertulis berisi harga, ongkir, dan jadwal kirim.</p>
          </>
        ) : (
          <>
            <h2>Ada pertanyaan?</h2>
            <p>Hubungi admin kami lewat WhatsApp atau telepon pada jam operasional.</p>
          </>
        )}
        <a className="btn btn-primary" style={{ alignSelf: "flex-start" }} href={waLink(s.whatsapp, waText)} target="_blank" rel="noopener">
          WhatsApp {s.whatsapp}
        </a>
        <a href={telLink(s.phone)}>atau telepon {s.phone}</a>
      </aside>
    </article>
  );
}
