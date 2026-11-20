/**
 * Legacy Pattern & Geometry Builders
 * Extracted from PatternCalculator.tsx for characterization and regression safety.
 */

import {
  TA_CM,
  Ta_CM,
  HD_CM,
  HV_CM,
  HR_CM,
  GW_CM,
  GH_CM,
  PAVING_CATALOG,
} from "../catalog";
import type {
  ColorId,
  Motif,
  Placed,
  Product,
  ProductId,
  Shape,
  Tile,
  Unit,
} from "./types";
import { COLOR_IDS, TONES } from "./types";

export const TA = TA_CM;
export const Ta = Ta_CM;
export const HD = HD_CM;
export const HV = HV_CM;
export const HR = HR_CM;
export const GW = GW_CM;
export const GH = GH_CM;

export const mod = (a: number, n: number) => ((a % n) + n) % n;

export function rng(seed: number) {
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
export function shuffledRoles(counts: number[], seed: number) {
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
export function spreadRoles(roles: number[], nb: (i: number) => number[], seed: number) {
  const r = rng(seed);
  const near = (i: number, role: number, skip = -1) =>
    nb(i).filter((j) => j !== skip && roles[j] === role).length;
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
export function staggerNeighbours(rows: number, cols: number) {
  return (i: number) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const at = (rr: number, cc: number) => mod(rr, rows) * cols + mod(cc, cols);
    const d = r % 2 === 0 ? -1 : 1;
    return [
      at(r, c - 1),
      at(r, c + 1),
      at(r - 1, c),
      at(r - 1, c + d),
      at(r + 1, c),
      at(r + 1, c + d),
    ];
  };
}

/** Susun bata (running bond): baris mendatar, tiap baris bergeser ½ bata. */
export function runningBond(
  rows: number,
  cols: number,
  role: (row: number, col: number, i: number) => number,
): Unit {
  const tiles: Tile[] = [];
  let i = 0;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      tiles.push({
        x: c * TA + (r % 2) * Ta,
        y: r * Ta,
        w: TA,
        h: Ta,
        r: role(r, c, i++),
      });
  return { w: cols * TA, h: rows * Ta, tiles };
}

/** Bata tegak lurus berjajar (stack bond). */
export function stackBond(cols: number, role: (col: number) => number): Unit {
  const tiles: Tile[] = [];
  for (let c = 0; c < cols; c++) tiles.push({ x: c * Ta, y: 0, w: Ta, h: TA, r: role(c) });
  return { w: cols * Ta, h: TA, tiles };
}

/**
 * Tulang ikan 90°: pasangan bata mendatar + tegak berundak diagonal.
 * Lajur ke-k bergeser 4 modul; n = jumlah lajur per satuan (lajur pertama = aksen bila n > 1).
 */
export function herringbone(n: number): Unit {
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
export function basketweave(): Unit {
  const tiles: Tile[] = [];
  for (let by = 0; by < 2; by++)
    for (let bx = 0; bx < 2; bx++) {
      const x = bx * TA;
      const y = by * TA;
      if ((bx + by) % 2 === 0) {
        tiles.push({ x, y, w: TA, h: Ta, r: 0 }, { x, y: y + Ta, w: TA, h: Ta, r: 0 });
      } else {
        tiles.push({ x, y: Ta, w: Ta, h: TA, r: 1 }, { x: x + Ta, y, w: Ta, h: TA, r: 1 });
      }
    }
  return { w: 2 * TA, h: 2 * TA, tiles };
}

/** Ubin persegi/persegi panjang; half = baris ganjil bergeser ½ ubin. */
export function grid(
  w: number,
  h: number,
  cols: number,
  rows: number,
  role: (col: number, row: number) => number,
  half = false,
): Unit {
  const tiles: Tile[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      tiles.push({
        x: c * w + (half && r % 2 ? w / 2 : 0),
        y: r * h,
        w,
        h,
        r: role(c, r),
      });
  return { w: cols * w, h: rows * h, tiles };
}

/**
 * Hexagon ujung lancip di atas, baris ganjil bergeser ½ (offset "odd-r").
 * role(q, r) memakai koordinat aksial, sehingga pola kisi (titik, bunga) mudah dirumuskan.
 * rows harus genap.
 */
export function hexes(
  cols: number,
  rows: number,
  role: (q: number, r: number, i: number) => number,
): Unit {
  const tiles: Tile[] = [];
  let i = 0;
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      const q = col - (row - (row & 1)) / 2;
      tiles.push({
        x: (col + 0.5 + (row % 2) * 0.5) * HD,
        y: row * HV + HR,
        w: 0,
        h: 0,
        r: role(q, row, i++),
      });
    }
  return { w: cols * HD, h: rows * HV, tiles };
}

export const HEX_NB = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, -1],
  [-1, 1],
];

/** Bunga 1 + 6 pada kisi indeks 13 (pusat-pusat bunga berjarak 4 sel). */
export function flower(q: number, r: number) {
  const centre = (a: number, b: number) => mod(b + 4 * a, 13) === 0;
  if (centre(q, r)) return 2;
  return HEX_NB.some(([dq, dr]) => centre(q + dq, r + dr)) ? 1 : 0;
}

export const NOTE_45 = "Pola miring 45° banyak dipotong di tepi area, jadi cadangan disarankan 10%.";

export const TRUEPAVE: Motif[] = [
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

export const HEX_NOTE = "Hexagon perlu dipotong di sisi tepi area, jadi cadangan disarankan 10%.";
export const HEXAGON: Motif[] = [
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

export function fullpave(S: number): Motif[] {
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

export const GRASSBLOCK: Motif[] = [
  { id: "sejajar", name: "Susun sejajar", roles: 1, use: "Carport, parkir & area resapan", cad: 5, build: () => grid(GW, GH, 1, 1, () => 0) },
  { id: "selang", name: "Selang-seling", roles: 1, use: "Area parkir & taman", cad: 5, build: () => grid(GW, GH, 1, 2, () => 0, true) },
];

export const PRODUCTS: Record<ProductId, Product> = {
  truepave: {
    id: "truepave",
    name: "Truepave / Bata",
    size: "21 × 10,5 cm",
    pcs: PAVING_CATALOG.truepave.labelPcsPerM2,
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
    pcs: PAVING_CATALOG.hexagon.labelPcsPerM2,
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
    pcs: PAVING_CATALOG.fp21.labelPcsPerM2,
    tebal: [6, 8],
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
    pcs: PAVING_CATALOG.fp30.labelPcsPerM2,
    tebal: [6, 8],
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
    pcs: PAVING_CATALOG.grass.labelPcsPerM2,
    tebal: [6, 8],
    shape: "grass",
    view: [360, 225],
    thumb: [240, 160],
    colors: ["N"],
    note: "Grass Block hanya tersedia warna Abu Natural.",
    motifs: GRASSBLOCK,
  },
};

export const PRODUCT_LIST = Object.values(PRODUCTS);
export const isProduct = (v: string | undefined): v is ProductId => !!v && v in PRODUCTS;

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

export function tileBox(shape: Shape, t: Tile): [number, number, number, number] {
  return shape === "hex" ? [t.x - HD / 2, t.y - HR, t.x + HD / 2, t.y + HR] : [t.x, t.y, t.x + t.w, t.y + t.h];
}

export function toneOf(i: number, j: number, k: number) {
  let h = Math.imul(i + 101, 73856093) ^ Math.imul(j + 211, 19349663) ^ Math.imul(k + 1, 83492791);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) % TONES.length;
}

export const r2 = (n: number) => Math.round(n * 100) / 100;

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
