/**
 * Rencana gambar pratinjau 2D (murni, tanpa DOM) agar lahan besar tetap ringan.
 * Keping dikelompokkan per gaya (utuh/potongan x peran warna) sehingga kanvas cukup
 * satu `fill` + satu `stroke` per kelompok, bukan satu elemen per keping.
 */

import type { PackedTiles } from "./packed-tiles";

export interface DrawGroup {
  partial: boolean;
  role: number;
  /** Indeks keping (ke array terkemas) dalam kelompok ini. */
  indices: Uint32Array;
}

/** Jumlah peran warna maksimum yang didukung (engine: 0..2). */
const MAX_ROLES = 3;

/**
 * Kelompokkan keping per (utuh/potongan, peran) tanpa membuat objek per keping.
 * Urutan hasil: keping utuh dulu (peran naik), lalu potongan, sehingga garis merah potongan
 * tidak tertimpa keping utuh. Dengan `onlyPartial` keping utuh dibuang ("Sorot Potongan Tepi").
 */
export function groupPacked(p: PackedTiles, onlyPartial = false): DrawGroup[] {
  const slots = MAX_ROLES * 2;
  const slotOf = (i: number) => Math.min(p.role[i], MAX_ROLES - 1) + (p.status[i] === 1 ? MAX_ROLES : 0);

  const counts = new Uint32Array(slots);
  for (let i = 0; i < p.count; i++) {
    const slot = slotOf(i);
    if (onlyPartial && slot < MAX_ROLES) continue;
    counts[slot]++;
  }
  const lists = Array.from(counts, (c) => new Uint32Array(c));
  const fill = new Uint32Array(slots);
  for (let i = 0; i < p.count; i++) {
    const slot = slotOf(i);
    if (onlyPartial && slot < MAX_ROLES) continue;
    lists[slot][fill[slot]++] = i;
  }

  const out: DrawGroup[] = [];
  for (let slot = 0; slot < slots; slot++) {
    if (counts[slot] === 0) continue;
    out.push({ partial: slot >= MAX_ROLES, role: slot % MAX_ROLES, indices: lists[slot] });
  }
  return out;
}

export interface SiteBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ViewFit {
  /** Piksel CSS per meter. */
  scale: number;
  /** Posisi piksel (CSS) sumbu X untuk x = 0 meter. */
  originX: number;
  /** Posisi piksel (CSS) sumbu Y untuk y = 0 meter (sumbu Y dibalik: y naik ke atas layar). */
  originY: number;
  /** Lebar tampilan dalam meter (lahan + bantalan), dasar tebal garis. */
  viewWidthM: number;
}

/** Bantalan sekeliling lahan, sama dengan tampilan SVG sebelumnya. */
export function viewPaddingM(bounds: SiteBounds): number {
  const sw = bounds.maxX - bounds.minX;
  const sh = bounds.maxY - bounds.minY;
  return Math.max(0.25, Math.max(sw, sh) * 0.05);
}

/** Pas-kan lahan + bantalan ke kanvas W x H (piksel CSS), di tengah, rasio terjaga ("meet"). */
export function fitView(bounds: SiteBounds, width: number, height: number): ViewFit {
  const pad = viewPaddingM(bounds);
  const viewW = bounds.maxX - bounds.minX + pad * 2;
  const viewH = bounds.maxY - bounds.minY + pad * 2;
  const scale = Math.max(1e-9, Math.min(width / viewW, height / viewH));
  const usedW = viewW * scale;
  const usedH = viewH * scale;
  const left = (width - usedW) / 2;
  const top = (height - usedH) / 2;
  return {
    scale,
    originX: left + (pad - bounds.minX) * scale,
    // y dibalik: y = maxY berada pada sisi atas area gambar.
    originY: top + (pad + bounds.maxY) * scale,
    viewWidthM: viewW,
  };
}

export interface StrokeWidths {
  joint: number;
  cutEdge: number;
  outline: number;
}

/** Tebal garis (meter) turun dari lebar tampilan, sama dengan rumus SVG sebelumnya. */
export function strokeWidthsM(viewWidthM: number): StrokeWidths {
  return {
    joint: Math.max(0.006, viewWidthM * 0.0011),
    cutEdge: Math.max(0.012, viewWidthM * 0.0018),
    outline: Math.max(0.018, viewWidthM * 0.0018),
  };
}

/**
 * Tebal garis nat (meter), dibatasi sebanding ukuran keping. Pada lahan besar tebal garis dari
 * lebar tampilan (0,11% x lebar) melebihi lebar keping sehingga seluruh denah memutih; batas
 * ini menyederhanakan garis nat di atas ambang keping tanpa mengubah lahan kecil.
 * Provisional: 12% dari sisi keping rata-rata.
 */
export const JOINT_MAX_FRACTION_OF_TILE = 0.12;
export function jointWidthM(baseJointM: number, avgTileAreaM2: number): number {
  if (!(avgTileAreaM2 > 0)) return baseJointM;
  return Math.min(baseJointM, JOINT_MAX_FRACTION_OF_TILE * Math.sqrt(avgTileAreaM2));
}

/** Rasio lebar:tinggi kotak tampilan, dijepit 1..2,2 seperti sebelumnya. */
export function viewAspect(bounds: SiteBounds): number {
  const pad = viewPaddingM(bounds);
  const w = bounds.maxX - bounds.minX + pad * 2;
  const h = bounds.maxY - bounds.minY + pad * 2;
  return Math.min(Math.max(w / h, 1), 2.2);
}
