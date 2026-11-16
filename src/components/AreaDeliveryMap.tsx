"use client";

import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type * as L from "leaflet";

export type RegionTier = "prioritas" | "reguler" | "proyek" | "koridor" | "konfirmasi";

export type DeliveryRegion = {
  id: string;
  nama: string;
  lat: number;
  lng: number;
  tier: RegionTier;
  tierLabel: string;
  jarakSingkat: string;
  jarakDetail: string;
  koridor: string;
  ringkas: string;
  slug?: string;
  isLiveSlug?: boolean;
  waHref: string;
  projectOnly?: boolean;
  needsScheduleConfirm?: boolean;
};

type Props = {
  factoryLat: number;
  factoryLng: number;
  factoryAddress: string;
  factoryWaHref: string;
  regions: DeliveryRegion[];
};

const TIER_META: Record<RegionTier, { shape: "star" | "dot" | "diamond" | "hex" | "ring"; short: string }> = {
  prioritas: { shape: "star", short: "Prioritas" },
  reguler: { shape: "dot", short: "Reguler" },
  proyek: { shape: "diamond", short: "Skala Proyek" },
  koridor: { shape: "hex", short: "Koridor Tol" },
  konfirmasi: { shape: "ring", short: "Konfirmasi" },
};

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeHref(url: string): string {
  if (url.startsWith("/") || url.startsWith("https://")) return esc(url);
  return "#";
}

function tierGlyphSvg(tier: RegionTier): string {
  switch (tier) {
    case "prioritas":
      return `<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><polygon points="8,1.5 10.1,5.6 14.6,6.3 11.3,9.5 12.1,14 8,11.9 3.9,14 4.7,9.5 1.4,6.3 5.9,5.6" fill="currentColor"/></svg>`;
    case "proyek":
      return `<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><rect x="3.5" y="3.5" width="9" height="9" rx="1.5" transform="rotate(45 8 8)" fill="currentColor"/></svg>`;
    case "konfirmasi":
      return `<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-dasharray="3 2"/></svg>`;
    case "koridor":
      return `<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><polygon points="8,1.5 13.8,4.8 13.8,11.2 8,14.5 2.2,11.2 2.2,4.8" fill="currentColor"/></svg>`;
    default:
      return `<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><circle cx="8" cy="8" r="4.5" fill="currentColor"/></svg>`;
  }
}

function TierBadgeIcon({ tier }: { tier: RegionTier }) {
  switch (tier) {
    case "prioritas":
      return (
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
          <polygon points="8,1.5 10.1,5.6 14.6,6.3 11.3,9.5 12.1,14 8,11.9 3.9,14 4.7,9.5 1.4,6.3 5.9,5.6" fill="currentColor" />
        </svg>
      );
    case "proyek":
      return (
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
          <rect x="3.5" y="3.5" width="9" height="9" rx="1.5" transform="rotate(45 8 8)" fill="currentColor" />
        </svg>
      );
    case "konfirmasi":
      return (
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
          <circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeDasharray="3 2" />
        </svg>
      );
    case "koridor":
      return (
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
          <polygon points="8,1.5 13.8,4.8 13.8,11.2 8,14.5 2.2,11.2 2.2,4.8" fill="currentColor" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
          <circle cx="8" cy="8" r="4.5" fill="currentColor" />
        </svg>
      );
  }
}

export function AreaDeliveryMap({ factoryLat, factoryLng, factoryAddress, factoryWaHref, regions }: Props) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const libRef = useRef<typeof L | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const factoryMarkerRef = useRef<L.Marker | null>(null);
  const boundsRef = useRef<L.LatLngBounds | null>(null);

  const [ready, setReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedRegion = useMemo(() => regions.find((r) => r.id === selectedId) ?? null, [regions, selectedId]);

  const prefersReducedMotion = () =>
    typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const fitAll = useCallback(() => {
    const m = mapRef.current;
    const b = boundsRef.current;
    if (!m || !b) return;
    m.closePopup();
    if (prefersReducedMotion()) {
      m.fitBounds(b.pad(0.14), { animate: false });
    } else {
      m.fitBounds(b.pad(0.14), { animate: true, duration: 0.45 });
    }
  }, []);

  const focusRegion = useCallback(
    (region: DeliveryRegion) => {
      const m = mapRef.current;
      const lib = libRef.current;
      const marker = markersRef.current.get(region.id);
      setSelectedId(region.id);
      if (!m || !lib) return;

      const pairBounds = lib.latLngBounds([
        [factoryLat, factoryLng],
        [region.lat, region.lng],
      ]);
      const animate = !prefersReducedMotion();

      if (region.id === "purwakarta") {
        m.setView([region.lat, region.lng], 11, { animate });
      } else {
        m.fitBounds(pairBounds.pad(0.28), { maxZoom: 11, animate });
      }

      if (marker) {
        window.setTimeout(() => {
          marker.openPopup();
        }, animate ? 180 : 0);
      }
    },
    [factoryLat, factoryLng],
  );

  // Inisialisasi OpenStreetMap via Leaflet secara dinamis (aman untuk SSR & zero JS di halaman lain).
  useEffect(() => {
    let dead = false;
    const markerMap = markersRef.current;

    (async () => {
      const leaflet = (await import("leaflet")).default;
      if (dead || !mapEl.current || mapRef.current) return;
      libRef.current = leaflet;

      const factory: [number, number] = [factoryLat, factoryLng];
      const map = leaflet.map(mapEl.current, {
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: false,
      });

      leaflet
        .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18,
          minZoom: 7,
          attribution: "© OpenStreetMap",
        })
        .addTo(map);

      // Koridor tol utama dari Purwakarta (Pasawahan) ke Jawa Barat & Jabodetabek.
      const corridors: Array<{ name: string; color: string; dash: string; paths: [number, number][][] }> = [
        {
          name: "Koridor Tol Jakarta–Cikampek",
          color: "#d63f12",
          dash: "8 6",
          paths: [
            [
              factory,
              [-6.508, 107.46],
              [-6.412, 107.468],
              [-6.3227, 107.3376],
              [-6.2846, 107.1705],
              [-6.245, 107.01],
              [-6.2088, 106.8456],
            ],
          ],
        },
        {
          name: "Koridor Tol Cipularang",
          color: "#254186",
          dash: "6 5",
          paths: [
            [
              factory,
              [-6.5569, 107.4431],
              [-6.615, 107.405],
              [-6.755, 107.452],
              [-6.8414, 107.4981],
              [-6.8722, 107.5425],
              [-6.9175, 107.6191],
            ],
            [
              [-6.8414, 107.4981],
              [-6.828, 107.315],
              [-6.8208, 107.1425],
            ],
          ],
        },
        {
          name: "Koridor Tol Cipali & Cisumdawu",
          color: "#0e2a6b",
          dash: "4 6",
          paths: [
            [
              [-6.412, 107.468],
              [-6.512, 107.68],
              [-6.5715, 107.7587],
              [-6.652, 108.162],
              [-6.732, 108.5523],
            ],
            [
              [-6.5715, 107.7587],
              [-6.742, 107.855],
              [-6.8586, 107.9219],
            ],
            [
              [-6.9175, 107.6191],
              [-6.895, 107.775],
              [-6.8586, 107.9219],
            ],
          ],
        },
      ];

      for (const cor of corridors) {
        for (const pts of cor.paths) {
          leaflet
            .polyline(pts, {
              color: "#ffffff",
              weight: 5,
              opacity: 0.72,
              interactive: false,
            })
            .addTo(map);
          leaflet
            .polyline(pts, {
              color: cor.color,
              weight: 2.6,
              opacity: 0.85,
              dashArray: cor.dash,
            })
            .bindTooltip(cor.name, { sticky: true, direction: "top" })
            .addTo(map);
        }
      }

      // Pin utama Pabrik Istana Block Purwakarta (Pasawahan) — ikon segi enam oranye khas.
      const factoryIcon = leaflet.divIcon({
        className: "area-leaflet-pin-wrap",
        html: `
          <div class="area-hub-pin">
            <svg viewBox="0 0 40 44" width="38" height="42" aria-hidden="true">
              <polygon points="20,2 37,11.8 37,32.2 20,42 3,32.2 3,11.8" fill="#FE5722" stroke="#ffffff" stroke-width="3" stroke-linejoin="round"/>
              <polygon points="20,10 29,15.2 29,26.8 20,32 11,26.8 11,15.2" fill="#0e2a6b"/>
              <circle cx="20" cy="21" r="3.5" fill="#ffffff"/>
            </svg>
            <span class="area-hub-tag">Pabrik Pasawahan</span>
          </div>
        `,
        iconSize: [38, 42],
        iconAnchor: [19, 21],
        popupAnchor: [0, -20],
      });

      const factoryPopup = `
        <div class="area-popup">
          <span class="area-popup-kicker is-factory">Titik Asal Armada</span>
          <h4>Pabrik Istana Block Purwakarta</h4>
          <p>${esc(factoryAddress)}</p>
          <p class="area-popup-meta"><strong>Akses tol:</strong> Cipularang, Jakarta–Cikampek, &amp; Cipali</p>
          <div class="area-popup-actions">
            <a href="${safeHref(factoryWaHref)}" target="_blank" rel="noopener" class="area-popup-btn is-primary">Cek ongkir via WhatsApp</a>
          </div>
        </div>
      `;

      const hubMarker = leaflet
        .marker(factory, {
          icon: factoryIcon,
          title: "Pabrik Istana Block Purwakarta (Pasawahan)",
          zIndexOffset: 500,
        })
        .bindPopup(factoryPopup, { maxWidth: 280, autoPan: true, autoPanPadding: [24, 24] })
        .on("click", () => setSelectedId(null))
        .addTo(map);
      factoryMarkerRef.current = hubMarker;

      const allPoints: [number, number][] = [factory];

      for (const r of regions) {
        allPoints.push([r.lat, r.lng]);
        const icon = leaflet.divIcon({
          className: "area-leaflet-pin-wrap",
          html: `
            <div class="area-pin is-${esc(r.tier)}" data-region="${esc(r.id)}">
              <span class="area-pin-mark">${tierGlyphSvg(r.tier)}</span>
              <span class="area-pin-label">${esc(r.nama)}</span>
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
          popupAnchor: [0, -16],
        });

        const detailLinkHtml =
          r.slug && r.isLiveSlug
            ? `<a href="${safeHref(`/${r.slug}`)}" class="area-popup-btn is-detail">Detail area →</a>`
            : "";

        const popupHtml = `
          <div class="area-popup">
            <span class="area-popup-kicker is-${esc(r.tier)}">${esc(r.tierLabel)}</span>
            <h4>${esc(r.nama)}</h4>
            <p class="area-popup-meta"><strong>Jarak:</strong> ${esc(r.jarakDetail || r.jarakSingkat)}</p>
            <p class="area-popup-meta"><strong>Akses:</strong> ${esc(r.koridor)}</p>
            <p>${esc(r.ringkas)}</p>
            <div class="area-popup-actions">
              ${detailLinkHtml}
              <a href="${safeHref(r.waHref)}" target="_blank" rel="noopener" class="area-popup-btn is-primary">Cek ongkir WA</a>
            </div>
          </div>
        `;

        const marker = leaflet
          .marker([r.lat, r.lng], {
            icon,
            title: `${r.nama} (${r.jarakSingkat})`,
            zIndexOffset: r.tier === "prioritas" || r.tier === "proyek" ? 200 : 100,
          })
          .bindTooltip(`${r.nama} · ${r.jarakSingkat}`, { direction: "top", offset: [0, -14] })
          .bindPopup(popupHtml, { maxWidth: 290, autoPan: true, autoPanPadding: [24, 24] })
          .on("click", () => {
            setSelectedId(r.id);
          })
          .addTo(map);

        markerMap.set(r.id, marker);
      }

      const bounds = leaflet.latLngBounds(allPoints);
      boundsRef.current = bounds;
      map.fitBounds(bounds.pad(0.14), { animate: false });

      mapRef.current = map;
      setReady(true);
    })();

    return () => {
      dead = true;
      markerMap.clear();
      factoryMarkerRef.current = null;
      boundsRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [factoryAddress, factoryLat, factoryLng, factoryWaHref, regions]);

  // Sinkronisasi kelas visual pin aktif pada peta ketika selectedId berubah dari pill atau marker.
  useEffect(() => {
    for (const [id, marker] of markersRef.current.entries()) {
      const el = marker.getElement();
      const pin = el?.querySelector(".area-pin");
      if (pin) {
        if (id === selectedId) pin.classList.add("is-active");
        else pin.classList.remove("is-active");
      }
    }
  }, [selectedId, ready]);

  const handleResetToFactory = () => {
    setSelectedId(null);
    fitAll();
  };

  const handleJumpToSimulator = (regionId: string) => {
    window.dispatchEvent(new CustomEvent("ib:select-region", { detail: regionId }));
    const sim = document.getElementById("simulasi-ongkir");
    if (sim) {
      sim.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
    }
  };

  return (
    <section id="peta-jangkauan" className="area-map-section" aria-labelledby="peta-judul">
      <div className="area-map-head">
        <div>
          <h2 id="peta-judul">Peta jangkauan &amp; koridor tol dari Pasawahan</h2>
          <p className="muted">
            Pilih wilayah di bawah atau klik penanda pada peta untuk melihat jarak tempuh, akses tol, ketentuan pengiriman, dan tautan cek ongkir.
          </p>
        </div>
        <button
          type="button"
          className={`area-pill-reset ${selectedId === null ? "is-selected" : ""}`}
          onClick={handleResetToFactory}
          aria-pressed={selectedId === null}
        >
          Semua rute Jawa Barat &amp; Jabodetabek
        </button>
      </div>

      {/* Bar tombol pilih cepat wilayah (Gestalt Common Region + keselarasan klik peta) */}
      <div className="area-map-pills" role="group" aria-label="Pilih cepat wilayah pengiriman">
        {regions.map((r) => {
          const active = selectedId === r.id;
          return (
            <button
              key={r.id}
              type="button"
              className={`area-region-pill is-${r.tier} ${active ? "is-selected" : ""}`}
              aria-pressed={active}
              onClick={() => focusRegion(r)}
            >
              <span className="area-pill-glyph">
                <TierBadgeIcon tier={r.tier} />
              </span>
              <span className="area-pill-name">{r.nama}</span>
              <span className="area-pill-tag">{TIER_META[r.tier].short}</span>
            </button>
          );
        })}
      </div>

      <div className="area-map-console">
        <div className="area-map-stage">
          <div
            ref={mapEl}
            className="area-leaflet-canvas"
            role="region"
            aria-label="Peta interaktif OpenStreetMap jangkauan armada Istana Block Purwakarta"
          />
          {!ready && (
            <div className="area-map-fallback" aria-hidden="true">
              <span>Peta OpenStreetMap · Jangkauan Tol Cipularang, Japek &amp; Cipali</span>
            </div>
          )}
          <div className="area-map-legend" aria-label="Keterangan penanda dan jalur tol pada peta">
            <span className="area-leg-item">
              <i className="area-leg-hex" aria-hidden="true" />
              Pabrik Pasawahan
            </span>
            <span className="area-leg-item">
              <i className="area-leg-dot is-prioritas" aria-hidden="true" />
              Prioritas / Reguler
            </span>
            <span className="area-leg-item">
              <i className="area-leg-dot is-proyek" aria-hidden="true" />
              Khusus Skala Proyek
            </span>
            <span className="area-leg-item">
              <i className="area-leg-dot is-koridor" aria-hidden="true" />
              Koridor Tol / Konfirmasi
            </span>
            <span className="area-leg-item">
              <i className="area-leg-line" aria-hidden="true" />
              Jalur Tol Cipularang · Japek · Cipali
            </span>
          </div>
        </div>

        <aside className="area-map-inspector" aria-live="polite">
          {selectedRegion ? (
            <div className="area-inspector-body">
              <div className="area-inspector-top">
                <span className={`area-tier-badge is-${selectedRegion.tier}`}>
                  <TierBadgeIcon tier={selectedRegion.tier} />
                  {selectedRegion.tierLabel}
                </span>
                <button type="button" className="area-inspector-clear" onClick={handleResetToFactory}>
                  Lihat semua rute
                </button>
              </div>
              <h3>{selectedRegion.nama}</h3>
              <p className="area-inspector-desc">{selectedRegion.ringkas}</p>

              <dl className="area-inspector-specs">
                <div>
                  <dt>Perkiraan jarak</dt>
                  <dd>{selectedRegion.jarakDetail || selectedRegion.jarakSingkat}</dd>
                </div>
                <div>
                  <dt>Koridor utama</dt>
                  <dd>{selectedRegion.koridor}</dd>
                </div>
                <div>
                  <dt>Armada kirim</dt>
                  <dd>Truk Flatbed &amp; Truk Crane milik sendiri</dd>
                </div>
                <div>
                  <dt>Status layanan</dt>
                  <dd>
                    {selectedRegion.projectOnly
                      ? "Khusus skala proyek / minimal order disepakati"
                      : selectedRegion.needsScheduleConfirm
                        ? "Konfirmasi jadwal & ongkir dengan admin lebih dulu"
                        : selectedRegion.tier === "prioritas"
                          ? "Paling mudah dijadwalkan dari Pasawahan"
                          : "Pengiriman reguler & proyek via akses tol"}
                  </dd>
                </div>
              </dl>

              <div className="area-inspector-actions">
                <a className="btn btn-primary btn-sm" href={selectedRegion.waHref} target="_blank" rel="noopener">
                  Cek ongkir ke {selectedRegion.nama}
                </a>
                {selectedRegion.slug && selectedRegion.isLiveSlug && (
                  <Link href={`/${selectedRegion.slug}`} className="btn btn-blue btn-sm">
                    Halaman detail area →
                  </Link>
                )}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleJumpToSimulator(selectedRegion.id)}
                >
                  Simulasikan ongkir wilayah ini ↓
                </button>
              </div>
            </div>
          ) : (
            <div className="area-inspector-body">
              <div className="area-inspector-top">
                <span className="area-tier-badge is-factory">
                  <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                    <polygon points="8,1 14.5,4.8 14.5,11.2 8,15 1.5,11.2 1.5,4.8" fill="currentColor" />
                  </svg>
                  Titik Asal Pengiriman
                </span>
              </div>
              <h3>Pabrik Istana Block (Pasawahan)</h3>
              <p className="area-inspector-desc">
                Semua pesanan diberangkatkan langsung dari pabrik di {factoryAddress} (koordinat{" "}
                <span className="tabular">
                  {factoryLat.toFixed(4)}, {factoryLng.toFixed(4)}
                </span>
                ).
              </p>

              <dl className="area-inspector-specs">
                <div>
                  <dt>Akses Tol Selatan</dt>
                  <dd>Tol Cipularang → Bandung, Cimahi, Bandung Barat, Cianjur</dd>
                </div>
                <div>
                  <dt>Akses Tol Barat</dt>
                  <dd>Tol Japek → Karawang, Cikampek, Bekasi, Cikarang, Jabodetabek</dd>
                </div>
                <div>
                  <dt>Akses Tol Timur</dt>
                  <dd>Tol Cipali → Subang, Sumedang, Cirebon &amp; Indramayu</dd>
                </div>
                <div>
                  <dt>Jenis armada</dt>
                  <dd>Truk Flatbed &amp; Truk Crane (U-Ditch / Buis)</dd>
                </div>
              </dl>

              <div className="area-inspector-actions">
                <a className="btn btn-primary btn-sm" href={factoryWaHref} target="_blank" rel="noopener">
                  Cek ongkir via WhatsApp
                </a>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    const first = regions[1] ?? regions[0];
                    if (first) focusRegion(first);
                  }}
                >
                  Contoh rute: {regions[1]?.nama ?? regions[0]?.nama}
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
