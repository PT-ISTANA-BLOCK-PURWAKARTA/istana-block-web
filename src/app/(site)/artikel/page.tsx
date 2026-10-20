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
      {/* Pengantar tetap tampil walau daftar artikel masih sedikit, supaya halaman ini tidak tipis. */}
      <div className="stack" style={{ gap: 12, maxWidth: 820, paddingBottom: 24 }}>
        <p className="hero-lead" style={{ fontSize: 18 }}>
          Kumpulan panduan dari pabrik Istana Block Purwakarta untuk pemilik rumah, kontraktor, dan petugas pengadaan yang sedang memilih material beton. Isinya seputar cara memilih jenis dan ukuran, menghitung kebutuhan, sampai memasang paving block, U-Ditch, buis beton, kanstin, dan genteng beton.
        </p>
        <p>
          Setiap artikel ditulis supaya bisa dipakai sebelum Anda meminta penawaran: Anda tahu produk apa yang cocok, berapa volume yang perlu dipesan, dan keterangan apa yang perlu disiapkan. Daftar harga ada di halaman <Link href="/produk">Produk</Link>, pilihan pola pemasangan di halaman <Link href="/pola-paving">Pola paving</Link>, dan wilayah kirim di halaman <Link href="/area-pengiriman">Area pengiriman</Link>.
        </p>
        <p>
          Belum menemukan jawaban yang Anda cari? Kirim produk, perkiraan volume, dan lokasi proyek ke admin lewat halaman <Link href="/kontak">Kontak</Link>. Admin membalas dengan penawaran berisi harga produk dan ongkir untuk lokasi Anda, jadi Anda tidak perlu menebak biaya sebelum memesan.
        </p>
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
