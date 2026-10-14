import type { Metadata } from "next";
import Link from "next/link";
import { ClientLogos } from "@/components/ClientLogos";
import { FaqList } from "@/components/FaqList";
import { JsonLd } from "@/components/JsonLd";
import paket from "@/data/paket-proyek.json";
import wa from "@/data/wa-templates.json";
import { getEnv } from "@/db";
import { priceLabel, waLink } from "@/lib/format";
import { listProducts } from "@/lib/queries";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Paket Material Proyek & Dokumen TKDN",
  description: "Paving block, kanstin, U-Ditch, buis beton, dan genteng beton dalam satu penawaran tertulis. Harga acuan pabrik, sertifikat TKDN Kemenperin, dan armada sendiri.",
  alternates: { canonical: "/paket-proyek" },
};

export default async function PaketProyekPage() {
  const [s, env, products] = await Promise.all([getSettings(), getEnv(), listProducts()]);
  const materials = products.filter((p) => p.category !== "Jasa");
  const jasa = products.find((p) => p.category === "Jasa");
  return (
    <div className="wrap section" style={{ paddingTop: 24 }}>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Beranda", item: env.SITE_URL },
            { "@type": "ListItem", position: 2, name: "Paket proyek", item: `${env.SITE_URL}/paket-proyek` },
          ],
        }}
      />
      <nav aria-label="Lokasi halaman" className="breadcrumb"><ol><li><Link href="/">Beranda</Link></li><li>Paket proyek</li></ol></nav>
      <header className="stack" style={{ gap: 14, padding: "16px 0 28px", maxWidth: 820 }}>
        <span className="pill" style={{ alignSelf: "flex-start", fontSize: 14, fontWeight: 600 }}>Kontraktor &amp; pengadaan</span>
        <h1 style={{ fontSize: "clamp(34px, 4vw, 52px)" }}>Paket material proyek</h1>
        <p className="hero-lead" style={{ fontSize: 18 }}>{paket.intro}</p>
        <div className="actions">
          <a className="btn btn-primary" href={waLink(s.whatsapp, wa.proyek)} target="_blank" rel="noopener">Minta penawaran proyek</a>
          <a className="btn btn-ghost" href="#harga-acuan">Lihat harga acuan</a>
        </div>
      </header>

      <section className="duo" style={{ paddingTop: 0 }}>
        <div className="panel" style={{ flex: "1 1 420px" }}>
          <h2>Yang Anda dapat</h2>
          <ul className="bullets">{paket.manfaat.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
        <div className="panel" style={{ flex: "1 1 420px" }}>
          <h2>Alur pemesanan</h2>
          <ol className="bullets">{paket.langkah.map((x) => <li key={x}>{x}</li>)}</ol>
        </div>
      </section>

      <section id="harga-acuan" style={{ paddingBottom: 48 }}>
        <div className="section-head" style={{ marginBottom: 18 }}>
          <h2>Harga acuan pabrik</h2>
          <p className="muted small">Belum termasuk ongkir. Rincian per ukuran ada di halaman tiap produk.</p>
        </div>
        <div className="table-card">
          <table className="price-ref">
            <caption className="sr-only">Harga acuan per produk</caption>
            <thead>
              <tr><th scope="col">Produk</th><th scope="col">Harga</th><th scope="col">TKDN</th></tr>
            </thead>
            <tbody>
              {materials.map((p) => (
                <tr key={p.id}>
                  <td><Link href={`/produk/${p.slug}`}>{p.name}</Link><div className="small muted">{p.summary.split(".")[0]}.</div></td>
                  <td className="tabular" style={{ whiteSpace: "nowrap" }}>{priceLabel(p)}</td>
                  <td>{p.tkdn ? <b>{p.tkdn}%</b> : <span className="muted">—</span>}</td>
                </tr>
              ))}
              {jasa && (
                <tr>
                  <td><Link href={`/produk/${jasa.slug}`}>{jasa.name}</Link><div className="small muted">{jasa.summary.split(".")[0]}.</div></td>
                  <td className="tabular" style={{ whiteSpace: "nowrap" }}>{priceLabel(jasa)}</td>
                  <td><span className="muted">—</span></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ marginTop: 10 }}>{s.tkdn_note} <Link href="/sertifikat-tkdn">Detail sertifikat →</Link></p>
      </section>

      <section style={{ paddingBottom: 48 }}>
        <ClientLogos />
      </section>

      <section className="duo" style={{ paddingTop: 0 }}>
        <div className="stack" style={{ flex: "1 1 520px", minWidth: 0, gap: 14 }}>
          <h2 style={{ fontSize: 30 }}>Syarat &amp; ketentuan</h2>
          <ul className="bullets">{paket.syarat.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
        <aside className="cta-aside hexpat" style={{ flex: "1 1 320px", minWidth: 0 }}>
          <h2>Kirim BoQ atau daftar kebutuhan</h2>
          <p>Penawaran tertulis berisi harga, ongkir, dan jadwal kirim. Salinan sertifikat TKDN tersedia untuk dokumen tender.</p>
          <a className="btn btn-primary" href={waLink(s.whatsapp, wa.proyek)} target="_blank" rel="noopener">WhatsApp {s.whatsapp}</a>
          <a href={waLink(s.whatsapp, wa.jabodetabek)} target="_blank" rel="noopener">Proyek di Jabodetabek? Tanya minimal order →</a>
        </aside>
      </section>

      <section style={{ paddingTop: 32 }}>
        <h2 style={{ fontSize: 30, marginBottom: 16 }}>Pertanyaan umum</h2>
        <FaqList items={paket.faq} />
      </section>
    </div>
  );
}
