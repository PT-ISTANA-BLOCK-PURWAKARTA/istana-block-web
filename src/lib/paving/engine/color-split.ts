/**
 * Pembagian warna lahan dinamis dari peran (role) keping hasil layout.
 * Mode Fixed menghitung porsi warna dari isi satu satuan pola; pada lahan bebas jumlah keping
 * tiap peran berbeda (potongan tepi, lubang), jadi porsi harus diambil dari layout itu sendiri.
 * Modul murni: tanpa DOM.
 */

import type { ColorId } from "../legacy/types";
import type { LayoutTile } from "./types";

export interface ColorSplit {
  c: ColorId;
  /** Porsi 0..1 dari seluruh keping terpasang (utuh + potongan, masing-masing dihitung 1). */
  share: number;
  /** Jumlah keping dibeli untuk warna ini (pembulatan ke atas dari total x porsi). */
  pcs: number;
}

/**
 * @param tiles keping hasil layout (hanya `role` yang dipakai)
 * @param colors warna tiap peran: colors[role]; peran di luar daftar memakai colors[0]
 * @param totalUnits total keping rekomendasi pembelian (termasuk cadangan)
 * @returns daftar warna berurutan menurut kemunculan peran pertamanya; peran dengan warna sama digabung;
 *          kosong bila layout tidak punya keping
 */
export function splitColorsByLayoutRoles(
  tiles: ReadonlyArray<Pick<LayoutTile, "role">>,
  colors: ReadonlyArray<ColorId>,
  totalUnits: number,
): ColorSplit[] {
  if (tiles.length === 0 || colors.length === 0) return [];

  const perRole = new Map<number, number>();
  for (const t of tiles) perRole.set(t.role, (perRole.get(t.role) ?? 0) + 1);

  const perColor = new Map<ColorId, number>();
  for (const role of [...perRole.keys()].sort((a, b) => a - b)) {
    const c = colors[role] ?? colors[0];
    perColor.set(c, (perColor.get(c) ?? 0) + (perRole.get(role) ?? 0));
  }

  const n = tiles.length;
  const total = Math.max(0, Math.round(totalUnits));
  return [...perColor.entries()].map(([c, count]) => ({
    c,
    share: count / n,
    pcs: Math.ceil((total * count) / n),
  }));
}
