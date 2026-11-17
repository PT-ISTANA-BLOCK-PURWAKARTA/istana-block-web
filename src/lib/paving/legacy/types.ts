/**
 * Legacy Type Definitions for Paving Calculator
 * Extracted from PatternCalculator.tsx for characterization and regression safety.
 */

export type ColorId = "N" | "M" | "H";

export const COLORS: Record<ColorId, { name: string; hex: string }> = {
  N: { name: "Abu Natural", hex: "#B5B4AF" },
  M: { name: "Merah", hex: "#9C4A3A" },
  H: { name: "Hitam", hex: "#2C2B29" },
};

export const COLOR_IDS: ColorId[] = ["N", "M", "H"];
export const DEFAULT_W: ColorId[] = ["N", "M", "H"];
export const ROLE_LABEL = ["Warna dasar", "Aksen 1", "Aksen 2"];
export const isColor = (v: string): v is ColorId => v === "N" || v === "M" || v === "H";

export const JOINT = "#6E6A63";
export const GRASS = "#5E8B3B";

export const TONES = [-0.075, -0.05, -0.025, 0, 0.025, 0.05, 0.075];

export function mixHex(hex: string, to: number, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  return (
    "#" +
    [(n >> 16) & 255, (n >> 8) & 255, n & 255]
      .map((v) => Math.round(v + (to - v) * amt).toString(16).padStart(2, "0"))
      .join("")
  );
}

export const SHADES = Object.fromEntries(
  COLOR_IDS.map((c) => [c, TONES.map((t) => (t < 0 ? mixHex(COLORS[c].hex, 0, -t) : mixHex(COLORS[c].hex, 255, t * 1.4)))]),
) as Record<ColorId, string[]>;

export type ProductId = "truepave" | "hexagon" | "fp21" | "fp30" | "grass";
export type Shape = "rect" | "hex" | "grass";
export type Tile = { x: number; y: number; w: number; h: number; r: number };
export type Unit = { w: number; h: number; tiles: Tile[] };

export type Motif = {
  id: string;
  name: string;
  roles: 1 | 2 | 3;
  use: string;
  cad: number;
  rot?: number;
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
  view: [number, number];
  thumb: [number, number];
  colors: ColorId[];
  note?: string;
  motifs: Motif[];
};

export type Placed = Tile & { t: number };

export type CalcState = {
  jenis: ProductId;
  motif: string;
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

export type Query = Record<string, string | string[] | undefined>;

export const CAD_OPTIONS = [0, 3, 5, 10];
export const URL_KEYS = [
  "jenis",
  "motif",
  "warna",
  "tebal",
  "mode",
  "p",
  "l",
  "luas",
  "cad",
  "kanstin",
  "kp",
  "abu",
  "bc",
  "persen",
];

export type Share = { c: ColorId; share: number };
