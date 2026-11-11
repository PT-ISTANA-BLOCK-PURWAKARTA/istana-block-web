"use client";

import { useState } from "react";
import { ImageLightbox } from "@/components/ImageLightbox";

/** Gambar di dalam konten Markdown yang bisa diklik untuk diperbesar dalam modal backdrop. */
export function MarkdownImage({
  src,
  alt = "",
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [open, setOpen] = useState(false);
  const resolvedSrc = typeof src === "string" ? src : "";
  if (!resolvedSrc) return null;

  return (
    <>
      <button
        type="button"
        className="prose-img-btn"
        aria-label={alt ? `${alt} — klik untuk perbesar` : "Klik untuk perbesar gambar"}
        onClick={() => setOpen(true)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={resolvedSrc} alt={alt} loading="lazy" decoding="async" {...props} />
      </button>
      <ImageLightbox
        items={[{ src: resolvedSrc, alt, caption: alt || undefined }]}
        index={open ? 0 : null}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
