"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { Product } from "@/db/schema";
import { imageUrl, priceLabel } from "@/lib/format";
import { responsif } from "@/lib/img";

export type ProdukItem = Pick<
  Product,
  "id" | "slug" | "name" | "category" | "summary" | "priceFrom" | "priceTo" | "unit" | "imageKey" | "specs" | "tkdn"
>;
type TabId = "all" | "jalan" | "saluran" | "atap" | "jasa" | "lainnya";

const PAVING_TAGS = ["Truepave", "Hexagon", "Fullpave", "Grass Block", "K-350–K-450"];
const PAVING_SAMPLES = [
  {
    name: "Truepave",
    spec: "21×10,5 cm",
    href: "/sampel?k=tp",
    src: "/img/sampel/paving-block-truepave-istana-block-tkdn-o.webp",
  },
  {
    name: "Hexagon",
    spec: "20×20 cm",
    href: "/sampel?k=hx",
    src: "/img/sampel/paving-block-hexagon-istana-block-tkdn-o.webp",
  },
  {
    name: "Fullpave",
    spec: "21×21 cm",
    href: "/sampel?k=f21",
    src: "/img/sampel/paving-block-fullpave-istana-block-tkdn-o.webp",
  },
  {
    name: "Grass Block",
    spec: "45×30 cm",
    href: "/sampel?k=gb",
    src: "/img/sampel/paving-grass-block-istana-block-tkdn-o.webp",
  },
] as const;
const JASA_CHIPS = ["Min. 200 m²", "Survei Gratis", "Garansi 1 Bulan"];
const ROLE: Record<string, string> = { kanstin: "Pembatas & Trotoar", "genteng-beton": "Atap Garuda & Flat" };
const SZ = "(max-width:639px) 92vw,(max-width:980px) 45vw,360px";
const TABS: [Exclude<TabId, "lainnya">, string][] = [
  ["all", "Semua"],
  ["jalan", "Perkerasan & Jalan"],
  ["saluran", "Saluran & Drainase"],
  ["atap", "Atap Beton"],
  ["jasa", "Jasa Pasang"],
];

const grp = (c: string): Exclude<TabId, "all"> =>
  c === "Paving" || c === "Kanstin" ? "jalan" : c === "Saluran" || c === "Buis" ? "saluran" : c === "Atap" ? "atap" : c === "Jasa" ? "jasa" : "lainnya";

const HEX_RING_POINTS = "7,0.6 93,0.6 94.9,3.3 99.4,47 99.4,53 94.9,96.7 93,99.4 7,99.4 5.1,96.7 0.6,53 0.6,47 5.1,3.3";

function HexFrame({
  hasImage,
  className = "",
  isHero,
  children,
}: {
  hasImage: boolean;
  className?: string;
  isHero?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`pk-hex-frame${isHero ? " is-hero" : ""}${className ? ` ${className}` : ""}`}>
      <div className="pk-hex-backdrop" aria-hidden="true" />
      <div className={`pk-hex-inner${hasImage ? "" : " hexpat-light"}`}>
        {children}
        <svg className="pk-hex-ring is-inner" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polygon points={HEX_RING_POINTS} fill="none" stroke="rgba(37, 65, 134, 0.28)" strokeWidth="1.25" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <svg className="pk-hex-ring" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <polygon points={HEX_RING_POINTS} fill="none" stroke="#254186" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

function Img({ p, sizes, eager }: { p: ProdukItem; sizes: string; eager?: boolean }) {
  const src = imageUrl(p.imageKey);
  if (!src) return <span>Foto {p.name.toLowerCase()} menyusul</span>;
  return (
    <>
      <img
        className="pk-hex-photo"
        src={src}
        {...responsif(src, sizes)}
        alt={`Foto ${p.name}`}
        width={1600}
        height={1200}
        fetchPriority={eager ? "high" : undefined}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
      />
      <span className="pk-watermark" aria-hidden="true">
        <img src="/brand/logo-istana-block-300.webp" alt="" width={300} height={90} loading="lazy" decoding="async" />
      </span>
    </>
  );
}

function Tile({ p, wide, sizes = SZ }: { p: ProdukItem; wide?: boolean; sizes?: string }) {
  const specs = p.specs.slice(0, 2);
  return (
    <Link prefetch={false} href={`/produk/${p.slug}`} className={`pk-card${wide ? " is-wide" : ""}`}>
      <HexFrame hasImage={Boolean(imageUrl(p.imageKey))} className="pk-media">
        <Img p={p} sizes={sizes} />
      </HexFrame>
      <div className="pk-cbody">
        <div className="pk-badges">
          <span className="pk-pill">{ROLE[p.slug] ?? p.category}</span>
          {p.tkdn && <span className="pk-pill is-tkdn">TKDN {p.tkdn}%</span>}
        </div>
        <h3>{p.name}</h3>
        <p className="pk-cdesc">{p.summary}</p>
        {specs.length > 0 && (
          <div className="pk-spec">
            {specs.map((s, i) => <span key={s.label}>{i > 0 && " · "}<strong>{s.label}:</strong> {s.value}</span>)}
          </div>
        )}
        <div className="card-foot">
          <span className="tabular">{priceLabel(p)}</span>
          <span className="card-arrow hex" aria-hidden="true">→</span>
        </div>
      </div>
    </Link>
  );
}

function JasaBanner({ p }: { p: ProdukItem }) {
  const chips = p.slug === "jasa-pasang-paving" || !p.specs.length ? JASA_CHIPS : p.specs.slice(0, 3).map((s) => `${s.label}: ${s.value}`);
  return (
    <Link prefetch={false} href={`/produk/${p.slug}`} className="pk-jasa">
      <HexFrame hasImage={Boolean(imageUrl(p.imageKey))} className="pk-jmedia">
        <Img p={p} sizes="(max-width:639px) 92vw,280px" />
      </HexFrame>
      <div className="pk-jbody">
        <div className="pk-badges">
          <span className="pk-pill is-navy">Layanan Terpasang</span>
          <span className="pk-pill">Paket Small · Medium · Large</span>
        </div>
        <h2>{p.name}</h2>
        <p className="pk-sum">{p.summary}</p>
        <div className="pk-jchips">{chips.map((c) => <span key={c} className="pk-jchip">{c}</span>)}</div>
      </div>
      <div className="pk-jcta">
        <div className="pk-pbox"><span className="pk-pkick">Mulai paket terpasang</span><strong className="pk-plg tabular">{priceLabel(p)}</strong></div>
        <span className="btn btn-primary">Lihat paket pasang <span aria-hidden="true">→</span></span>
      </div>
    </Link>
  );
}

const Grid = ({ items }: { items: ProdukItem[] }) => {
  const cols = items.length === 1 ? "1" : items.length === 2 || items.length === 4 ? "2" : "3";
  return (
    <div className="pk-fgrid" data-cols={cols}>
      {items.map((p) => <Tile key={p.id} p={p} wide={cols !== "3"} sizes={cols === "1" ? "(max-width:639px) 92vw,440px" : SZ} />)}
    </div>
  );
};

function Reg({ id, kick, title, meta, neu, children }: { id: string; kick: string; title: string; meta: string; neu?: boolean; children: ReactNode }) {
  return (
    <section className={`pk-reg${neu ? " is-neu" : ""}`} aria-labelledby={id}>
      <div className="pk-reg-head">
        <div>
          <span className="pk-reg-kick">{kick}</span>
          <h2 id={id}>{title}</h2>
        </div>
        <span className="pk-reg-meta tabular">{meta}</span>
      </div>
      {children}
    </section>
  );
}

export function ProdukShowcase({ products, barTop }: { products: ProdukItem[]; barTop: ReactNode }) {
  const [tab, setTab] = useState<TabId>("all");
  if (!products.length) return <p className="muted">Belum ada produk. Tambahkan dari halaman admin.</p>;

  const by = (id: TabId) => (id === "all" ? products : products.filter((p) => grp(p.category) === id));
  const lainnya = by("lainnya");
  const tabs: [TabId, string, number][] = [
    ...TABS.map(([id, label]): [TabId, string, number] => [id, label, by(id).length]),
    ...(lainnya.length ? ([["lainnya", "Lainnya", lainnya.length]] as [TabId, string, number][]) : []),
  ];

  const flag = products.find((p) => p.slug === "paving-block") ?? products.find((p) => p.category === "Paving") ?? products[0];
  const drain = products.filter((p) => p.id !== flag?.id && grp(p.category) === "saluran");
  const pair = products.filter((p) => p.id !== flag?.id && (p.category === "Kanstin" || p.category === "Atap"));
  const jasa = products.filter((p) => p.id !== flag?.id && p.category === "Jasa");
  const rest = products.filter((p) => p.id !== flag?.id && !drain.includes(p) && !pair.includes(p) && !jasa.includes(p));
  const list = by(tab);
  const flagTags = flag?.slug === "paving-block" ? PAVING_TAGS : flag?.specs.slice(0, 4).map((s) => `${s.label}: ${s.value}`) ?? [];

  return (
    <>
      <section className="pk-bar" aria-label="Ringkasan dan filter kategori produk">
        {barTop}
        <div className="pk-tabs" role="group" aria-label="Filter kategori produk">
          {tabs.map(([id, label, count]) => (
            <button key={id} type="button" className="pk-tab" aria-pressed={tab === id} disabled={!count} onClick={() => setTab(id)}>
              <span>{label}</span><span className="pk-cnt tabular">{count}</span>
            </button>
          ))}
        </div>
      </section>
      {tab === "all" ? (
        <div className="pk-flow">
          {flag && (
            <article className="pk-hero" aria-label={`Produk utama: ${flag.name}`}>
              <div className="pk-hero-etalase">
                <Link prefetch={false} href={`/produk/${flag.slug}`} className="pk-hero-media" aria-label={`Detail ${flag.name}`}>
                  <HexFrame hasImage={Boolean(imageUrl(flag.imageKey))} isHero>
                    <Img p={flag} sizes="(max-width:639px) 92vw,(max-width:980px) 44vw,520px" eager />
                  </HexFrame>
                </Link>
                {flag.slug === "paving-block" && (
                  <ul className="pk-sample-strip" aria-label="4 sampel varian paving block">
                    {PAVING_SAMPLES.map((s) => (
                      <li key={s.name}>
                        <Link prefetch={false} href={s.href} className="pk-sample-tile">
                          <span className="pk-sample-thumb">
                            <img
                              src={s.src}
                              srcSet={`${s.src.replace(/\.webp$/, "-320.webp")} 320w, ${s.src} 1200w`}
                              sizes="(max-width: 600px) 84px, 140px"
                              alt=""
                              width={1200}
                              height={1200}
                              loading="lazy"
                              decoding="async"
                            />
                          </span>
                          <span className="pk-sample-cap">
                            <strong>{s.name}</strong>
                            <span>{s.spec}</span>
                            <span className="sr-only"> — lihat sampel</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="pk-hero-body">
                <div className="pk-badges">
                  <span className="pk-pill is-navy">Lini Utama · {flag.category}</span>
                  {flag.tkdn && <span className="pk-pill is-tkdn">TKDN {flag.tkdn}%</span>}
                </div>
                <h2><Link prefetch={false} href={`/produk/${flag.slug}`}>{flag.name}</Link></h2>
                <p className="pk-sum">{flag.summary}</p>
                {flagTags.length > 0 && <div className="pk-tags">{flagTags.map((t) => <span key={t} className="pk-tag">{t}</span>)}</div>}
                <div className="pk-hero-foot">
                  <div className="pk-pbox"><span className="pk-pkick">Harga acuan</span><strong className="pk-plg tabular">{priceLabel(flag)}</strong></div>
                  <div className="pk-acts">
                    <Link prefetch={false} href={`/produk/${flag.slug}`} className="btn btn-primary">Lihat harga &amp; ukuran <span aria-hidden="true">→</span></Link>
                    <Link prefetch={false} href="/pola-paving" className="btn btn-ghost">Hitung di Kalkulator <span aria-hidden="true">↗</span></Link>
                  </div>
                </div>
              </div>
            </article>
          )}
          {drain.length > 0 && (
            <Reg id="reg-drainase" kick="Infrastruktur Air" title="Drainase, Sumur & Gorong" meta={`${drain.length} produk pracetak`}>
              <div className="pk-grid-3">{drain.map((p) => <Tile key={p.id} p={p} />)}</div>
            </Reg>
          )}
          {pair.length > 0 && (
            <Reg id="reg-tepi" kick="Perkerasan Tepi & Atap" title="Pembatas Jalan & Atap" meta={`${pair.length} lini pelengkap`} neu>
              <div className="pk-grid-1">{pair.map((p) => <Tile key={p.id} p={p} wide sizes="(max-width:639px) 92vw,(max-width:980px) 40vw,420px" />)}</div>
            </Reg>
          )}
          {rest.length > 0 && (
            <Reg id="reg-lain" kick="Katalog Tambahan" title="Produk Beton Lainnya" meta={`${rest.length} produk`} neu>
              <Grid items={rest} />
            </Reg>
          )}
          {jasa.map((p) => <JasaBanner key={p.id} p={p} />)}
        </div>
      ) : (
        <div>
          <div className="pk-fbar">
            <p className="muted small">Menampilkan <strong style={{ color: "var(--biru-tua)" }}>{list.length}</strong> produk pada kategori <strong style={{ color: "var(--biru-tua)" }}>{tabs.find((t) => t[0] === tab)?.[1]}</strong>.</p>
            <button type="button" className="pk-reset" onClick={() => setTab("all")}>Tampilkan semua ({products.length})</button>
          </div>
          {!list.length ? <p className="muted">Belum ada produk pada kategori ini.</p> : tab === "jasa" && list.length === 1 ? <JasaBanner p={list[0]} /> : <Grid items={list} />}
        </div>
      )}
    </>
  );
}
