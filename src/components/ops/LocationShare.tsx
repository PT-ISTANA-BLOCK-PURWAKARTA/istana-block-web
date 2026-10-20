"use client";

import { useEffect, useRef, useState } from "react";

const SEND_EVERY = 10_000; // kirim posisi terakhir tiap 10 detik selama berbagi lokasi

/**
 * "Bagikan lokasi" dari HP sopir selama mengantar (berangkat, tiba, tertunda di jalan). Hanya berjalan saat halaman terbuka;
 * untuk pelacakan di latar belakang pakai alat GPS truk atau aplikasi Traccar Client.
 * Posisi dibaca terus (watchPosition) dan dikirim paling sering tiap 10 detik.
 */
export function LocationShare() {
  const [on, setOn] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const watch = useRef<number | null>(null);
  const latest = useRef<GeolocationPosition | null>(null);
  const sentFix = useRef<GeolocationPosition | null>(null);
  const sentAt = useRef(0);
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
      latest.current = null;
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
    let stopped = false;
    let sending = false;

    async function send() {
      const pos = latest.current;
      if (!pos || sending) return;
      // Titik yang sama dikirim ulang dengan jam sekarang supaya kantor tahu HP masih hidup walau truk berhenti,
      // tetapi tidak lebih sering dari tiap 30 detik (hemat tulis D1).
      const fresh = sentFix.current === pos;
      if (fresh && Date.now() - sentAt.current < 30_000) return;
      sending = true;
      try {
        sentAt.current = Date.now();
        const r = await fetch("/api/lacak/hp", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude, speed: fresh ? 0 : pos.coords.speed, heading: pos.coords.heading, accuracy: pos.coords.accuracy, at: fresh ? Date.now() : pos.timestamp }),
        });
        sentFix.current = pos;
        const d = (await r.json()) as { ok: boolean; error?: string; note?: string; stop?: boolean };
        if (stopped) return;
        if (d.stop) {
          setMsg(d.error ?? "Berbagi lokasi berhenti.");
          setOn(false);
          return;
        }
        const t = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        setMsg(d.ok ? d.note ?? `Lokasi terkirim ${t} · akurasi ± ${Math.round(pos.coords.accuracy)} m` : d.error ?? "Gagal mengirim lokasi.");
      } catch {
        if (!stopped) setMsg("Sinyal internet lemah; lokasi dicoba lagi otomatis.");
      } finally {
        sending = false;
      }
    }

    watch.current = navigator.geolocation.watchPosition(
      (pos) => {
        const first = latest.current === null;
        latest.current = pos;
        if (first) void send();
      },
      (err) => {
        setMsg(err.code === err.PERMISSION_DENIED ? "Izin lokasi ditolak. Izinkan lokasi untuk situs ini di pengaturan browser." : "Lokasi belum didapat. Pastikan GPS HP menyala.");
        if (err.code === err.PERMISSION_DENIED) setOn(false);
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 60_000 },
    );
    const timer = setInterval(() => void send(), SEND_EVERY);
    return () => {
      stopped = true;
      clearInterval(timer);
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
