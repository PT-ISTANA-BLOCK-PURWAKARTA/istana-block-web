"use client";

import { useState } from "react";
import { ImageLightbox } from "@/components/ImageLightbox";

const IMAGE_RE = /\.(webp|jpe?g|png|gif|avif)$/i;

/**
 * Tautan lampiran kalender: berkas gambar dibuka di modal pratinjau;
 * dokumen lain (PDF, Word, Excel, dll.) dibuka di tab baru.
 */
export function AttachmentLink({ fileKey, name }: { fileKey: string; name: string }) {
  const [open, setOpen] = useState(false);
  const href = `/operasional/berkas/${fileKey}`;

  if (!IMAGE_RE.test(name)) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="cal-file-link">
        {name}
      </a>
    );
  }

  return (
    <>
      <button type="button" className="cal-file-link" onClick={() => setOpen(true)}>
        {name}
      </button>
      <ImageLightbox
        items={[{ src: href, alt: name, caption: name }]}
        index={open ? 0 : null}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
