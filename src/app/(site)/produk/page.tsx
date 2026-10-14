import type { Metadata } from "next";
import { ProductCard } from "@/components/ProductCard";
import { listProducts } from "@/lib/queries";
import { categories } from "@/db/schema";

export const metadata: Metadata = {
  title: "Produk & Daftar Harga Beton Pracetak",
  description: "Daftar harga paving block, U-Ditch, buis beton, kanstin, genteng beton, dan jasa pasang dari pabrik Istana Block Purwakarta.",
  alternates: { canonical: "/produk" },
};

export default async function ProdukPage() {
  const products = await listProducts();
  const groups = categories.map((c) => ({ c, items: products.filter((p) => p.category === c) })).filter((g) => g.items.length);
  return (
    <div className="wrap section" style={{ paddingTop: 24 }}>
      <nav aria-label="Lokasi halaman" className="breadcrumb"><ol><li><a href="/">Beranda</a></li><li>Produk</li></ol></nav>
      <div className="section-head" style={{ marginTop: 12 }}>
        <h1 style={{ fontSize: "clamp(34px, 4vw, 52px)" }}>Produk dan daftar harga</h1>
        <p className="muted small">Harga belum termasuk ongkir. Penawaran tertulis yang berlaku.</p>
      </div>
      <div className="stack" style={{ gap: 48 }}>
        {groups.map((g) => (
          <section key={g.c} aria-labelledby={`k-${g.c}`}>
            <h2 id={`k-${g.c}`} style={{ fontSize: 24, marginBottom: 16 }}>{g.c === "Jasa" ? "Jasa pemasangan" : g.c}</h2>
            <div className="grid-cards">
              {g.items.map((p) => (
                <ProductCard key={p.id} p={p} />
              ))}
            </div>
          </section>
        ))}
        {groups.length === 0 && <p className="muted">Belum ada produk. Tambahkan dari halaman admin.</p>}
      </div>
    </div>
  );
}
