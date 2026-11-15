import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleCover } from "@/components/ArticleCover";
import { JsonLd } from "@/components/JsonLd";
import { LocalEstimator } from "@/components/LocalEstimator";
import { LocalMobileDock } from "@/components/LocalMobileDock";
import { LocalTrustBadges } from "@/components/LocalTrustBadges";
import { Markdown } from "@/components/Markdown";
import "@/components/local-enhancements.css";
import { getEnv } from "@/db";
import { imageUrl, telLink, waLink } from "@/lib/format";
import { PAGE_SLUG_RE } from "@/lib/pages";
import { getPageBySlug, listPages } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { clampDescription, clampTitle, fitTitle } from "@/lib/title";

const H1_OVERRIDES: Record<string, string> = {
  "pasang-paving-istanablock": "Profil Produksi & Pemasangan Paving Block",
  servis: "Layanan Pemasangan Paving & Beton Precast",
};

type Props = { params: Promise<{ slug: string }> };

// Slug di luar format slugify (mis. /favicon.ico) langsung 404 tanpa query ke database.
async function load(slug: string) {
  return PAGE_SLUG_RE.test(slug) ? getPageBySlug(slug) : undefined;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const pg = await load((await params).slug);
  if (!pg) return { title: "Halaman tidak ditemukan", robots: { index: false } };
  const title = clampTitle(pg.seoTitle || pg.title);
  const rawDesc = pg.seoDescription || pg.excerpt || "";
  const description = rawDesc ? clampDescription(rawDesc) : undefined;
  const img = imageUrl(pg.coverKey);
  return {
    // seoTitle dari panel sudah lengkap dengan merek; "absolute" mencegah template layout menempelkan akhiran merek kedua.
    title: pg.seoTitle ? { absolute: clampTitle(pg.seoTitle) } : fitTitle(pg.title),
    description,
    alternates: { canonical: `/${pg.slug}` },
    openGraph: {
      title,
      description,
      url: `/${pg.slug}`,
      images: img
        ? [img]
        : [
            { url: "/og-default.webp", width: 1200, height: 630, type: "image/webp" },
            { url: "/og-default.jpg", width: 1200, height: 630, type: "image/jpeg" },
          ],
    },
  };
}

export default async function StaticPage({ params }: Props) {
  const { slug } = await params;
  const [pg, s, env, allPages] = await Promise.all([load(slug), getSettings(), getEnv(), listPages()]);
  if (!pg) notFound();
  const isArea = pg.kind === "area";
  const siblingInfoPages = allPages.filter((x) => x.slug !== pg.slug && x.slug !== "sampel" && x.slug !== "katalog");
  const displayTitle = H1_OVERRIDES[pg.slug] ?? pg.title;
  const img = imageUrl(pg.coverKey);
  const url = `${env.SITE_URL}/${pg.slug}`;
  // Nama area untuk tombol dan pesan WhatsApp: judul tanpa awalan produk ("Paving Block Subang" jadi "Subang").
  const areaName = pg.title.replace(/^paving block\s+/i, "").trim() || pg.title;
  const waText = isArea
    ? `Halo Istana Block, saya ingin cek harga + ongkir ke ${areaName}. Produk: ..., Volume: ..., Lokasi: ...`
    : `Halo Istana Block, saya membaca halaman "${pg.title}" dan ingin bertanya.`;
  // Ekstrak kecamatan untuk kalkulator interaktif
  const kecMatch = pg.content.match(/\*\*Kecamatan:\*\*\s*([^\n]+)/i);
  const districts = kecMatch
    ? kecMatch[1]
        .split(/,|dan/i)
        .map((d) => d.replace(/[\.\*]/g, "").trim())
        .filter((d) => d.length > 2)
    : [areaName];

  // Ekstrak FAQ untuk Rich Snippets Google (Schema FAQPage)
  const faqMatches = isArea
    ? Array.from(pg.content.matchAll(/###\s+([^\n?]+(?:\?|[^\n]+))\n+([\s\S]*?)(?=(?:\n###|\n##|$))/g))
    : [];
  const faqEntities = faqMatches.slice(0, 8).map((m) => ({
    "@type": "Question",
    name: m[1].trim(),
    acceptedAnswer: {
      "@type": "Answer",
      text: m[2].replace(/[#*_\[\]\(\)]/g, "").trim(),
    },
  }));

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
          ...(faqEntities.length > 0
            ? [
                {
                  "@context": "https://schema.org",
                  "@type": "FAQPage",
                  mainEntity: faqEntities,
                },
              ]
            : []),
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
        <h1 style={{ fontSize: "clamp(32px, 4vw, 50px)" }}>{displayTitle}</h1>
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
      {isArea && <LocalTrustBadges areaName={areaName} />}
      {isArea && <LocalEstimator areaName={areaName} districts={districts} whatsapp={s.whatsapp} />}
      {img && (
        <div className="article-cover-wrap">
          <ArticleCover
            variant="hero"
            title={pg.title}
            category={isArea ? "Area pengiriman" : "Panduan Material"}
            excerpt={pg.excerpt ?? ""}
            coverSrc={img}
            sizes="(max-width: 960px) 92vw, 820px"
            priority
          />
        </div>
      )}
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
      <section className="info-links-box panel" style={{ marginTop: 32, maxWidth: 820 }} aria-labelledby="info-terkait-heading">
        <h2 id="info-terkait-heading" style={{ fontSize: 22 }}>Panduan, area kirim &amp; dokumen terkait</h2>
        <div className="chips" style={{ marginTop: 8 }}>
          <Link prefetch={false} className="chip-link" href="/produk">Daftar produk &amp; harga</Link>
          <Link prefetch={false} className="chip-link" href="/katalog">Katalog PDF (11 hal.)</Link>
          <Link prefetch={false} className="chip-link" href="/sampel">Katalog sampel &amp; QR</Link>
          <Link prefetch={false} className="chip-link" href="/paket-proyek">Paket proyek</Link>
          {siblingInfoPages.map((p) => (
            <Link key={p.id} prefetch={false} className="chip-link" href={`/${p.slug}`}>
              {H1_OVERRIDES[p.slug] ?? p.title}
            </Link>
          ))}
        </div>
      </section>
      {isArea && <LocalMobileDock areaName={areaName} whatsapp={s.whatsapp} />}
    </article>
  );
}
