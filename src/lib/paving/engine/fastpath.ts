/**
 * Jalur cepat keping utuh.
 * Menentukan tanpa clipping apakah footprint keping berada sepenuhnya di dalam lahan
 * (termasuk lahan berlubang). Uji bersifat konservatif: keping yang menyentuh/memotong
 * tepi, atau meragukan, dikembalikan sebagai "tidak yakin" sehingga tetap di-clip seperti biasa.
 */

import type { MultiPolygon2D, Point2D, Ring2D } from "../geometry/types";

interface Edge {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface SiteIndex {
  edges: Edge[];
  /** Satu titik contoh per ring (untuk mendeteksi lubang/ring yang berada di dalam keping). */
  ringProbes: Point2D[];
  rings: Ring2D[];
}

export function buildSiteIndex(geometry: MultiPolygon2D): SiteIndex {
  const edges: Edge[] = [];
  const ringProbes: Point2D[] = [];
  const rings: Ring2D[] = [];
  for (const poly of geometry) {
    for (const ring of poly) {
      if (ring.length < 3) continue;
      rings.push(ring);
      ringProbes.push(ring[0]);
      for (let i = 0; i < ring.length; i++) {
        const [ax, ay] = ring[i];
        const [bx, by] = ring[(i + 1) % ring.length];
        if (ax === bx && ay === by) continue;
        edges.push({
          ax,
          ay,
          bx,
          by,
          minX: Math.min(ax, bx),
          maxX: Math.max(ax, bx),
          minY: Math.min(ay, by),
          maxY: Math.max(ay, by),
        });
      }
    }
  }
  return { edges, ringProbes, rings };
}

/** Ray casting (even-odd). Hanya dipakai pada titik yang tidak menyentuh tepi. */
function pointInRing(x: number, y: number, ring: Ring2D): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function orient(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

/** Apakah dua segmen berpotongan atau bersentuhan (termasuk kolinear tumpang tindih). */
function segmentsTouch(
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
  e: Edge,
): boolean {
  const o1 = orient(p1x, p1y, p2x, p2y, e.ax, e.ay);
  const o2 = orient(p1x, p1y, p2x, p2y, e.bx, e.by);
  const o3 = orient(e.ax, e.ay, e.bx, e.by, p1x, p1y);
  const o4 = orient(e.ax, e.ay, e.bx, e.by, p2x, p2y);
  if (((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) && ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0))) {
    return true;
  }
  // Kasus bersentuhan / kolinear: bbox sudah tumpang tindih, jadi cukup uji nol-orientasi.
  return o1 === 0 || o2 === 0 || o3 === 0 || o4 === 0;
}

/**
 * true  = keping PASTI utuh di dalam lahan (tanpa menyentuh tepi mana pun).
 * false = tidak yakin; harus di-clip.
 */
export function isTileStrictlyInside(tile: Ring2D, site: SiteIndex): boolean {
  const n = tile.length;
  if (n < 3) return false;

  let tMinX = Infinity;
  let tMaxX = -Infinity;
  let tMinY = Infinity;
  let tMaxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const [x, y] = tile[i];
    if (x < tMinX) tMinX = x;
    if (x > tMaxX) tMaxX = x;
    if (y < tMinY) tMinY = y;
    if (y > tMaxY) tMaxY = y;
  }

  // 1) Tidak ada tepi lahan yang memotong/menyentuh tepi keping.
  const { edges } = site;
  for (let k = 0; k < edges.length; k++) {
    const e = edges[k];
    if (e.maxX < tMinX || e.minX > tMaxX || e.maxY < tMinY || e.minY > tMaxY) continue;
    for (let i = 0; i < n; i++) {
      const [ax, ay] = tile[i];
      const [bx, by] = tile[(i + 1) % n];
      if (ax === bx && ay === by) continue; // cincin tertutup: titik akhir = titik awal
      if (segmentsTouch(ax, ay, bx, by, e)) return false;
    }
  }

  // 2) Satu sudut keping harus di dalam lahan (ganjil di seluruh ring: luar - lubang).
  //    Tanpa persinggungan tepi, jika satu sudut di dalam maka seluruh keping di dalam.
  const [px, py] = tile[0];
  let crossings = 0;
  for (const ring of site.rings) if (pointInRing(px, py, ring)) crossings++;
  if (crossings % 2 === 0) return false;

  // 3) Tidak ada ring (mis. lubang) yang seluruhnya berada di dalam keping.
  for (const [rx, ry] of site.ringProbes) {
    if (rx < tMinX || rx > tMaxX || ry < tMinY || ry > tMaxY) continue;
    if (pointInRing(rx, ry, tile)) return false;
  }

  return true;
}
