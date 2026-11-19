"use client";

import { useEffect, useRef, useState } from "react";
import { projectWgs84MultiPolygon } from "@/lib/paving/geometry/project";
import type { MultiPolygon2D, Point2D, ProjectGeometry, Ring2D } from "@/lib/paving/geometry/types";
import { IconAlert, IconCheck, IconInfo, IconTrash, IconUndo } from "./Icons";
import css from "./PavingDesigner.module.css";

interface Props {
  onApplyGeometry: (geom: ProjectGeometry) => void;
  onCancel?: () => void;
}

export function MapDrawer({ onApplyGeometry }: Props) {
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

  const handleUndo = () => {
    if (points.length > 0) setPoints(points.slice(0, -1));
  };

  const handleClear = () => {
    setPoints([]);
    setTempGeom(null);
    setValidationError(null);
  };

  const handleApply = () => {
    if (tempGeom) onApplyGeometry(tempGeom);
  };

  return (
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
  );
}
