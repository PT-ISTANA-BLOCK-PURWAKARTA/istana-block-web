"use client";

import { useEffect, useRef, useState } from "react";
import { projectWgs84MultiPolygon } from "@/lib/paving/geometry/project";
import type { MultiPolygon2D, Point2D, ProjectGeometry, Ring2D } from "@/lib/paving/geometry/types";
import css from "./PavingDesigner.module.css";

interface Props {
  onApplyGeometry: (geom: ProjectGeometry) => void;
  onCancel?: () => void;
}

export function MapDrawer({ onApplyGeometry, onCancel }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const polygonLayerRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);

  // WGS84 points clicked: array of [lon, lat]
  const [points, setPoints] = useState<Point2D[]>([]);
  const [tempGeom, setTempGeom] = useState<ProjectGeometry | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Keep a ref of points for the click handler
  const pointsRef = useRef<Point2D[]>([]);
  pointsRef.current = points;

  // Initialize Leaflet Map on Mount
  useEffect(() => {
    let isMounted = true;

    async function initLeaflet() {
      if (!mapContainerRef.current) return;

      const L = await import("leaflet");
      // @ts-ignore - Leaflet CSS import in dynamic client loader
      await import("leaflet/dist/leaflet.css");
      if (!isMounted) return;

      leafletRef.current = L;

      // Fix default Leaflet marker icon URLs if needed
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      // Default center: Purwakarta / Jawa Barat
      const map = L.map(mapContainerRef.current, {
        center: [-6.556, 107.443],
        zoom: 17,
        maxZoom: 19,
        scrollWheelZoom: true,
      });

      // Esri World Imagery (Satellite)
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          attribution:
            "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, GIS User Community",
          maxZoom: 19,
        },
      ).addTo(map);

      // Layer groups for polygon and markers
      const polyLayer = L.polygon([], {
        color: "#f59e0b",
        fillColor: "#fbbf24",
        fillOpacity: 0.45,
        weight: 3,
      }).addTo(map);

      const markersGroup = L.layerGroup().addTo(map);

      polygonLayerRef.current = polyLayer;
      markersLayerRef.current = markersGroup;
      mapInstanceRef.current = map;

      // Click to add point
      map.on("click", (e: any) => {
        const lon = e.latlng.lng;
        const lat = e.latlng.lat;
        const newPoints: Point2D[] = [...pointsRef.current, [lon, lat]];
        setPoints(newPoints);
      });
    }

    initLeaflet();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Polygon & Markers whenever points change
  useEffect(() => {
    const L = leafletRef.current;
    if (!L || !mapInstanceRef.current) return;

    const polyLayer = polygonLayerRef.current;
    const markersGroup = markersLayerRef.current;

    markersGroup.clearLayers();

    // Leaflet expects [lat, lng]
    const latLngs = points.map(([lon, lat]) => [lat, lon]);
    polyLayer.setLatLngs(latLngs);

    // Add marker for each vertex
    points.forEach(([lon, lat], idx) => {
      const circle = L.circleMarker([lat, lon], {
        radius: 6,
        fillColor: idx === 0 ? "#10b981" : "#3b82f6",
        color: "#ffffff",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9,
      });
      circle.bindTooltip(`Titik ${idx + 1}${idx === 0 ? " (Awal)" : ""}`, {
        permanent: false,
        direction: "top",
      });
      markersGroup.addLayer(circle);
    });

    // Calculate real-time projected geometry if >= 3 points
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
    if (points.length > 0) {
      setPoints(points.slice(0, -1));
    }
  };

  const handleClear = () => {
    setPoints([]);
    setTempGeom(null);
    setValidationError(null);
  };

  const handleApply = () => {
    if (tempGeom) {
      onApplyGeometry(tempGeom);
    }
  };

  return (
    <div className={css.panel}>
      <h3 className={css.panelTitle}>Gambar Lahan di Peta Satelit (Leaflet + Esri)</h3>
      <p className={css.instruction}>
        Klik pada bidang tanah di peta satelit untuk menandai sudut-sudut batas lahan. Titik pertama
        akan otomatis tersambung ke titik terakhir untuk membentuk poligon tertutup.
      </p>

      {/* Map Canvas */}
      <div
        ref={mapContainerRef}
        style={{
          width: "100%",
          height: "440px",
          borderRadius: "8px",
          border: "1px solid #d1d5db",
          overflow: "hidden",
          position: "relative",
          zIndex: 1,
        }}
      />

      {/* Map Control Bar */}
      <div className={css.mapToolbar}>
        <div className={css.mapInfo}>
          <span>Titik sudut: <strong>{points.length}</strong></span>
          {tempGeom && (
            <>
              <span className={css.divider}>|</span>
              <span>
                Luas: <strong>{tempGeom.metrics.areaM2.toLocaleString("id-ID")} m²</strong>
              </span>
              <span className={css.divider}>|</span>
              <span>
                Keliling: <strong>{tempGeom.metrics.perimeterM.toLocaleString("id-ID")} m</strong>
              </span>
              <span className={css.divider}>|</span>
              <span>Zona: <strong>{tempGeom.projection?.zone || "Lokal"}</strong></span>
            </>
          )}
        </div>

        <div className={css.mapActions}>
          <button
            type="button"
            className={css.secondaryButton}
            onClick={handleUndo}
            disabled={points.length === 0}
          >
            Hapus Titik Terakhir
          </button>
          <button
            type="button"
            className={css.secondaryButton}
            onClick={handleClear}
            disabled={points.length === 0}
          >
            Reset Peta
          </button>
          <button
            type="button"
            className={css.applyButton}
            onClick={handleApply}
            disabled={!tempGeom}
          >
            Terapkan Bentuk Lahan
          </button>
        </div>
      </div>

      {validationError && (
        <div className={css.errorAlert} role="alert">
          <strong>Peringatan Geometri:</strong> {validationError}
        </div>
      )}

      <div className={css.calloutBox}>
        <p className={css.calloutText}>
          ℹ️ <strong>Catatan Akurasi:</strong> Citra satelit membantu visualisasi awal dan estimasi
          kasar. Karena distorsi sudut satelit, lakukan pengukuran fisik pita ukur/total station
          sebelum melakukan pemesanan final material.
        </p>
      </div>
    </div>
  );
}
