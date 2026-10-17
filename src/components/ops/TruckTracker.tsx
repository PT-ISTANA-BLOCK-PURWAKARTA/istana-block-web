"use client";

import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as L from "leaflet";
import type { TruckView } from "@/lib/erp/tracking";

type Route = { points: [number, number, number, number][]; km: number } | null;
type Data = { trucks: TruckView[]; route: Route; now: number };

// Purwakarta: titik awal peta sebelum ada posisi.
const HOME: [number, number] = [-6.5569, 107.4431];
const REFRESH_MS = 30_000;

const STATE_LABEL: Record<TruckView["state"], string> = { bergerak: "Bergerak", berhenti: "Berhenti", tanpa_sinyal: "Tanpa sinyal", belum_ada: "Belum ada data" };

const jam = (t: number) => new Date(t * 1000).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

function ago(t: number | null, now: number) {
  if (!t) return "";
  const s = Math.max(0, now - t);
  if (s < 60) return "baru saja";
  if (s < 3600) return `${Math.floor(s / 60)} mnt lalu`;
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
  return `${Math.floor(s / 86400)} hari lalu`;
}

function stateText(t: TruckView, now: number) {
  if (t.state === "bergerak") return `Bergerak ${Math.round(t.speed ?? 0)} km/jam`;
  if (t.state === "berhenti") return t.stoppedSince ? `Berhenti sejak ${jam(t.stoppedSince)}` : "Berhenti";
  if (t.state === "tanpa_sinyal") return `Tanpa sinyal ${ago(t.at, now).replace(" lalu", "")}`;
  return t.hasDevice ? "Belum ada data dari perangkat" : "Belum dipasang pelacak";
}

export function TruckTracker({ initial, today, canSetup }: { initial: Data; today: string; canSetup: boolean }) {
  const [data, setData] = useState<Data>(initial);
  const [sel, setSel] = useState<string | null>(initial.trucks.find((t) => t.lat != null)?.id ?? null);
  const [date, setDate] = useState(today);
  const [updated, setUpdated] = useState(initial.now);
  const [error, setError] = useState<string | null>(null);
  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const lib = useRef<typeof L | null>(null);
  const layers = useRef<{ markers: L.LayerGroup | null; route: L.LayerGroup | null }>({ markers: null, route: null });
  const fitted = useRef(false);
  const fittedRoute = useRef("");

  const load = useCallback(async () => {
    try {
      const q = new URLSearchParams(sel ? { rute: sel, tanggal: date } : {});
      const r = await fetch(`/api/lacak/posisi?${q}`, { cache: "no-store" });
      if (!r.ok) throw new Error(r.status === 403 ? "Sesi berakhir. Muat ulang halaman." : `Gagal memuat (${r.status}).`);
      const d = (await r.json()) as Data;
      setData(d);
      setUpdated(d.now);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat posisi.");
    }
  }, [sel, date]);

  // Muat ulang tiap 30 detik, dan langsung saat truk/tanggal dipilih.
  useEffect(() => {
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  // Peta dibuat sekali di browser.
  useEffect(() => {
    let dead = false;
    (async () => {
      const leaflet = (await import("leaflet")).default;
      if (dead || !mapEl.current || map.current) return;
      lib.current = leaflet;
      const m = leaflet.map(mapEl.current, { zoomControl: true, attributionControl: true }).setView(HOME, 10);
      leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(m);
      layers.current.route = leaflet.layerGroup().addTo(m);
      layers.current.markers = leaflet.layerGroup().addTo(m);
      map.current = m;
      setData((d) => ({ ...d })); // gambar ulang penanda setelah peta siap
    })();
    return () => {
      dead = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Gambar penanda truk & rute.
  useEffect(() => {
    const leaflet = lib.current;
    const m = map.current;
    if (!leaflet || !m || !layers.current.markers || !layers.current.route) return;
    layers.current.markers.clearLayers();
    layers.current.route.clearLayers();
    const pts: [number, number][] = [];
    for (const t of data.trucks) {
      if (t.lat == null || t.lng == null) continue;
      pts.push([t.lat, t.lng]);
      const icon = leaflet.divIcon({
        className: "",
        html: `<div class="truck-pin is-${t.state}${t.id === sel ? " is-sel" : ""}"><span class="dot"></span><b>${t.plate.replace(/</g, "")}</b></div>`,
        iconSize: [0, 0],
      });
      leaflet.marker([t.lat, t.lng], { icon, title: `${t.plate}: ${stateText(t, data.now)}`, keyboard: true }).on("click", () => setSel(t.id)).addTo(layers.current.markers);
      if (t.id === sel && t.trip?.dest) {
        leaflet.circleMarker(t.trip.dest, { radius: 7, color: "#d63f12", weight: 3, fillColor: "#fff", fillOpacity: 1 }).bindTooltip(`Tujuan: ${t.trip.contactName}`).addTo(layers.current.route);
      }
    }
    const route = data.route?.points ?? [];
    if (sel && route.length > 1) {
      leaflet.polyline(route.map((p) => [p[0], p[1]] as [number, number]), { color: "#254186", weight: 4, opacity: 0.85 }).addTo(layers.current.route);
      leaflet.circleMarker([route[0][0], route[0][1]], { radius: 6, color: "#254186", weight: 3, fillColor: "#fff", fillOpacity: 1 }).bindTooltip(`Mulai ${jam(route[0][2])}`).addTo(layers.current.route);
    }
    // Bingkai peta: rute truk terpilih (sekali per truk/tanggal), atau semua truk saat pertama dibuka.
    const routeKey = `${sel}|${date}`;
    if (sel && route.length > 1 && fittedRoute.current !== routeKey) {
      fittedRoute.current = routeKey;
      fitted.current = true;
      const t = data.trucks.find((x) => x.id === sel);
      const b = leaflet.latLngBounds(route.map((p) => [p[0], p[1]] as [number, number]));
      if (t?.lat != null && t.lng != null) b.extend([t.lat, t.lng]);
      if (t?.trip?.dest) b.extend(t.trip.dest);
      m.fitBounds(b.pad(0.15));
    } else if (!fitted.current && pts.length) {
      fitted.current = true;
      if (pts.length === 1) m.setView(pts[0], 13);
      else m.fitBounds(leaflet.latLngBounds(pts).pad(0.25));
    }
  }, [data, sel, date]);

  const selected = useMemo(() => data.trucks.find((t) => t.id === sel) ?? null, [data, sel]);

  function focus(t: TruckView) {
    setSel(t.id);
    if (t.lat != null && t.lng != null) map.current?.setView([t.lat, t.lng], Math.max(map.current.getZoom(), 13));
  }

  const counts = {
    jalan: data.trucks.filter((t) => t.trip).length,
    sinyal: data.trucks.filter((t) => t.state === "bergerak" || t.state === "berhenti").length,
  };

  return (
    <div className="tracker">
      <aside className="tracker-list" aria-label="Daftar truk">
        <div className="tracker-meta small muted" aria-live="polite">
          {counts.sinyal} dari {data.trucks.length} truk mengirim posisi · {counts.jalan} sedang mengantar
          <br />Diperbarui {jam(updated)} · otomatis tiap 30 detik
          {error && <span className="text-bahaya"> · {error}</span>}
        </div>
        {data.trucks.map((t) => (
          <button key={t.id} type="button" className={`truck-card is-${t.state}${t.id === sel ? " is-sel" : ""}`} onClick={() => focus(t)} aria-pressed={t.id === sel}>
            <span className="truck-head">
              <b>{t.plate}</b>
              {t.name && <span className="muted small">{t.name}</span>}
            </span>
            <span className={`truck-state is-${t.state}`}><span className="dot" aria-hidden="true" />{stateText(t, data.now)}</span>
            {t.trip ? (
              <span className="truck-trip small">
                Mengantar <b>{t.trip.number}</b> ke {t.trip.contactName}
                {t.trip.destination ? ` · ${t.trip.destination}` : ""}
                {t.trip.driver ? ` · sopir ${t.trip.driver}` : ""}
                {t.distanceKm != null && <> · <b>± {t.distanceKm.toLocaleString("id-ID")} km</b> lurus ke tujuan</>}
              </span>
            ) : (
              <span className="truck-trip small muted">Tidak ada surat jalan di jalan</span>
            )}
            {t.at && <span className="small muted">Posisi {ago(t.at, data.now)} · {t.source === "hp" ? "dari HP sopir" : "dari GPS"}</span>}
          </button>
        ))}
        {data.trucks.length === 0 && <p className="muted small">Belum ada armada aktif.</p>}
        {canSetup && (
          <Link href="/operasional/lacak/pengaturan" className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }}>
            Pengaturan GPS
          </Link>
        )}
      </aside>
      <section className="tracker-map-wrap" aria-label="Peta posisi truk">
        {selected && (
          <form className="tracker-route" onSubmit={(e) => e.preventDefault()}>
            <span>
              <b>Rute {selected.plate}</b>{" "}
              {data.route ? (data.route.points.length > 1 ? `· ${data.route.km.toLocaleString("id-ID")} km, ${data.route.points.length} titik` : "· belum ada rute di tanggal ini") : ""}
            </span>
            <label className="sr-only" htmlFor="rute-tgl">Tanggal rute</label>
            <input id="rute-tgl" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} />
          </form>
        )}
        <div ref={mapEl} className="tracker-map" />
      </section>
    </div>
  );
}
