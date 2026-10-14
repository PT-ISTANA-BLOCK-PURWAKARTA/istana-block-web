import type { Metadata } from "next";
import Link from "next/link";
import { imageUrl, tanggal } from "@/lib/format";
import { listArticles } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Artikel & Panduan Material Beton",
  description: "Panduan memilih, menghitung, dan memasang paving block, U-Ditch, buis beton, kanstin, dan genteng beton dari Istana Block Purwakarta.",
  alternates: { canonical: "/artikel" },
};

export default async function ArtikelPage() {
  const articles = await listArticles();
  return (
    <div className="wrap section" style={{ paddingTop: 24 }}>
      <nav aria-label="Lokasi halaman" className="breadcrumb"><ol><li><Link href="/">Beranda</Link></li><li>Artikel</li></ol></nav>
      <div className="section-head" style={{ marginTop: 12 }}>
        <h1 style={{ fontSize: "clamp(34px, 4vw, 52px)" }}>Artikel &amp; panduan</h1>
      </div>
      {articles.length === 0 && <p className="muted">Belum ada artikel.</p>}
      <div className="grid-cards">
        {articles.map((a) => {
          const img = imageUrl(a.coverKey);
          return (
            <Link href={`/artikel/${a.slug}`} className="card" key={a.id}>
              {img && (
                <div className="card-media hexlong">
                  <img src={img} alt="" loading="lazy" />
                </div>
              )}
              <div className="card-body" style={{ paddingTop: img ? 0 : 10 }}>
                <span className="small muted">{tanggal(a.publishedAt)}</span>
                <h2 style={{ fontSize: 21 }}>{a.title}</h2>
                <p>{a.excerpt}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
