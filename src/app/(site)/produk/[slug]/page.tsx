import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Hex } from "@/components/Hex";
import { JsonLd } from "@/components/JsonLd";
import { Markdown } from "@/components/Markdown";
import { ProductCard } from "@/components/ProductCard";
import specSheets from "@/data/spec-sheets.json";
import { getEnv } from "@/db";
import type { PriceRow } from "@/db/schema";
import { imageUrl, priceLabel, rupiah, telLink, waLink } from "@/lib/format";
import { getProductBySlug, listProducts } from "@/lib/queries";
import { getSettings } from "@/lib/settings";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProductBySlug((await params).slug);
  if (!p) return { title: "Produk tidak ditemukan", robots: { index: false } };
  const title = p.seoTitle || `Harga ${p.name} Purwakarta`;
  const price = priceLabel(p);
  let summary = p.summary;
  const room = 155 - price.length - 2;
  if (summary.length > room) summary = summary.slice(0, room).replace(/[\s,.;:]+\S*$/, "") + "…";
  const description = p.seoDescription || `${summary} ${price}.`;
  const img = imageUrl(p.imageKey);
  return {
    title,
    description,
    alternates: { canonical: `/produk/${p.slug}` },
    openGraph: { title, description, url: `/produk/${p.slug}`, images: img ? [img] : ["/img/pabrik/pabrik-mesin-paving.webp"] },
  };
}

const STEPS = [
  { t: "Kirim kebutuhan", d: "Ukuran, jumlah, gambar kerja atau BoQ bila ada, dan titik lokasi." },
  { t: "Terima penawaran", d: "Harga, ongkir, dan jadwal kirim dalam satu dokumen tertulis." },
  { t: "DP saat PO", d: "Pelunasan saat barang tiba di lokasi, sesuai kesepakatan." },
  { t: "Dikirim armada pabrik", d: "Truk crane dan flatbed langsung dari pabrik Purwakarta." },
];

function groupRows(rows: PriceRow[]) {
  const map = new Map<string, PriceRow[]>();
  for (const r of rows) {
    const g = r.group || "Daftar harga";
    map.set(g, [...(map.get(g) ?? []), r]);
  }
  return [...map.entries()];
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const [p, s, env, all] = await Promise.all([getProductBySlug(slug), getSettings(), getEnv(), listProducts()]);
  if (!p) notFound();
  const img = imageUrl(p.imageKey);
  const groups = groupRows(p.priceRows);
  const hasDetail = p.priceRows.some((r) => r.detail);
  const related = all.filter((x) => x.id !== p.id && x.category !== "Jasa").slice(0, 3);
  const prices = p.priceRows.map((r) => r.price).filter((x): x is number => x != null);
  const url = `${env.SITE_URL}/produk/${p.slug}`;
  const waText = p.waText?.trim() || `Halo Istana Block, saya mau tanya harga ${p.name}. Ukuran: ..., jumlah: ..., lokasi kirim: ...`;

  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": p.category === "Jasa" ? "Service" : "Product",
            name: p.name,
            description: p.summary,
            url,
            ...(img ? { image: img.startsWith("http") ? img : `${env.SITE_URL}${img}` } : {}),
            brand: { "@type": "Brand", name: "Istana Block" },
            ...(prices.length || p.priceFrom != null
              ? {
                  offers: {
                    "@type": "AggregateOffer",
                    priceCurrency: "IDR",
                    lowPrice: prices.length ? Math.min(...prices) : p.priceFrom,
                    highPrice: prices.length ? Math.max(...prices) : (p.priceTo ?? p.priceFrom),
                    offerCount: Math.max(prices.length, 1),
                    availability: "https://schema.org/InStock",
                    seller: { "@id": `${env.SITE_URL}/#business` },
                  },
                }
              : {}),
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Beranda", item: env.SITE_URL },
              { "@type": "ListItem", position: 2, name: "Produk", item: `${env.SITE_URL}/produk` },
              { "@type": "ListItem", position: 3, name: p.name, item: url },
            ],
          },
          ...(p.faq.length
            ? [{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: p.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }]
            : []),
        ]}
      />
      <div className="wrap">
        <nav aria-label="Lokasi halaman" className="breadcrumb">
          <ol><li><Link href="/">Beranda</Link></li><li><Link href="/produk">Produk</Link></li><li>{p.name}</li></ol>
        </nav>
        <section className="product-hero">
          <div className="hero-text" style={{ gap: 22 }}>
            <h1>{p.name}</h1>
            <p className="hero-lead" style={{ fontSize: 18 }}>{p.summary}</p>
            {(p.specs.length > 0 || p.tkdn) && (
              <dl className="specs">
                {p.specs.map((x, i) => (
                  <div key={i}><dt>{x.label}</dt><dd>{x.value}</dd></div>
                ))}
                {p.tkdn && <div className="accent"><dt>TKDN Kemenperin</dt><dd>{p.tkdn}%</dd></div>}
              </dl>
            )}
            <div className="actions">
              <a className="btn btn-primary" href={waLink(s.whatsapp, waText)} target="_blank" rel="noopener">Minta harga + ongkir</a>
              {p.priceRows.length > 0 && <a className="btn btn-ghost" href="#harga">Lihat tabel harga</a>}
            </div>
          </div>
          <div className="product-art">
            <div className="hex" aria-hidden="true" style={{ position: "absolute", right: 4, top: 0, width: 210, height: 242, background: "var(--biru-muda)", transform: "rotate(7deg)" }} />
            <Hex size={84} color="#FE5722" className="deco" style={{ right: 18, bottom: 6, transform: "rotate(-6deg)" }} />
            <Hex size={48} color="#B5B4AF" className="deco" style={{ left: 8, bottom: 40, transform: "rotate(9deg)" }} />
            <figure className={`hex ${img ? "" : "hexpat-light"}`}>
              {img ? <img src={img} alt={`Foto ${p.name}`} /> : <figcaption>Foto {p.name.toLowerCase()} menyusul</figcaption>}
            </figure>
          </div>
        </section>

        {p.priceRows.length > 0 && (
          <section id="harga" style={{ paddingBottom: 56 }}>
            <div className="section-head">
              <h2>Daftar harga {p.name}</h2>
              <p className="muted small">Belum termasuk ongkir. Harga dapat berubah; penawaran tertulis yang berlaku.</p>
            </div>
            <div className="tables">
              {groups.map(([g, rows]) => (
                <div className="table-card" key={g}>
                  <table>
                    <caption>{g}</caption>
                    <thead>
                      <tr>
                        <th scope="col">Ukuran / jenis</th>
                        {hasDetail && <th scope="col" className="col-detail">Keterangan</th>}
                        <th scope="col" className="num">Harga</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i}>
                          <td className="variant">
                            {r.variant}
                            {r.detail && <div className="detail-inline small muted">{r.detail}</div>}
                          </td>
                          {hasDetail && <td className="muted col-detail">{r.detail}</td>}
                          <td className="num"><b>{r.price != null ? rupiah(r.price) : "Hubungi"}</b>{r.unit ? <span className="muted small">/{r.unit}</span> : null}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </section>
        )}

        {(() => {
          const sheets = (specSheets as Record<string, { src: string; title: string; alt: string; w: number; h: number }[]>)[p.slug];
          if (!sheets?.length) return null;
          return (
            <section aria-labelledby="lembar" style={{ paddingBottom: 56 }}>
              <div className="section-head" style={{ marginBottom: 18 }}>
                <h2 id="lembar">Lembar spesifikasi &amp; TKDN</h2>
                <p className="muted small">Klik untuk melihat ukuran penuh.</p>
              </div>
              <div className={`sheets${sheets.length === 1 ? " single" : ""}`}>
                {sheets.map((x) => (
                  <a key={x.src} href={x.src} target="_blank" rel="noopener" className="sheet">
                    <img src={x.src} alt={x.alt} width={x.w} height={x.h} loading="lazy" decoding="async" />
                    <span>{x.title}<i aria-hidden="true">↗</i></span>
                  </a>
                ))}
              </div>
            </section>
          );
        })()}

        {p.description && (
          <section style={{ paddingBottom: 56 }}>
            <Markdown>{p.description}</Markdown>
          </section>
        )}

        <section style={{ paddingBottom: 56 }}>
          <h2 style={{ fontSize: 34, marginBottom: 22 }}>Cara memesan</h2>
          <ol className="steps" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {STEPS.map((x, i) => (
              <li className="step" key={x.t}>
                <span className="step-n hex" aria-hidden="true">{i + 1}</span>
                <b style={{ fontSize: 18, color: "var(--biru-tua)" }}>{x.t}</b>
                <span className="muted">{x.d}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="duo" style={{ paddingTop: 0 }}>
          {p.faq.length > 0 && (
            <div className="stack faq" style={{ flex: "1 1 520px", minWidth: 0, gap: 12 }}>
              <h2 style={{ fontSize: 34, marginBottom: 8 }}>Pertanyaan umum</h2>
              {p.faq.map((f, i) => (
                <details key={i}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          )}
          <aside className="cta-aside hexpat" style={{ flex: "1 1 320px", minWidth: 0 }}>
            <h2>Kirim kebutuhan Anda</h2>
            <p>Ukuran, jumlah, dan lokasi proyek. Admin mengirim penawaran berisi harga, ongkir, dan jadwal.</p>
            <a className="btn btn-primary" href={waLink(s.whatsapp, waText)} target="_blank" rel="noopener">WhatsApp {s.whatsapp}</a>
            <a href={telLink(s.phone)}>atau telepon {s.phone}</a>
          </aside>
        </section>

        {related.length > 0 && (
          <section className="section" style={{ paddingTop: 24 }}>
            <h2 style={{ fontSize: 28, marginBottom: 20 }}>Produk lain</h2>
            <div className="grid-cards">
              {related.map((x) => (
                <ProductCard key={x.id} p={x} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
