"use client";

import { useState } from "react";
import gallery from "@/data/gallery.json";
import { ImageLightbox } from "@/components/ImageLightbox";
import { responsif } from "@/lib/img";

export type GalleryItem = (typeof gallery)[number];

/** Grid foto dokumentasi interaktif. Klik membuka modal backdrop dengan navigasi antar-foto. */
export function GalleryGridClient({ items, teaser = false }: { items: GalleryItem[]; teaser?: boolean }) {
  const [idx, setIdx] = useState<number | null>(null);

  return (
    <>
      <div className={`gallery-grid${teaser ? " gallery-teaser" : ""}`}>
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
              {...responsif(g.thumb, teaser ? "(max-width: 720px) 50vw, 375px" : "(max-width: 720px) 50vw, 285px")}
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
      <ImageLightbox
        items={items.map((g) => ({ src: g.src, alt: g.alt, caption: g.alt }))}
        index={idx}
        onClose={() => setIdx(null)}
        onChange={setIdx}
      />
    </>
  );
}
