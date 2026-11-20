/**
 * Lubang rumput Grass Block (3 x 2 per keping) untuk pratinjau 3D dan tekstur lahan besar.
 * Murni (tanpa three.js/DOM). Proporsi sama dengan gambar 2D PatternCalculator (grassPath):
 * lubang 20% x 30% sisi keping, jarak antar-lubang dan tepi dibagi rata.
 */

import type { Unit } from "../legacy/types";

export const GRASS_COLS = 3;
export const GRASS_ROWS = 2;
const HOLE_W_FRAC = 0.2;
const HOLE_H_FRAC = 0.3;

export interface HoleRect {
  /** Sudut kiri-bawah lubang terhadap sudut kiri-bawah keping (satuan sama dengan w, h). */
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Enam lubang rumput pada keping berukuran w x h (sisi panjang = w). */
export function grassHoleRects(w: number, h: number): HoleRect[] {
  const hw = w * HOLE_W_FRAC;
  const hh = h * HOLE_H_FRAC;
  const gx = (w - GRASS_COLS * hw) / (GRASS_COLS + 1);
  const gy = (h - GRASS_ROWS * hh) / (GRASS_ROWS + 1);
  const out: HoleRect[] = [];
  for (let r = 0; r < GRASS_ROWS; r++)
    for (let c = 0; c < GRASS_COLS; c++) out.push({ x: gx + c * (hw + gx), y: gy + r * (hh + gy), w: hw, h: hh });
  return out;
}

export interface HolePlacement {
  /** Pusat lubang pada bidang plan (meter). */
  cx: number;
  cy: number;
  /** Panjang sisi lubang searah sisi panjang keping (w) dan searah sisi pendek (h), meter. */
  w: number;
  h: number;
  /** Sudut sisi panjang keping terhadap sumbu +x plan (radian); mengikuti rotasi pola. */
  angle: number;
}

/**
 * Letak lubang rumput pada satu keping persegi panjang (cincin 4 titik, tanpa titik penutup),
 * termasuk bila pola diputar. gapM = lebar nat yang dikurangkan dari tiap sisi keping.
 * Mengembalikan [] bila cincin bukan persegi panjang 4 titik.
 */
export function grassHolePlacements(ring: ReadonlyArray<{ x: number; y: number }>, gapM = 0): HolePlacement[] {
  if (ring.length !== 4) return [];
  const [p0, p1, p2] = ring;
  let ux = p1.x - p0.x;
  let uy = p1.y - p0.y;
  let vx = p2.x - p1.x;
  let vy = p2.y - p1.y;
  if (Math.hypot(ux, uy) < Math.hypot(vx, vy)) [ux, uy, vx, vy] = [vx, vy, -ux, -uy];
  const L = Math.hypot(ux, uy);
  const W = Math.hypot(vx, vy);
  if (L <= gapM * 2 || W <= gapM * 2) return [];
  const eux = ux / L;
  const euy = uy / L;
  const evx = vx / W;
  const evy = vy / W;
  const cx = (ring[0].x + ring[1].x + ring[2].x + ring[3].x) / 4;
  const cy = (ring[0].y + ring[1].y + ring[2].y + ring[3].y) / 4;
  const w = L - gapM;
  const h = W - gapM;
  const angle = Math.atan2(euy, eux);
  return grassHoleRects(w, h).map((r) => {
    // Posisi pusat lubang relatif terhadap pusat keping, pada sumbu lokal (u: sisi panjang, v: sisi pendek).
    const lu = r.x + r.w / 2 - w / 2;
    const lv = r.y + r.h / 2 - h / 2;
    return { cx: cx + lu * eux + lv * evx, cy: cy + lu * euy + lv * evy, w: r.w, h: r.h, angle };
  });
}

type Pt = { x: number; y: number };

/** Titik di dalam poligon (even-odd). */
function pointInRing(px: number, py: number, ring: ReadonlyArray<Pt>): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (a.y > py !== b.y > py && px < ((b.x - a.x) * (py - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Empat sudut lubang pada bidang plan. */
function holeCorners(h: HolePlacement): Pt[] {
  const c = Math.cos(h.angle);
  const s = Math.sin(h.angle);
  const hw = h.w / 2;
  const hh = h.h / 2;
  return [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([u, v]) => ({ x: h.cx + u * c - v * s, y: h.cy + u * s + v * c }));
}

/** Lubang yang seluruhnya (4 sudut) berada di dalam poligon potongan; sisanya dibuang. */
export function holesInsidePolygon(holes: HolePlacement[], ring: ReadonlyArray<Pt>): HolePlacement[] {
  if (ring.length < 3) return [];
  return holes.filter((h) => holeCorners(h).every((p) => pointInRing(p.x, p.y, ring)));
}

export interface GrassLatticeCfg {
  /** Satuan ulang motif dalam cm (unitOf(...).w / .h) dan keping-kepingnya (cm). */
  unitW: number;
  unitH: number;
  tiles: ReadonlyArray<{ x: number; y: number; w: number; h: number }>;
  rotationDeg?: number;
  originM?: { x: number; y: number };
}

/**
 * Cincin keping sumber (persegi panjang utuh, 4 titik) yang memuat titik (px, py); null bila tak ada.
 * Dipakai untuk potongan tepi: poligon potongan tidak membawa keping asalnya, jadi dicari lewat
 * titik beratnya (selalu di dalam keping sumber karena potongan adalah himpunan-bagian persegi panjang).
 */
export function sourceTileRingAt(px: number, py: number, cfg: GrassLatticeCfg): Pt[] | null {
  const ox = cfg.originM?.x ?? 0;
  const oy = cfg.originM?.y ?? 0;
  const rad = ((cfg.rotationDeg ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  // Balik rotasi ke kerangka lattice.
  const dx = px - ox;
  const dy = py - oy;
  const lx = ox + dx * cos + dy * sin;
  const ly = oy - dx * sin + dy * cos;
  const uW = cfg.unitW / 100;
  const uH = cfg.unitH / 100;
  const i0 = Math.floor((lx - ox) / uW);
  const j0 = Math.floor((ly - oy) / uH);
  for (let j = j0 - 1; j <= j0 + 1; j++)
    for (let i = i0 - 1; i <= i0 + 1; i++)
      for (const t of cfg.tiles) {
        const x0 = ox + i * uW + t.x / 100;
        const y0 = oy + j * uH + t.y / 100;
        const x1 = x0 + t.w / 100;
        const y1 = y0 + t.h / 100;
        if (lx < x0 || lx > x1 || ly < y0 || ly > y1) continue;
        return [
          [x0, y0],
          [x1, y0],
          [x1, y1],
          [x0, y1],
        ].map(([x, y]) => ({ x: ox + (x - ox) * cos - (y - oy) * sin, y: oy + (x - ox) * sin + (y - oy) * cos }));
      }
  return null;
}

/** Lubang rumput untuk potongan tepi: lubang keping sumber yang jatuh utuh di dalam poligon potongan. */
export function grassHolesForCut(cutRing: ReadonlyArray<Pt>, cfg: GrassLatticeCfg, gapM = 0): HolePlacement[] {
  if (cutRing.length < 3) return [];
  let cx = 0;
  let cy = 0;
  for (const p of cutRing) {
    cx += p.x;
    cy += p.y;
  }
  const src = sourceTileRingAt(cx / cutRing.length, cy / cutRing.length, cfg);
  if (!src) return [];
  return holesInsidePolygon(grassHolePlacements(src, gapM), cutRing);
}

/** Cfg lattice dari satuan motif legacy (unitOf(productId, motifId)). */
export function latticeCfgFromUnit(unit: Unit, rotationDeg = 0, originM?: { x: number; y: number }): GrassLatticeCfg {
  return { unitW: unit.w, unitH: unit.h, tiles: unit.tiles, rotationDeg, originM };
}
