"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Video singkat fitur situs, diputar seperti GIF (senyap, berulang).
 * Desktop memakai versi 16:9, ponsel memakai versi 9:16.
 * Tombol "Putar dengan suara" memutar versi ber-voice-over dari awal.
 */
// Ponsel, atau tablet yang dipegang tegak → 9:16. Dipakai juga oleh poster dan CSS (.reel-auto), jadi samakan bila diubah.
const MOBILE_QUERY = "(max-width: 720px), (orientation: portrait) and (pointer: coarse)";

type Fmt = "16x9" | "9x16";

export function FeatureReel() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [fmt, setFmt] = useState<Fmt | null>(null);
  const [inView, setInView] = useState(false);
  const [withSound, setWithSound] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [reduced, setReduced] = useState(false);

  // pilih format sesuai perangkat (dan ikuti bila layar diputar / jendela diubah)
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setFmt(mq.matches ? "9x16" : "16x9");
    update();
    setReduced(rm.matches);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // baru memuat video saat bagian ini terlihat; jeda saat keluar layar
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const src = fmt ? `/reel/reel-${fmt}${withSound ? "-suara" : ""}` : undefined; // tanpa ekstensi: .mp4 lalu .webm

  useEffect(() => setPlaying(false), [src]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !src) return;
    if (withSound) return; // dikendalikan pengguna lewat tombol/kontrol
    v.muted = true; // syarat autoplay di browser
    if (inView && !reduced) v.play().catch(() => {});
    else v.pause();
  }, [inView, src, reduced, withSound]);

  function playWithSound() {
    setWithSound(true);
    requestAnimationFrame(() => {
      const v = videoRef.current;
      if (!v) return;
      v.muted = false;
      v.currentTime = 0;
      v.play().catch(() => {});
    });
  }

  function backToLoop() {
    setWithSound(false);
  }

  return (
    <div className={`reel reel-${fmt ?? "auto"}`} ref={boxRef}>
      <div className="reel-frame">
        <picture className="reel-poster" aria-hidden="true">
          <source media={MOBILE_QUERY} srcSet="/reel/reel-9x16.webp" type="image/webp" />
          <source srcSet="/reel/reel-16x9.webp" type="image/webp" />
          <img src="/reel/reel-16x9.jpg" alt="" loading="lazy" decoding="async" />
        </picture>
        {src && (inView || withSound || playing) && (
          <video
            key={src}
            ref={videoRef}
            className={playing || withSound || reduced ? "is-on" : ""}
            muted={!withSound}
            loop={!withSound}
            playsInline
            autoPlay={!reduced && !withSound}
            controls={withSound || reduced}
            preload="metadata"
            aria-label="Video singkat: menghitung kebutuhan paving dengan kalkulator, mengirim hasilnya ke admin lewat WhatsApp, dan melihat daftar harga U-Ditch per ukuran."
            onPlaying={() => setPlaying(true)}
            onEnded={withSound ? backToLoop : undefined}
          >
            <source src={`${src}.mp4`} type="video/mp4" />
            <source src={`${src}.webm`} type="video/webm" />
            {withSound && <track kind="captions" src="/reel/reel-suara.vtt" srcLang="id" label="Bahasa Indonesia" />}
          </video>
        )}
      </div>
      <div className="reel-actions">
        {withSound ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={backToLoop}>
            Kembali ke mode senyap
          </button>
        ) : (
          <button type="button" className="btn btn-blue btn-sm" onClick={playWithSound}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 5 6 9H2v6h4l5 4V5z" />
              <path d="M15.5 8.5a5 5 0 0 1 0 7" />
              <path d="M19 5a10 10 0 0 1 0 14" />
            </svg>
            Putar dengan suara
          </button>
        )}
      </div>
    </div>
  );
}
