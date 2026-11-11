import gallery from "@/data/gallery.json";
import { GalleryGridClient, type GalleryItem } from "@/components/GalleryClient";

export type { GalleryItem };
export const GALLERY = gallery as GalleryItem[];

/** Grid foto dokumentasi. Klik membuka foto ukuran penuh dalam modal backdrop. */
export function GalleryGrid({ items, teaser = false }: { items: GalleryItem[]; teaser?: boolean }) {
  return <GalleryGridClient items={items} teaser={teaser} />;
}
