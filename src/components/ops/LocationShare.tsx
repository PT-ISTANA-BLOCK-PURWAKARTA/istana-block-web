"use client";

import { useEffect, useRef, useState } from "react";

const MIN_INTERVAL = 30_000; // kirim paling sering tiap 30 detik
const MIN_MOVE_M = 40; // … atau lebih cepat bila sudah bergeser ≥ 40 m

function meters(a: GeolocationCoordinates, b: GeolocationCoordinates) {
  const R = 6371000;
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.latitude - a.latitude) / 2) ** 2 + Math.cos(r(a.latitude)) * Math.cos(r(b.latitude)) * Math.sin(r(b.longitude - a.longitude) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * "Bagikan lokasi" dari HP sopir selama mengantar. Hanya berjalan saat halaman terbuka;
 * untuk pelacakan di latar belakang pakai alat GPS truk atau aplikasi Traccar Client.
 */
export function LocationShare() {
  const [on, setOn] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const watch = useRef<number | null>(null);
  const last = useRef<{ t: number; c: GeolocationCoordinates } | null>(null);
  const wake = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("ib-share-loc") === "1") setOn(true);
    } catch {
      /* penyimpanan tidak tersedia */
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem("ib-share-loc", on ? "1" : "0");
    } catch {
      /* abaikan */
    }
    if (!on) {
      if (watch.current != null) navigator.geolocation.clearWatch(watch.current);
      watch.current = null;
      wake.current?.release().catch(() => {});
      wake.current = null;
      return;
    }
    if (!("geolocation" in navigator)) {
      setMsg("HP ini tidak mendukung lokasi.");
      setOn(false);
      return;
    }
    setMsg("Mencari sinyal GPS…");
    // Jaga layar tetap menyala selama berbagi lokasi (bila didukung browser).
    (navigator as Navigator & { wakeLock?: { request(t: "screen"): Promise<WakeLockSentinel> } }).wakeLock?.request("screen").then((w) => (wake.current = w)).catch(() => {});
    watch.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const prev = last.current;
        const now = Date.now();
        if (prev && now - prev.t < MIN_INTERVAL && meters(prev.c, pos.coords) < MIN_MOVE_M) return;
        last.current = { t: now, c: pos.coords };
        try {
          const r = await fetch("/api/lacak/hp", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude, speed: pos.coords.speed, heading: pos.coords.heading, accuracy: pos.coords.accuracy, at: pos.timestamp }),
          });
          const d = (await r.json()) as { ok: boolean; error?: string; note?: string; stop?: boolean };
          if (d.stop) {
            setMsg(d.error ?? "Berbagi lokasi berhenti.");
            setOn(false);
            return;
          }
          const t = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
          setMsg(d.ok ? d.note ?? `Lokasi terkirim ${t} · akurasi ± ${Math.round(pos.coords.accuracy)} m` : d.error ?? "Gagal mengirim lokasi.");
        } catch {
          setMsg("Sinyal internet lemah; lokasi dicoba lagi otomatis.");
        }
      },
      (err) => {
        setMsg(err.code === err.PERMISSION_DENIED ? "Izin lokasi ditolak. Izinkan lokasi untuk situs ini di pengaturan browser." : "Lokasi belum didapat. Pastikan GPS HP menyala.");
        if (err.code === err.PERMISSION_DENIED) setOn(false);
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 60_000 },
    );
    return () => {
      if (watch.current != null) navigator.geolocation.clearWatch(watch.current);
      watch.current = null;
    };
  }, [on]);

  return (
    <div className={`loc-share${on ? " is-on" : ""}`}>
      <label className="loc-toggle">
        <input type="checkbox" role="switch" checked={on} onChange={(e) => setOn(e.target.checked)} />
        <span>
          <b>Bagikan lokasi saya</b>
          <small>Kantor bisa melihat posisi truk selama mengantar. Biarkan halaman ini terbuka.</small>
        </span>
      </label>
      {msg && <p className="small loc-msg" role="status">{msg}</p>}
    </div>
  );
}
