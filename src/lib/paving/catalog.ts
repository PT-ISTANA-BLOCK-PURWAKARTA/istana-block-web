/**
 * Katalog Tunggal Produk Paving — PT Istana Block Purwakarta
 *
 * Sumber kebenaran tunggal untuk ukuran fisik pabrik, celah nat per produk,
 * modul kisi, dan angka pcs/m² (geometri vs label publik).
 *
 * Nilai aktual dan nat berstatus "provisional" hingga konfirmasi pabrik di F7.
 * Angka labelPcsPerM2 adalah angka publik resmi yang dipakai kalkulator dan katalog.
 */

export type ProductId = "truepave" | "hexagon" | "fp21" | "fp30" | "grass";
export type PavingShape = "rect" | "hex" | "grass";
export type ColorId = "N" | "M" | "H";

export interface PavingProductSpec {
  id: ProductId;
  name: string;
  shape: PavingShape;
  sizeLabel: string;
  actualLengthM: number;
  actualWidthM: number;
  jointLengthM: number;
  jointWidthM: number;
  moduleLengthM: number;
  moduleWidthM: number;
  pcsPerM2: number;
  labelPcsPerM2: number;
  tebalCm: number[];
  colors: ColorId[];
  viewCm: [number, number];
  thumbCm: [number, number];
  status: "provisional" | "confirmed";
  notes?: string;
}

/* ---------- Konstanta Geometri Bersama (cm) ---------- */
export const TA_CM = 21.3;
export const Ta_CM = TA_CM / 2;
export const HD_CM = Math.sqrt(20000 / (27 * Math.sqrt(3)));
export const HV_CM = (HD_CM * Math.sqrt(3)) / 2;
export const HR_CM = HD_CM / Math.sqrt(3);
export const GW_CM = 45.3;
export const GH_CM = 30.3;

export const BED_DEPTH_M = 0.05; // Abu batu 5 cm
export const BASE_DEPTH_M = 0.20; // Base course 20 cm

/* ---------- Perhitungan Modul & Spesifikasi Produk ---------- */

// Truepave: 21 x 10,5 cm asli + nat 0,3 cm (panjang) dan 0,15 cm (lebar)
const TRUEPAVE_MOD_L_M = TA_CM / 100;
const TRUEPAVE_MOD_W_M = Ta_CM / 100;

// Hexagon: sisi datar 20 cm asli + nat terhitung agar tepat 27 pcs/m²
const HEX_MOD_L_M = HD_CM / 100;
const HEX_MOD_W_M = HEX_MOD_L_M;

// Fullpave 21: 21 x 21 cm asli + nat 0,3 cm
const FP21_MOD_M = 21.3 / 100;

// Fullpave 30: 30 x 30 cm asli + nat 0,15 cm
const FP30_MOD_M = 30.15 / 100;

// Grass Block: 45 x 30 cm asli + nat 0,3 cm
const GRASS_MOD_L_M = GW_CM / 100;
const GRASS_MOD_W_M = GH_CM / 100;

export const PAVING_CATALOG: Record<ProductId, PavingProductSpec> = {
  truepave: {
    id: "truepave",
    name: "Paving Bata (Truepave)",
    shape: "rect",
    sizeLabel: "21 × 10,5 cm",
    actualLengthM: 0.21,
    actualWidthM: 0.105,
    jointLengthM: 0.003,
    jointWidthM: 0.0015,
    moduleLengthM: TRUEPAVE_MOD_L_M,
    moduleWidthM: TRUEPAVE_MOD_W_M,
    pcsPerM2: 1 / (TRUEPAVE_MOD_L_M * TRUEPAVE_MOD_W_M),
    labelPcsPerM2: 44,
    tebalCm: [6, 8],
    colors: ["N", "M", "H"],
    viewCm: [240, 150],
    thumbCm: [120, 75],
    status: "confirmed",
    notes: "Tervalidasi sesuai spesifikasi cetakan pabrik PT Istana Block Purwakarta per 17 Nov 2026. Lebar modul Ta = TA/2, nat berbeda per sumbu agar bata terkunci 2:1 pas.",
  },
  hexagon: {
    id: "hexagon",
    name: "Paving Hexagon (Segi Enam)",
    shape: "hex",
    sizeLabel: "20 × 20 cm",
    actualLengthM: 0.20,
    actualWidthM: 0.20,
    jointLengthM: HEX_MOD_L_M - 0.20,
    jointWidthM: HEX_MOD_L_M - 0.20,
    moduleLengthM: HEX_MOD_L_M,
    moduleWidthM: HEX_MOD_W_M,
    pcsPerM2: 10000 / ((Math.sqrt(3) / 2) * HD_CM ** 2),
    labelPcsPerM2: 27,
    tebalCm: [6, 8],
    colors: ["N", "M", "H"],
    viewCm: [240, 150],
    thumbCm: [120, 75],
    status: "confirmed",
    notes: "Tervalidasi per 17 Nov 2026: Nat diturunkan dari target 27 pcs/m² (HD ≈ 20,68 cm).",
  },
  fp21: {
    id: "fp21",
    name: "Fullpave 21 (Ubin)",
    shape: "rect",
    sizeLabel: "21 × 21 cm",
    actualLengthM: 0.21,
    actualWidthM: 0.21,
    jointLengthM: 0.003,
    jointWidthM: 0.003,
    moduleLengthM: FP21_MOD_M,
    moduleWidthM: FP21_MOD_M,
    pcsPerM2: 1 / (FP21_MOD_M * FP21_MOD_M),
    labelPcsPerM2: 22,
    tebalCm: [6],
    colors: ["N", "M", "H"],
    viewCm: [240, 150],
    thumbCm: [120, 75],
    status: "confirmed",
    notes: "Tervalidasi per 17 Nov 2026.",
  },
  fp30: {
    id: "fp30",
    name: "Fullpave 30 (Ubin Besar)",
    shape: "rect",
    sizeLabel: "30 × 30 cm",
    actualLengthM: 0.30,
    actualWidthM: 0.30,
    jointLengthM: 0.0015,
    jointWidthM: 0.0015,
    moduleLengthM: FP30_MOD_M,
    moduleWidthM: FP30_MOD_M,
    pcsPerM2: 1 / (FP30_MOD_M * FP30_MOD_M),
    labelPcsPerM2: 11,
    tebalCm: [6],
    colors: ["N", "M", "H"],
    viewCm: [360, 225],
    thumbCm: [180, 112.5],
    status: "confirmed",
    notes: "Tervalidasi per 17 Nov 2026.",
  },
  grass: {
    id: "grass",
    name: "Grass Block (Paving Rumput)",
    shape: "grass",
    sizeLabel: "45 × 30 cm",
    actualLengthM: 0.45,
    actualWidthM: 0.30,
    jointLengthM: 0.003,
    jointWidthM: 0.003,
    moduleLengthM: GRASS_MOD_L_M,
    moduleWidthM: GRASS_MOD_W_M,
    pcsPerM2: 1 / (GRASS_MOD_L_M * GRASS_MOD_W_M),
    labelPcsPerM2: 7.5,
    tebalCm: [6, 8],
    colors: ["N"],
    viewCm: [360, 225],
    thumbCm: [180, 112.5],
    status: "confirmed",
    notes: "Tervalidasi per 17 Nov 2026: Geometri 7,2855 pcs/m² vs label publik 7,5 pcs/m² (selisih ~2,9%, label publik 7,5 resmi dipertahankan).",
  },
};

export const PRODUCT_LIST = Object.values(PAVING_CATALOG);
