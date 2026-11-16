import type { Metadata } from "next";
import Link from "next/link";
import { LandingFooter, LandingHeader } from "@/components/LandingChrome";
import { getEnv } from "@/db";
import { imageUrl, priceLabel, waLink } from "@/lib/format";
import { listProducts } from "@/lib/queries";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Penawaran Resmi Pabrik Istana Block Purwakarta",
  description: "Pusat penawaran harga pabrik beton pracetak dan paving block Istana Block Purwakarta.",
  robots: { index: false, follow: false },
};

export default async function LandingHubPage() {
  const [products, s, env] = await Promise.all([listProducts(), getSettings(), getEnv()]);
  const waHref = waLink(
    s.whatsapp,
    "Halo Istana Block, saya melihat penawaran pabrik di Google Ads. Boleh minta katalog harga dan estimasi ongkir ke proyek saya?",
  );

  return (
    <>
      <LandingHeader s={s} waHref={waHref} />
      <div className="wrap" style={{ paddingTop: 32, paddingBottom: 64 }}>
        <section className="product-hero" style={{ marginBottom: 40 }}>
          <div className="hero-text" style={{ gap: 18 }}>
            <span
              style={{
                display: "inline-block",
                padding: "4px 12px",
                background: "var(--biru-muda, #e0f2fe)",
                color: "var(--biru-tua, #0e2a6b)",
                borderRadius: 99,
                fontSize: 13,
                fontWeight: 600,
                width: "fit-content",
              }}
            >
              Penawaran Khusus Proyek &amp; Pabrik Langsung
            </span>
            <h1 style={{ fontSize: "clamp(26px, 4vw, 42px)", lineHeight: 1.2, margin: 0 }}>
              Pusat Penawaran Resmi Pabrik Istana Block Purwakarta
            </h1>
            <p className="hero-lead" style={{ fontSize: 18, color: "#475569", margin: 0 }}>
              Produsen langsung paving block, kanstin, U-Ditch, buis beton, gravel, dan genteng beton berstandar SNI &amp; TKDN Kemenperin. Pilih kategori produk di bawah untuk melihat rincian harga pabrik dan mengajukan penawaran tertulis.
            </p>
            <div className="actions" style={{ marginTop: 8 }}>
              <a className="btn btn-primary" href={waHref} target="_blank" rel="noopener noreferrer">
                Chat WhatsApp Sales Pabrik
              </a>
            </div>
          </div>
        </section>

        <section>
          <div className="section-head" style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 28, margin: "0 0 8px" }}>Pilihan Produk Beton Pracetak</h2>
            <p className="muted small" style={{ margin: 0 }}>
              Semua produk diproduksi langsung dari workshop pabrik Purwakarta dengan armada pengiriman mandiri (truk crane &amp; colt diesel).
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 24,
            }}
          >
            {products
              .filter((p) => p.category !== "Jasa")
              .map((p) => {
                const img = imageUrl(p.imageKey);
                return (
                  <article
                    key={p.id}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 16,
                      background: "#ffffff",
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                    }}
                  >
                    <div style={{ position: "relative", width: "100%", aspectRatio: "4/3", background: "#f8fafc" }}>
                      {img ? (
                        <img
                          src={img}
                          alt={p.name}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          loading="lazy"
                        />
                      ) : (
                        <div style={{ display: "grid", placeItems: "center", height: "100%", color: "#94a3b8" }}>
                          Foto segera hadir
                        </div>
                      )}
                      {p.tkdn && (
                        <span
                          style={{
                            position: "absolute",
                            top: 10,
                            right: 10,
                            background: "rgba(14, 42, 107, 0.9)",
                            color: "#fff",
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: 6,
                          }}
                        >
                          TKDN {p.tkdn}%
                        </span>
                      )}
                    </div>
                    <div style={{ padding: 20, display: "flex", flexDirection: "column", flex: 1, gap: 10 }}>
                      <h3 style={{ fontSize: 20, margin: 0, color: "var(--biru-tua, #0e2a6b)" }}>{p.name}</h3>
                      <p style={{ fontSize: 14, color: "#64748b", margin: 0, flex: 1, lineHeight: 1.5 }}>
                        {p.summary}
                      </p>
                      <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
                        <div style={{ fontSize: 13, color: "#64748b" }}>Harga acuan:</div>
                        <div style={{ fontSize: 17, fontWeight: 700, color: "var(--biru-tua, #0e2a6b)" }}>
                          {priceLabel(p)}
                        </div>
                      </div>
                      <Link
                        href={`/landing/${p.slug}`}
                        className="btn btn-primary"
                        style={{ textAlign: "center", justifyContent: "center", marginTop: 8 }}
                      >
                        Lihat Penawaran {p.name} →
                      </Link>
                    </div>
                  </article>
                );
              })}
          </div>
        </section>
      </div>
      <LandingFooter s={s} />
    </>
  );
}
