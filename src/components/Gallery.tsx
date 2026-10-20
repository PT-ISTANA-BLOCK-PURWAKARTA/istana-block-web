import gallery from "@/data/gallery.json";
import { responsif } from "@/lib/img";

export type GalleryItem = (typeof gallery)[number];
export const GALLERY = gallery as GalleryItem[];

/** Grid foto dokumentasi. Klik membuka foto ukuran penuh. */
export function GalleryGrid({ items, teaser = false }: { items: GalleryItem[]; teaser?: boolean }) {
  return (
    <div className={`gallery-grid${teaser ? " gallery-teaser" : ""}`}>
      {items.map((g) => (
        <a key={g.src} href={g.src} target="_blank" rel="noopener" aria-label={`${g.alt} (buka foto)`}>
          <img src={g.thumb} {...responsif(g.thumb, teaser ? "(max-width: 720px) 50vw, 375px" : "(max-width: 720px) 50vw, 285px")} alt={g.alt} width={640} height={480} loading="lazy" decoding="async" />
          <span className="gallery-cap" aria-hidden="true">{g.alt}</span>
        </a>
      ))}
    </div>
  );
}
