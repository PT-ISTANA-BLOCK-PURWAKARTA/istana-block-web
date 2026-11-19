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
  /** Produk katalog yang memenuhi tebal minimum. Kosong bila katalog belum punya tebal cukup. */
  produk: ProdukRekomendasi[];
  /** Produk tebal terbesar yang ada bila `produk` kosong (butuh pesanan khusus). */
  produkAlternatif: Array<{ id: ProductId; name: string; tebalMaksCm: number }>;
  peringatan: string[];
  sementara: true;
}

/** Kelas beban -> tebal minimum + produk katalog yang cocok. */
export function rekomendasiBeban(kelas: KelasBeban): RekomendasiBeban {
  const tebalMinCm = TEBAL_MIN_CM[kelas].nilai;
  const kandidat = PRODUK_PER_BEBAN.nilai[kelas].map((id) => PAVING_CATALOG[id]);

  const produk: ProdukRekomendasi[] = [];
  for (const p of kandidat) {
    const tebalCm = p.tebalCm.filter((t) => t >= tebalMinCm);
    if (tebalCm.length > 0) produk.push({ id: p.id, name: p.name, tebalCm });
  }

  const peringatan: string[] = [];
  let produkAlternatif: RekomendasiBeban["produkAlternatif"] = [];
  if (produk.length === 0) {
    produkAlternatif = kandidat.map((p) => ({ id: p.id, name: p.name, tebalMaksCm: Math.max(...p.tebalCm) }));
    peringatan.push(
      `Katalog belum punya tebal ${tebalMinCm} cm untuk beban ${LABEL_BEBAN[kelas].toLowerCase()}; tanyakan pesanan khusus ke pabrik.`,
    );
  }

  return { kelas, label: LABEL_BEBAN[kelas], tebalMinCm, produk, produkAlternatif, peringatan, sementara: true };
}

/** Tebal bawaan: terkecil yang memenuhi minimum; bila tak ada, tebal katalog terbesar. */
export function tebalBawaan(produkId: ProductId, kelas: KelasBeban): number {
  const tebal = [...PAVING_CATALOG[produkId].tebalCm].sort((a, b) => a - b);
  return tebal.find((t) => t >= TEBAL_MIN_CM[kelas].nilai) ?? tebal[tebal.length - 1];
}
