"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Hex } from "@/components/Hex";
import { ImageLightbox } from "@/components/ImageLightbox";
import {
  buildTileFallbackDataUri,
  COLORS,
  computeEstimate,
  DEFAULT_SELECTION,
  getProductDetail,
  getProductImage,
  getProductLink,
  getProductOptionGroups,
  getProductSpecs,
  getProductTkdnBadge,
  getProductTrustKeys,
  normalizeSelection,
  SAMPEL_BY_KEY,
  SAMPEL_CATEGORIES,
  SAMPEL_PRODUCTS,
  TRUST_NOTES,
  type OptionKey,
  type SampelCategoryId,
  type SampelProduct,
  type SampelSelection,
  type TrustKey,
} from "@/data/sampel";
import { waLink } from "@/lib/format";

type DataLayerWindow = Window & {
  dataLayer?: Array<Record<string, unknown>>;
};

function pushDataLayer(event: "sampel_lihat" | "sampel_scan" | "galeri_scan", p: SampelProduct) {
  if (typeof window === "undefined") return;
  const w = window as DataLayerWindow;
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push({ event, produk: p.id, kategori: p.cat });
}

function syncUrlCode(code: string) {
  if (typeof window === "undefined" || !window.history?.replaceState) return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("s");
    url.searchParams.set("k", code);
    url.hash = "";
    window.history.replaceState(null, "", `${url.pathname}?${url.searchParams.toString()}`);
  } catch {
    /* abaikan bila browser membatasi history API */
  }
}

function TrustBadgeIcon({ k, label }: { k: TrustKey; label: string }) {
  if (k === "pasang") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z" />
      </svg>
    );
  }
  if (k === "warna") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="13.5" cy="6.5" r=".8" fill="currentColor" />
        <circle cx="17.5" cy="10.5" r=".8" fill="currentColor" />
        <circle cx="8.5" cy="7.5" r=".8" fill="currentColor" />
        <circle cx="6.5" cy="12.5" r=".8" fill="currentColor" />
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2Z" />
      </svg>
    );
  }
  if (k === "pabrik") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    );
  }
  return <span>{label}</span>;
}

export function SampelExplorer({ whatsapp }: { whatsapp: string }) {
  const [product, setProduct] = useState<SampelProduct>(SAMPEL_PRODUCTS[0]);
  const [selection, setSelection] = useState<SampelSelection>(() => normalizeSelection(SAMPEL_PRODUCTS[0], DEFAULT_SELECTION));
  const [from, setFrom] = useState<"" | "s" | "g">("");
  const [qtyInput, setQtyInput] = useState("");
  const [kotaInput, setKotaInput] = useState("");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const luasId = useId();
  const kotaId = useId();
  const panelId = useId();

  useEffect(() => {
    const syncFromLocation = (isInitial: boolean) => {
      const params = new URLSearchParams(window.location.search);
      const key = (params.get("k") || params.get("s") || window.location.hash.replace(/^#/, "") || "").trim().toLowerCase();
      const matched = key ? SAMPEL_BY_KEY[key] : undefined;
      if (!matched) return;

      const nextFrom: "s" | "g" = params.get("g") ? "g" : "s";
      setProduct(matched);
      setSelection((prev) => normalizeSelection(matched, prev));
      setFrom(isInitial ? nextFrom : "");
      setImgFailed(false);
      if (isInitial) pushDataLayer(nextFrom === "g" ? "galeri_scan" : "sampel_scan", matched);
    };

    syncFromLocation(true);
    const onPopOrHash = () => syncFromLocation(false);
    window.addEventListener("popstate", onPopOrHash);
    window.addEventListener("hashchange", onPopOrHash);
    return () => {
      window.removeEventListener("popstate", onPopOrHash);
      window.removeEventListener("hashchange", onPopOrHash);
    };
  }, []);

  const optionGroups = useMemo(() => getProductOptionGroups(product, selection), [product, selection]);
  const specs = useMemo(() => getProductSpecs(product, selection), [product, selection]);
  const trustKeys = useMemo(() => getProductTrustKeys(product, selection), [product, selection]);
  const detailText = useMemo(() => getProductDetail(product, selection), [product, selection]);
  const tkdnBadge = useMemo(() => getProductTkdnBadge(product, selection), [product, selection]);
  const activeImg = useMemo(() => getProductImage(product, selection), [product, selection]);
  const fallbackImg = useMemo(() => buildTileFallbackDataUri(product), [product]);
  const productLink = useMemo(() => getProductLink(product, selection), [product, selection]);
  const categoryProducts = useMemo(() => SAMPEL_PRODUCTS.filter((item) => item.cat === product.cat), [product.cat]);
  const relatedProducts = useMemo(
    () => product.rel.map((key) => SAMPEL_BY_KEY[key]).filter((item): item is SampelProduct => Boolean(item)),
    [product.rel],
  );
  const estimate = useMemo(
    () => computeEstimate(product, selection, qtyInput, kotaInput, from),
    [product, selection, qtyInput, kotaInput, from],
  );

  const waHref = useMemo(() => waLink(whatsapp, estimate.waMessage), [whatsapp, estimate.waMessage]);
  const activeCat = SAMPEL_CATEGORIES.find((c) => c.id === product.cat) ?? SAMPEL_CATEGORIES[0];

  const selectProduct = (next: SampelProduct, scrollToTop = false) => {
    setProduct(next);
    setSelection((prev) => normalizeSelection(next, prev));
    setImgFailed(false);
    syncUrlCode(next.code);
    pushDataLayer("sampel_lihat", next);
    if (scrollToTop) {
      rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const selectCategory = (catId: SampelCategoryId) => {
    if (catId === product.cat) return;
    const first = SAMPEL_PRODUCTS.find((item) => item.cat === catId);
    if (first) selectProduct(first);
  };

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    let targetIndex = currentIndex;
    if (e.key === "ArrowRight") targetIndex = (currentIndex + 1) % SAMPEL_CATEGORIES.length;
    else if (e.key === "ArrowLeft") targetIndex = (currentIndex - 1 + SAMPEL_CATEGORIES.length) % SAMPEL_CATEGORIES.length;
    else if (e.key === "Home") targetIndex = 0;
    else if (e.key === "End") targetIndex = SAMPEL_CATEGORIES.length - 1;
    else return;

    e.preventDefault();
    const targetCat = SAMPEL_CATEGORIES[targetIndex];
    selectCategory(targetCat.id);
    const btn = e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[targetIndex];
    btn?.focus();
  };

  const updateOption = (key: OptionKey, value: string) => {
    setSelection((prev) => normalizeSelection(product, { ...prev, [key]: value }));
    setImgFailed(false);
  };

  const imgSrc = imgFailed ? fallbackImg : activeImg;
  const imgAlt = `${product.full} Istana Block Purwakarta${detailText ? ` (${detailText})` : product.size ? ` ${product.size}` : ""}`;
  const lightboxCaption = `${product.full}${detailText ? ` — ${detailText}` : ""}`;
  const kickerText =
    from === "g" ? "Produk di galeri Istana Block" : from === "s" ? "Sampel yang Anda pegang" : activeCat.name;

  const pavingLayerColor = product.cat === "paving" ? COLORS[selection.warna]?.hex || COLORS.N.hex : COLORS.N.hex;

  return (
    <section id="ibs-explorer" ref={rootRef} className="sampel-explorer" aria-label="Eksplorasi sampel produk Istana Block">
      {from !== "" && (
        <div className="sampel-scan-banner" role="status">
          <div className="sampel-scan-ico" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <path d="M14 14h3v3h-3zM17 17h4v4h-4zM14 20h3" />
            </svg>
          </div>
          <div>
            <strong>{from === "g" ? "Produk di galeri Istana Block" : "Sampel yang Anda pegang"}</strong>
            <p>
              {from === "g"
                ? "Anda membuka halaman ini dari kartu produk di galeri Istana Block."
                : "Anda membuka halaman ini dari QR pada label sampel Istana Block."}
            </p>
          </div>
        </div>
      )}

      {/* Region 1: Navigasi kategori & produk (Gestalt proximity + common region) */}
      <div className="sampel-nav-box">
        <div className="sampel-cats" role="tablist" aria-label="Kategori produk sampel">
          {SAMPEL_CATEGORIES.map((cat, idx) => {
            const active = cat.id === product.cat;
            return (
              <button
                key={cat.id}
                id={`sampel-tab-${cat.id}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={panelId}
                tabIndex={active ? 0 : -1}
                className="sampel-cat"
                onClick={() => selectCategory(cat.id)}
                onKeyDown={(e) => handleTabKeyDown(e, idx)}
              >
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>

        <div className="sampel-chips" role="group" aria-label={`Varian ${activeCat.name}`}>
          {categoryProducts.map((item) => {
            const active = item.id === product.id;
            return (
              <button
                key={item.id}
                type="button"
                className="sampel-chip"
                aria-pressed={active}
                onClick={() => selectProduct(item)}
              >
                {item.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Region 2: Stage produk aktif */}
      <div id={panelId} role="tabpanel" aria-labelledby={`sampel-tab-${product.cat}`} className="sampel-stage-wrap">
        <div className="sampel-stage">
          {/* Kolom kiri: Foto dalam bingkai hexlong + Lightbox */}
          <div className="sampel-media-col">
            <div className="sampel-art-decor" aria-hidden="true">
              <div className="sampel-art-back hex" />
              <Hex size={64} color="#FE5722" className="sampel-deco-orange" />
              <Hex size={42} color="#B5B4AF" className="sampel-deco-grey" />
            </div>

            <button
              type="button"
              className="sampel-photo-btn hexlong"
              aria-label={`${imgAlt} — klik untuk perbesar gambar`}
              onClick={() => setLightboxOpen(true)}
            >
              <div className="sampel-photo-inner">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={imgSrc}
                  src={imgSrc}
                  alt={imgAlt}
                  width={1200}
                  height={1200}
                  fetchPriority="high"
                  decoding="async"
                  onError={() => setImgFailed(true)}
                />
              </div>
              <span className="sampel-zoom-pill">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.3-4.3" />
                  <path d="M11 8v6M8 11h6" />
                </svg>
                Klik untuk perbesar
              </span>
            </button>

            {detailText && (
              <p className="sampel-media-caption">
                Varian aktif: <b>{detailText}</b>
              </p>
            )}

            <ImageLightbox
              items={[{ src: imgSrc, alt: imgAlt, caption: lightboxCaption }]}
              index={lightboxOpen ? 0 : null}
              onClose={() => setLightboxOpen(false)}
            />
          </div>

          {/* Kolom kanan: Judul, pemilih varian, dan spesifikasi teknis */}
          <div className="sampel-info-col">
            <div className="sampel-badges">
              <span className={`sampel-kicker${from !== "" ? " is-scan" : ""}`}>{kickerText}</span>
              {tkdnBadge && <span className="sampel-tkdn-pill">{tkdnBadge}</span>}
            </div>

            <h2 className="sampel-title">{product.full}</h2>
            <p className="sampel-sub">{product.sub}</p>

            {optionGroups.length > 0 && (
              <div className="sampel-opts-stack">
                {optionGroups.map((group) => (
                  <div key={group.k} className="sampel-opt-group">
                    <span className="sampel-opt-label">{group.label}</span>
                    <div className="sampel-opts" role="group" aria-label={group.label}>
                      {group.vals.map((val) => {
                        const pressed = selection[group.k] === val.v;
                        return (
                          <button
                            key={val.v}
                            type="button"
                            className="sampel-opt"
                            aria-pressed={pressed}
                            onClick={() => updateOption(group.k, val.v)}
                          >
                            {val.sw && (
                              <span
                                className="sampel-swatch hex"
                                style={{ backgroundColor: val.sw }}
                                aria-hidden="true"
                              />
                            )}
                            <span>{val.t || val.v}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <dl className="sampel-specs" aria-label={`Spesifikasi ${product.full}`}>
              {specs.map(([label, value]) => (
                <div key={label} className="sampel-spec">
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* Region 3: Cocok untuk + Tabel Ukuran/Berat + Susunan Pemasangan Paving */}
        <div className="sampel-secondary-grid">
          <div className="sampel-card">
            <h3>Cocok untuk</h3>
            <ul className="sampel-use-list">
              {product.use.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          </div>

          {product.layers && (
            <div className="sampel-card">
              <div className="sampel-card-head">
                <h3>Susunan Pemasangan Paving</h3>
                <span className="sampel-layer-tag">Potongan melintang</span>
              </div>
              <ol className="sampel-layers" aria-label="Susunan lapisan pemasangan paving block">
                <li className="sampel-layer is-paving">
                  <span
                    className="sampel-layer-chip"
                    style={{ backgroundColor: pavingLayerColor }}
                    aria-hidden="true"
                  />
                  <div className="sampel-layer-text">
                    <strong>Paving {product.name}</strong>
                    <small>Lapis permukaan pengunci ({COLORS[selection.warna]?.name})</small>
                  </div>
                  <span className="sampel-layer-thick">{selection.tebal} cm</span>
                </li>
                <li className="sampel-layer is-sand">
                  <span className="sampel-layer-chip" aria-hidden="true" />
                  <div className="sampel-layer-text">
                    <strong>Abu batu / pasir alas</strong>
                    <small>Perata kedudukan blok &amp; pengisi celah nat</small>
                  </div>
                  <span className="sampel-layer-thick">± 5 cm</span>
                </li>
                <li className="sampel-layer is-base">
                  <span className="sampel-layer-chip" aria-hidden="true" />
                  <div className="sampel-layer-text">
                    <strong>Base course (sirtu / batu pecah)</strong>
                    <small>Lapis pondasi dipadatkan untuk daya dukung beban</small>
                  </div>
                  <span className="sampel-layer-thick">± 20 cm</span>
                </li>
                <li className="sampel-layer is-soil">
                  <span className="sampel-layer-chip" aria-hidden="true" />
                  <div className="sampel-layer-text">
                    <strong>Tanah dasar dipadatkan</strong>
                    <small>Subgrade rata dengan kemiringan drainase</small>
                  </div>
                  <span className="sampel-layer-thick">Dasar</span>
                </li>
              </ol>
              <p className="sampel-layer-foot">
                Area minimal 200 m²? Tersedia paket{" "}
                <Link href="/produk/jasa-pasang-paving">Jasa Pasang Paving bergaransi →</Link>
              </p>
            </div>
          )}

          {product.table && (
            <div className="sampel-card sampel-card-wide">
              <div className="sampel-card-head">
                <h3>{product.table.h}</h3>
                <span className="sampel-table-hint">Klik baris untuk memilih ukuran</span>
              </div>
              <div className="sampel-table-scroll">
                <table className="sampel-table">
                  <thead>
                    <tr>
                      {product.table.head.map((col) => (
                        <th key={col} scope="col">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {product.table.rows.map((row) => {
                      const activeRow = row.key === selection[product.table!.k];
                      return (
                        <tr
                          key={row.key}
                          className={activeRow ? "is-on" : undefined}
                          aria-current={activeRow ? "true" : undefined}
                          onClick={() => updateOption(product.table!.k, row.key)}
                        >
                          {row.cells.map((cell, cIdx) => (
                            <td key={cIdx} className={cIdx === 0 ? "is-key" : undefined}>
                              {cell}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Region 4: Hitung Cepat & Minta Penawaran */}
        <div className="sampel-calc hexpat" id="sampel-hitung">
          <div className="sampel-calc-head">
            <div>
              <span className="sampel-calc-kicker">Estimasi &amp; Penawaran Pabrik</span>
              <h3>Hitung Cepat &amp; Minta Penawaran</h3>
              <p className="sampel-calc-sub">
                Hitung perkiraan jumlah unit untuk <b>{product.full}</b>
                {detailText ? ` (${detailText})` : ""}, lalu kirim rincian langsung ke WhatsApp admin.
              </p>
            </div>
          </div>

          <div className="sampel-calc-panel">
            <div className="sampel-calc-fields">
              <div className="field">
                <label htmlFor={luasId}>{product.est.label}</label>
                <input
                  id={luasId}
                  type="text"
                  inputMode={product.est.unit === "pcs" ? "numeric" : "decimal"}
                  placeholder={product.est.ph}
                  value={qtyInput}
                  onChange={(e) => setQtyInput(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor={kotaId}>Lokasi pengiriman (kota / kecamatan)</label>
                <input
                  id={kotaId}
                  type="text"
                  placeholder="contoh: Purwakarta, Karawang, Subang"
                  value={kotaInput}
                  onChange={(e) => setKotaInput(e.target.value)}
                />
              </div>
            </div>

            <div className="sampel-calc-result" aria-live="polite">
              <p className="sampel-res-text">
                {estimate.headlinePrefix}
                {estimate.headlineHighlight && <b>{estimate.headlineHighlight}</b>}
                {estimate.headlineSuffix}
              </p>
              <p className="sampel-res-note">
                {product.est.extra
                  ? "Perkiraan sudah termasuk cadangan 5% untuk potongan tepi. "
                  : product.est.len
                    ? "Perkiraan dihitung dari panjang per buah. "
                    : ""}
                Harga dan ongkos kirim dikonfirmasi admin sesuai volume dan lokasi.
              </p>
            </div>

            <div className="sampel-calc-actions">
              <a className="btn btn-primary" href={waHref} target="_blank" rel="noopener">
                Minta Penawaran via WhatsApp
              </a>
              <Link className="btn btn-ghost" href={productLink}>
                {product.linkT}
              </Link>
              {product.priceLink && product.priceLinkT && (
                <Link className="btn btn-ghost" href={product.priceLink}>
                  {product.priceLinkT}
                </Link>
              )}
              <Link className="sampel-katalog-link" href="/katalog">
                Buka Katalog PDF 11 Halaman →
              </Link>
            </div>
          </div>
        </div>

        {/* Region 5: Kenapa Istana Block (Trust & TKDN) */}
        <div className="sampel-section">
          <div className="sampel-section-head">
            <h3>Kenapa Istana Block</h3>
            <Link href="/sertifikat-tkdn" className="sampel-text-link">
              Lihat semua sertifikat TKDN →
            </Link>
          </div>
          <div className="sampel-trust-grid">
            {trustKeys.map((tKey) => {
              const note = TRUST_NOTES[tKey];
              return (
                <div key={tKey} className="sampel-trust-card">
                  <span className="sampel-trust-badge">
                    <TrustBadgeIcon k={tKey} label={note.badge} />
                  </span>
                  <p>
                    <b>{note.title}</b>
                    {note.body}
                    {note.externalUrl && (
                      <>
                        {" "}
                        <a href={note.externalUrl} target="_blank" rel="noopener noreferrer">
                          {note.externalLabel}
                        </a>
                      </>
                    )}
                    {note.internalHref && (
                      <>
                        {" · "}
                        <Link href={note.internalHref}>{note.internalLabel}</Link>
                      </>
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Region 6: Sering Dipesan Bersama */}
        {relatedProducts.length > 0 && (
          <div className="sampel-section">
            <div className="sampel-section-head">
              <h3>{product.cat === "genteng" ? "Genteng & aksesoris lainnya" : "Sering dipesan bersama"}</h3>
              <span className="muted small">Klik untuk beralih ke spesifikasi produk terkait</span>
            </div>
            <div className="sampel-rel-grid">
              {relatedProducts.map((rel) => (
                <button
                  key={rel.id}
                  type="button"
                  className="sampel-rel-btn"
                  onClick={() => selectProduct(rel, true)}
                >
                  <span className="sampel-rel-dot hex" aria-hidden="true" />
                  <span className="sampel-rel-copy">
                    <b>{rel.full}</b>
                    <small>{rel.size || activeCategoryLabel(rel.cat)}</small>
                  </span>
                  <span className="sampel-rel-arrow" aria-hidden="true">→</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function activeCategoryLabel(cat: SampelCategoryId): string {
  return SAMPEL_CATEGORIES.find((c) => c.id === cat)?.name ?? "Produk Istana Block";
}
