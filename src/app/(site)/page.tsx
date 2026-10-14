import type { Metadata } from "next";
import Link from "next/link";
import { Calculator } from "@/components/Calculator";
import { ClientLogos } from "@/components/ClientLogos";
import { FaqList } from "@/components/FaqList";
import { GALLERY, GalleryGrid } from "@/components/Gallery";
import { FeatureReel } from "@/components/FeatureReel";
import { Hex } from "@/components/Hex";
import { HexDivider } from "@/components/HexDivider";
import { JsonLd } from "@/components/JsonLd";
import { ProductCard } from "@/components/ProductCard";
import { getEnv } from "@/db";
import { rupiah, tanggal, waLink } from "@/lib/format";
import { localBusiness } from "@/lib/jsonld";
import { listArticles, listProducts, listTestimonials } from "@/lib/queries";
import { getSettings, parseFaq } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    title: { absolute: s.seo_title },
    description: s.seo_description,
    alternates: { canonical: "/" },
    openGraph: { title: s.seo_title, description: s.seo_description, url: "/", images: ["/img/pabrik/pabrik-mesin-paving.webp"] },
  };
}

const TILE_COLORS = [
  { bg: "var(--oranye-muda)", fg: "var(--oranye-cta-hover)" },
  { bg: "var(--biru-muda)", fg: "var(--biru-tua)" },
  { bg: "var(--abu)", fg: "var(--tinta)" },
];

export default async function Home() {
  const [s, env, all, reviews, articles] = await Promise.all([getSettings(), getEnv(), listProducts(), listTestimonials(), listArticles(3)]);
  const products = all.filter((p) => p.featured && p.category !== "Jasa");
  const faq = parseFaq(s.home_faq);
  const jasa = all.find((p) => p.category === "Jasa");
  const tkdn = all.filter((p) => p.tkdn).slice(0, 3);
  const bestTkdn = tkdn.map((p) => parseFloat((p.tkdn ?? "").replace(",", "."))).filter(Boolean).sort((a, b) => b - a)[0];

  return (
    <>
      <JsonLd data={localBusiness(s, env.SITE_URL)} />
      <section className="wrap hero">
        <div className="hero-text">
          <div className="pills">
            <span className="pill pill-orange">Penjualan produk</span>
            <span className="pill">Jasa pemasangan</span>
            <span className="pill">Supplier proyek</span>
          </div>
          <h1>{s.hero_title}</h1>
          <p className="hero-lead">{s.hero_subtitle}</p>
          <div className="actions">
            <a className="btn btn-primary" href={waLink(s.whatsapp, "Halo Istana Block, saya mau minta penawaran.")} target="_blank" rel="noopener">
              Minta penawaran via WhatsApp
            </a>
            <Link className="btn btn-ghost" href="/produk">Lihat harga</Link>
          </div>
        </div>
        <div className="hero-art">
          <div className="back hex hexpat-light" aria-hidden="true" />
          <Hex size={92} color="#FE5722" className="deco deco-lg" style={{ left: 6, bottom: 30, transform: "rotate(-8deg)" }} />
          <Hex size={54} color="#B5B4AF" className="deco" style={{ left: 70, top: 26, transform: "rotate(5deg)" }} />
          <Hex size={40} color="#254186" className="deco" style={{ right: 30, bottom: 96, transform: "rotate(-4deg)" }} />
          <figure className="hex">
            <picture>
              <source media="(max-width: 720px)" srcSet="/img/pabrik/pabrik-mesin-paving-800.webp" />
              <img src="/img/pabrik/pabrik-mesin-paving.webp" alt="Mesin cetak paving di pabrik Istana Block Purwakarta dengan paving yang baru dicetak" width={1600} height={1334} fetchPriority="high" />
            </picture>
          </figure>
          {s.google_rating &&
            (() => {
              const inner = (
                <>
                  <b>
                    {s.google_rating} <span style={{ color: "var(--oranye)", fontSize: "inherit" }}>★</span>
                  </b>
                  <span>{s.google_review_count} ulasan Google</span>
                </>
              );
              return s.maps_url ? (
                <a className="chip" href={s.maps_url} target="_blank" rel="noopener">{inner}</a>
              ) : (
                <div className="chip">{inner}</div>
              );
            })()}
        </div>
      </section>

      <section className="wrap" aria-label="Keunggulan">
        <div className="proof">
          {[
            { big: bestTkdn ? `TKDN hingga ${String(bestTkdn).replace(".", ",")}%` : "Bersertifikat TKDN", small: "sertifikat Kemenperin", c: "#FE5722" },
            { big: s.quality_label, small: "mutu beton, berstandar SNI", c: "#254186" },
            { big: "Armada sendiri", small: "truk crane & flatbed", c: "#B5B4AF" },
            { big: `Sejak ${s.founded_year}`, small: "pabrik di Pasawahan, Purwakarta", c: "#0E2A6B" },
          ].map((x) => (
            <div key={x.big}>
              <Hex size={16} color={x.c} />
              <p>
                <b>{x.big}</b>
                <span>{x.small}</span>
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="wrap" aria-label="Klien" style={{ paddingTop: 16 }}>
        <ClientLogos />
      </section>

      <section className="wrap reel-section" aria-labelledby="reel-title">
        <div className="section-head" style={{ marginBottom: 24 }}>
          <h2 id="reel-title">Hitung, cek harga, pesan — langsung dari sini.</h2>
          <p className="muted small">Lihat cara memakai kalkulator paving dan daftar harga dalam 20 detik.</p>
        </div>
        <FeatureReel />
        <nav className="reel-links" aria-label="Coba fiturnya">
          <a href="#kalkulator"><Hex size={14} color="#FE5722" />Coba kalkulator paving</a>
          <Link href="/produk/u-ditch#harga"><Hex size={14} color="#254186" />Lihat daftar harga</Link>
          <a href={waLink(s.whatsapp, "Halo Istana Block, saya mau minta penawaran.")} target="_blank" rel="noopener"><Hex size={14} color="#B5B4AF" />Chat admin via WhatsApp</a>
        </nav>
      </section>

      <section className="wrap section" id="produk">
        <div className="section-head">
          <h2>Produk dan harga mulai</h2>
          <p className="muted small">Belum termasuk ongkir. Harga per ukuran ada di halaman produk.</p>
        </div>
        <div className="grid-cards">
          {products.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
        <div className="swatches">
          <b>Warna paving:</b>
          <span className="swatch"><i className="hex" style={{ background: "#2C2B29" }} />Hitam</span>
          <span className="swatch"><i className="hex" style={{ background: "#B5B4AF" }} />Abu natural</span>
          <span className="swatch"><i className="hex" style={{ background: "#9C4A3A" }} />Merah</span>
        </div>
      </section>

      <div style={{ marginTop: 32 }}>
        <HexDivider seed={3} />
      </div>
      <section className="calc-band hexpat" id="kalkulator">
        <div className="wrap">
          <div className="calc-intro">
            <h2>Hitung kebutuhan paving</h2>
            <p>Isi ukuran area. Jumlah sudah termasuk cadangan 5% untuk potongan tepi. Hasilnya bisa langsung dikirim ke admin.</p>
            <p>Mau atur motif dan kombinasi warna, plus hitung kanstin, abu batu, dan base course?</p>
            <Link href="/pola-paving" className="btn btn-ghost" style={{ alignSelf: "flex-start", borderColor: "#fff", color: "#fff" }}>Buka kalkulator pola &amp; warna →</Link>
            <div style={{ display: "flex", gap: 10, marginTop: 12 }} aria-hidden="true">
              <Hex size={56} color="#FE5722" />
              <Hex size={56} color="#B5B4AF" style={{ marginTop: 31 }} />
              <Hex size={56} color="#254186" />
            </div>
          </div>
          <Calculator whatsapp={s.whatsapp} />
        </div>
      </section>
      <HexDivider flip seed={8} />

      <section className="wrap duo" id="proyek">
        <div className="panel" style={{ flex: "1 1 560px", padding: 14, flexDirection: "row", flexWrap: "wrap", gap: 24 }}>
          <figure className="hexlong figure-fill" style={{ flex: "1 1 220px", margin: 0, minHeight: 260, background: "var(--beton)" }}>
            <img src="/img/galeri/galeri-10.webp" alt="Halaman luas berpaving hexagon merah dan abu-abu di depan bangunan berpilar hijau" width={600} height={400} loading="lazy" />
          </figure>
          <div className="stack" style={{ flex: "1 1 280px", minWidth: 0, gap: 16, padding: "22px 22px 22px 0" }}>
            <h2>{s.project_title}</h2>
            <p className="muted">{s.project_text}</p>
            {tkdn.length > 0 && (
              <div className="tiles">
                {tkdn.map((p, i) => (
                  <div className="tile" key={p.id} style={{ background: TILE_COLORS[i % 3].bg }}>
                    <b style={{ color: TILE_COLORS[i % 3].fg }}>{p.tkdn}%</b>
                    <span>TKDN {p.name}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="small muted">{s.tkdn_note}</p>
            <a className="btn btn-ghost" style={{ alignSelf: "flex-start" }} href={waLink(s.whatsapp, "Halo Istana Block, saya minta penawaran material proyek dan salinan sertifikat TKDN.")} target="_blank" rel="noopener">
              Minta penawaran proyek
            </a>
          </div>
        </div>
        {jasa && (
          <div className="panel" style={{ flex: "1 1 380px" }}>
            <h2>{jasa.name}</h2>
            <p className="muted small">{jasa.summary}</p>
            <div className="rowlist">
              {jasa.priceRows.map((r, i) => (
                <div className="rowitem" key={i}>
                  <div>
                    <b>{r.variant}</b>
                    <div className="small muted">{r.detail}</div>
                  </div>
                  <b className="tabular" style={{ whiteSpace: "nowrap", color: "var(--tinta)" }}>{r.price != null ? `${rupiah(r.price)}/${r.unit}` : "Hubungi admin"}</b>
                </div>
              ))}
            </div>
            <Link href={`/produk/${jasa.slug}`} style={{ fontWeight: 600 }}>Syarat & detail paket →</Link>
          </div>
        )}
      </section>

      <section className="wrap section" aria-labelledby="galeri-title" style={{ paddingTop: 32 }}>
        <div className="section-head">
          <h2 id="galeri-title">Hasil pemasangan</h2>
          <Link href="/galeri" style={{ fontWeight: 600 }}>Lihat {GALLERY.length} foto dokumentasi →</Link>
        </div>
        <GalleryGrid items={GALLERY.filter((g) => g.kategori === "Pemasangan paving").slice(0, 6)} teaser />
      </section>

      {reviews.length > 0 && (
        <section className="wrap section" id="ulasan" style={{ paddingTop: 32 }}>
          <div className="section-head">
            <h2>Kata pelanggan</h2>
            {s.maps_url && <a href={s.maps_url} target="_blank" rel="noopener" style={{ fontWeight: 600 }}>Baca {s.google_review_count} ulasan Google →</a>}
          </div>
          <div className="reviews">
            {reviews.slice(0, 6).map((r) => (
              <figure className="review" key={r.id}>
                <div className="stars" role="img" aria-label={`${r.rating} dari 5 bintang`}>{"★".repeat(r.rating)}</div>
                <blockquote>{r.quote}</blockquote>
                <figcaption className="small muted">{r.name}{r.context ? ` · ${r.context}` : ""}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {faq.length > 0 && (
        <section className="wrap section" aria-labelledby="faq-title" style={{ paddingTop: 32 }}>
          <div className="section-head">
            <h2 id="faq-title">Pertanyaan yang sering diajukan</h2>
            <Link href="/kontak" style={{ fontWeight: 600 }}>Tanya langsung →</Link>
          </div>
          <FaqList items={faq} />
        </section>
      )}

      {articles.length > 0 && (
        <section className="wrap section" style={{ paddingTop: 32 }}>
          <div className="section-head">
            <h2>Panduan &amp; artikel</h2>
            <Link href="/artikel" style={{ fontWeight: 600 }}>Semua artikel →</Link>
          </div>
          <div className="grid-cards">
            {articles.map((a) => (
              <Link href={`/artikel/${a.slug}`} className="card" key={a.id}>
                <div className="card-body" style={{ paddingTop: 10 }}>
                  <span className="small muted">{tanggal(a.publishedAt)}</span>
                  <h3 style={{ fontSize: 21 }}>{a.title}</h3>
                  <p>{a.excerpt}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
