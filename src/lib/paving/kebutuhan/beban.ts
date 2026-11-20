import { PAVING_CATALOG, type ProductId } from "../catalog";
import { LABEL_BEBAN, PRODUK_PER_BEBAN, TEBAL_MIN_CM, type KelasBeban } from "./konstanta-sementara";

export interface ProdukRekomendasi {
  id: ProductId;
  name: string;
  /** Tebal katalog (cm) yang memenuhi tebal minimum. */
  tebalCm: number[];
}

export interface RekomendasiBeban {
  kelas: KelasBeban;
  label: string;
  tebalMinCm: number;
  /** Mutu beton yang dianjurkan (dari konten situs). */
  mutu?: string;
  /** Catatan dari konten situs, mis. perlunya perencanaan teknis. */
  catatan?: string;
  /** Produk katalog yang cocok dan memenuhi tebal minimum. */
  produk: ProdukRekomendasi[];
  peringatan: string[];
}

/** Kelas beban -> tebal minimum + mutu + produk katalog yang cocok. */
export function rekomendasiBeban(kelas: KelasBeban): RekomendasiBeban {
  const { nilai: tebalMinCm, mutu, catatan } = TEBAL_MIN_CM[kelas];

  const produk: ProdukRekomendasi[] = [];
  for (const id of PRODUK_PER_BEBAN.nilai[kelas]) {
    const p = PAVING_CATALOG[id];
    const tebalCm = p.tebalCm.filter((t) => t >= tebalMinCm);
    if (tebalCm.length > 0) produk.push({ id: p.id, name: p.name, tebalCm });
  }

  return { kelas, label: LABEL_BEBAN[kelas], tebalMinCm, mutu, catatan, produk, peringatan: [] };
}

/** Tebal bawaan: terkecil yang memenuhi minimum; bila tak ada, tebal katalog terbesar. */
export function tebalBawaan(produkId: ProductId, kelas: KelasBeban): number {
  const tebal = [...PAVING_CATALOG[produkId].tebalCm].sort((a, b) => a - b);
  return tebal.find((t) => t >= TEBAL_MIN_CM[kelas].nilai) ?? tebal[tebal.length - 1];
}
