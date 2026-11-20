/**
 * Lubang rumput Grass Block pada pratinjau 2D kanvas (Lahan Dinamis; ikut tercetak karena kanvas).
 * Semua lubang dalam satu irisan digabung menjadi SATU path lalu di-fill sekali berwarna GRASS.
 * Lubang keping utuh selalu di dalam keping; potongan tepi hanya memuat lubang yang utuh
 * di dalam poligon potongan.
 */

import { GRASS } from "../legacy/types";
import { grassHolePlacements, grassHolesForCut, latticeCfgFromUnit, type GrassLatticeCfg, type HolePlacement } from "./grass-holes";
import { unitOf } from "../legacy/patterns";
import type { ProductId } from "../legacy/types";
import type { PackedTiles } from "./packed-tiles";

export interface GrassDrawOpts {
  cfg: GrassLatticeCfg;
  /** Lebar nat (meter) yang dikurangkan dari tiap sisi keping. */
  gapM: number;
  /** Piksel CSS per meter; lubang lebih kecil dari ~1,5 px dilewati (hemat pada lahan sangat besar). */
  scale: number;
}

const MIN_HOLE_PX = 1.5;

function ringOf(p: PackedTiles, t: number) {
  const out: { x: number; y: number }[] = [];
  for (let j = p.offsets[t]; j < p.offsets[t + 1]; j++) out.push({ x: p.coords[2 * j], y: p.coords[2 * j + 1] });
  const a = out[0];
  const b = out[out.length - 1];
  if (out.length > 1 && Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9) out.pop();
  return out;
}

function traceHole(ctx: CanvasRenderingContext2D, h: HolePlacement) {
  const c = Math.cos(h.angle);
  const s = Math.sin(h.angle);
  const hw = h.w / 2;
  const hh = h.h / 2;
  const u = [-hw, hw, hw, -hw];
  const v = [-hh, -hh, hh, hh];
  for (let k = 0; k < 4; k++) {
    const x = h.cx + u[k] * c - v[k] * s;
    const y = h.cy + u[k] * s + v[k] * c;
    if (k === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  // Tanpa closePath() (lihat catatan di Preview2D): kembali ke titik awal secara manual.
  ctx.lineTo(h.cx + u[0] * c - v[0] * s, h.cy + u[0] * s + v[0] * c);
}

/**
 * Gambar lubang rumput keping dari indeks from sampai sebelum to: satu beginPath + satu fill (GRASS).
 * Mengembalikan jumlah lubang yang digambar.
 */
export function drawGrassHoles(
  ctx: CanvasRenderingContext2D,
  p: PackedTiles,
  from: number,
  to: number,
  opts: GrassDrawOpts,
): number {
  let n = 0;
  ctx.beginPath();
  for (let t = from; t < to; t++) {
    const ring = ringOf(p, t);
    const holes =
      p.status[t] === 1 ? grassHolesForCut(ring, opts.cfg, opts.gapM) : grassHolePlacements(ring, opts.gapM);
    for (const h of holes) {
      if (Math.min(h.w, h.h) * opts.scale < MIN_HOLE_PX) continue;
      traceHole(ctx, h);
      n++;
    }
  }
  if (n > 0) {
    ctx.fillStyle = GRASS;
    ctx.fill();
  }
  return n;
}

/** Cfg lubang untuk pratinjau 2D; null untuk produk selain Grass Block (tidak ada lubang digambar). */
export function grassCfgFor(productId: ProductId | undefined, motifId: string | undefined, rotationDeg = 0) {
  return productId === "grass" && motifId ? latticeCfgFromUnit(unitOf(productId, motifId), rotationDeg) : null;
}
