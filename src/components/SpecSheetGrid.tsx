"use client";

import { useState } from "react";
import { ImageLightbox } from "@/components/ImageLightbox";
import { responsif } from "@/lib/img";

export type SpecSheetItem = {
  src: string;
  title: string;
  alt: string;
  w: number;
  h: number;
};

/** Grid lembar spesifikasi & sertifikat TKDN. Klik membuka pratinjau penuh di modal backdrop. */
export function SpecSheetGrid({ items }: { items: SpecSheetItem[] }) {
  const [idx, setIdx] = useState<number | null>(null);

  return (
    <>
      <div className={`sheets${items.length === 1 ? " single" : ""}`}>
        {items.map((x, i) => (
          <button
            key={x.src}
            type="button"
            className="sheet"
            aria-label={`${x.title} — lihat ukuran penuh`}
            onClick={() => setIdx(i)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={x.src}
              {...responsif(x.src, items.length === 1 ? "(max-width: 720px) 90vw, 540px" : "(max-width: 720px) 90vw, 280px")}
              alt={x.alt}
              width={x.w}
              height={x.h}
              loading="lazy"
              decoding="async"
            />
            <span>{x.title}<i aria-hidden="true">Perbesar</i></span>
          </button>
        ))}
      </div>
      <ImageLightbox
        items={items.map((x) => ({ src: x.src, alt: x.alt, caption: x.title }))}
        index={idx}
        onClose={() => setIdx(null)}
        onChange={setIdx}
      />
    </>
  );
}
