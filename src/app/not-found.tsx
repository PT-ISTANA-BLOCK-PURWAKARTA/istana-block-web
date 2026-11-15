import type { Metadata } from "next";
import Link from "next/link";
import { Hex } from "@/components/Hex";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Halaman Tidak Ditemukan",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="login-wrap" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div className="stack" style={{ alignItems: "center", gap: 16, textAlign: "center" }}>
        <Hex size={90} color="#FE5722" />
        <h1>Halaman tidak ditemukan</h1>
        <p className="muted">Mungkin alamatnya berubah. Coba lihat daftar produk kami.</p>
        <Link className="btn btn-primary" href="/produk">Lihat produk</Link>
      </div>
    </main>
  );
}
