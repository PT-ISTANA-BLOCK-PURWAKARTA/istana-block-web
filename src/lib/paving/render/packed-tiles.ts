/**
 * Format keping "terkemas" (typed array) untuk memindahkan hasil layout dari Web Worker
 * ke main thread TANPA structured clone per objek.
 *
 * Mengapa: lahan 2.000 m² menghasilkan ~88.000 keping (>600 ribu objek kecil). Menerima hasil
 * sebagai array objek membuat main thread membeku beberapa detik hanya untuk mendeserialisasi
 * (terukur 4,4 dtk pada 2.000 m²). Typed array dipindahkan lewat `transfer` (tanpa salinan) dan
 * digambar langsung dari array-nya. Bentuk objek (LayoutTile) hanya dibuat bila benar-benar
 * dibutuhkan (mis. pratinjau 3D), lewat unpackTiles.
 */

import type { LayoutResult, LayoutTile } from "../engine/types";

export interface PackedTiles {
  count: number;
  /** 0 = utuh, 1 = potongan tepi. */
  status: Uint8Array;
  role: Uint8Array;
  /** Indeks titik awal tiap keping di `coords`; panjang count + 1 (offsets[i+1] = akhir keping i). */
  offsets: Uint32Array;
  /** x,y bergantian (meter), semua keping berurutan. */
  coords: Float64Array;
  areaM2: Float64Array;
}

/** Hasil layout tanpa array objek keping; kepingnya ada di `packed`. */
export type PackedLayoutResult = Omit<LayoutResult, "tiles"> & { packed: PackedTiles };

export function packTiles(tiles: readonly LayoutTile[]): PackedTiles {
  const count = tiles.length;
  let verts = 0;
  for (let i = 0; i < count; i++) verts += tiles[i].polygon.length;

  const status = new Uint8Array(count);
  const role = new Uint8Array(count);
  const offsets = new Uint32Array(count + 1);
  const coords = new Float64Array(verts * 2);
  const areaM2 = new Float64Array(count);

  let v = 0;
  for (let i = 0; i < count; i++) {
    const t = tiles[i];
    status[i] = t.status === "partial" ? 1 : 0;
    role[i] = t.role;
    areaM2[i] = t.areaM2;
    offsets[i] = v;
    const poly = t.polygon;
    for (let j = 0; j < poly.length; j++) {
      coords[2 * v] = poly[j].x;
      coords[2 * v + 1] = poly[j].y;
      v++;
    }
  }
  offsets[count] = v;
  return { count, status, role, offsets, coords, areaM2 };
}

export function packLayout(layout: LayoutResult): PackedLayoutResult {
  const { tiles, ...rest } = layout;
  return { ...rest, packed: packTiles(tiles) };
}

/**
 * Bangun ulang objek keping. id dibuat ulang (`tile_<indeks>`); sourceTileId tidak dibawa
 * (tidak dipakai pratinjau); cutReason untuk potongan selalu "site-boundary".
 */
export function unpackTiles(p: PackedTiles): LayoutTile[] {
  const out: LayoutTile[] = new Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const start = p.offsets[i];
    const end = p.offsets[i + 1];
    const polygon = new Array<{ x: number; y: number }>(end - start);
    for (let j = start; j < end; j++) polygon[j - start] = { x: p.coords[2 * j], y: p.coords[2 * j + 1] };
    const partial = p.status[i] === 1;
    const tile: LayoutTile = {
      id: `tile_${i}`,
      sourceTileId: "",
      status: partial ? "partial" : "full",
      role: p.role[i] as 0 | 1 | 2,
      polygon,
      areaM2: p.areaM2[i],
    };
    if (partial) tile.cutReason = "site-boundary";
    out[i] = tile;
  }
  return out;
}

export function unpackLayout(r: PackedLayoutResult): LayoutResult {
  const { packed, ...rest } = r;
  return { ...rest, tiles: unpackTiles(packed) };
}

/** Buffer yang boleh dipindahkan (transfer) lewat postMessage. */
export function packedTransferables(p: PackedTiles): ArrayBuffer[] {
  return [p.status.buffer, p.role.buffer, p.offsets.buffer, p.coords.buffer, p.areaM2.buffer] as ArrayBuffer[];
}
