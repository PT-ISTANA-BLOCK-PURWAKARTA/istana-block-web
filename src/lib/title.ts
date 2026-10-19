import type { Metadata } from "next";

// Harus sama dengan title.template di src/app/layout.tsx.
const AKHIRAN_TEMPLATE = " | Istana Block Purwakarta";
// Batas aman tampil di hasil pencarian; sama dengan BATAS.judulMaks di tools/cek-seo.mjs.
const MAKS = 65;

/** Judul tanpa merek menjadi nilai metadata.title. Bila akhiran template membuatnya melewati batas, pakai akhiran merek pendek. */
export function fitTitle(judul: string): Metadata["title"] {
  if (judul.length + AKHIRAN_TEMPLATE.length <= MAKS) return judul;
  return { absolute: `${judul} | Istana Block` };
}
