/**
 * Pola paving sebagai tekstur berulang untuk pratinjau 3D lahan besar (di atas MAX_3D_BLOCKS keping).
 * Berkas ini murni (tanpa three.js) agar ringan dan bisa diuji; menggambar satu sel lattice dari data
 * motif yang sama dengan mesin layout (unitOf), lalu UV dihitung dalam satuan sel dari koordinat meter.
 */
import { HR_CM, PAVING_CATALOG } from "../catalog";
import { TONES, mixHex, JOINT, GRASS } from "../legacy/types";
import type { ProductId } from "../legacy/types";
import { unitOf } from "../legacy/patterns";
import { grassHoleRects } from "./grass-holes";

/** Batas keping untuk menggambar per keping (InstancedMesh); di atasnya dipakai tekstur. */
export const MAX_3D_BLOCKS = 10000;
/** Lebar nat (cm) pada tekstur; sama dengan JOINT_GAP_M (6 mm) pada mode per keping. */
export const TEXTURE_JOINT_CM = 0.6;

export interface LatticeTileDraw {
  shape: "rect" | "hex";
  /** rect: sudut (x, y), ukuran (w, h); hex: pusat (x, y). Semua dalam cm, sumbu y naik. */
  x: number;
  y: number;
  w: number;
  h: number;
  role: number;
  /** Indeks nuansa warna (stabil per keping agar tekstur periodik). */
  tone: number;
}

export interface LatticeCell {
  wCm: number;
  hCm: number;
  tiles: LatticeTileDraw[];
  /** Grass Block: tiap keping digambar dengan 3 x 2 lubang rumput. */
  grass: boolean;
}

/** Sel pengulangan (satuan pola) untuk produk + motif, sama dengan yang dipakai mesin layout. */
export function latticeCell(productId: ProductId, motifId: string): LatticeCell {
  const unit = unitOf(productId, motifId);
  const hex = PAVING_CATALOG[productId].shape === "hex";
  return {
    wCm: unit.w,
    hCm: unit.h,
    grass: productId === "grass",
    tiles: unit.tiles.map((t, k) => ({
      shape: hex ? "hex" : "rect",
      x: t.x,
      y: t.y,
      w: t.w,
      h: t.h,
      role: t.r,
      tone: (k * 5 + 2) % TONES.length,
    })),
  };
}

/**
 * UV (satuan sel) dari koordinat plan (meter). Lattice diputar rotationDeg terhadap titik asal (0,0),
 * jadi koordinat lattice = R(-rotasi) · p. Satu satuan UV = satu sel penuh, sehingga ukuran keping
 * pada tekstur sama dengan ukuran aslinya.
 */
export function latticeUv(px: number, py: number, rotationDeg: number, wCm: number, hCm: number): [number, number] {
  const a = (rotationDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const qx = c * px + s * py;
  const qy = -s * px + c * py;
  return [(qx * 100) / wCm, (qy * 100) / hCm];
}

/** Gambar satu sel ke kanvas 2D. `ppmCm` = piksel per cm. Sumbu y kanvas dibalik (plan y naik). */
export function drawLatticeCell(
  ctx: CanvasRenderingContext2D,
  cell: LatticeCell,
  palette: readonly string[],
  ppmCm: number,
): void {
  const W = cell.wCm * ppmCm;
  const H = cell.hCm * ppmCm;
  const inset = TEXTURE_JOINT_CM / 2;
  ctx.fillStyle = JOINT;
  ctx.fillRect(0, 0, W, H);
  for (const t of cell.tiles) {
    const base = palette[t.role] ?? palette[0] ?? "#b5b4af";
    const tone = TONES[t.tone];
    const fill = tone < 0 ? mixHex(base, 0, -tone) : mixHex(base, 255, tone * 1.4);
    ctx.fillStyle = fill;
    // Salin di 9 sel tetangga agar keping yang melewati tepi sel tetap menyambung saat diulang.
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        const ox = di * cell.wCm;
        const oy = dj * cell.hCm;
        ctx.beginPath();
        if (t.shape === "hex") {
          const cx = t.x + ox;
          const cy = t.y + oy;
          const r = HR_CM - inset;
          for (let s = 0; s < 6; s++) {
            const ang = (Math.PI / 3) * s - Math.PI / 2;
            const px = (cx + r * Math.cos(ang)) * ppmCm;
            const py = H - (cy + r * Math.sin(ang)) * ppmCm;
            if (s === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
        } else {
          const x0 = (t.x + ox + inset) * ppmCm;
          const yTop = H - (t.y + oy + t.h - inset) * ppmCm;
          ctx.rect(x0, yTop, (t.w - 2 * inset) * ppmCm, (t.h - 2 * inset) * ppmCm);
        }
        ctx.fill();
        if (cell.grass && t.shape === "rect") {
          const tw = t.w - 2 * inset;
          const th = t.h - 2 * inset;
          const x0 = t.x + ox + inset;
          const y0 = t.y + oy + inset;
          ctx.fillStyle = GRASS;
          for (const hole of grassHoleRects(tw, th))
            ctx.fillRect((x0 + hole.x) * ppmCm, H - (y0 + hole.y + hole.h) * ppmCm, hole.w * ppmCm, hole.h * ppmCm);
          ctx.fillStyle = fill;
        }
      }
    }
  }
}
