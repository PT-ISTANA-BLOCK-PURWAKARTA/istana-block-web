"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
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
      {/* <dialog> dilarang di dalam <p> (react-markdown membungkus gambar inline dengan <p>): parser HTML menutup <p>
          sebelum <dialog>, sehingga HTML server beda dari pohon klien dan React melempar error #418. Dialog hanya
          dirender setelah diklik, lewat portal ke body, jadi tidak ada di HTML server. */}
      {open &&
        createPortal(
          <ImageLightbox
            items={[{ src: resolvedSrc, alt: safeAlt, caption: alt.trim() || undefined }]}
            index={0}
            onClose={() => setOpen(false)}
          />,
          document.body,
        )}
    </>
  );
}
