/**
 * Lubang rumput Grass Block (3 x 2 per keping) untuk pratinjau 3D dan tekstur lahan besar.
 * Murni (tanpa three.js/DOM). Proporsi sama dengan gambar 2D PatternCalculator (grassPath):
 * lubang 20% x 30% sisi keping, jarak antar-lubang dan tepi dibagi rata.
 */

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
