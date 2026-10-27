// Kelompok barang jadi (line) & metode Buis: label, tebakan kelompok dari nama barang, warna genteng.
// Murni (tanpa server-only) supaya dipakai halaman server dan komponen klien.
import type { ProductLine, ProductionCategory, ProductionMethod } from "@/db/erp";

export const LINE_LABEL: Record<ProductLine, string> = {
  paving: "Paving",
  genteng: "Genteng Beton",
  buis: "Buis Beton",
  tutup_buis: "Tutup Buis Beton",
  kanstin: "Kanstin",
  uditch: "U-Ditch",
  tutup_uditch: "Tutup U-Ditch",
  greffel: "Greffel",
  grass: "Grass Block",
  lainnya: "Lainnya",
};

/** 9 kategori spesifikasi produk (tanpa "Lainnya"). */
export const SPEC_LINES: ProductLine[] = ["paving", "genteng", "buis", "tutup_buis", "kanstin", "uditch", "tutup_uditch", "greffel", "grass"];

export const METHOD_LABEL: Record<ProductionMethod, string> = { tumbuk: "Tumbuk", cor: "Cor", tulangan: "Tulangan" };

/** Paving diinput QC; selain itu precast (mandor). */
export const lineCategory = (l: ProductLine | null | undefined): ProductionCategory => (l === "paving" ? "paving" : "precast");

const RULES: [RegExp, ProductLine][] = [
  [/tutup\s*u-?\s*ditch/, "tutup_uditch"],
  [/tutup\s*buis/, "tutup_buis"],
  [/u-?\s*ditch/, "uditch"],
  [/buis/, "buis"],
  [/genteng|\bnok\b/, "genteng"],
  [/kanstin|kansteen|kastin/, "kanstin"],
  [/gref+el|gravel/, "greffel"],
  [/gras+\s*bl?ok/, "grass"],
  [/paving|bata|ubin|hexa|segi ?enam/, "paving"],
];

/** Tebakan kelompok dari nama (aturan app live); null bila tidak dikenal. */
export function guessLine(name: string): ProductLine | null {
  const n = name.toLowerCase();
  for (const [re, line] of RULES) if (re.test(n)) return line;
  return null;
}

/** Kelompok barang: atribut barang bila diisi, kalau tidak tebakan dari nama (barang tak dikenal = lainnya). */
export function lineOfItem(i: { productionLine?: ProductLine | null; name: string }): ProductLine {
  return i.productionLine ?? guessLine(i.name) ?? "lainnya";
}

export type GentengColor = "natural" | "hitam" | "merah";
export const GENTENG_COLOR_LABEL: Record<GentengColor, string> = { natural: "Natural", hitam: "Hitam", merah: "Merah" };

export function gentengColor(name: string): GentengColor {
  const n = name.toLowerCase();
  return /\bhitam\b/.test(n) ? "hitam" : /\bmerah\b/.test(n) ? "merah" : "natural";
}

/** Kunci tipe genteng: nama tanpa kata warna, dinormalkan (untuk memasangkan natural dengan warnanya). */
export function gentengType(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(natural|hitam|merah)\b/g, " ")
    .replace(/[·\-_/()]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Berat total perkiraan (kg); satuan "m" tidak dihitung. */
export function estimateWeight(weightKg: number | null | undefined, qty: number, unit: string) {
  if (!weightKg || !(qty > 0) || /^m$/i.test(unit.trim())) return null;
  return weightKg * qty;
}
