"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type * as L from "leaflet";

// Purwakarta: titik awal peta bila belum ada posisi maupun tujuan.
const HOME: [number, number] = [-6.5569, 107.4431];

/** Peta publik halaman lacak: posisi terakhir truk (bila ada) dan titik tujuan (bila koordinatnya diketahui). Tile OpenStreetMap. */
export function TrackMap({ lat, lng, destLat, destLng, plate }: { lat: number | null; lng: number | null; destLat: number | null; destLng: number | null; plate: string }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const lib = useRef<typeof L | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const fitted = useRef("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let dead = false;
    (async () => {
      const leaflet = (await import("leaflet")).default;
      if (dead || !el.current || map.current) return;
      lib.current = leaflet;
      const m = leaflet.map(el.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false }).setView(HOME, 11);
      leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(m);
      layer.current = leaflet.layerGroup().addTo(m);
      map.current = m;
      setReady(true);
    })();
    return () => {
      dead = true;
      map.current?.remove();
      map.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const leaflet = lib.current;
    const m = map.current;
    const g = layer.current;
    if (!ready || !leaflet || !m || !g) return;
    g.clearLayers();
    const pts: [number, number][] = [];
    if (lat != null && lng != null) {
      pts.push([lat, lng]);
      const icon = leaflet.divIcon({ className: "", html: `<div class="truck-pin is-bergerak is-sel"><span class="dot"></span><b>${plate.replace(/[<>&"]/g, "")}</b></div>`, iconSize: [0, 0] });
      leaflet.marker([lat, lng], { icon, title: `Posisi terakhir ${plate}` }).addTo(g);
    }
    if (destLat != null && destLng != null) {
      pts.push([destLat, destLng]);
      leaflet.circleMarker([destLat, destLng], { radius: 8, color: "#d63f12", weight: 3, fillColor: "#fff", fillOpacity: 1 }).bindTooltip("Tujuan").addTo(g);
    }
    // Bingkai peta sekali per kombinasi (ada posisi / ada tujuan); setelah itu pengguna bebas menggeser.
    const key = `${lat != null}|${destLat != null}`;
    if (pts.length && fitted.current !== key) {
      fitted.current = key;
      if (pts.length === 1) m.setView(pts[0], 14);
      else m.fitBounds(leaflet.latLngBounds(pts).pad(0.25));
    }
  }, [ready, lat, lng, destLat, destLng, plate]);

  return <div ref={el} className="tk-map" role="img" aria-label="Peta posisi truk dan tujuan" />;
}
