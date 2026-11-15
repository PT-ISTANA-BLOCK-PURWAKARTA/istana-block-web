import type { Metadata } from "next";

// Harus sama dengan title.template di src/app/layout.tsx.
const AKHIRAN_TEMPLATE = " | Istana Block Purwakarta";
const AKHIRAN_PENDEK = " | Istana Block";
// Target <= 60 karakter (memenuhi OpenSEO TITLE_MAX_CHARS = 60 sekaligus BATAS.judulMaks = 65 di cek-seo.mjs).
const MAKS = 60;

function trimKata(teks: string, maks: number): string {
  const bersih = teks.replace(/\s+/g, " ").trim();
  if (bersih.length <= maks) return bersih;
  const potong = bersih.slice(0, Math.max(12, maks - 1)).replace(/[\s,.;:\-–—|]+\S*$/, "").trim();
  return `${potong || bersih.slice(0, maks - 1).trim()}…`;
}

/**
 * Judul tanpa merek menjadi nilai metadata.title.
 * Bila akhiran template melewati batas 60 karakter, gunakan akhiran pendek atau pangkas di batas kata.
 */
export function fitTitle(judul: string): Metadata["title"] {
  const bersih = judul.replace(/\s+/g, " ").trim();
  if (/istana block/i.test(bersih)) return { absolute: clampTitle(bersih) };
  if (bersih.length + AKHIRAN_TEMPLATE.length <= MAKS) return bersih;
  if (bersih.length + AKHIRAN_PENDEK.length <= MAKS) return { absolute: `${bersih}${AKHIRAN_PENDEK}` };
  return { absolute: `${trimKata(bersih, MAKS - AKHIRAN_PENDEK.length)}${AKHIRAN_PENDEK}` };
}

/** Memastikan judul SEO kustom (sudah memuat merek) tetap <= 60 karakter tanpa memotong kata di tengah. */
export function clampTitle(judul: string, maks = MAKS): string {
  const bersih = judul.replace(/\s+/g, " ").trim();
  if (bersih.length <= maks) return bersih;
  const ringkas = bersih.replace(/\s*\|\s*Istana Block Purwakarta$/i, AKHIRAN_PENDEK);
  if (ringkas.length <= maks) return ringkas;
  const idx = ringkas.lastIndexOf(" | ");
  if (idx > 0) {
    const depan = trimKata(ringkas.slice(0, idx), maks - (ringkas.length - idx));
    return `${depan}${ringkas.slice(idx)}`;
  }
  return trimKata(ringkas, maks);
}

/** Memastikan meta description berada dalam batas 70–160 karakter untuk cuplikan SERP penuh. */
export function clampDescription(desc: string, maks = 160): string {
  return trimKata(desc, maks);
}
