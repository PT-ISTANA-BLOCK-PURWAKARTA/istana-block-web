import type { Metadata } from "next";
import Link from "next/link";
import { AreaDeliveryMap, type DeliveryRegion, type RegionTier } from "@/components/AreaDeliveryMap";
import { AreaShippingExplorer } from "@/components/AreaShippingExplorer";
import { Hex } from "@/components/Hex";
import { JsonLd } from "@/components/JsonLd";
import area from "@/data/area.json";
import wa from "@/data/wa-templates.json";
import { getEnv } from "@/db";
import { waLink } from "@/lib/format";
import { listPages } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import "./area.css";

const TITLE = "Area Kirim Paving & Beton";
const DESCRIPTION =
  "Armada sendiri dari pabrik Purwakarta ke Karawang, Cikampek, Subang, Bandung, hingga Jabodetabek untuk skala proyek. Cara hitung ongkir dan cara pesan.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/area-pengiriman" },
};

type Wilayah = { nama: string; slug?: string; ringkas?: string; jarak?: string };

type GeoPreset = {
  id: string;
  lat: number;
  lng: number;
  tier: RegionTier;
  tierLabel: string;
  jarakSingkat: string;
  jarakDetail: string;
  koridor: string;
  defaultRingkas: string;
  projectOnly?: boolean;
  needsScheduleConfirm?: boolean;
};

const GEO_PRESETS: Record<string, GeoPreset> = {
  "Kabupaten Purwakarta": {
    id: "purwakarta",
    lat: -6.5569,
    lng: 107.4431,
    tier: "prioritas",
    tierLabel: "Prioritas · Paling Mudah Dijadwalkan",
    jarakSingkat: "0–25 km · Prioritas",
    jarakDetail: "±0–25 km dari pabrik Pasawahan",
    koridor: "Jalan utama Purwakarta & Gerbang Tol Sadang / Jatiluhur",
    defaultRingkas: "Seluruh kecamatan di Kabupaten Purwakarta. Area paling mudah dijadwalkan.",
  },
  "Karawang & Cikampek": {
    id: "karawang-cikampek",
    lat: -6.3227,
    lng: 107.3376,
    tier: "reguler",
    tierLabel: "Jalur Tol Langsung",
    jarakSingkat: "±29–48 km",
    jarakDetail: "±29 km ke Cikampek, ±48 km ke Karawang Barat",
    koridor: "Tol Jakarta–Cikampek (Gerbang Tol Sadang → Cikopo / Karawang)",
    defaultRingkas: "Karawang Barat & Timur, Cikampek, Klari, Telukjambe, KIIC, dan Suryacipta.",
  },
  Subang: {
    id: "subang",
    lat: -6.5715,
    lng: 107.7587,
    tier: "reguler",
    tierLabel: "Jalur Tol & Arteri",
    jarakSingkat: "±51–72 km",
    jarakDetail: "±51 km lewat Kalijati, ±72 km lewat Tol Cipali (ke Subang kota)",
    koridor: "Jalur Kalijati / Tol Cipali (Gerbang Tol Subang)",
    defaultRingkas: "Kalijati, Cipeundeuy, Purwadadi, Pagaden, Subang kota, hingga Pamanukan.",
  },
  "Bekasi & Cikarang": {
    id: "bekasi-cikarang",
    lat: -6.2846,
    lng: 107.1705,
    tier: "proyek",
    tierLabel: "Khusus Skala Proyek",
    jarakSingkat: "±63–88 km · Skala Proyek",
    jarakDetail: "±63 km ke Cikarang, ±88 km ke Kota Bekasi",
    koridor: "Tol Jakarta–Cikampek (Cikarang, Cibitung, Tambun, Kota Bekasi)",
    defaultRingkas: "Khusus pesanan skala proyek. Cikarang, Jababeka, EJIP, MM2100, Delta Silicon, dan Kota Bekasi.",
    projectOnly: true,
  },
  Jabodetabek: {
    id: "jabodetabek",
    lat: -6.2088,
    lng: 106.8456,
    tier: "proyek",
    tierLabel: "Khusus Skala Proyek / Min. Order",
    jarakSingkat: "±95–135 km · Skala Proyek",
    jarakDetail: "±95–135 km via Tol Jakarta–Cikampek (khusus skala proyek)",
    koridor: "Tol Jakarta–Cikampek → JORR / Jagorawi / Tol Dalam Kota",
    defaultRingkas: "Jakarta, Bogor, Depok, dan Tangerang khusus pesanan skala proyek dengan minimal order disepakati.",
    projectOnly: true,
  },
  "Cirebon & Indramayu": {
    id: "cirebon-indramayu",
    lat: -6.732,
    lng: 108.5523,
    tier: "konfirmasi",
    tierLabel: "Konfirmasi Jadwal",
    jarakSingkat: "±145–175 km · Konfirmasi Jadwal",
    jarakDetail: "±145–175 km melalui Tol Cipali",
    koridor: "Tol Cipali (Cikopo → Kertajati / Palimanan)",
    defaultRingkas: "Konfirmasi jadwal dan ongkir ke admin sebelum memesan.",
    needsScheduleConfirm: true,
  },
  Bandung: {
    id: "bandung",
    lat: -6.9175,
    lng: 107.6191,
    tier: "koridor",
    tierLabel: "Koridor Tol Cipularang",
    jarakSingkat: "±65–85 km · Cipularang",
    jarakDetail: "±65–85 km via Tol Cipularang",
    koridor: "Tol Cipularang (Ciganea/Jatiluhur → Pasteur / Buah Batu)",
    defaultRingkas: "Kota Bandung dan sekitarnya dilayani melalui akses Tol Cipularang dari Purwakarta.",
  },
  Cimahi: {
    id: "cimahi",
    lat: -6.8722,
    lng: 107.5425,
    tier: "koridor",
    tierLabel: "Koridor Tol Cipularang",
    jarakSingkat: "±58–70 km · Cipularang",
    jarakDetail: "±58–70 km via Tol Cipularang",
    koridor: "Tol Cipularang (Gerbang Tol Padalarang / Baros)",
    defaultRingkas: "Kota Cimahi dilayani langsung melalui akses Tol Cipularang keluar Padalarang/Baros.",
  },
  "Bandung Barat": {
    id: "bandung-barat",
    lat: -6.8414,
    lng: 107.4981,
    tier: "koridor",
    tierLabel: "Koridor Tol Cipularang",
    jarakSingkat: "±50–65 km · Cipularang",
    jarakDetail: "±50–65 km via Tol Cipularang",
    koridor: "Tol Cipularang (Padalarang & koridor Purwakarta selatan)",
    defaultRingkas: "Padalarang, Ngamprah, Batujajar, dan kawasan Bandung Barat yang terjangkau armada.",
  },
  Cianjur: {
    id: "cianjur",
    lat: -6.8208,
    lng: 107.1425,
    tier: "koridor",
    tierLabel: "Koridor Selatan / Cipularang",
    jarakSingkat: "±60–80 km",
    jarakDetail: "±60–80 km via Plered/Cirata atau Padalarang",
    koridor: "Purwakarta – Plered – Cirata atau Tol Cipularang → Padalarang",
    defaultRingkas: "Wilayah Cianjur yang dapat dijangkau armada dari Purwakarta selatan atau jalur Padalarang.",
  },
  Sumedang: {
    id: "sumedang",
    lat: -6.8586,
    lng: 107.9219,
    tier: "koridor",
    tierLabel: "Koridor Cipali / Cisumdawu",
    jarakSingkat: "±85–105 km",
    jarakDetail: "±85–105 km via Subang atau Tol Cisumdawu",
    koridor: "Tol Cipali → Subang atau Tol Cipularang → Cisumdawu",
    defaultRingkas: "Jatinangor, Tanjungsari, dan Sumedang melalui koridor Subang atau Tol Cisumdawu.",
  },
};

const COLORS = ["#FE5722", "#254186", "#B5B4AF", "#0E2A6B"];

function parseCoord(raw: string, fallback: number, maxAbs: number): number {
  const n = Number(String(raw ?? "").trim().replace(",", "."));
  return Number.isFinite(n) && Math.abs(n) <= maxAbs ? n : fallback;
}

export default async function AreaPage() {
  const [s, env, areaPages] = await Promise.all([getSettings(), getEnv(), listPages("area")]);
  const live = new Set(areaPages.map((p) => p.slug));
  const waMap = wa as Record<string, string>;

  const factoryLat = parseCoord(s.geo_lat, -6.5831124, 90);
  const factoryLng = parseCoord(s.geo_lng, 107.4663503, 180);

  const wilayah = area.wilayah as Wilayah[];
  const detailed = wilayah.filter((w) => w.slug || w.ringkas || w.jarak);
  const others = wilayah.filter((w) => !(w.slug || w.ringkas || w.jarak));

  const buildRegion = (w: Wilayah): DeliveryRegion => {
    const preset = GEO_PRESETS[w.nama];
    const templateKey = w.slug ? `area:${w.slug}` : w.nama === "Jabodetabek" ? "jabodetabek" : "";
    const waText =
      (templateKey && waMap[templateKey]) ||
      `Halo Istana Block, saya ingin cek ongkir dan perkiraan jadwal kirim ke ${w.nama}. Produk: ..., Volume: ..., Lokasi bongkar: ...`;

    return {
      id: preset?.id ?? w.nama.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      nama: w.nama,
      lat: preset?.lat ?? factoryLat,
      lng: preset?.lng ?? factoryLng,
      tier: preset?.tier ?? "koridor",
      tierLabel: preset?.tierLabel ?? "Wilayah Layanan",
      jarakSingkat: preset?.jarakSingkat ?? (w.jarak || "Jawa Barat"),
      jarakDetail: w.jarak ?? preset?.jarakDetail ?? "",
      koridor: preset?.koridor ?? "Tol Cipularang / Japek / Cipali",
      ringkas: w.ringkas ?? preset?.defaultRingkas ?? `Pengiriman armada sendiri dari Pasawahan ke ${w.nama}.`,
      slug: w.slug,
      isLiveSlug: !!(w.slug && live.has(w.slug)),
      waHref: waLink(s.whatsapp, waText),
      projectOnly: preset?.projectOnly,
      needsScheduleConfirm: preset?.needsScheduleConfirm,
    };
  };

  const regions: DeliveryRegion[] = wilayah.map(buildRegion);
  const regionByName = new Map(regions.map((r) => [r.nama, r]));
  const pageUrl = `${env.SITE_URL}/area-pengiriman`;

  return (
    <div className="wrap area-page">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            "@id": pageUrl,
            url: pageUrl,
            name: TITLE,
            description: DESCRIPTION,
            inLanguage: "id-ID",
            isPartOf: { "@type": "WebSite", url: env.SITE_URL, name: s.company_name },
            about: { "@id": `${env.SITE_URL}/#business` },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Beranda", item: env.SITE_URL },
              { "@type": "ListItem", position: 2, name: "Area pengiriman", item: pageUrl },
            ],
          },
          {
            "@context": "https://schema.org",
            "@type": "Service",
            "@id": `${pageUrl}#service`,
            name: "Pengiriman Paving Block & Beton Precast Armada Sendiri",
            serviceType: "Pengiriman Material Konstruksi Beton Precast",
            description: area.intro,
            url: pageUrl,
            provider: { "@id": `${env.SITE_URL}/#business` },
            areaServed: regions.map((r) => ({ "@type": "AdministrativeArea", name: r.nama })),
          },
        ]}
      />

      <nav aria-label="Lokasi halaman" className="breadcrumb">
        <ol>
          <li>
            <Link href="/">Beranda</Link>
          </li>
          <li>Area pengiriman</li>
        </ol>
      </nav>

      <header className="area-hero">
        <span className="area-hero-pill">Armada sendiri dari Pasawahan, Purwakarta</span>
        <h1>Area pengiriman</h1>
        <p className="hero-lead">{area.intro}</p>

        <div className="area-corridors" aria-label="Akses tiga koridor tol utama dari pabrik">
          <div className="area-corridor-chip">
            <strong>Tol Cipularang</strong>
            <span>Purwakarta, Bandung, Cimahi, Bandung Barat, Cianjur</span>
          </div>
          <div className="area-corridor-chip">
            <strong>Tol Jakarta–Cikampek</strong>
            <span>Karawang, Cikampek, Bekasi, Cikarang, Jabodetabek</span>
          </div>
          <div className="area-corridor-chip">
            <strong>Tol Cipali &amp; Arteri</strong>
            <span>Subang, Sumedang, Cirebon &amp; Indramayu</span>
          </div>
        </div>

        <div className="area-hero-actions">
          <a className="btn btn-primary" href={waLink(s.whatsapp, wa["cek-ongkir"])} target="_blank" rel="noopener">
            Cek ongkir via WhatsApp
          </a>
          <a className="btn btn-ghost" href="#simulasi-ongkir">
            Simulasi faktor ongkir ↓
          </a>
          <a className="btn btn-ghost" href="#cara-memesan">
            Alur pesan 5 langkah ↓
          </a>
        </div>
      </header>

      <AreaDeliveryMap
        factoryLat={factoryLat}
        factoryLng={factoryLng}
        factoryAddress={s.address}
        factoryWaHref={waLink(s.whatsapp, wa["cek-ongkir"])}
        regions={regions}
      />

      <section aria-labelledby="wilayah" className="area-regions-section">
        <div className="area-section-head" style={{ marginBottom: 18 }}>
          <div>
            <span className="area-eyebrow">Jangkauan Jawa Barat &amp; Jabodetabek</span>
            <h2 id="wilayah">Wilayah yang kami layani</h2>
          </div>
          <p className="area-section-lead">
            Wilayah dengan halaman detail memiliki panduan rute dan layanan lokal; seluruh area dapat langsung dicek ongkirnya ke admin.
          </p>
        </div>

        <div className="area-cards-grid">
          {detailed.map((w, i) => {
            const reg = regionByName.get(w.nama);
            const hasPage = !!(w.slug && live.has(w.slug));
            const waHref = reg?.waHref ?? waLink(s.whatsapp, wa["cek-ongkir"]);
            return (
              <article key={w.nama} className="area-region-card">
                <div className="area-card-head">
                  {reg && <span className={`area-card-tag is-${reg.tier}`}>{reg.tierLabel}</span>}
                  <h3>
                    <Hex size={18} color={COLORS[i % COLORS.length]} />
                    {w.nama}
                  </h3>
                </div>
                {(w.jarak || reg?.jarakSingkat) && (
                  <span className="area-card-dist">{w.jarak || reg?.jarakSingkat}</span>
                )}
                {w.ringkas && <p className="area-card-desc">{w.ringkas}</p>}
                <div className="area-card-actions">
                  {hasPage ? (
                    <Link href={`/${w.slug}`} className="area-card-link">
                      Lihat detail area →
                    </Link>
                  ) : (
                    <span className="small muted">{reg?.koridor}</span>
                  )}
                  <a href={waHref} target="_blank" rel="noopener" className="area-card-wa">
                    Cek ongkir WA →
                  </a>
                </div>
              </article>
            );
          })}
        </div>

        {others.length > 0 && (
          <div className="area-others-panel">
            <p className="small muted" style={{ fontWeight: 600 }}>
              Juga melayani rute Tol Cipularang &amp; koridor Jawa Barat (klik kota untuk tanya jadwal &amp; ongkir via WhatsApp):
            </p>
            <div className="area-others-chips">
              {others.map((w) => {
                const reg = regionByName.get(w.nama);
                return (
                  <a
                    key={w.nama}
                    href={reg?.waHref ?? waLink(s.whatsapp, wa["cek-ongkir"])}
                    target="_blank"
                    rel="noopener"
                    className="area-city-wa"
                  >
                    <strong>{w.nama}</strong>
                    {reg?.jarakSingkat && <span>· {reg.jarakSingkat}</span>}
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {area.catatanJabodetabek && (
          <div className="callout" role="note">
            <Hex size={22} color="#FE5722" />
            <div>
              <strong>Pengiriman ke Jabodetabek</strong>
              <p>{area.catatanJabodetabek}</p>
              <p style={{ marginTop: 8 }}>
                <a href={waLink(s.whatsapp, wa.jabodetabek)} target="_blank" rel="noopener" style={{ fontWeight: 700 }}>
                  Tanya minimal order &amp; ongkir proyek Jabodetabek →
                </a>
              </p>
            </div>
          </div>
        )}
      </section>

      <AreaShippingExplorer
        regions={regions}
        ongkirRules={area.ongkir}
        orderSteps={area.langkah}
        whatsapp={s.whatsapp}
      />

      <aside className="cta-aside hexpat" style={{ maxWidth: 820 }}>
        <h2>Cek ongkir ke lokasi Anda</h2>
        <p>Kirim produk, perkiraan volume, dan titik lokasi di peta. Admin membalas dengan penawaran resmi berisi harga produk, ongkir, dan perkiraan jadwal kirim.</p>
        <div className="actions">
          <a className="btn btn-primary" href={waLink(s.whatsapp, wa["cek-ongkir"])} target="_blank" rel="noopener">
            Cek ongkir via WhatsApp
          </a>
          <Link className="btn btn-blue" href="/pola-paving">
            Hitung kebutuhan di kalkulator paving
          </Link>
          <Link className="btn area-cta-ghost" href="/paket-proyek">
            Lihat paket proyek
          </Link>
        </div>
      </aside>
    </div>
  );
}
