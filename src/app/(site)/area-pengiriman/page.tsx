import type { Metadata } from "next";
import Link from "next/link";
import { Hex } from "@/components/Hex";
import { JsonLd } from "@/components/JsonLd";
import area from "@/data/area.json";
import wa from "@/data/wa-templates.json";
import { getEnv } from "@/db";
import { waLink } from "@/lib/format";
import { listPages } from "@/lib/queries";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Pengiriman Paving, U-Ditch & Buis Beton",
  description: "Armada sendiri dari pabrik Purwakarta ke Karawang, Cikampek, Subang, Bandung, hingga Jabodetabek untuk skala proyek. Cara hitung ongkir dan cara pesan.",
  alternates: { canonical: "/area-pengiriman" },
};

type Wilayah = { nama: string; slug?: string; ringkas?: string; jarak?: string };
const COLORS = ["#FE5722", "#254186", "#B5B4AF", "#0E2A6B"];

export default async function AreaPage() {
  const [s, env, areaPages] = await Promise.all([getSettings(), getEnv(), listPages("area")]);
  const live = new Set(areaPages.map((p) => p.slug));
  const wilayah = area.wilayah as Wilayah[];
  const detailed = wilayah.filter((w) => w.slug || w.ringkas || w.jarak);
  const others = wilayah.filter((w) => !(w.slug || w.ringkas || w.jarak));
  return (
    <div className="wrap section" style={{ paddingTop: 24 }}>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Beranda", item: env.SITE_URL },
            { "@type": "ListItem", position: 2, name: "Area pengiriman", item: `${env.SITE_URL}/area-pengiriman` },
          ],
        }}
      />
      <nav aria-label="Lokasi halaman" className="breadcrumb"><ol><li><Link href="/">Beranda</Link></li><li>Area pengiriman</li></ol></nav>
      <header className="stack" style={{ gap: 14, padding: "16px 0 28px", maxWidth: 820 }}>
        <span className="pill pill-orange" style={{ alignSelf: "flex-start", fontSize: 14, fontWeight: 600 }}>Armada sendiri</span>
        <h1 style={{ fontSize: "clamp(34px, 4vw, 52px)" }}>Area pengiriman</h1>
        <p className="hero-lead" style={{ fontSize: 18 }}>{area.intro}</p>
      </header>

      <section aria-labelledby="wilayah" style={{ paddingBottom: 40 }}>
        <h2 id="wilayah" style={{ fontSize: 28, marginBottom: 16 }}>Wilayah yang kami layani</h2>
        <div className="area-grid">
          {detailed.map((w, i) => {
            const inner = (
              <>
                <h3><Hex size={18} color={COLORS[i % COLORS.length]} />{w.nama}</h3>
                {w.jarak && <span className="small" style={{ color: "var(--biru)", fontWeight: 600 }}>{w.jarak}</span>}
                {w.ringkas && <p className="muted">{w.ringkas}</p>}
                {w.slug && live.has(w.slug) && <span className="more">Lihat detail area →</span>}
              </>
            );
            return w.slug && live.has(w.slug) ? (
              <Link key={w.nama} href={`/${w.slug}`} className="area-card">{inner}</Link>
            ) : (
              <div key={w.nama} className="area-card">{inner}</div>
            );
          })}
        </div>
        {others.length > 0 && (
          <div className="stack" style={{ gap: 10, marginTop: 18 }}>
            <p className="small muted">Juga melayani:</p>
            <div className="city-chips">{others.map((w) => <span key={w.nama}>{w.nama}</span>)}</div>
          </div>
        )}
        {area.catatanJabodetabek && (
          <div className="callout" role="note">
            <Hex size={22} color="#FE5722" />
            <div>
              <strong>Pengiriman ke Jabodetabek</strong>
              <p>{area.catatanJabodetabek}</p>
            </div>
          </div>
        )}
      </section>

      <section className="duo" style={{ paddingTop: 0 }}>
        <div className="panel" style={{ flex: "1 1 420px" }}>
          <h2>Cara ongkir dihitung</h2>
          <ul className="bullets">{area.ongkir.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
        <div className="panel" style={{ flex: "1 1 420px" }}>
          <h2>Cara memesan</h2>
          <ol className="bullets">{area.langkah.map((x) => <li key={x}>{x}</li>)}</ol>
        </div>
      </section>

      <aside className="cta-aside hexpat" style={{ maxWidth: 760 }}>
        <h2>Cek ongkir ke lokasi Anda</h2>
        <p>Kirim produk, volume, dan titik lokasi. Admin membalas dengan harga, ongkir, dan perkiraan jadwal kirim.</p>
        <a className="btn btn-primary" style={{ alignSelf: "flex-start" }} href={waLink(s.whatsapp, wa["cek-ongkir"])} target="_blank" rel="noopener">Cek ongkir via WhatsApp</a>
      </aside>
    </div>
  );
}
