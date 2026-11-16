import type { Metadata } from "next";
import Link from "next/link";
import { LandingFooter, LandingHeader, LandingStickyBar } from "@/components/LandingChrome";
import { Hex } from "@/components/Hex";
import { JsonLd } from "@/components/JsonLd";
import { Markdown } from "@/components/Markdown";
import { SpecSheetGrid } from "@/components/SpecSheetGrid";
import specSheets from "@/data/spec-sheets.json";
import { getEnv } from "@/db";
import type { PriceRow, Product } from "@/db/schema";
import { imageUrl, priceLabel, rupiah, tanggal, telLink, waLink } from "@/lib/format";
import { productOffers } from "@/lib/jsonld";
import { getProductBySlug, listProducts } from "@/lib/queries";
import { responsif } from "@/lib/img";
import { getSettings } from "@/lib/settings";
import { clampDescription, clampTitle, fitTitle } from "@/lib/title";

type Props = { params: Promise<{ slug: string }> };

function formatGravelText(text: string): string {
  return text.replace(
    /(gravel\s*\(\s*gr[ae]ff?(?:el|le)\s*\))|(?<![/-])\b(gr[ae]ff?(?:el|le))\b(?!-)/gi,
    (full, wrapped: string | undefined, word: string | undefined) => {
      if (wrapped) return full;
      if (!word) return full;
      return word[0] === word[0].toUpperCase() ? "Gravel (Greffel)" : "gravel (greffel)";
    },
  );
}

function normalizeProductDisplay(p: Product): Product {
  if (p.slug !== "greffel-beton") return p;
  return {
    ...p,
    name: formatGravelText(p.name),
    summary: formatGravelText(p.summary),
    description: formatGravelText(p.description),
    seoTitle: p.seoTitle ? formatGravelText(p.seoTitle) : p.seoTitle,
    seoDescription: p.seoDescription ? formatGravelText(p.seoDescription) : p.seoDescription,
    waText: p.waText ? formatGravelText(p.waText) : p.waText,
    specs: p.specs.map((x) => ({ label: formatGravelText(x.label), value: formatGravelText(x.value) })),
    priceRows: p.priceRows.map((r) => ({
      ...r,
      group: formatGravelText(r.group),
      variant: formatGravelText(r.variant),
      detail: formatGravelText(r.detail),
    })),
    faq: p.faq.map((f) => ({ q: formatGravelText(f.q), a: formatGravelText(f.a) })),
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const raw = await getProductBySlug(slug);
  if (!raw) {
    return {
      title: "Penawaran Produk Istana Block Purwakarta",
      robots: { index: false, follow: false },
    };
  }
  const p = normalizeProductDisplay(raw);
  const fallbackTitle = `Penawaran Harga ${p.name} Purwakarta - Pabrik Langsung`;
  const title = clampTitle(p.seoTitle ? `Penawaran ${p.seoTitle}` : fallbackTitle);
  const price = priceLabel(p);
  let summary = p.summary;
  const room = 155 - price.length - 2;
  if (summary.length > room) summary = summary.slice(0, room).replace(/[\s,.;:]+\S*$/, "") + "…";
  const description = clampDescription(p.seoDescription || `${summary} ${price}. Penawaran resmi pabrik.`);
  const img = imageUrl(p.imageKey);

  return {
    title: p.seoTitle ? { absolute: clampTitle(p.seoTitle) } : fitTitle(fallbackTitle),
    description,
    // Google Ads landing page: noindex agar tidak memicu duplikat konten, canonical diarahkan ke halaman produk resmi
    robots: { index: false, follow: false },
    alternates: { canonical: `/produk/${p.slug}` },
    openGraph: {
      title,
      description,
      url: `/landing/${p.slug}`,
      images: img
        ? [img]
        : [
            { url: "/og-default.webp", width: 1200, height: 630, type: "image/webp" },
            { url: "/og-default.jpg", width: 1200, height: 630, type: "image/jpeg" },
          ],
    },
  };
}

const STEPS = [
  { t: "Kirim kebutuhan proyek", d: "Sebutkan volume, ukuran, dan titik lokasi proyek via WhatsApp." },
  { t: "Terima penawaran resmi", d: "Rincian harga pabrik, estimasi ongkir, dan jadwal kirim tertulis." },
  { t: "DP saat PO", d: "Pembayaran DP aman saat pemesanan, pelunasan saat barang tiba di lokasi." },
  { t: "Dikirim armada pabrik", d: "Pengiriman langsung dari workshop pabrik Purwakarta dengan armada mandiri." },
];

function groupRows(rows: PriceRow[]) {
  const map = new Map<string, PriceRow[]>();
  for (const r of rows) {
    const g = r.group || "Daftar harga";
    map.set(g, [...(map.get(g) ?? []), r]);
  }
  return [...map.entries()];
}

export default async function ProductLandingPage({ params }: Props) {
  const { slug } = await params;
  const [raw, s, env, allProducts] = await Promise.all([
    getProductBySlug(slug),
    getSettings(),
    getEnv(),
    listProducts(),
  ]);

  // ZERO-LEAK RESCUE: Jika produk terhapus atau slug tidak ditemukan
  if (!raw) {
    const rescueWaText = `Halo Istana Block, saya dari iklan Google ingin menanyakan informasi produk dan penawaran harga pabrik untuk kebutuhan proyek saya.`;
    const rescueWaHref = waLink(s.whatsapp, rescueWaText);

    return (
      <>
        <LandingHeader s={s} waHref={rescueWaHref} />
        <div className="wrap" style={{ paddingTop: 48, paddingBottom: 64, textAlign: "center", maxWidth: 680 }}>
          <span
            style={{
              display: "inline-block",
              padding: "4px 14px",
              background: "#fee2e2",
              color: "#991b1b",
              borderRadius: 99,
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 16,
            }}
          >
            Pemberitahuan Penawaran Pabrik
          </span>
          <h1 style={{ fontSize: "clamp(24px, 4vw, 36px)", lineHeight: 1.25, color: "var(--biru-tua, #0e2a6b)" }}>
            Katalog Penawaran Produk Sedang Diperbarui
          </h1>
          <p style={{ fontSize: 16, color: "#64748b", lineHeight: 1.6, margin: "16px 0 28px" }}>
            Halaman penawaran untuk produk ini sedang disesuaikan dengan kapasitas produksi dan pembaruan harga material terkini. Anda tetap dapat meminta penawaran harga khusus dan mengecek ketersediaan stok langsung melalui tim sales pabrik kami.
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap", marginBottom: 36 }}>
            <a
              className="btn btn-primary"
              href={rescueWaHref}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 16, padding: "12px 24px" }}
            >
              Chat WhatsApp Sales Pabrik
            </a>
          </div>

          <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 28 }}>
            <h2 style={{ fontSize: 18, marginBottom: 16, color: "#334155" }}>
              Atau Lihat Penawaran Produk Pabrik Lainnya:
            </h2>
            <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 10 }}>
              {allProducts
                .filter((p) => p.category !== "Jasa")
                .map((p) => (
                  <Link
                    key={p.id}
                    href={`/landing/${p.slug}`}
                    className="btn btn-ghost btn-sm"
                    style={{ background: "#f8fafc", borderColor: "#cbd5e1" }}
                  >
                    {p.name}
                  </Link>
                ))}
            </div>
          </div>
        </div>
        <LandingFooter s={s} />
      </>
    );
  }

  const p = normalizeProductDisplay(raw);
  const img = imageUrl(p.imageKey);
  const groups = groupRows(p.priceRows);
  const hasDetail = p.priceRows.some((r) => r.detail);
  const offers = productOffers(p, env.SITE_URL);
  const url = `${env.SITE_URL}/landing/${p.slug}`;

  // Format pesan WhatsApp khusus Google Ads
  const waText = `Halo Istana Block, saya melihat penawaran ${p.name} di Google Ads. Boleh minta rincian harga & estimasi ongkir ke lokasi proyek saya?`;
  const waHref = waLink(s.whatsapp, waText);

  const h1 = p.category === "Jasa" || /purwakarta/i.test(p.name) ? p.name : `${p.name} Purwakarta`;
  const noPrices = p.priceRows.length > 0 && p.priceRows.every((r) => r.price == null);

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
            ...(offers ? { offers } : {}),
          },
          ...(p.faq.length
            ? [
                {
                  "@context": "https://schema.org",
                  "@type": "FAQPage",
                  mainEntity: p.faq.map((f) => ({
                    "@type": "Question",
                    name: f.q,
                    acceptedAnswer: { "@type": "Answer", text: f.a },
                  })),
                },
              ]
            : []),
        ]}
      />

      <LandingHeader s={s} waHref={waHref} />

      <div className="wrap" style={{ paddingTop: 20 }}>
        {/* HERO SECTION ON-POINT */}
        <section className="product-hero" style={{ paddingBottom: 40 }}>
          <div className="hero-text" style={{ gap: 20 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span
                style={{
                  display: "inline-block",
                  padding: "4px 10px",
                  background: "var(--biru-muda, #e0f2fe)",
                  color: "var(--biru-tua, #0e2a6b)",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                }}
              >
                HARGA PABRIK LANGSUNG
              </span>
              {p.tkdn && (
                <span
                  style={{
                    display: "inline-block",
                    padding: "4px 10px",
                    background: "#ecfdf5",
                    color: "#065f46",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  TKDN Kemenperin {p.tkdn}%
                </span>
              )}
            </div>

            <h1 style={{ fontSize: "clamp(28px, 4.5vw, 44px)", lineHeight: 1.15, margin: 0 }}>
              {h1}
            </h1>

            <p className="hero-lead" style={{ fontSize: 18, margin: 0, color: "#334155" }}>
              {p.summary}
            </p>

            {p.priceFrom != null && (
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: "12px 16px",
                  width: "fit-content",
                }}
              >
                <div style={{ fontSize: 13, color: "#64748b" }}>Harga acuan pabrik:</div>
                <div className="tabular" style={{ fontSize: 22, margin: 0, fontWeight: 700 }}>
                  <span style={{ color: "var(--biru-tua, #0e2a6b)" }}>{priceLabel(p)}</span>{" "}
                  <span className="muted" style={{ fontSize: 14, fontWeight: 400 }}>· belum termasuk ongkir</span>
                </div>
              </div>
            )}

            {(p.specs.length > 0 || p.tkdn) && (
              <dl className="specs">
                {p.specs.map((x, i) => (
                  <div key={i}><dt>{x.label}</dt><dd>{x.value}</dd></div>
                ))}
                {p.tkdn && <div className="accent"><dt>TKDN Kemenperin</dt><dd>{p.tkdn}%</dd></div>}
              </dl>
            )}

            <div className="actions" style={{ marginTop: 4 }}>
              <a
                className="btn btn-primary"
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 16, padding: "12px 24px" }}
              >
                Minta Penawaran Harga + Ongkir
              </a>
              {p.priceRows.length > 0 && (
                <a className="btn btn-ghost" href="#harga">
                  {noPrices ? "Lihat Ukuran" : "Lihat Tabel Harga"}
                </a>
              )}
            </div>
          </div>

          <div className="product-art">
            <div className="hex" aria-hidden="true" style={{ position: "absolute", right: 4, top: 0, width: 210, height: 242, background: "var(--biru-muda)", transform: "rotate(7deg)" }} />
            <Hex size={84} color="#FE5722" className="deco" style={{ right: 18, bottom: 6, transform: "rotate(-6deg)" }} />
            <Hex size={48} color="#B5B4AF" className="deco" style={{ left: 8, bottom: 40, transform: "rotate(9deg)" }} />
            <figure className={`hex ${img ? "" : "hexpat-light"}`} style={{ position: "relative" }}>
              {img ? (
                <>
                  <img src={img} {...responsif(img, "(max-width: 720px) 254px, 404px")} alt={`Foto ${p.name}`} width={1600} height={1200} fetchPriority="high" loading="eager" decoding="async" />
                  <span className="card-watermark product-hero-watermark" aria-hidden="true">
                    <img src="/brand/logo-istana-block-300.webp" alt="" width={300} height={90} loading="lazy" decoding="async" />
                  </span>
                </>
              ) : <figcaption>Foto {p.name.toLowerCase()} menyusul</figcaption>}
            </figure>
          </div>
        </section>

        {/* TABEL HARGA & UKURAN */}
        {p.priceRows.length > 0 && (
          <section id="harga" style={{ paddingBottom: 56 }}>
            <div className="section-head">
              <h2>{noPrices ? `Ukuran dan Spesifikasi ${p.name}` : `Daftar Harga Pabrik ${p.name}`}</h2>
              <p className="muted small">
                {noPrices ? (
                  "Ukuran dan jenis yang tersedia. Harga dikonfirmasi lewat penawaran tertulis, belum termasuk ongkir."
                ) : (
                  <>
                    Harga langsung pabrik Purwakarta (belum termasuk ongkir). Penawaran tertulis mengikat yang berlaku untuk proyek.
                    <span style={{ display: "block" }}>
                      Harga diperbarui <time dateTime={p.updatedAt.toISOString()}>{tanggal(p.updatedAt)}</time>
                    </span>
                  </>
                )}
              </p>
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
                        {!noPrices && <th scope="col" className="num">Harga</th>}
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
                          {!noPrices && <td className="num"><b>{r.price != null ? rupiah(r.price) : "Hubungi"}</b>{r.unit ? <span className="muted small">/{r.unit}</span> : null}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>

            <div className="actions" style={{ marginTop: 20, alignItems: "center" }}>
              <a className="btn btn-primary" href={waHref} target="_blank" rel="noopener noreferrer">
                Kirim Rincian Ukuran &amp; Dapatkan Penawaran
              </a>
              <span className="muted small">
                Kirimkan ukuran dan lokasi proyek; admin sales segera membalas dengan penawaran resmi + ongkir.
              </span>
            </div>
          </section>
        )}

        {/* LEMBAR SPESIFIKASI TEKNIS / CAD */}
        {(() => {
          const sheets = (specSheets as Record<string, { src: string; title: string; alt: string; w: number; h: number }[]>)[p.slug];
          if (!sheets?.length) return null;
          return (
            <section aria-labelledby="lembar" style={{ paddingBottom: 56 }}>
              <div className="section-head" style={{ marginBottom: 18 }}>
                <h2 id="lembar">Lembar Spesifikasi Teknis &amp; TKDN</h2>
                <p className="muted small">Gambar teknik resmi pabrik untuk acuan gambar kerja &amp; BoQ proyek.</p>
              </div>
              <SpecSheetGrid items={sheets} />
            </section>
          );
        })()}

        {/* DESKRIPSI & KEUNGGULAN PRODUK */}
        {p.description && (
          <section style={{ paddingBottom: 56 }}>
            <Markdown>{p.description}</Markdown>
          </section>
        )}

        {/* CARA MEMESAN */}
        <section style={{ paddingBottom: 56 }}>
          <h2 style={{ fontSize: 32, marginBottom: 20 }}>Cara Pemesanan Cepat &amp; Aman</h2>
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

        {/* FAQ & CTA ASIDE */}
        <section className="duo" style={{ paddingTop: 0, paddingBottom: 40 }}>
          {p.faq.length > 0 && (
            <div className="stack faq" style={{ flex: "1 1 520px", minWidth: 0, gap: 12 }}>
              <h2 style={{ fontSize: 32, marginBottom: 8 }}>Pertanyaan Umum (FAQ)</h2>
              {p.faq.map((f, i) => (
                <details key={i}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          )}
          <aside className="cta-aside hexpat" style={{ flex: "1 1 320px", minWidth: 0 }}>
            <h2>Minta Penawaran Tertulis</h2>
            <p>Sampaikan volume kebutuhan dan titik lokasi pengiriman. Tim sales kami merespon cepat dengan surat penawaran resmi.</p>
            <a className="btn btn-primary" href={waHref} target="_blank" rel="noopener noreferrer">
              WhatsApp {s.whatsapp}
            </a>
            <a href={telLink(s.phone)}>atau Telepon {s.phone}</a>
          </aside>
        </section>
      </div>

      <LandingFooter s={s} />

      {/* STICKY BOTTOM BAR FOR MOBILE */}
      <LandingStickyBar
        priceLabel={p.priceFrom != null ? priceLabel(p) : undefined}
        waHref={waHref}
        productName={p.name}
      />
    </>
  );
}
