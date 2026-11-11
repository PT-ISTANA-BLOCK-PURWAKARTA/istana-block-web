"use client";

import { useEffect, useRef, useState } from "react";

export type LightboxItem = {
  src: string;
  alt?: string;
  caption?: string;
};

/**
 * Dialog pratinjau gambar layar penuh (native `<dialog>`):
 * tutup lewat Esc, klik backdrop, atau tombol ×; mendukung geser kiri/kanan dengan panah.
 */
export function ImageLightbox({
  items,
  index,
  onClose,
  onChange,
}: {
  items: LightboxItem[];
  index: number | null;
  onClose: () => void;
  onChange?: (next: number) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const active = index !== null && index >= 0 && index < items.length ? items[index] : null;
  const total = items.length;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (active) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [active]);

  useEffect(() => {
    if (!active || total <= 1 || !onChange || index === null) return;
    const step = (delta: number) => onChange((index + delta + total) % total);
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        step(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        step(1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, index, onChange, total]);

  const caption = active ? active.caption || active.alt || "" : "";

  return (
    <dialog
      ref={ref}
      className="ib-lightbox"
      aria-label={caption || "Pratinjau gambar"}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
    >
      {active && (
        <div className="ib-lightbox-stage">
          <div className="ib-lightbox-top">
            {total > 1 ? (
              <span className="ib-lightbox-count" aria-live="polite">
                {(index ?? 0) + 1} / {total}
              </span>
            ) : (
              <span />
            )}
            <button
              type="button"
              className="ib-lightbox-close"
              aria-label="Tutup pratinjau"
              onClick={() => ref.current?.close()}
            >
              ×
            </button>
          </div>

          <div className="ib-lightbox-frame">
            {total > 1 && onChange && index !== null && (
              <button
                type="button"
                className="ib-lightbox-nav is-prev"
                aria-label="Foto sebelumnya"
                onClick={() => onChange((index - 1 + total) % total)}
              >
                ‹
              </button>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={active.src} alt={active.alt || caption || "Foto"} decoding="async" />
            {total > 1 && onChange && index !== null && (
              <button
                type="button"
                className="ib-lightbox-nav is-next"
                aria-label="Foto berikutnya"
                onClick={() => onChange((index + 1) % total)}
              >
                ›
              </button>
            )}
          </div>

          {caption && <p className="ib-lightbox-cap">{caption}</p>}
        </div>
      )}
    </dialog>
  );
}

/** Gambar tunggal yang bisa diklik untuk diperbesar dalam modal backdrop. */
export function ZoomableImage({
  src,
  alt,
  caption,
  className = "",
  imgClassName,
  width,
  height,
  loading,
  decoding = "async",
  fetchPriority,
  srcSet,
  sizes,
  children,
}: {
  src: string;
  alt: string;
  caption?: string;
  className?: string;
  imgClassName?: string;
  width?: number;
  height?: number;
  loading?: "lazy" | "eager";
  decoding?: "async" | "sync" | "auto";
  fetchPriority?: "high" | "low" | "auto";
  srcSet?: string;
  sizes?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={`ib-zoom-btn ${className}`.trim()}
        aria-label={alt ? `${alt} — klik untuk perbesar` : "Klik untuk perbesar gambar"}
        onClick={() => setOpen(true)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          srcSet={srcSet}
          sizes={sizes}
          alt={alt}
          className={imgClassName}
          width={width}
          height={height}
          loading={loading}
          decoding={decoding}
          fetchPriority={fetchPriority}
        />
        {children}
      </button>
      <ImageLightbox
        items={[{ src, alt, caption: caption ?? alt }]}
        index={open ? 0 : null}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

export type ProofPhotoItem = {
  src: string;
  thumb?: string;
  alt: string;
  caption?: string;
};

/** Grid thumbnail yang membuka modal backdrop dengan navigasi antar-foto. */
export function PhotoLightboxGrid({
  items,
  containerClassName,
  itemClassName,
}: {
  items: ProofPhotoItem[];
  containerClassName: string;
  itemClassName?: string;
}) {
  const [idx, setIdx] = useState<number | null>(null);
  return (
    <>
      <div className={containerClassName}>
        {items.map((item, i) => (
          <button
            key={`${item.src}-${i}`}
            type="button"
            className={itemClassName ? `ib-thumb-btn ${itemClassName}` : "ib-thumb-btn"}
            aria-label={`${item.alt} — klik untuk perbesar`}
            onClick={() => setIdx(i)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.thumb ?? item.src} alt={item.alt} loading="lazy" decoding="async" />
          </button>
        ))}
      </div>
      <ImageLightbox
        items={items.map((x) => ({ src: x.src, alt: x.alt, caption: x.caption ?? x.alt }))}
        index={idx}
        onClose={() => setIdx(null)}
        onChange={setIdx}
      />
    </>
  );
}
