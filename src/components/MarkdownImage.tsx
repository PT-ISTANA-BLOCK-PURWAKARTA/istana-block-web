"use client";

import { useState } from "react";
import { ImageLightbox } from "@/components/ImageLightbox";

/** Gambar di dalam konten Markdown yang bisa diklik untuk diperbesar dalam modal backdrop. */
export function MarkdownImage({
  src,
  alt = "",
  width,
  height,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [open, setOpen] = useState(false);
  const resolvedSrc = typeof src === "string" ? src : "";
  if (!resolvedSrc) return null;
  const safeAlt = alt.trim() || "Dokumentasi material beton precast Istana Block Purwakarta";

  return (
    <>
      <button
        type="button"
        className="prose-img-btn"
        aria-label={`${safeAlt} — klik untuk perbesar`}
        onClick={() => setOpen(true)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolvedSrc}
          alt={safeAlt}
          width={width ?? 800}
          height={height ?? 500}
          loading="lazy"
          decoding="async"
          {...props}
        />
      </button>
      <ImageLightbox
        items={[{ src: resolvedSrc, alt: safeAlt, caption: alt.trim() || undefined }]}
        index={open ? 0 : null}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
