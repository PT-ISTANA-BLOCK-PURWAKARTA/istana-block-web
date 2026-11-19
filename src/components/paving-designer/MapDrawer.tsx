"use client";

import { useEffect, useRef, useState } from "react";
import { projectWgs84MultiPolygon } from "@/lib/paving/geometry/project";
import { titikTengahPoligon, type LokasiProyek, type TitikLokasi } from "@/lib/paving/lokasi";
import type { MultiPolygon2D, Point2D, ProjectGeometry, Ring2D } from "@/lib/paving/geometry/types";
import { IconAlert, IconCheck, IconInfo, IconTrash, IconUndo } from "./Icons";
import { LokasiSearch } from "./LokasiSearch";
import css from "./PavingDesigner.module.css";

interface Props {
  onApplyGeometry: (geom: ProjectGeometry) => void;
  onCancel?: () => void;
  /** Lokasi proyek awal (dipulihkan dari tautan bagi). */
  lokasi?: LokasiProyek | null;
  onLokasiChange?: (lokasi: LokasiProyek | null) => void;
}

const ZOOM_LOKASI = 18;

export function MapDrawer({ onApplyGeometry, lokasi: lokasiAwal, onLokasiChange }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const polygonLayerRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const [points, setPoints] = useState<Point2D[]>([]);
  const [tempGeom, setTempGeom] = useState<ProjectGeometry | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  // Langkah "Cari lokasi proyek": tampil di atas dan boleh dilewati. Peta baru tampil setelah dicari atau dilewati.
  const [lokasi, setLokasi] = useState<LokasiProyek | null>(lokasiAwal ?? null);
  const [labelLokasi, setLabelLokasi] = useState<string>(lokasiAwal ? "Dari tautan bagi" : "");
  const [cariTerbuka, setCariTerbuka] = useState(!lokasiAwal);
  const [petaTampil, setPetaTampil] = useState(Boolean(lokasiAwal));
  const [mapSiap, setMapSiap] = useState(false);
  const lokasiMarkerRef = useRef<any>(null);
  const terbangRef = useRef<"fly" | "set" | null>(lokasiAwal ? "set" : null);
  /** true bila lokasi berasal dari pencarian (bukan titik tengah poligon), supaya tidak ditimpa saat menerapkan. */
  const dariCariRef = useRef(lokasiAwal?.asal === "cari");
  const onLokasiChangeRef = useRef(onLokasiChange);
  onLokasiChangeRef.current = onLokasiChange;

  const pointsRef = useRef<Point2D[]>([]);
  pointsRef.current = points;

  useEffect(() => {
    let isMounted = true;

    async function initLeaflet() {
      if (!mapContainerRef.current) return;
      try {
        const L = await import("leaflet");
        // @ts-ignore - Leaflet CSS dimuat dinamis di klien
        await import("leaflet/dist/leaflet.css");
        if (!isMounted || !mapContainerRef.current) return;

        leafletRef.current = L;

        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        });

        const map = L.map(mapContainerRef.current, {
          center: [-6.556, 107.443],
          zoom: 17,
          maxZoom: 19,
          scrollWheelZoom: true,
        });

        L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          {
            attribution:
              "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, GIS User Community",
            maxZoom: 19,
          },
        ).addTo(map);

        const polyLayer = L.polygon([], {
          color: "#fe5722",
          fillColor: "#254186",
          fillOpacity: 0.32,
          weight: 3,
        }).addTo(map);

        const markersGroup = L.layerGroup().addTo(map);

        polygonLayerRef.current = polyLayer;
        markersLayerRef.current = markersGroup;
        mapInstanceRef.current = map;

        // Panel peta bisa disembunyikan lalu ditampilkan lagi (pindah tab/cara input): ukur ulang.
        if (typeof ResizeObserver !== "undefined") {
          const ro = new ResizeObserver(() => {
            if (mapContainerRef.current && mapContainerRef.current.clientWidth > 0) map.invalidateSize();
          });
          ro.observe(mapContainerRef.current);
          resizeObserverRef.current = ro;
        }

        map.on("click", (e: any) => {
          const lon = e.latlng.lng;
          const lat = e.latlng.lat;
          setPoints([...pointsRef.current, [lon, lat]]);
        });
        setMapSiap(true);
      } catch (err: any) {
        if (isMounted) {
          setMapError(err?.message || "Gagal memuat peta satelit. Periksa koneksi internet Anda.");
        }
      }
    }

    initLeaflet();

    return () => {
      isMounted = false;
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    if (!L || !mapInstanceRef.current) return;

    const polyLayer = polygonLayerRef.current;
    const markersGroup = markersLayerRef.current;

    markersGroup.clearLayers();

    const latLngs = points.map(([lon, lat]) => [lat, lon]);
    polyLayer.setLatLngs(latLngs);

    points.forEach(([lon, lat], idx) => {
      const circle = L.circleMarker([lat, lon], {
        radius: 6,
        fillColor: idx === 0 ? "#fe5722" : "#254186",
        color: "#ffffff",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.95,
      });
      circle.bindTooltip(`Titik ${idx + 1}${idx === 0 ? " (Awal)" : ""}`, {
        permanent: false,
        direction: "top",
      });
      markersGroup.addLayer(circle);
    });

    if (points.length >= 3) {
      try {
        const closedRing: Ring2D = [...points, points[0]];
        const multiPoly: MultiPolygon2D = [[closedRing]];
        const proj = projectWgs84MultiPolygon(multiPoly, "map");
        setTempGeom(proj);
        setValidationError(null);
      } catch (err: any) {
        setValidationError(err?.message || "Poligon tidak valid (mungkin saling berpotongan).");
        setTempGeom(null);
      }
    } else {
      setTempGeom(null);
      setValidationError(null);
    }
  }, [points]);

  // Penanda "Lokasi proyek" + terbang ke lokasi. Tidak menangkap klik supaya titik sudut tetap bisa digambar di atasnya.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapInstanceRef.current;
    if (!L || !map || !mapSiap) return;
    lokasiMarkerRef.current?.remove();
    lokasiMarkerRef.current = null;
    if (!lokasi) return;
    const ll: [number, number] = [lokasi.lat, lokasi.lng];
    const marker = L.marker(ll, { interactive: false, keyboard: false, title: "Lokasi proyek" });
    marker.bindTooltip(lokasi.asal === "poligon" ? "Lokasi proyek (perkiraan)" : "Lokasi proyek", {
      permanent: true,
      direction: "top",
      offset: [0, -34],
    });
    marker.addTo(map);
    lokasiMarkerRef.current = marker;
    const mode = terbangRef.current;
    if (mode && petaTampil) {
      terbangRef.current = null;
      map.invalidateSize();
      if (mode === "fly") map.flyTo(ll, ZOOM_LOKASI, { duration: 1.2 });
      else map.setView(ll, ZOOM_LOKASI, { animate: false });
    }
  }, [lokasi, mapSiap, petaTampil]);

  useEffect(() => {
    if (petaTampil && mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
  }, [petaTampil, mapSiap]);

  const pilihLokasi = (titik: TitikLokasi, label: string) => {
    const baru: LokasiProyek = { lat: titik.lat, lng: titik.lng, asal: "cari" };
    dariCariRef.current = true;
    terbangRef.current = "fly";
    setLokasi(baru);
    setLabelLokasi(label);
    setCariTerbuka(false);
    setPetaTampil(true);
    onLokasiChangeRef.current?.(baru);
  };

  const lewatiCari = () => {
    setCariTerbuka(false);
    setPetaTampil(true);
  };

  const handleUndo = () => {
    if (points.length > 0) setPoints(points.slice(0, -1));
  };

  const handleClear = () => {
    setPoints([]);
    setTempGeom(null);
    setValidationError(null);
  };

  const handleApply = () => {
    if (!tempGeom) return;
    // Tanpa pencarian lokasi: pakai titik tengah poligon sebagai lokasi proyek (ditandai "perkiraan" di pesan WA).
    if (!dariCariRef.current) {
      const c = titikTengahPoligon(points);
      if (c) {
        const perkiraan: LokasiProyek = { ...c, asal: "poligon" };
        setLokasi(perkiraan);
        setLabelLokasi("");
        onLokasiChangeRef.current?.(perkiraan);
      }
    }
    onApplyGeometry(tempGeom);
  };

  return (
    <div className={css.stack}>
      {cariTerbuka ? (
        <LokasiSearch onPilih={pilihLokasi} onLewati={lewatiCari} petaSudahTampil={petaTampil} />
      ) : (
        <div className={css.lokasiRingkas}>
          <div className={css.lokasiRingkasTeks}>
            {lokasi ? (
              <>
                <strong>{lokasi.asal === "poligon" ? "Lokasi proyek (perkiraan)" : "Lokasi proyek"}</strong>
                <span>
                  {labelLokasi ? `${labelLokasi} · ` : ""}
                  {lokasi.lat}, {lokasi.lng}
                </span>
              </>
            ) : (
              <span>Lokasi proyek belum dipilih.</span>
            )}
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCariTerbuka(true)}>
            <span>{lokasi ? "Ubah lokasi" : "Cari lokasi"}</span>
          </button>
        </div>
      )}

      <div hidden={!petaTampil}>
      <div className={css.stack}>
      <p className={css.instruction}>
        Klik sudut-sudut batas tanah langsung di peta satelit (Esri World Imagery). Titik pertama akan
        tersambung otomatis membentuk poligon tertutup.
      </p>

      {mapError ? (
        <div className={css.errorAlert} role="alert">
          <IconAlert size={18} />
          <div>
            <strong>Peta satelit tidak tersedia.</strong> {mapError}
          </div>
        </div>
      ) : (
        <div ref={mapContainerRef} className={css.mapCanvas} />
      )}

      <div className={css.mapToolbar}>
        <div className={css.mapInfo}>
          <span>
            Titik sudut: <strong>{points.length}</strong>
          </span>
          {tempGeom && (
            <>
              <span className={css.divider}>·</span>
              <span>
                Luas: <strong>{tempGeom.metrics.areaM2.toLocaleString("id-ID")} m²</strong>
              </span>
              <span className={css.divider}>·</span>
              <span>
                Keliling: <strong>{tempGeom.metrics.perimeterM.toLocaleString("id-ID")} m</strong>
              </span>
              <span className={css.divider}>·</span>
              <span>
                Zona: <strong>{tempGeom.projection?.zone || "Lokal"}</strong>
              </span>
            </>
          )}
        </div>

        <div className={css.mapActions}>
          <button
            type="button"
            className="btn btn-blue btn-sm"
            onClick={handleApply}
            disabled={!tempGeom}
          >
            <IconCheck size={15} />
            <span>Terapkan Bentuk Lahan</span>
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleUndo}
            disabled={points.length === 0}
          >
            <IconUndo size={15} />
            <span>Hapus Titik</span>
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleClear}
            disabled={points.length === 0}
          >
            <IconTrash size={15} />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {validationError && (
        <div className={css.errorAlert} role="alert">
          <IconAlert size={18} />
          <div>
            <strong>Peringatan geometri:</strong> {validationError}
          </div>
        </div>
      )}

      <div className={css.noteBox}>
        <IconInfo size={16} />
        <div>
          <strong>Catatan akurasi:</strong> Citra satelit membantu visualisasi awal dan estimasi kasar.
          Lakukan pengukuran fisik di lapangan sebelum pemesanan final material.
        </div>
      </div>
      </div>
      </div>
    </div>
  );
}
