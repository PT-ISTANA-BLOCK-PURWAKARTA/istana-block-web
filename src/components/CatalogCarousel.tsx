"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImageLightbox, type LightboxItem } from "@/components/ImageLightbox";
import katalogData from "@/data/katalog.json";
import { waLink } from "@/lib/format";
import "./katalog.css";

export const ORIGINAL_PDF_URL = "https://drive.google.com/file/d/1FMeJJZYi9FOtClAZXy18y_HvQhK71ABz/view?pli=1";

export type CatalogSlide = {
  page: number;
  src: string;
  thumb: string;
  w: number;
  h: number;
  title: string;
  summary: string;
};

const SLIDES: CatalogSlide[] = katalogData;

const QUICK_JUMPS = [
  { page: 1, label: "1 Sampul" },
  { page: 3, label: "3 Paving" },
  { page: 4, label: "4 Jasa Pasang" },
  { page: 5, label: "5 Kanstin" },
  { page: 6, label: "6 Buis" },
  { page: 7, label: "7 Gravel (Greffel)" },
  { page: 9, label: "9 U-Ditch" },
  { page: 10, label: "10 Genteng" },
] as const;

export type CatalogCarouselProps = {
  whatsapp: string;
  compact?: boolean;
  initialPage?: number;
  pdfUrl?: string;
  showPdfButton?: boolean;
  className?: string;
};

function clampSlideIndex(page: number | undefined, total: number) {
  if (!page || !Number.isFinite(page)) return 0;
  return Math.min(Math.max(0, Math.round(page) - 1), total - 1);
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Penampil dokumen katalog multi-halaman bergaya LinkedIn Carousel:
 * scroll-snap horizontal, tombol prev/next, pintasan keyboard, filmstrip thumbnail,
 * lompatan bagian cepat, zoom layar penuh lewat ImageLightbox, dan CTA WhatsApp kontekstual.
 */
export function CatalogCarousel({
  whatsapp,
  compact = false,
  initialPage = 1,
  pdfUrl = ORIGINAL_PDF_URL,
  showPdfButton = true,
  className = "",
}: CatalogCarouselProps) {
  const total = SLIDES.length;
  const initialIdx = useMemo(() => clampSlideIndex(initialPage, total), [initialPage, total]);

  const [activeIndex, setActiveIndex] = useState(initialIdx);
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeRef = useRef(activeIndex);
  const targetIdxRef = useRef<number | null>(null);
  const targetTimerRef = useRef<number | null>(null);
  const scrollRafRef = useRef<number | null>(null);

  activeRef.current = activeIndex;

  const active = SLIDES[activeIndex] ?? SLIDES[0];
  const progressPct = ((activeIndex + 1) / total) * 100;

  const lightboxItems = useMemo<LightboxItem[]>(
    () =>
      SLIDES.map((slide) => ({
        src: slide.src,
        alt: `Katalog Istana Block halaman ${slide.page}: ${slide.title}`,
        caption: `Halaman ${slide.page} / ${total} — ${slide.title}: ${slide.summary}`,
      })),
    [total],
  );

  const clearTargetLock = useCallback(() => {
    targetIdxRef.current = null;
    if (targetTimerRef.current !== null) {
      window.clearTimeout(targetTimerRef.current);
      targetTimerRef.current = null;
    }
  }, []);

  const goTo = useCallback(
    (nextIndex: number, instant = false) => {
      const clamped = Math.min(Math.max(0, nextIndex), total - 1);
      setActiveIndex(clamped);

      const track = trackRef.current;
      if (!track) return;

      clearTargetLock();
      const useInstant = instant || prefersReducedMotion();
      if (!useInstant) {
        targetIdxRef.current = clamped;
        targetTimerRef.current = window.setTimeout(() => {
          targetIdxRef.current = null;
          targetTimerRef.current = null;
        }, 700);
      }

      track.scrollTo({
        left: clamped * track.clientWidth,
        behavior: useInstant ? "auto" : "smooth",
      });
    },
    [clearTargetLock, total],
  );

  // Sinkronkan posisi slide saat `initialPage` berubah (termasuk kembali ke halaman 1).
  const mountedRef = useRef(false);
  useEffect(() => {
    setActiveIndex(initialIdx);
    const track = trackRef.current;
    if (track && (mountedRef.current || initialIdx > 0)) {
      track.scrollTo({ left: initialIdx * track.clientWidth, behavior: "auto" });
    }
    mountedRef.current = true;
  }, [initialIdx]);

  // Pertahankan posisi slide saat ukuran kontainer berubah (rotasi layar / modal).
  useEffect(() => {
    const track = trackRef.current;
    if (!track || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      track.scrollTo({ left: activeRef.current * track.clientWidth, behavior: "auto" });
    });
    ro.observe(track);
    return () => ro.disconnect();
  }, []);

  // Gulir filmstrip secara horizontal agar thumbnail aktif selalu terlihat tanpa menggulir halaman utama.
  useEffect(() => {
    const strip = stripRef.current;
    const btn = thumbRefs.current[activeIndex];
    if (!strip || !btn) return;
    const targetLeft = btn.offsetLeft - (strip.clientWidth - btn.clientWidth) / 2;
    strip.scrollTo({
      left: Math.max(0, targetLeft),
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, [activeIndex]);

  // Pembersihan timer & RAF saat unmount.
  useEffect(() => {
    return () => {
      clearTargetLock();
      if (scrollRafRef.current !== null) window.cancelAnimationFrame(scrollRafRef.current);
    };
  }, [clearTargetLock]);

  // Navigasi keyboard ArrowLeft / ArrowRight / Home / End saat ImageLightbox tidak aktif.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (zoomIndex !== null) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) {
        return;
      }

      const openDialogs = document.querySelectorAll("dialog[open]");
      const ownDialog = rootRef.current?.closest("dialog[open]");
      if (openDialogs.length > 0 && !ownDialog) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goTo(activeRef.current - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goTo(activeRef.current + 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        goTo(0);
      } else if (e.key === "End") {
        e.preventDefault();
        goTo(total - 1);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goTo, total, zoomIndex]);

  function handleTrackScroll() {
    if (scrollRafRef.current !== null) return;
    scrollRafRef.current = window.requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const track = trackRef.current;
      if (!track) return;
      const w = track.clientWidth;
      if (w <= 0) return;

      if (targetIdxRef.current !== null) {
        if (Math.abs(track.scrollLeft - targetIdxRef.current * w) <= 4) {
          clearTargetLock();
        }
        return;
      }

      const nearest = Math.min(total - 1, Math.max(0, Math.round(track.scrollLeft / w)));
      if (nearest !== activeRef.current) {
        setActiveIndex(nearest);
      }
    });
  }

  const waHref = waLink(
    whatsapp,
    `Halo Istana Block, saya sedang melihat Katalog halaman ${active.page} (${active.title}) dan ingin bertanya atau minta penawaran.`,
  );

  return (
    <section
      ref={rootRef}
      id="katalog-viewer"
      className={`ib-cat${compact ? " is-compact" : ""}${className ? ` ${className}` : ""}`}
      role="region"
      aria-roledescription="carousel"
      aria-label="Katalog Produk Istana Block Purwakarta"
    >
      {/* Pengumuman ARIA untuk pembaca layar saat halaman berganti */}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        Halaman {active.page} dari {total}: {active.title}. {active.summary}
      </span>

      {/* Top Toolbar */}
      <div className="ib-cat-top">
        <div className="ib-cat-meta">
          <span className="ib-cat-badge">
            Halaman {active.page} / {total}
          </span>
          <div className="ib-cat-heading">
            <p className="ib-cat-title">{active.title}</p>
            <p className="ib-cat-summary">{active.summary}</p>
          </div>
        </div>

        <div className="ib-cat-actions">
          <button
            type="button"
            className="ib-cat-tool-btn is-zoom"
            onClick={() => setZoomIndex(activeIndex)}
            aria-label={`Perbesar halaman ${active.page} layar penuh`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
            <span>Perbesar</span>
          </button>

          {showPdfButton && pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ib-cat-tool-btn"
              data-cta="katalog-pdf-asli"
              aria-label="Unduh PDF Asli (Google Drive, buka di tab baru)"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Unduh PDF Asli (Google Drive)</span>
            </a>
          )}
        </div>
      </div>

      {/* Stage Utama (Scroll-Snap Horizontal + Prev/Next + Progress Bar) */}
      <div className="ib-cat-stage">
        <button
          type="button"
          className="ib-cat-nav is-prev"
          aria-label="Halaman sebelumnya"
          disabled={activeIndex === 0}
          onClick={() => goTo(activeIndex - 1)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <div
          ref={trackRef}
          className="ib-cat-track"
          onScroll={handleTrackScroll}
          tabIndex={0}
          aria-label="Daftar halaman katalog, geser kiri atau kanan atau gunakan tombol panah"
        >
          {SLIDES.map((slide, i) => (
            <div
              key={slide.page}
              className="ib-cat-slide"
              role="group"
              aria-roledescription="slide"
              aria-label={`Halaman ${slide.page} dari ${total}: ${slide.title}`}
            >
              <button
                type="button"
                className="ib-cat-page-btn"
                onClick={() => setZoomIndex(i)}
                aria-label={`Perbesar halaman ${slide.page}: ${slide.title}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={slide.src}
                  alt={`Katalog Istana Block halaman ${slide.page}: ${slide.title} — ${slide.summary}`}
                  width={slide.w}
                  height={slide.h}
                  className="ib-cat-page-img"
                  loading={Math.abs(i - activeIndex) <= 1 ? "eager" : "lazy"}
                  decoding={i === activeIndex ? "sync" : "async"}
                  fetchPriority={i === activeIndex && !compact ? "high" : undefined}
                />
                <span className="ib-cat-zoom-hint" aria-hidden="true">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    <line x1="11" y1="8" x2="11" y2="14" />
                    <line x1="8" y1="11" x2="14" y2="11" />
                  </svg>
                  Klik untuk perbesar
                </span>
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="ib-cat-nav is-next"
          aria-label="Halaman berikutnya"
          disabled={activeIndex === total - 1}
          onClick={() => goTo(activeIndex + 1)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        {/* Animated Progress Strip */}
        <div
          className="ib-cat-progress"
          role="progressbar"
          aria-label="Progres baca katalog"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={active.page}
        >
          <div className="ib-cat-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Bottom Dock: Quick Jumps + Thumbnail Filmstrip + WA Strip */}
      <div className="ib-cat-dock">
        <div className="ib-cat-jumps" role="group" aria-label="Lompat cepat ke bagian produk">
          {QUICK_JUMPS.map((jump) => {
            const isCurrent = active.page === jump.page;
            return (
              <button
                key={jump.page}
                type="button"
                className={`ib-cat-jump${isCurrent ? " is-active" : ""}`}
                aria-pressed={isCurrent}
                onClick={() => goTo(jump.page - 1)}
              >
                {jump.label}
              </button>
            );
          })}
        </div>

        <div ref={stripRef} className="ib-cat-strip" role="group" aria-label="Pilih halaman katalog dari gambar kecil">
          {SLIDES.map((slide, i) => {
            const isCurrent = i === activeIndex;
            return (
              <button
                key={slide.page}
                ref={(el) => {
                  thumbRefs.current[i] = el;
                }}
                type="button"
                className={`ib-cat-thumb${isCurrent ? " is-active" : ""}`}
                aria-label={`Buka halaman ${slide.page}: ${slide.title}`}
                aria-current={isCurrent ? "true" : undefined}
                onClick={() => goTo(i)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={slide.thumb}
                  alt={`Thumbnail halaman ${slide.page}: ${slide.title}`}
                  width={160}
                  height={226}
                  loading={i < 6 ? "eager" : "lazy"}
                  decoding="async"
                />
                <span className="ib-cat-thumb-num">{String(slide.page).padStart(2, "0")}</span>
              </button>
            );
          })}
        </div>

        <div className="ib-cat-wa-strip">
          <div className="ib-cat-wa-copy">
            <strong>Tanyakan produk di halaman ini ke admin</strong>
            <span>
              Hal. {active.page}: {active.title}
            </span>
          </div>
          <a
            href={waHref}
            target="_blank"
            rel="noopener"
            className="btn btn-primary ib-cat-wa-btn"
            data-cta="katalog-wa-halaman"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
            <span>Tanya via WhatsApp</span>
          </a>
        </div>
      </div>

      {/* Mode Zoom Layar Penuh */}
      <ImageLightbox
        items={lightboxItems}
        index={zoomIndex}
        onClose={() => setZoomIndex(null)}
        onChange={(next) => {
          setZoomIndex(next);
          goTo(next, true);
        }}
      />
    </section>
  );
}
