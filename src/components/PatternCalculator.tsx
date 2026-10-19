"use client";

import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { waLink } from "@/lib/format";
import css from "./PatternCalculator.module.css";

/* =====================================================================
   Data: warna, produk, motif
   ===================================================================== */

export type ColorId = "N" | "M" | "H";
export const COLORS: Record<ColorId, { name: string; hex: string }> = {
  N: { name: "Abu Natural", hex: "#B5B4AF" },
  M: { name: "Merah", hex: "#9C4A3A" },
  H: { name: "Hitam", hex: "#2C2B29" },
};
const COLOR_IDS: ColorId[] = ["N", "M", "H"];
const DEFAULT_W: ColorId[] = ["N", "M", "H"];
const ROLE_LABEL = ["Warna dasar", "Aksen 1", "Aksen 2"];
const isColor = (v: string): v is ColorId => v === "N" || v === "M" || v === "H";

/** Warna nat (celah) dan rumput untuk pratinjau. */
const JOINT = "#6E6A63";
const GRASS = "#5E8B3B";

function mixHex(hex: string, to: number, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  return (
    "#" +
    [(n >> 16) & 255, (n >> 8) & 255, n & 255]
      .map((v) => Math.round(v + (to - v) * amt).toString(16).padStart(2, "0"))
      .join("")
  );
}
/** Variasi warna tiap blok (deterministik) agar pratinjau tampak seperti beton asli. */
const TONES = [-0.075, -0.05, -0.025, 0, 0.025, 0.05, 0.075];
const SHADES = Object.fromEntries(
  COLOR_IDS.map((c) => [c, TONES.map((t) => (t < 0 ? mixHex(COLORS[c].hex, 0, -t) : mixHex(COLORS[c].hex, 255, t * 1.4)))]),
) as Record<ColorId, string[]>;

export type ProductId = "truepave" | "hexagon" | "fp21" | "fp30" | "grass";
type Shape = "rect" | "hex" | "grass";
type Tile = { x: number; y: number; w: number; h: number; r: number };
/** Satuan pola berulang: semua blok di dalamnya diulang dengan geser (w, h). Blok boleh menjorok keluar satuan. */
export type Unit = { w: number; h: number; tiles: Tile[] };
export type Motif = {
  id: string;
  name: string;
  roles: 1 | 2 | 3;
  use: string;
  /** Cadangan bawaan (%). */
  cad: number;
  /** Rotasi pola (derajat), mis. 45 untuk pola miring. */
  rot?: number;
  /** Keterangan per peran warna. */
  hints?: string[];
  note?: string;
  build: () => Unit;
};
export type Product = {
  id: ProductId;
  name: string;
  size: string;
  pcs: number;
  tebal: number[];
  shape: Shape;
  /** Ukuran jendela pratinjau & gambar kecil (cm). */
  view: [number, number];
  thumb: [number, number];
  colors: ColorId[];
  note?: string;
  motifs: Motif[];
};

/* ---------- Geometri (cm). Ukuran modul = ukuran blok + nat, sehingga isi per m² cocok. ---------- */

const TA = 21.3; // Truepave panjang (21 cm + nat): 21,3 × 10,65 → 44 pcs/m²
const Ta = TA / 2;
/** Hexagon: lebar sisi-ke-sisi sehingga tepat 27 pcs/m². */
const HD = Math.sqrt(20000 / (27 * Math.sqrt(3)));
const HV = (HD * Math.sqrt(3)) / 2; // jarak baris
const HR = HD / Math.sqrt(3); // jari-jari sudut
const GW = 45.3;
const GH = 30.3;

const mod = (a: number, n: number) => ((a % n) + n) % n;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Daftar peran dengan jumlah pasti, diacak dengan benih tetap: hasilnya sama setiap kali dimuat. */
function shuffledRoles(counts: number[], seed: number) {
  const out: number[] = [];
  counts.forEach((n, role) => {
    for (let i = 0; i < n; i++) out.push(role);
  });
  const r = rng(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
/**
 * Ratakan sebaran campuran acak: blok aksen yang bersebelahan dengan aksen sewarna ditukar dengan
 * blok dasar yang tidak bersebelahan dengan warna itu. Jumlah tiap peran tidak berubah.
 */
function spreadRoles(roles: number[], nb: (i: number) => number[], seed: number) {
  const r = rng(seed);
  const near = (i: number, role: number, skip = -1) => nb(i).filter((j) => j !== skip && roles[j] === role).length;
  for (let pass = 0; pass < 80; pass++) {
    let moved = false;
    for (let i = 0; i < roles.length; i++) {
      const ri = roles[i];
      const here = ri === 0 ? 0 : near(i, ri);
      if (!here) continue;
      // Pindah ke blok dasar dengan tetangga sewarna paling sedikit (min-conflicts).
      let best = here;
      let cands: number[] = [];
      for (let j = 0; j < roles.length; j++) {
        if (roles[j] !== 0) continue;
        const n = near(j, ri, i);
        if (n < best) {
          best = n;
          cands = [j];
        } else if (n === best && n < here) cands.push(j);
      }
      if (!cands.length) continue;
      roles[cands[Math.floor(r() * cands.length)]] = ri;
      roles[i] = 0;
      moved = true;
    }
    if (!moved) break;
  }
  return roles;
}
/**
 * Tetangga pada kisi berselang (baris ganjil bergeser ½): berlaku untuk susun bata maupun hexagon "odd-r".
 * rows genap; kisi bersambung di tepi satuan.
 */
function staggerNeighbours(rows: number, cols: number) {
  return (i: number) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const at = (rr: number, cc: number) => mod(rr, rows) * cols + mod(cc, cols);
    const d = r % 2 === 0 ? -1 : 1;
    return [at(r, c - 1), at(r, c + 1), at(r - 1, c), at(r - 1, c + d), at(r + 1, c), at(r + 1, c + d)];
  };
}

/** Susun bata (running bond): baris mendatar, tiap baris bergeser ½ bata. */
function runningBond(rows: number, cols: number, role: (row: number, col: number, i: number) => number): Unit {
  const tiles: Tile[] = [];
  let i = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) tiles.push({ x: c * TA + (r % 2) * Ta, y: r * Ta, w: TA, h: Ta, r: role(r, c, i++) });
  return { w: cols * TA, h: rows * Ta, tiles };
}
/** Bata tegak lurus berjajar (stack bond). */
function stackBond(cols: number, role: (col: number) => number): Unit {
  const tiles: Tile[] = [];
  for (let c = 0; c < cols; c++) tiles.push({ x: c * Ta, y: 0, w: Ta, h: TA, r: role(c) });
  return { w: cols * Ta, h: TA, tiles };
}
/**
 * Tulang ikan 90°: pasangan bata mendatar + tegak berundak diagonal.
 * Lajur ke-k bergeser 4 modul; n = jumlah lajur per satuan (lajur pertama = aksen bila n > 1).
 */
function herringbone(n: number): Unit {
  const P = 4 * n;
  const tiles: Tile[] = [];
  for (let k = 0; k < n; k++)
    for (let i = 0; i < P; i++) {
      const x = mod(i + 4 * k, P) * Ta;
      const y = i * Ta;
      const role = n > 1 && k === 0 ? 1 : 0;
      tiles.push({ x, y, w: TA, h: Ta, r: role });
      tiles.push({ x, y: y + Ta, w: Ta, h: TA, r: role });
    }
  return { w: P * Ta, h: P * Ta, tiles };
}
/** Anyaman: blok 2 bata mendatar dan 2 bata tegak berselang. */
function basketweave(): Unit {
  const tiles: Tile[] = [];
  for (let by = 0; by < 2; by++)
    for (let bx = 0; bx < 2; bx++) {
      const x = bx * TA;
      const y = by * TA;
      if ((bx + by) % 2 === 0) {
        tiles.push({ x, y, w: TA, h: Ta, r: 0 }, { x, y: y + Ta, w: TA, h: Ta, r: 0 });
      } else {
        tiles.push({ x, y, w: Ta, h: TA, r: 1 }, { x: x + Ta, y, w: Ta, h: TA, r: 1 });
      }
    }
  return { w: 2 * TA, h: 2 * TA, tiles };
}
/** Ubin persegi/persegi panjang; half = baris ganjil bergeser ½ ubin. */
function grid(w: number, h: number, cols: number, rows: number, role: (col: number, row: number) => number, half = false): Unit {
  const tiles: Tile[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) tiles.push({ x: c * w + (half && r % 2 ? w / 2 : 0), y: r * h, w, h, r: role(c, r) });
  return { w: cols * w, h: rows * h, tiles };
}
/**
 * Hexagon ujung lancip di atas, baris ganjil bergeser ½ (offset "odd-r").
 * role(q, r) memakai koordinat aksial, sehingga pola kisi (titik, bunga) mudah dirumuskan.
 * rows harus genap.
 */
function hexes(cols: number, rows: number, role: (q: number, r: number, i: number) => number): Unit {
  const tiles: Tile[] = [];
  let i = 0;
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      const q = col - (row - (row & 1)) / 2;
      tiles.push({ x: (col + 0.5 + (row % 2) * 0.5) * HD, y: row * HV + HR, w: 0, h: 0, r: role(q, row, i++) });
    }
  return { w: cols * HD, h: rows * HV, tiles };
}
const HEX_NB = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, -1],
  [-1, 1],
];
/** Bunga 1 + 6 pada kisi indeks 13 (pusat-pusat bunga berjarak 4 sel). */
function flower(q: number, r: number) {
  const centre = (a: number, b: number) => mod(b + 4 * a, 13) === 0;
  if (centre(q, r)) return 2;
  return HEX_NB.some(([dq, dr]) => centre(q + dq, r + dr)) ? 1 : 0;
}

const NOTE_45 = "Pola miring 45° banyak dipotong di tepi area, jadi cadangan disarankan 10%.";

const TRUEPAVE: Motif[] = [
  { id: "bata", name: "Susun bata", roles: 1, use: "Halaman rumah, teras & jalan setapak", cad: 5, build: () => runningBond(2, 1, () => 0) },
  {
    id: "bata-list",
    name: "Susun bata + list",
    roles: 2,
    use: "Halaman & jalan setapak",
    cad: 5,
    hints: ["", "list tiap 4 baris"],
    build: () => runningBond(4, 1, (r) => (r === 0 ? 1 : 0)),
  },
  {
    id: "bata-campur",
    name: "Susun bata campur",
    roles: 3,
    use: "Halaman luas & area publik",
    cad: 5,
    hints: ["±70%", "±20%", "±10%"],
    build: () => {
      const roles = spreadRoles(shuffledRoles([67, 19, 10], 20260915), staggerNeighbours(12, 8), 7);
      return runningBond(12, 8, (_r, _c, i) => roles[i]);
    },
  },
  {
    id: "tegak",
    name: "Bata tegak + jalur",
    roles: 2,
    use: "Selasar, parkir & penanda jalur",
    cad: 5,
    hints: ["", "jalur tiap 4 bata"],
    build: () => stackBond(4, (c) => (c === 0 ? 1 : 0)),
  },
  { id: "tulang90", name: "Tulang ikan 90°", roles: 1, use: "Carport, jalan & area kendaraan", cad: 5, build: () => herringbone(1) },
  {
    id: "tulang-zigzag",
    name: "Tulang ikan zigzag",
    roles: 2,
    use: "Carport & jalan masuk",
    cad: 5,
    hints: ["", "lajur zigzag"],
    build: () => herringbone(3),
  },
  { id: "tulang45", name: "Tulang ikan 45°", roles: 1, use: "Jalan utama & kendaraan berat", cad: 10, rot: 45, note: NOTE_45, build: () => herringbone(1) },
  {
    id: "anyaman",
    name: "Anyaman",
    roles: 2,
    use: "Teras, taman & plaza",
    cad: 5,
    hints: ["pasangan mendatar", "pasangan tegak"],
    build: basketweave,
  },
];

const HEX_NOTE = "Hexagon perlu dipotong di sisi tepi area, jadi cadangan disarankan 10%.";
const HEXAGON: Motif[] = [
  { id: "polos", name: "Polos", roles: 1, use: "Taman, halaman & area publik", cad: 10, build: () => hexes(1, 2, () => 0) },
  {
    id: "garis",
    name: "Garis",
    roles: 2,
    use: "Halaman & jalan setapak",
    cad: 10,
    hints: ["", "garis tiap 4 baris"],
    build: () => hexes(1, 4, (_q, r) => (r % 4 === 0 ? 1 : 0)),
  },
  {
    id: "titik",
    name: "Titik",
    roles: 2,
    use: "Halaman & teras",
    cad: 10,
    hints: ["", "titik"],
    build: () => hexes(7, 14, (q, r) => (mod(r + 3 * q, 7) === 0 ? 1 : 0)),
  },
  {
    id: "bunga",
    name: "Bunga (1 + 6)",
    roles: 3,
    use: "Taman, plaza & area bermain",
    cad: 10,
    hints: ["", "kelopak", "tengah bunga"],
    build: () => hexes(13, 26, flower),
  },
  {
    id: "acak",
    name: "Campur acak",
    roles: 2,
    use: "Halaman & area publik",
    cad: 10,
    hints: ["±75%", "±25%"],
    build: () => {
      const roles = spreadRoles(shuffledRoles([108, 36], 1402), staggerNeighbours(12, 12), 3);
      return hexes(12, 12, (_q, _r, i) => roles[i]);
    },
  },
  {
    id: "acak3",
    name: "Campur tiga warna",
    roles: 3,
    use: "Taman & area publik",
    cad: 10,
    hints: ["±60%", "±25%", "±15%"],
    build: () => {
      const roles = spreadRoles(shuffledRoles([86, 36, 22], 2026), staggerNeighbours(12, 12), 33);
      return hexes(12, 12, (_q, _r, i) => roles[i]);
    },
  },
];

function fullpave(S: number): Motif[] {
  return [
    { id: "lurus", name: "Susun lurus", roles: 1, use: "Teras, selasar & kafe", cad: 5, build: () => grid(S, S, 1, 1, () => 0) },
    { id: "setengah", name: "Susun setengah", roles: 1, use: "Halaman & jalan setapak", cad: 5, build: () => grid(S, S, 1, 2, () => 0, true) },
    {
      id: "catur",
      name: "Papan catur",
      roles: 2,
      use: "Teras, kafe & area duduk",
      cad: 5,
      hints: ["kotak A", "kotak B"],
      build: () => grid(S, S, 2, 2, (c, r) => (c + r) % 2),
    },
    {
      id: "bingkai",
      name: "Bingkai",
      roles: 2,
      use: "Halaman luas & plaza",
      cad: 5,
      hints: ["isi", "bingkai"],
      build: () => grid(S, S, 4, 4, (c, r) => (c === 0 || r === 0 ? 1 : 0)),
    },
    {
      id: "bingkai-titik",
      name: "Bingkai + titik tengah",
      roles: 3,
      use: "Plaza & halaman luas",
      cad: 5,
      hints: ["isi", "bingkai", "titik tengah"],
      build: () => grid(S, S, 4, 4, (c, r) => (c === 0 || r === 0 ? 1 : c === 2 && r === 2 ? 2 : 0)),
    },
    { id: "diagonal", name: "Diagonal 45°", roles: 1, use: "Plaza & area dekoratif", cad: 10, rot: 45, note: NOTE_45, build: () => grid(S, S, 1, 1, () => 0) },
    {
      id: "diagonal-catur",
      name: "Diagonal catur",
      roles: 2,
      use: "Teras & area dekoratif",
      cad: 10,
      rot: 45,
      note: NOTE_45,
      hints: ["kotak A", "kotak B"],
      build: () => grid(S, S, 2, 2, (c, r) => (c + r) % 2),
    },
  ];
}

const GRASSBLOCK: Motif[] = [
  { id: "sejajar", name: "Susun sejajar", roles: 1, use: "Carport, parkir & area resapan", cad: 5, build: () => grid(GW, GH, 1, 1, () => 0) },
  { id: "selang", name: "Selang-seling", roles: 1, use: "Area parkir & taman", cad: 5, build: () => grid(GW, GH, 1, 2, () => 0, true) },
];

export const PRODUCTS: Record<ProductId, Product> = {
  truepave: {
    id: "truepave",
    name: "Truepave / Bata",
    size: "21 × 10,5 cm",
    pcs: 44,
    tebal: [6, 8],
    shape: "rect",
    view: [240, 150],
    thumb: [120, 80],
    colors: COLOR_IDS,
    motifs: TRUEPAVE,
  },
  hexagon: {
    id: "hexagon",
    name: "Hexagon",
    size: "20 × 20 cm",
    pcs: 27,
    tebal: [6, 8],
    shape: "hex",
    view: [240, 150],
    thumb: [150, 100],
    colors: COLOR_IDS,
    note: HEX_NOTE,
    motifs: HEXAGON,
  },
  fp21: {
    id: "fp21",
    name: "Fullpave / Ubin 21",
    size: "21 × 21 cm",
    pcs: 22,
    tebal: [6],
    shape: "rect",
    view: [240, 150],
    thumb: [180, 120],
    colors: COLOR_IDS,
    motifs: fullpave(21.3),
  },
  fp30: {
    id: "fp30",
    name: "Fullpave 30",
    size: "30 × 30 cm",
    pcs: 11,
    tebal: [6],
    shape: "rect",
    view: [360, 225],
    thumb: [240, 160],
    colors: COLOR_IDS,
    motifs: fullpave(30.15),
  },
  grass: {
    id: "grass",
    name: "Grass Block",
    size: "45 × 30 cm",
    pcs: 7.5,
    tebal: [6, 8],
    shape: "grass",
    view: [360, 225],
    thumb: [240, 160],
    colors: ["N"],
    note: "Grass Block hanya tersedia warna Abu Natural.",
    motifs: GRASSBLOCK,
  },
};
const PRODUCT_LIST = Object.values(PRODUCTS);
const isProduct = (v: string | undefined): v is ProductId => !!v && v in PRODUCTS;

export function motifOf(p: ProductId, id: string): Motif {
  const list = PRODUCTS[p].motifs;
  return list.find((m) => m.id === id) ?? list[0];
}

const UNITS = new Map<string, Unit>();
export function unitOf(p: ProductId, motifId: string): Unit {
  const m = motifOf(p, motifId);
  const key = `${p}.${m.id}`;
  let u = UNITS.get(key);
  if (!u) {
    u = m.build();
    UNITS.set(key, u);
  }
  return u;
}

/** Jumlah blok per peran dalam satu satuan pola berulang. */
export function roleCounts(u: Unit) {
  const c = [0, 0, 0];
  for (const t of u.tiles) c[t.r]++;
  return c;
}

/* =====================================================================
   Tata letak pratinjau
   ===================================================================== */

export type Placed = Tile & { t: number };

function tileBox(shape: Shape, t: Tile): [number, number, number, number] {
  return shape === "hex" ? [t.x - HD / 2, t.y - HR, t.x + HD / 2, t.y + HR] : [t.x, t.y, t.x + t.w, t.y + t.h];
}
function toneOf(i: number, j: number, k: number) {
  let h = Math.imul(i + 101, 73856093) ^ Math.imul(j + 211, 19349663) ^ Math.imul(k + 1, 83492791);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) % TONES.length;
}

/** Transformasi SVG: titik tengah satuan pola diletakkan di tengah jendela, lalu diputar bila perlu. */
export function patternTransform(u: Unit, W: number, H: number, rot = 0) {
  return `translate(${r2(W / 2)} ${r2(H / 2)})${rot ? ` rotate(${rot})` : ""} translate(${r2(-u.w / 2)} ${r2(-u.h / 2)})`;
}

/**
 * Blok yang terlihat dalam jendela W × H (cm), memakai transformasi yang sama dengan patternTransform.
 * Koordinat yang dikembalikan masih koordinat pola (sebelum digeser/diputar).
 */
export function layoutTiles(u: Unit, shape: Shape, W: number, H: number, rot = 0): Placed[] {
  const rad = (rot * Math.PI) / 180;
  const cs = Math.cos(rad);
  const sn = Math.sin(rad);
  const cx = W / 2;
  const cy = H / 2;
  const ux = u.w / 2;
  const uy = u.h / 2;
  const toLocal = (x: number, y: number) => [(x - cx) * cs + (y - cy) * sn + ux, -(x - cx) * sn + (y - cy) * cs + uy];
  const corners = [toLocal(0, 0), toLocal(W, 0), toLocal(0, H), toLocal(W, H)];
  const minX = Math.min(...corners.map((c) => c[0]));
  const maxX = Math.max(...corners.map((c) => c[0]));
  const minY = Math.min(...corners.map((c) => c[1]));
  const maxY = Math.max(...corners.map((c) => c[1]));
  let tx0 = Infinity;
  let ty0 = Infinity;
  let tx1 = -Infinity;
  let ty1 = -Infinity;
  const boxes = u.tiles.map((t) => tileBox(shape, t));
  for (const b of boxes) {
    tx0 = Math.min(tx0, b[0]);
    ty0 = Math.min(ty0, b[1]);
    tx1 = Math.max(tx1, b[2]);
    ty1 = Math.max(ty1, b[3]);
  }
  const i0 = Math.floor((minX - tx1) / u.w);
  const i1 = Math.ceil((maxX - tx0) / u.w);
  const j0 = Math.floor((minY - ty1) / u.h);
  const j1 = Math.ceil((maxY - ty0) / u.h);
  const out: Placed[] = [];
  const e = 0.05;
  for (let j = j0; j <= j1; j++)
    for (let i = i0; i <= i1; i++) {
      const dx = i * u.w;
      const dy = j * u.h;
      for (let k = 0; k < u.tiles.length; k++) {
        const b = boxes[k];
        let x0 = b[0] + dx - ux;
        let y0 = b[1] + dy - uy;
        let x1 = b[2] + dx - ux;
        let y1 = b[3] + dy - uy;
        if (rot) {
          const pts = [
            [x0, y0],
            [x1, y0],
            [x0, y1],
            [x1, y1],
          ].map(([x, y]) => [x * cs - y * sn, x * sn + y * cs]);
          x0 = Math.min(...pts.map((p) => p[0]));
          x1 = Math.max(...pts.map((p) => p[0]));
          y0 = Math.min(...pts.map((p) => p[1]));
          y1 = Math.max(...pts.map((p) => p[1]));
        }
        x0 += cx;
        x1 += cx;
        y0 += cy;
        y1 += cy;
        if (x1 <= e || y1 <= e || x0 >= W - e || y0 >= H - e) continue;
        const t = u.tiles[k];
        out.push({ x: t.x + dx, y: t.y + dy, w: t.w, h: t.h, r: t.r, t: toneOf(i, j, k) });
      }
    }
  return out;
}

const NAT = 0.6; // lebar nat yang digambar (cm)
const r2 = (n: number) => Math.round(n * 100) / 100;
const HEX_PTS = (() => {
  const rr = (HD - NAT - 1) / Math.sqrt(3); // sisa 1 cm dibulatkan oleh stroke sewarna
  return Array.from({ length: 6 }, (_, k) => {
    const a = (Math.PI / 3) * k - Math.PI / 2;
    return [rr * Math.cos(a), rr * Math.sin(a)];
  });
})();
function hexPath(x: number, y: number) {
  return "M" + HEX_PTS.map(([dx, dy]) => `${r2(x + dx)} ${r2(y + dy)}`).join("L") + "Z";
}
/** Persegi panjang (opsional bersudut bulat) sebagai sub-path, agar banyak blok bisa digabung dalam satu <path>. */
function rectPath(t: Tile, round: boolean) {
  const x = t.x + NAT / 2;
  const y = t.y + NAT / 2;
  const w = t.w - NAT;
  const h = t.h - NAT;
  if (!round) return `M${r2(x)} ${r2(y)}h${r2(w)}v${r2(h)}h${r2(-w)}Z`;
  const k = 0.9;
  return `M${r2(x + k)} ${r2(y)}h${r2(w - 2 * k)}a${k} ${k} 0 0 1 ${k} ${k}v${r2(h - 2 * k)}a${k} ${k} 0 0 1 -${k} ${k}h${r2(-(w - 2 * k))}a${k} ${k} 0 0 1 -${k} -${k}v${r2(-(h - 2 * k))}a${k} ${k} 0 0 1 ${k} -${k}Z`;
}
/** Grass block: kotak beton dengan 3 × 2 lubang rumput (fill-rule evenodd). */
function grassPath(t: Tile) {
  const x = t.x + NAT / 2;
  const y = t.y + NAT / 2;
  const w = t.w - NAT;
  const h = t.h - NAT;
  let d = `M${r2(x)} ${r2(y)}h${r2(w)}v${r2(h)}h${r2(-w)}Z`;
  const hw = w * 0.2;
  const hh = h * 0.3;
  const gx = (w - 3 * hw) / 4;
  const gy = (h - 2 * hh) / 3;
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 3; c++) d += `M${r2(x + gx + c * (hw + gx))} ${r2(y + gy + r * (hh + gy))}h${r2(hw)}v${r2(hh)}h${r2(-hw)}Z`;
  return d;
}

type ArtProps = { jenis: ProductId; motif: string; colorKey: string; w: number; h: number; label?: string; rich?: boolean };

/** Gambar pola tampak atas dengan skala sebenarnya (1 satuan SVG = 1 cm). */
const PatternArt = memo(function PatternArt({ jenis, motif, colorKey, w, h, label, rich }: ArtProps) {
  const uid = "pp" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const P = PRODUCTS[jenis];
  const m = motifOf(jenis, motif);
  const unit = unitOf(jenis, m.id);
  const tiles = useMemo(() => layoutTiles(unit, P.shape, w, h, m.rot ?? 0), [unit, m.rot, P.shape, w, h]);
  // Satu <path> per warna+nuansa (maks. 21 elemen) agar DOM tetap ringan walau ratusan blok.
  const groups = useMemo(() => {
    const cols = colorKey.split("").filter(isColor);
    const map = new Map<string, string[]>();
    for (const t of tiles) {
      const fill = SHADES[cols[t.r] ?? cols[0] ?? "N"][t.t];
      const d = P.shape === "hex" ? hexPath(t.x, t.y) : P.shape === "grass" ? grassPath(t) : rectPath(t, !!rich);
      const list = map.get(fill);
      if (list) list.push(d);
      else map.set(fill, [d]);
    }
    return [...map.entries()].map(([fill, ds]) => [fill, ds.join("")] as const);
  }, [tiles, colorKey, P.shape, rich]);
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid slice"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {rich && (
        <defs>
          <linearGradient id={`${uid}l`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity=".16" />
            <stop offset=".5" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity=".16" />
          </linearGradient>
          <filter id={`${uid}g`} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="7" stitchTiles="stitch" />
            <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.5 -0.6" />
          </filter>
        </defs>
      )}
      <rect width={w} height={h} fill={P.shape === "grass" ? GRASS : JOINT} />
      <g transform={patternTransform(unit, w, h, m.rot)}>
        {groups.map(([fill, d]) =>
          P.shape === "hex" ? (
            <path key={fill} d={d} fill={fill} stroke={fill} strokeWidth="1" strokeLinejoin="round" />
          ) : (
            <path key={fill} d={d} fill={fill} fillRule={P.shape === "grass" ? "evenodd" : undefined} />
          ),
        )}
      </g>
      {rich && (
        <>
          <rect width={w} height={h} fill={`url(#${uid}l)`} />
          <rect width={w} height={h} filter={`url(#${uid}g)`} opacity=".3" />
        </>
      )}
    </svg>
  );
});

/* =====================================================================
   Angka & hitungan
   ===================================================================== */

/** Format Indonesia: 1.234,5 (tanpa bergantung pada Intl agar server & peramban selalu sama). */
export function fmt(n: number, dec = 2) {
  if (!Number.isFinite(n)) return "–";
  const [i, d = ""] = Math.abs(n).toFixed(dec).split(".");
  const frac = d.replace(/0+$/, "");
  return (n < 0 ? "-" : "") + i.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + (frac ? "," + frac : "");
}
export const fmtPct = (share: number) => `${fmt(share * 100, 1)}%`;

/** Terima "12,5", "12.5", atau "1.234,5". Kosong/tidak valid → NaN. */
export function parseNum(s: string) {
  let t = (s ?? "").trim().replace(/\s/g, "");
  if (!t) return NaN;
  if (t.includes(",") && t.includes(".")) t = t.replace(/\./g, "").replace(",", ".");
  else t = t.replace(",", ".");
  if (!/^\d*\.?\d+$|^\d+\.$/.test(t)) return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}
/** Pembulatan ke atas yang kebal galat floating point: 0,5 × 10 m × 44 × 1,10 = 242,00000000000003 harus 242, bukan 243. */
export const ceilSafe = (x: number) => Math.ceil(Math.round(x * 1e6) / 1e6);

export type CalcState = {
  jenis: ProductId;
  motif: string;
  /** Warna untuk peran dasar, aksen 1, aksen 2. */
  warna: ColorId[];
  tebal: number;
  mode: "pl" | "luas";
  p: string;
  l: string;
  luas: string;
  cad: number;
  k: boolean;
  ks: 40 | 60;
  kp: string;
  abu: boolean;
  bc: boolean;
  manual: boolean;
  persen: Partial<Record<ColorId, string>>;
};
type Query = Record<string, string | string[] | undefined>;

export const CAD_OPTIONS = [0, 3, 5, 10];
export const URL_KEYS = ["jenis", "motif", "warna", "tebal", "mode", "p", "l", "luas", "cad", "kanstin", "kp", "abu", "bc", "persen"];

const cleanNum = (v: string | undefined) => (v ?? "").replace(/[^0-9.,]/g, "").slice(0, 12).replace(".", ",");

export function decodeState(q: Query): CalcState {
  const get = (k: string) => {
    const v = q[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const jenisQ = get("jenis");
  const jenis: ProductId = isProduct(jenisQ) ? jenisQ : "truepave";
  const P = PRODUCTS[jenis];
  const m = motifOf(jenis, get("motif") ?? "");
  const wq = (get("warna") ?? "").toUpperCase();
  const warna = DEFAULT_W.map((d, i) => (isColor(wq[i] ?? "") ? (wq[i] as ColorId) : d));
  const tebal = Number(get("tebal"));
  const cad = Number(get("cad"));
  const kq = get("kanstin");
  const persen: Partial<Record<ColorId, string>> = {};
  for (const part of (get("persen") ?? "").split("_")) {
    const c = part.charAt(0).toUpperCase();
    const v = parseNum(part.slice(1));
    if (isColor(c) && v >= 0 && v <= 100) persen[c] = fmt(v, 1);
  }
  return {
    jenis,
    motif: m.id,
    warna,
    tebal: P.tebal.includes(tebal) ? tebal : P.tebal[0],
    mode: get("mode") === "luas" ? "luas" : "pl",
    p: cleanNum(get("p")),
    l: cleanNum(get("l")),
    luas: cleanNum(get("luas")),
    cad: get("cad") != null && CAD_OPTIONS.includes(cad) ? cad : m.cad,
    k: kq !== "0",
    ks: kq === "60" ? 60 : 40,
    kp: cleanNum(get("kp")),
    abu: get("abu") !== "0",
    bc: get("bc") === "1",
    manual: Object.keys(persen).length > 0,
    persen,
  };
}

const urlNum = (v: string) => {
  const n = parseNum(v);
  return Number.isFinite(n) ? String(n) : "";
};
/** Pilihan → query string pendek & terbaca, mis. ?jenis=truepave&motif=tulang90&warna=NM&p=10&l=5 */
export function encodeState(st: CalcState) {
  const P = PRODUCTS[st.jenis];
  const m = motifOf(st.jenis, st.motif);
  const q = new URLSearchParams();
  q.set("jenis", st.jenis);
  q.set("motif", m.id);
  if (P.colors.length > 1) q.set("warna", effectiveColors(st).join(""));
  if (st.tebal !== P.tebal[0]) q.set("tebal", String(st.tebal));
  if (st.mode === "luas") {
    q.set("mode", "luas");
    if (urlNum(st.luas)) q.set("luas", urlNum(st.luas));
  } else {
    if (urlNum(st.p)) q.set("p", urlNum(st.p));
    if (urlNum(st.l)) q.set("l", urlNum(st.l));
  }
  if (st.cad !== m.cad) q.set("cad", String(st.cad));
  if (!st.k) q.set("kanstin", "0");
  else {
    if (st.ks === 60) q.set("kanstin", "60");
    if (urlNum(st.kp)) q.set("kp", urlNum(st.kp));
  }
  if (!st.abu) q.set("abu", "0");
  if (st.bc) q.set("bc", "1");
  if (st.manual) {
    const parts = autoShares(st)
      .slice(1)
      .map((x) => (urlNum(st.persen[x.c] ?? "") ? x.c + urlNum(st.persen[x.c] ?? "") : ""))
      .filter(Boolean);
    if (parts.length) q.set("persen", parts.join("_"));
  }
  return q;
}

export function effectiveColors(st: CalcState): ColorId[] {
  const P = PRODUCTS[st.jenis];
  const m = motifOf(st.jenis, st.motif);
  return Array.from({ length: m.roles }, (_, i) => (P.colors.includes(st.warna[i]) ? st.warna[i] : P.colors[0]));
}

export type Share = { c: ColorId; share: number };
/** Bagian tiap warna dihitung dari isi satu satuan pola; peran dengan warna sama digabung. */
export function autoShares(st: CalcState): Share[] {
  const counts = roleCounts(unitOf(st.jenis, st.motif));
  const colors = effectiveColors(st);
  const total = counts.reduce((a, b) => a + b, 0);
  const out: Share[] = [];
  colors.forEach((c, role) => {
    const s = counts[role] / total;
    const hit = out.find((x) => x.c === c);
    if (hit) hit.share += s;
    else out.push({ c, share: s });
  });
  return out.filter((x) => x.share > 0);
}

export function compute(st: CalcState) {
  const P = PRODUCTS[st.jenis];
  const m = motifOf(st.jenis, st.motif);
  const auto = autoShares(st);
  let shares = auto;
  let manualErr = "";
  if (st.manual && auto.length > 1) {
    const acc = auto.slice(1).map((x) => {
      const raw = st.persen[x.c];
      return { c: x.c, v: raw == null || raw.trim() === "" ? x.share * 100 : parseNum(raw) };
    });
    const sum = acc.reduce((a, b) => a + b.v, 0);
    if (acc.some((x) => !Number.isFinite(x.v) || x.v < 0 || x.v > 100)) manualErr = "Isi persentase dengan angka 0–100.";
    else if (sum > 100 + 1e-9) manualErr = `Jumlah persentase aksen ${fmt(sum, 1)}%, melebihi 100%.`;
    else shares = [{ c: auto[0].c, share: (100 - sum) / 100 }, ...acc.map((x) => ({ c: x.c, share: x.v / 100 }))];
  }
  const pj = parseNum(st.p);
  const lb = parseNum(st.l);
  const ls = parseNum(st.luas);
  const area = st.mode === "pl" ? (pj > 0 && lb > 0 ? pj * lb : 0) : ls > 0 ? ls : 0;
  const keliling = st.mode === "pl" && pj > 0 && lb > 0 ? 2 * (pj + lb) : 0;
  const exact = area * P.pcs * (1 + st.cad / 100);
  const total = ceilSafe(exact);
  const per = shares.map((x) => ({ ...x, pcs: ceilSafe(exact * x.share) }));
  const sumPer = per.reduce((a, b) => a + b.pcs, 0);
  const kpN = parseNum(st.kp);
  const kAuto = !(kpN > 0);
  const kLen = st.k ? (kAuto ? keliling : kpN) : 0;
  const kPcs = kLen > 0 ? ceilSafe((kLen * 100) / st.ks) : 0;
  return {
    P,
    m,
    auto,
    shares,
    manualErr,
    pj,
    lb,
    area,
    keliling,
    exact,
    total,
    per,
    sumPer,
    kanstin: { on: st.k, size: st.ks, len: kLen, auto: kAuto, pcs: kPcs },
    abuM3: st.abu ? area * 0.05 : 0,
    bcM3: st.bc ? area * 0.2 : 0,
  };
}
export type Result = ReturnType<typeof compute>;

/** Baris rincian yang sama untuk WhatsApp, salinan, dan cetak. */
export function detailLines(st: CalcState, r: Result): string[] {
  const { P, m } = r;
  const has = r.area > 0;
  const lines = [`• Produk: ${P.name} ${P.size}, tebal ${st.tebal} cm`, `• Motif: ${m.name}`, `• Warna${st.manual && !r.manualErr && r.shares.length > 1 ? " (persentase manual)" : ""}:`];
  for (const x of r.per) lines.push(`   – ${COLORS[x.c].name} (${fmtPct(x.share)})${has ? `: ${fmt(x.pcs)} pcs` : ""}`);
  if (!has) lines.push("• Ukuran area: belum diisi");
  else if (st.mode === "pl") lines.push(`• Ukuran area: ${fmt(r.pj)} × ${fmt(r.lb)} m = ${fmt(r.area)} m²`);
  else lines.push(`• Luas area: ${fmt(r.area)} m²`);
  lines.push(`• Cadangan: ${st.cad}%`);
  if (has) lines.push(`• Total paving: ${fmt(r.total)} pcs (${fmt(P.pcs)} pcs/m²)`);
  if (st.k) {
    if (r.kanstin.len > 0)
      lines.push(`• Kanstin ${st.ks} cm: ${fmt(r.kanstin.pcs)} pcs (${r.kanstin.auto ? "keliling " : "panjang "}${fmt(r.kanstin.len)} m)`);
    else lines.push(`• Kanstin ${st.ks} cm: panjang belum diisi`);
  }
  if (st.abu) lines.push(`• Abu batu 5 cm: ${has ? `${fmt(r.abuM3)} m³` : "menyesuaikan luas"}`);
  if (st.bc) lines.push(`• Base course 20 cm: ${has ? `${fmt(r.bcM3)} m³` : "menyesuaikan luas"}`);
  return lines;
}
export function waMessage(lines: string[], link: string) {
  return [
    "Halo Istana Block, saya mau minta penawaran paving sesuai hasil Kalkulator Pola Paving:",
    "",
    ...lines,
    "",
    "Lokasi kirim: ...",
    ...(link ? ["", `Lihat pola: ${link}`] : []),
  ].join("\n");
}
export function copyMessage(lines: string[], link: string) {
  return ["Rincian Kalkulator Pola Paving – Istana Block Purwakarta", "", ...lines, ...(link ? ["", `Tautan: ${link}`] : [])].join("\n");
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* coba cara lama */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/* =====================================================================
   Komponen
   ===================================================================== */

/*
 * Cetak: aturan ada di PatternCalculator.module.css (@media print). Elemen bertanda data-pp-noprint
 * (juga di halaman: breadcrumb, judul, FAQ) disembunyikan, sehingga yang tercetak hanya pratinjau + hasil.
 */

function StepHead({ n, id, title, sub }: { n: number; id: string; title: string; sub?: ReactNode }) {
  return (
    <div className={css.head}>
      <span className={`${css.no} hex`} aria-hidden="true">
        {n}
      </span>
      <div>
        <h2 id={id}>
          <span className="sr-only">Langkah {n}: </span>
          {title}
        </h2>
        {sub && <p className={css.sub}>{sub}</p>}
      </div>
    </div>
  );
}

function Seg<T extends string | number>({
  name,
  legend,
  value,
  options,
  onChange,
  help,
}: {
  name: string;
  legend: string;
  value: T;
  options: { v: T; label: string; note?: string }[];
  onChange: (v: T) => void;
  help?: ReactNode;
}) {
  return (
    <fieldset className={css.fs} aria-describedby={help ? `${name}-help` : undefined}>
      <legend className={css.legend}>{legend}</legend>
      <div className={css.seg}>
        {options.map((o) => (
          <label key={String(o.v)} className={css.pill}>
            <input type="radio" name={name} value={String(o.v)} checked={value === o.v} onChange={() => onChange(o.v)} />
            <span>
              {o.label}
              {o.note && <small>{o.note}</small>}
            </span>
          </label>
        ))}
      </div>
      {help && (
        <p id={`${name}-help`} className={css.help}>
          {help}
        </p>
      )}
    </fieldset>
  );
}

function NumField({
  id,
  label,
  unit,
  value,
  onChange,
  placeholder,
  help,
}: {
  id: string;
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  help?: string;
}) {
  const bad = value.trim() !== "" && !(parseNum(value) >= 0);
  const desc = bad ? `${id}-err` : help ? `${id}-help` : undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className={css.inputWrap}>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value.slice(0, 12))}
          aria-invalid={bad || undefined}
          aria-describedby={desc}
          style={{ paddingRight: 52 }}
        />
        <span className={css.unit} aria-hidden="true">
          {unit}
        </span>
      </div>
      {bad ? (
        <p id={`${id}-err`} className={css.err}>
          Isi dengan angka, mis. 12,5
        </p>
      ) : help ? (
        <p id={`${id}-help`} className="help">
          {help}
        </p>
      ) : null}
    </div>
  );
}

function Swatch({ c }: { c: ColorId }) {
  return <i className={`${css.sw} hex`} style={{ background: COLORS[c].hex }} aria-hidden="true" />;
}

export function PatternCalculator({ whatsapp, initialQuery }: { whatsapp: string; initialQuery?: Query }) {
  const [st, setSt] = useState<CalcState>(() => decodeState(initialQuery ?? {}));
  const [shareUrl, setShareUrl] = useState("");
  const [status, setStatus] = useState("");
  const [fallback, setFallback] = useState("");
  const touched = useRef(false);

  // Tanpa initialQuery dari server: pulihkan pilihan dari URL setelah dimuat.
  useEffect(() => {
    if (initialQuery) return;
    const q: Query = {};
    new URLSearchParams(window.location.search).forEach((v, k) => {
      q[k] = v;
    });
    if (URL_KEYS.some((k) => k in q)) setSt(decodeState(q));
  }, [initialQuery]);

  // Simpan pilihan ke query URL (tautan bisa dibagikan). Ditunda sedikit karena Safari membatasi replaceState.
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        const enc = encodeState(st);
        const share = new URL(window.location.pathname, window.location.origin);
        enc.forEach((v, k) => share.searchParams.set(k, v));
        setShareUrl(share.toString());
        if (!touched.current) return;
        const url = new URL(window.location.href);
        URL_KEYS.forEach((k) => url.searchParams.delete(k));
        enc.forEach((v, k) => url.searchParams.set(k, v));
        const next = url.pathname + url.search + url.hash;
        if (next !== window.location.pathname + window.location.search + window.location.hash) {
          window.history.replaceState(window.history.state, "", next);
        }
      } catch {
        /* abaikan: URL tetap seperti semula */
      }
    }, 300);
    return () => window.clearTimeout(id);
  }, [st]);

  useEffect(() => {
    if (!status) return;
    const id = window.setTimeout(() => setStatus(""), 5000);
    return () => window.clearTimeout(id);
  }, [status]);

  const update = useCallback((fn: (s: CalcState) => CalcState) => {
    touched.current = true;
    setSt(fn);
  }, []);
  const patch = useCallback((p: Partial<CalcState>) => update((s) => ({ ...s, ...p })), [update]);

  const chooseJenis = (id: ProductId) =>
    update((s) => {
      const P = PRODUCTS[id];
      const m = motifOf(id, s.motif);
      return { ...s, jenis: id, motif: m.id, tebal: P.tebal.includes(s.tebal) ? s.tebal : P.tebal[0], cad: m.cad, manual: false, persen: {} };
    });
  const chooseMotif = (id: string) =>
    update((s) => {
      const m = motifOf(s.jenis, id);
      // Motif dengan lebih banyak peran: pastikan aksen berbeda dari warna sebelumnya agar motif terlihat.
      const warna = [...s.warna];
      for (let i = 1; i < m.roles; i++) {
        if (warna.slice(0, i).includes(warna[i])) warna[i] = COLOR_IDS.find((c) => !warna.slice(0, i).includes(c)) ?? warna[i];
      }
      return { ...s, motif: m.id, warna, cad: m.cad, manual: false, persen: {} };
    });
  /** Warna yang sudah dipakai peran lain ditukar, sehingga tiap peran tetap berbeda. */
  const chooseColor = (role: number, c: ColorId) =>
    update((s) => {
      const roles = motifOf(s.jenis, s.motif).roles;
      const warna = [...s.warna];
      const other = warna.findIndex((x, i) => i !== role && i < roles && x === c);
      if (other >= 0) warna[other] = warna[role];
      warna[role] = c;
      return { ...s, warna };
    });

  const P = PRODUCTS[st.jenis];
  const m = motifOf(st.jenis, st.motif);
  const colors = effectiveColors(st);
  const colorKey = colors.join("");
  const thumbKey = st.warna.map((c) => (P.colors.includes(c) ? c : P.colors[0])).join("");
  const r = useMemo(() => compute(st), [st]);
  const lines = useMemo(() => detailLines(st, r), [st, r]);
  const has = r.area > 0;
  const waHref = waLink(whatsapp, waMessage(lines, shareUrl));
  const dupColors = new Set(colors).size < colors.length;
  const [vw, vh] = P.view;
  const shareText = r.auto.map((x) => `${COLORS[x.c].name} ${fmtPct(x.share)}`).join(", ");
  const previewLabel = `Pratinjau tampak atas motif ${m.name}, paving ${P.name} ${P.size}, ${shareText}. Potongan area ${fmt(vw / 100)} × ${fmt(vh / 100)} meter dengan skala sebenarnya.`;

  const enableManual = (on: boolean) =>
    update((s) => {
      if (!on) return { ...s, manual: false, persen: {} };
      const persen: Partial<Record<ColorId, string>> = {};
      for (const x of autoShares(s).slice(1)) persen[x.c] = fmt(x.share * 100, 1);
      return { ...s, manual: true, persen };
    });

  const onCopy = async () => {
    const text = copyMessage(lines, shareUrl);
    const ok = await copyText(text);
    setFallback(ok ? "" : text);
    setStatus(ok ? "Rincian disalin. Tempel di catatan atau pesan Anda." : "Gagal menyalin otomatis. Salin teks di bawah secara manual.");
  };

  const steps = [
    { id: "pp-jenis", label: "Jenis", value: P.name, done: true },
    { id: "pp-pola", label: "Pola", value: m.name, done: true },
    { id: "pp-warna", label: "Warna", value: r.auto.map((x) => COLORS[x.c].name).join(" + "), done: true },
    { id: "pp-ukuran", label: "Ukuran", value: has ? `${fmt(r.area)} m²` : "belum diisi", done: has },
    { id: "pp-hasil", label: "Hasil", value: has ? `${fmt(r.total)} pcs` : "–", done: has },
  ];

  return (
    <div className={css.wrap}>
      <nav aria-label="Langkah kalkulator" className={css.stepper} data-pp-noprint>
        <ol>
          {steps.map((x, i) => (
            <li key={x.id}>
              <a href={`#${x.id}`} className={x.done ? css.done : undefined}>
                <span className={`${css.sHex} hex`} aria-hidden="true">
                  {i + 1}
                </span>
                <span className={css.sText}>
                  <span className={css.sLabel}>
                    <span className="sr-only">Langkah {i + 1}: </span>
                    {x.label}
                  </span>
                  <span className={css.sVal}>{x.value}</span>
                </span>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className={css.printOnly}>
        <b>Istana Block Purwakarta · Rincian kalkulator pola paving</b>
        <span>WhatsApp {whatsapp}</span>
        {shareUrl && <span className={css.printLink}>{shareUrl}</span>}
      </div>

      <div className={css.root}>
        <div className={css.flow}>
          {/* 1. Jenis */}
          <section id="pp-jenis" className={`${css.card} ${css.oJenis}`} aria-labelledby="pp-jenis-h" data-pp-noprint>
            <StepHead n={1} id="pp-jenis-h" title="Jenis paving" sub="Isi per m² sudah termasuk celah nat." />
            <fieldset className={css.fs}>
              <legend className="sr-only">Pilih jenis paving</legend>
              <div className={`${css.grid} ${css.gridJenis}`}>
                {PRODUCT_LIST.map((p) => (
                  <label key={p.id} className={css.opt}>
                    <input type="radio" name="pp-jenis" value={p.id} checked={st.jenis === p.id} onChange={() => chooseJenis(p.id)} />
                    <span className={css.optBody}>
                      <span className={css.thumb}>
                        <PatternArt jenis={p.id} motif={p.motifs[0].id} colorKey="NNN" w={p.thumb[0]} h={p.thumb[1]} />
                      </span>
                      <span className={css.optName}>{p.name}</span>
                      <span className={css.optMeta}>
                        {p.size}
                        <br />
                        <b>{fmt(p.pcs)} pcs/m²</b>
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            {P.tebal.length > 1 ? (
              <Seg
                name="pp-tebal"
                legend="Tebal"
                value={st.tebal}
                options={P.tebal.map((t) => ({ v: t, label: `${t} cm`, note: t >= 8 ? "kendaraan berat" : "pejalan kaki & mobil" }))}
                onChange={(v) => patch({ tebal: v })}
                help="Tebal tidak mengubah jumlah pcs; dicantumkan di pesanan."
              />
            ) : (
              <p className={css.inlineNote}>
                <b>Tebal:</b> {P.tebal[0]} cm
              </p>
            )}
          </section>

          {/* 2. Pola / motif */}
          <section id="pp-pola" className={`${css.card} ${css.oPola}`} aria-labelledby="pp-pola-h" data-pp-noprint>
            <StepHead n={2} id="pp-pola-h" title="Pola & motif" sub={`${P.motifs.length} motif untuk ${P.name}. Gambar mengikuti warna pilihan Anda.`} />
            <fieldset className={css.fs}>
              <legend className="sr-only">Pilih motif {P.name}</legend>
              <div className={`${css.grid} ${css.gridMotif}`}>
                {P.motifs.map((x) => (
                  <label key={x.id} className={css.opt}>
                    <input type="radio" name="pp-motif" value={x.id} checked={m.id === x.id} onChange={() => chooseMotif(x.id)} />
                    <span className={css.optBody}>
                      <span className={css.thumb}>
                        <PatternArt jenis={st.jenis} motif={x.id} colorKey={thumbKey} w={P.thumb[0]} h={P.thumb[1]} />
                      </span>
                      <span className={css.optName}>{x.name}</span>
                      <span className={css.optMeta}>{x.use}</span>
                      <span className={css.tags}>
                        <span>{x.roles === 1 ? "1 warna" : `${x.roles} warna`}</span>
                        {x.cad >= 10 && <span className={css.tagWarn}>cadangan {x.cad}%</span>}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            {(m.note || P.note) && <p className={css.note}>{m.note ?? P.note}</p>}
          </section>

          {/* 3. Warna */}
          <section id="pp-warna" className={`${css.card} ${css.oWarna}`} aria-labelledby="pp-warna-h" data-pp-noprint>
            <StepHead
              n={3}
              id="pp-warna-h"
              title="Warna"
              sub={
                m.roles === 1
                  ? "Motif ini satu warna."
                  : `Motif ini memakai ${m.roles} warna: dasar dan ${m.roles - 1} aksen. Memilih warna yang sudah dipakai akan menukar posisinya.`
              }
            />
            <div className={css.roles}>
              {colors.map((c, role) => (
                <fieldset key={role} className={css.fs}>
                  <legend className={css.legend}>
                    {ROLE_LABEL[role]}
                    {m.hints?.[role] && <span className={css.legendHint}> · {m.hints[role]}</span>}
                  </legend>
                  <div className={css.chips}>
                    {P.colors.map((cc) => (
                      <label key={cc} className={css.chip}>
                        <input type="radio" name={`pp-warna-${role}`} value={cc} checked={c === cc} onChange={() => chooseColor(role, cc)} />
                        <span>
                          <Swatch c={cc} />
                          {COLORS[cc].name}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
            {P.note && P.colors.length === 1 && <p className={css.note}>{P.note}</p>}
            {dupColors && <p className={css.note}>Ada peran dengan warna yang sama; bagiannya digabung dalam hitungan.</p>}

            <div className={css.shareBox}>
              <p className={css.shareTitle}>Komposisi warna {st.manual && !r.manualErr && r.shares.length > 1 ? "(manual)" : "dari motif"}</p>
              <div className={css.bar} aria-hidden="true">
                {r.shares.map((x) => (
                  <span key={x.c} style={{ width: `${x.share * 100}%`, background: COLORS[x.c].hex }} />
                ))}
              </div>
              <ul className={css.legendList}>
                {r.shares.map((x) => (
                  <li key={x.c}>
                    <Swatch c={x.c} />
                    {COLORS[x.c].name} <b className="tabular">{fmtPct(x.share)}</b>
                  </li>
                ))}
              </ul>
              {r.auto.length > 1 && (
                <>
                  <label className="check">
                    <input type="checkbox" checked={st.manual} onChange={(e) => enableManual(e.target.checked)} />
                    Atur persentase manual
                  </label>
                  {st.manual && (
                    <div className={css.manual}>
                      {r.auto.slice(1).map((x) => (
                        <NumField
                          key={x.c}
                          id={`pp-persen-${x.c}`}
                          label={`${COLORS[x.c].name} (aksen)`}
                          unit="%"
                          value={st.persen[x.c] ?? ""}
                          placeholder={fmt(x.share * 100, 1)}
                          onChange={(v) => update((s) => ({ ...s, persen: { ...s.persen, [x.c]: v } }))}
                        />
                      ))}
                      <p className={css.help}>
                        {COLORS[r.auto[0].c].name} (warna dasar) otomatis mengisi sisanya
                        {!r.manualErr && <>: <b>{fmtPct(r.shares[0].share)}</b></>}. Pratinjau tetap mengikuti motif.
                      </p>
                      {r.manualErr && (
                        <p className={css.err} role="alert">
                          {r.manualErr} Hitungan memakai komposisi motif.
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          {/* 4. Ukuran */}
          <section id="pp-ukuran" className={`${css.card} ${css.oUkuran}`} aria-labelledby="pp-ukuran-h" data-pp-noprint>
            <StepHead n={4} id="pp-ukuran-h" title="Ukuran area" sub="Gunakan koma atau titik untuk desimal." />
            <div className={css.stack}>
              <Seg
                name="pp-mode"
                legend="Cara isi ukuran"
                value={st.mode}
                options={[
                  { v: "pl" as const, label: "Panjang × lebar" },
                  { v: "luas" as const, label: "Luas langsung" },
                ]}
                onChange={(v) => patch({ mode: v })}
              />
              {st.mode === "pl" ? (
                <div className={css.two}>
                  <NumField id="pp-p" label="Panjang" unit="m" value={st.p} placeholder="mis. 10" onChange={(v) => patch({ p: v })} />
                  <NumField id="pp-l" label="Lebar" unit="m" value={st.l} placeholder="mis. 5" onChange={(v) => patch({ l: v })} />
                </div>
              ) : (
                <NumField id="pp-luas" label="Luas area" unit="m²" value={st.luas} placeholder="mis. 50" onChange={(v) => patch({ luas: v })} />
              )}
              <Seg
                name="pp-cad"
                legend="Cadangan potong & pecah"
                value={st.cad}
                options={CAD_OPTIONS.map((c) => ({ v: c, label: `${c}%`, note: c === m.cad ? "disarankan" : undefined }))}
                onChange={(v) => patch({ cad: v })}
                help={`Untuk motif ${m.name.toLowerCase()} disarankan ${m.cad}%. Pola lurus cukup 5%; pola 45° dan hexagon 10%.`}
              />
              <fieldset className={css.fs}>
                <legend className={css.legend}>Pelengkap (opsional)</legend>
                <div className={css.extras}>
                  <div className={css.extra}>
                    <label className="check">
                      <input type="checkbox" checked={st.k} onChange={(e) => patch({ k: e.target.checked })} />
                      Kanstin (pembatas tepi)
                    </label>
                    {st.k && (
                      <div className={css.nested}>
                        <Seg
                          name="pp-ks"
                          legend="Ukuran kanstin"
                          value={st.ks}
                          options={[
                            { v: 40 as const, label: "40 cm", note: "40×20, 40×25, 40×28, S" },
                            { v: 60 as const, label: "60 cm", note: "60×30" },
                          ]}
                          onChange={(v) => patch({ ks: v })}
                        />
                        <NumField
                          id="pp-kp"
                          label="Panjang kanstin"
                          unit="m"
                          value={st.kp}
                          placeholder={r.keliling > 0 ? `otomatis ${fmt(r.keliling)}` : "mis. 30"}
                          onChange={(v) => patch({ kp: v })}
                          help={
                            r.keliling > 0
                              ? `Kosongkan untuk memakai keliling 2 × (P + L) = ${fmt(r.keliling)} m.`
                              : st.mode === "luas"
                                ? "Isi panjang tepi yang dipasang kanstin."
                                : "Otomatis keliling 2 × (P + L) setelah ukuran diisi."
                          }
                        />
                      </div>
                    )}
                  </div>
                  <div className={css.extra}>
                    <label className="check">
                      <input type="checkbox" checked={st.abu} onChange={(e) => patch({ abu: e.target.checked })} />
                      Abu batu alas 5 cm
                    </label>
                  </div>
                  <div className={css.extra}>
                    <label className="check">
                      <input type="checkbox" checked={st.bc} onChange={(e) => patch({ bc: e.target.checked })} />
                      Base course 20 cm
                    </label>
                  </div>
                </div>
              </fieldset>
            </div>
          </section>

          {/* 5. Hasil */}
          <section id="pp-hasil" className={`${css.card} ${css.oHasil}`} aria-labelledby="pp-hasil-h">
            <StepHead n={5} id="pp-hasil-h" title="Hasil perhitungan" />
            <div className={css.total} aria-live="polite" aria-atomic="true">
              {has ? (
                <>
                  <span className={css.totalLabel}>
                    Total {P.name} {P.size}
                  </span>
                  <b className="tabular">{fmt(r.total)} pcs</b>
                  <span className={css.formula}>
                    {fmt(r.area)} m² × {fmt(P.pcs)} pcs/m² × (1 + {st.cad}%) = {fmt(r.exact)} → dibulatkan ke atas
                  </span>
                  <span className="sr-only">{r.per.map((x) => `${COLORS[x.c].name} ${fmt(x.pcs)} pcs`).join(", ")}.</span>
                </>
              ) : (
                <>
                  <span className={css.totalLabel}>Belum ada ukuran area</span>
                  <b>– pcs</b>
                  <span className={css.formula}>
                    Isi ukuran di <a href="#pp-ukuran">langkah 4</a>. Kebutuhan per m²: {fmt(P.pcs)} pcs
                    {r.per.length > 1 && <> ({r.per.map((x) => `${COLORS[x.c].name} ${fmt(P.pcs * x.share, 1)}`).join(" · ")})</>}.
                  </span>
                </>
              )}
            </div>

            <ul className={`rowlist ${css.rows}`}>
              {r.per.map((x) => (
                <li key={x.c} className="rowitem">
                  <span className={css.rowName}>
                    <Swatch c={x.c} />
                    <span>
                      {COLORS[x.c].name}
                      <small className={css.rowSub}>
                        {fmtPct(x.share)} {st.manual && !r.manualErr ? "(manual)" : "dari motif"}
                      </small>
                    </span>
                  </span>
                  <b className="tabular">{has ? `${fmt(x.pcs)} pcs` : "–"}</b>
                </li>
              ))}
              {st.k && (
                <li className="rowitem">
                  <span>
                    Kanstin {st.ks} cm
                    <small className={css.rowSub}>
                      {r.kanstin.len > 0 ? `${r.kanstin.auto ? "keliling" : "panjang"} ${fmt(r.kanstin.len)} m ÷ ${fmt(st.ks / 100)} m` : "isi panjang kanstin"}
                    </small>
                  </span>
                  <b className="tabular">{r.kanstin.len > 0 ? `${fmt(r.kanstin.pcs)} pcs` : "–"}</b>
                </li>
              )}
              {st.abu && (
                <li className="rowitem">
                  <span>
                    Abu batu alas
                    <small className={css.rowSub}>luas × 0,05 m</small>
                  </span>
                  <b className="tabular">{has ? `${fmt(r.abuM3)} m³` : "–"}</b>
                </li>
              )}
              {st.bc && (
                <li className="rowitem">
                  <span>
                    Base course
                    <small className={css.rowSub}>luas × 0,20 m</small>
                  </span>
                  <b className="tabular">{has ? `${fmt(r.bcM3)} m³` : "–"}</b>
                </li>
              )}
            </ul>
            {has && r.per.length > 1 && r.sumPer > r.total && (
              <p className={css.help}>
                Jumlah per warna dibulatkan ke atas masing-masing, jadi totalnya {fmt(r.sumPer)} pcs ({fmt(r.sumPer - r.total)} pcs lebih banyak dari total).
              </p>
            )}

            <div className={css.actions} data-pp-noprint>
              {/* data-cta dibaca pemicu GTM untuk menghitung lead kalkulator terpisah dari klik WhatsApp biasa. */}
              <a className="btn btn-primary" href={waHref} target="_blank" rel="noopener" data-cta="kalkulator">
                <WaIcon />
                Kirim ke WhatsApp
              </a>
              <button type="button" className="btn btn-ghost" onClick={onCopy}>
                Salin rincian
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => window.print()}>
                Cetak / simpan PDF
              </button>
            </div>
            <p className={css.status} role="status" data-pp-noprint>
              {status}
            </p>
            {fallback && (
              <div className="field" data-pp-noprint>
                <label htmlFor="pp-fallback">Rincian untuk disalin</label>
                <textarea id="pp-fallback" readOnly value={fallback} onFocus={(e) => e.currentTarget.select()} />
              </div>
            )}
            <p className={css.disclaimer}>
              Ilustrasi tampak atas berskala ukuran asli; warna aktual dapat sedikit berbeda. Hasil berupa perkiraan dan dicek admin sebelum pengiriman.
            </p>
          </section>
        </div>

        {/* Pratinjau */}
        <aside className={css.aside} aria-labelledby="pp-prev-h">
          <div className={css.previewCard}>
            <div className={css.prevHead}>
              <h2 id="pp-prev-h">Pratinjau motif</h2>
              <span>Tampak atas · skala asli</span>
            </div>
            <div className={css.stage}>
              <PatternArt jenis={st.jenis} motif={m.id} colorKey={colorKey} w={vw} h={vh} label={previewLabel} rich />
              <span className={css.dims} aria-hidden="true">
                {fmt(vw / 100)} × {fmt(vh / 100)} m
              </span>
              <span className={css.scale} style={{ width: `${10000 / vw}%` }} aria-hidden="true">
                <span>1 m</span>
                <i />
              </span>
            </div>
            <p className={css.prevTitle}>
              <b>{m.name}</b> · {P.name} {P.size} · tebal {st.tebal} cm
            </p>
            <ul className={css.legendList}>
              {r.auto.map((x) => (
                <li key={x.c}>
                  <Swatch c={x.c} />
                  {COLORS[x.c].name} <b className="tabular">{fmtPct(x.share)}</b>
                </li>
              ))}
            </ul>
          </div>
          <div className={css.quick} data-pp-noprint>
            <div>
              <span>{has ? `Total untuk ${fmt(r.area)} m²` : "Total"}</span>
              <b className="tabular">{has ? `${fmt(r.total)} pcs` : "– pcs"}</b>
            </div>
            <a href={has ? "#pp-hasil" : "#pp-ukuran"} className={`btn btn-sm ${css.quickBtn}`}>
              {has ? "Lihat rincian" : "Isi ukuran"}
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}

function WaIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"
      />
    </svg>
  );
}
