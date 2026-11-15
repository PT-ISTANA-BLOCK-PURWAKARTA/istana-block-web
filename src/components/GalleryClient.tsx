"use client";

import { useState } from "react";
import gallery from "@/data/gallery.json";
import { ImageLightbox } from "@/components/ImageLightbox";
import { responsif } from "@/lib/img";
import "./galeri.css";

export type GalleryItem = (typeof gallery)[number];

/**
 * Grid foto dokumentasi interaktif.
 * - `teaser={true}`: grid seragam 4:3 untuk beranda.
 * - `teaser={false}`: tata letak Pinterest Masonry rasio asli untuk `/galeri`.
 */
export function GalleryGridClient({ items, teaser = false }: { items: GalleryItem[]; teaser?: boolean }) {
  const [idx, setIdx] = useState<number | null>(null);
  const lightboxItems = items.map((g) => ({ src: g.src, alt: g.alt, caption: g.alt }));

  return (
    <>
      {teaser ? (
        <div className="gallery-grid gallery-teaser">
          {items.map((g, i) => (
            <button
              key={g.src}
              type="button"
              className="gallery-item"
              aria-label={`${g.alt} — klik untuk perbesar`}
              onClick={() => setIdx(i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={g.thumb}
                {...responsif(g.thumb, "(max-width: 720px) 50vw, 375px")}
                alt={g.alt}
                width={640}
                height={480}
                loading="lazy"
                decoding="async"
              />
              <span className="gallery-cap" aria-hidden="true">{g.alt}</span>
            </button>
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="muted galeri-empty">Belum ada foto dokumentasi pada kategori ini.</p>
      ) : (
        <div className="galeri-masonry">
          {items.map((g, i) => {
            const isPabrik = g.kategori === "Pabrik & stok";
            return (
              <button
                key={g.src}
                type="button"
                className="galeri-pin"
                aria-label={`${g.alt} — klik untuk perbesar`}
                onClick={() => setIdx(i)}
              >
                <span className="galeri-media" style={{ aspectRatio: `${g.w} / ${g.h}` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={g.thumb}
                    {...responsif(g.thumb, "(max-width: 600px) 48vw, (max-width: 960px) 48vw, 380px")}
                    alt={g.alt}
                    width={g.w}
                    height={g.h}
                    loading={i < 4 ? "eager" : "lazy"}
                    decoding="async"
                  />
                  <span className={`galeri-badge ${isPabrik ? "is-pabrik" : "is-pemasangan"}`} aria-hidden="true">
                    {isPabrik ? "Pabrik & Stok" : "Pemasangan"}
                  </span>
                  <span className="galeri-zoom" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="7" />
                      <path d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
                    </svg>
                  </span>
                  <span className="galeri-scrim" aria-hidden="true">
                    <span className="galeri-scrim-hint">Perbesar foto ↗</span>
                  </span>
                </span>
                <span className="galeri-foot">
                  <span className="galeri-cap-text">{g.alt}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
      <ImageLightbox
        items={lightboxItems}
        index={idx}
        onClose={() => setIdx(null)}
        onChange={setIdx}
      />
    </>
  );
}
