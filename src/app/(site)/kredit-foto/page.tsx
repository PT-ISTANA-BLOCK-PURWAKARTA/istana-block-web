import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kredit foto",
  description: "Sumber dan lisensi foto yang dipakai di situs Istana Block Purwakarta.",
  alternates: { canonical: "/kredit-foto" },
  robots: { index: false, follow: true },
};

const STOK = [
  {
    produk: "Buis beton",
    judul: "Concrete Pipes at a Construction Site",
    pemilik: "Quang Nguyen Vinh",
    url: "https://www.pexels.com/photo/concrete-pipes-at-a-construction-site-12387207/",
  },
  {
    produk: "Kanstin",
    judul: "Stacked Concrete Slabs at Construction Site",
    pemilik: "Pexels contributor",
    url: "https://www.pexels.com/photo/stacked-concrete-slabs-at-construction-site-36003981/",
  },
  {
    produk: "Grass block",
    judul: "Geometric Garden Path with Vibrant Green Grass",
    pemilik: "Pexels contributor",
    url: "https://www.pexels.com/photo/geometric-garden-path-with-vibrant-green-grass-37343148/",
  },
  {
    produk: "Jasa pasang paving",
    judul: "Close up of Worker Holding Pavers in Rain",
    pemilik: "Pexels contributor",
    url: "https://www.pexels.com/photo/close-up-of-worker-holding-pavers-in-rain-16239802/",
  },
];

export default function KreditFoto() {
  return (
    <div className="wrap section" style={{ paddingTop: 24 }}>
      <nav aria-label="Lokasi halaman" className="breadcrumb"><ol><li><a href="/">Beranda</a></li><li>Kredit foto</li></ol></nav>
      <div className="section-head" style={{ marginTop: 12 }}>
        <h1 style={{ fontSize: "clamp(30px, 3.4vw, 44px)" }}>Kredit foto</h1>
        <p className="muted small">
          Sebagian foto produk masih memakai foto stok pengisi. Foto milik pabrik sendiri tidak perlu kredit.
        </p>
      </div>

      <section aria-labelledby="k-stok">
        <h2 id="k-stok" style={{ fontSize: 22, marginBottom: 12 }}>Foto stok — Pexels License</h2>
        <p className="muted small" style={{ marginTop: -6 }}>
          Pexels License: gratis untuk penggunaan komersial, boleh diubah, tanpa kewajiban atribusi.
          Nama pemilik dicantumkan sebagai kesopanan.
        </p>
        <div className="admin-table">
          <table>
            <thead><tr><th>Produk</th><th>Foto</th><th>Pemilik</th></tr></thead>
            <tbody>
              {STOK.map((f) => (
                <tr key={f.url}>
                  <td>{f.produk}</td>
                  <td><a href={f.url} target="_blank" rel="noopener noreferrer nofollow">{f.judul}</a></td>
                  <td>{f.pemilik}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="k-sendiri" style={{ marginTop: 32 }}>
        <h2 id="k-sendiri" style={{ fontSize: 22, marginBottom: 12 }}>Foto pabrik sendiri</h2>
        <p className="muted">
          Paving block dan U-Ditch memakai foto dari arsip situs lama (aset Istana Block), tidak perlu kredit.
          Rincian berkas ada di <code>docs/legal/kredit-foto.md</code>.
        </p>
      </section>
    </div>
  );
}
