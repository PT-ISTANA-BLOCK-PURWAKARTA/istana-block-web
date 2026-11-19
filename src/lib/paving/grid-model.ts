/**
 * Model murni kanvas grid (tanpa DOM): state titik + riwayat urung, serta matematika
 * tampilan (zoom, geser, cubit dua jari). Dipakai GridCanvas dan diuji tanpa browser.
 */

import type { Point2D } from "./geometry/types";

/* ---------- State titik + riwayat ---------- */

interface Snapshot {
  points: Point2D[];
  closed: boolean;
}

export interface GridState {
  points: Point2D[];
  /** Poligon sudah ditutup (siap dihitung). */
  closed: boolean;
  /** Indeks titik terpilih (untuk hapus / geser dengan papan ketik). */
  selected: number | null;
  past: Snapshot[];
}

export const MAX_HISTORY = 100;
/** Titik minimum agar poligon boleh ditutup. */
export const MIN_POLYGON_POINTS = 3;

export type GridAction =
  | { type: "add"; pt: Point2D }
  /** Awal seret/geser titik: simpan satu riwayat untuk seluruh gerakan. */
  | { type: "moveStart" }
  | { type: "move"; index: number; pt: Point2D }
  | { type: "select"; index: number | null }
  | { type: "remove"; index: number }
  | { type: "close" }
  | { type: "undo" }
  | { type: "reset" };

export const initialGridState: GridState = { points: [], closed: false, selected: null, past: [] };

function pushPast(state: GridState): Snapshot[] {
  const snap: Snapshot = { points: state.points, closed: state.closed };
  const next = [...state.past, snap];
  return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
}

export function gridReducer(state: GridState, action: GridAction): GridState {
  switch (action.type) {
    case "add": {
      if (state.closed) return state;
      return {
        ...state,
        points: [...state.points, action.pt],
        selected: null,
        past: pushPast(state),
      };
    }
    case "moveStart":
      return { ...state, past: pushPast(state) };
    case "move": {
      if (action.index < 0 || action.index >= state.points.length) return state;
      const points = state.points.slice();
      points[action.index] = action.pt;
      return { ...state, points, selected: action.index };
    }
    case "select": {
      if (action.index !== null && (action.index < 0 || action.index >= state.points.length)) return state;
      return { ...state, selected: action.index };
    }
    case "remove": {
      if (action.index < 0 || action.index >= state.points.length) return state;
      const points = state.points.filter((_, i) => i !== action.index);
      return {
        points,
        // Kurang dari 3 titik tidak bisa jadi poligon: buka kembali.
        closed: state.closed && points.length >= MIN_POLYGON_POINTS,
        selected: null,
        past: pushPast(state),
      };
    }
    case "close": {
      if (state.closed || state.points.length < MIN_POLYGON_POINTS) return state;
      return { ...state, closed: true, selected: null, past: pushPast(state) };
    }
    case "undo": {
      if (state.past.length === 0) return state;
      const last = state.past[state.past.length - 1];
      return { points: last.points, closed: last.closed, selected: null, past: state.past.slice(0, -1) };
    }
    case "reset": {
      if (state.points.length === 0 && !state.closed) return state;
      return { points: [], closed: false, selected: null, past: pushPast(state) };
    }
    default:
      return state;
  }
}

/** Cincin tertutup (titik pertama diulang di akhir) untuk dikirim ke validasi/engine. */
export function toClosedRing(points: readonly Point2D[]): Point2D[] {
  if (points.length === 0) return [];
  return [...points.map((p): Point2D => [p[0], p[1]]), [points[0][0], points[0][1]]];
}

export function snapValue(v: number, snap: number): number {
  if (!(snap > 0)) return v;
  // Bulatkan ke 1e-9 agar 0,1 + 0,2 tidak menghasilkan ekor desimal.
  return Math.round(Math.round(v / snap) * snap * 1e9) / 1e9;
}

/** Indeks titik terdekat dalam `radius` (satuan sama dengan koordinat), atau -1. */
export function nearestPointIndex(points: readonly Point2D[], pt: Point2D, radius: number): number {
  let best = -1;
  let bestD = radius;
  for (let i = 0; i < points.length; i++) {
    const d = Math.hypot(points[i][0] - pt[0], points[i][1] - pt[1]);
    if (d <= bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/* ---------- Tampilan: zoom & geser ---------- */

/** Jendela pandang persegi: pusat (meter) dan sisi yang terlihat (meter). */
export interface GridView {
  cx: number;
  cy: number;
  span: number;
}

export const DEFAULT_VIEW: GridView = { cx: 10, cy: 10, span: 20 };
export const MIN_SPAN = 2;
export const MAX_SPAN = 400;
/** Batas koordinat titik (meter) agar angka tidak lari. */
export const COORD_LIMIT = 1000;

export type Frac = [number, number];

export function clampSpan(span: number): number {
  return Math.min(MAX_SPAN, Math.max(MIN_SPAN, span));
}

export function clampCoord(v: number): number {
  return Math.min(COORD_LIMIT, Math.max(-COORD_LIMIT, v));
}

/** Posisi pecahan kanvas (fx dari kiri, fy dari atas, 0..1) ke koordinat dunia (meter, y naik). */
export function fracToWorld(view: GridView, [fx, fy]: Frac): Point2D {
  return [view.cx + (fx - 0.5) * view.span, view.cy - (fy - 0.5) * view.span];
}

export function worldToFrac(view: GridView, [x, y]: Point2D): Frac {
  return [(x - view.cx) / view.span + 0.5, 0.5 - (y - view.cy) / view.span];
}

/** Ubah skala dengan faktor `factor` (>1 = perkecil/zoom out) dengan titik jangkar tetap di tempat. */
export function zoomAt(view: GridView, factor: number, anchor: Frac = [0.5, 0.5]): GridView {
  const span = clampSpan(view.span * factor);
  const w = fracToWorld(view, anchor);
  return {
    span,
    cx: w[0] - (anchor[0] - 0.5) * span,
    cy: w[1] + (anchor[1] - 0.5) * span,
  };
}

/** Geser isi kanvas mengikuti jari: isi bergerak (dfx, dfy) pecahan kanvas. */
export function panByFrac(view: GridView, dfx: number, dfy: number): GridView {
  return { ...view, cx: view.cx - dfx * view.span, cy: view.cy + dfy * view.span };
}

/**
 * Cubit dua jari: titik dunia di bawah titik tengah awal tetap di bawah titik tengah baru,
 * dan skala berubah sebanding rasio jarak jari.
 */
export function pinchView(start: GridView, startMid: Frac, startDist: number, mid: Frac, dist: number): GridView {
  if (!(startDist > 0) || !(dist > 0)) return start;
  const span = clampSpan(start.span * (startDist / dist));
  const w = fracToWorld(start, startMid);
  return {
    span,
    cx: w[0] - (mid[0] - 0.5) * span,
    cy: w[1] + (mid[1] - 0.5) * span,
  };
}

/** Pas-kan semua titik ke jendela dengan ruang di sekeliling; tanpa titik = tampilan awal. */
export function fitToPoints(points: readonly Point2D[], margin = 0.2, minSpan = 10): GridView {
  if (points.length === 0) return DEFAULT_VIEW;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const size = Math.max(maxX - minX, maxY - minY);
  const span = clampSpan(Math.max(minSpan, size * (1 + margin * 2)));
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, span };
}

/** Jarak antar garis grid (1-2-5 per dekade) agar sekitar 8-20 garis terlihat. */
export function gridStep(span: number): number {
  const raw = span / 12;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / pow;
  const nice = n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10;
  return nice * pow;
}

/** Nilai kelipatan `step` yang jatuh di [min, max]. */
export function gridLineValues(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  if (!(step > 0)) return out;
  const first = Math.ceil(min / step - 1e-9);
  const last = Math.floor(max / step + 1e-9);
  for (let i = first; i <= last; i++) {
    const v = Math.round(i * step * 1e9) / 1e9;
    out.push(v === 0 ? 0 : v); // hindari -0
  }
  return out;
}
