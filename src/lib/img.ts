import variants from "@/data/img-variants.json";

type Varian = { w: number; v: number[] };
const PETA = variants as Record<string, Varian>;

/**
 * srcSet + sizes untuk foto statis yang punya varian lebar kecil (dibuat `npm run gambar:varian`,
 * daftar di src/data/img-variants.json). Gambar lain (unggahan R2 /media/...) tidak punya varian:
 * hasilnya kosong, jadi <img> tampil apa adanya.
 */
export function responsif(src: string | null | undefined, sizes: string): { srcSet?: string; sizes?: string } {
  const e = src ? PETA[src] : undefined;
  if (!src || !e) return {};
  const srcSet = [...e.v.map((w) => `${src.replace(/\.webp$/, `-${w}.webp`)} ${w}w`), `${src} ${e.w}w`].join(", ");
  return { srcSet, sizes };
}
