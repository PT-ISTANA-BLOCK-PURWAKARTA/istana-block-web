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
  const perRole: number[] = [];
  for (const t of tiles) perRole[t.role] = (perRole[t.role] ?? 0) + 1;
  return splitColorsByRoleCounts(perRole, colors, totalUnits);
}

/**
 * Varian untuk hasil layout terkemas (`PackedTiles.role`): menghitung per peran langsung dari
 * Uint8Array tanpa membuat objek keping, jadi aman di main thread pada lahan ribuan m2.
 */
export function splitColorsByPackedRoles(
  roles: ArrayLike<number>,
  colors: ReadonlyArray<ColorId>,
  totalUnits: number,
): ColorSplit[] {
  const perRole: number[] = [];
  for (let i = 0; i < roles.length; i++) perRole[roles[i]] = (perRole[roles[i]] ?? 0) + 1;
  return splitColorsByRoleCounts(perRole, colors, totalUnits);
}

/** Inti pembagian: `perRole[role]` = jumlah keping peran itu (indeks kosong dianggap nol). */
export function splitColorsByRoleCounts(
  perRole: ReadonlyArray<number | undefined>,
  colors: ReadonlyArray<ColorId>,
  totalUnits: number,
): ColorSplit[] {
  let n = 0;
  for (const c of perRole) n += c ?? 0;
  if (n === 0 || colors.length === 0) return [];

  const perColor = new Map<ColorId, number>();
  for (let role = 0; role < perRole.length; role++) {
    const count = perRole[role] ?? 0;
    if (count === 0) continue;
    const c = colors[role] ?? colors[0];
    perColor.set(c, (perColor.get(c) ?? 0) + count);
  }

  const total = Math.max(0, Math.round(totalUnits));
  return [...perColor.entries()].map(([c, count]) => ({
    c,
    share: count / n,
    pcs: Math.ceil((total * count) / n),
  }));
}
