import { PAVING_CATALOG, type ProductId } from "../catalog";
import {
  BERAT_PALET_KG,
  DENSITAS_KG_M3,
  FAKTOR_PADAT_GRASS,
  KAPASITAS_TRUK,
  M2_PER_PALET,
  type JenisTruk,
} from "./konstanta-sementara";
import { ceilAman, cekNonNegatif } from "./util";

export interface ItemLogistik {
  produkId: ProductId;
  tebalCm: number;
  pcs: number;
}

export interface BarisLogistik extends ItemLogistik {
  pcsPerPalet: number;
  palet: number;
  beratPcsKg: number;
  beratKg: number;
}

export interface HasilLogistik {
  baris: BarisLogistik[];
  paletTotal: number;
  beratTotalKg: number;
  jenisTruk: JenisTruk;
  trip: number;
  sementara: true;
}

/** Berat satu pcs (kg) dari luas muka x tebal x kerapatan. SEMENTARA (tidak ada data timbang pabrik). */
export function beratPcsKg(produkId: ProductId, tebalCm: number): number {
  const p = PAVING_CATALOG[produkId];
  let luasMuka = p.actualLengthM * p.actualWidthM;
  if (p.shape === "hex") luasMuka = (Math.sqrt(3) / 2) * p.actualLengthM ** 2;
  if (p.shape === "grass") luasMuka *= FAKTOR_PADAT_GRASS.nilai;
  return luasMuka * (tebalCm / 100) * DENSITAS_KG_M3.nilai;
}

/** Isi pcs per palet, diturunkan dari m² per palet x pcs/m² label. */
export function pcsPerPalet(produkId: ProductId): number {
  return Math.max(1, Math.floor(M2_PER_PALET.nilai * PAVING_CATALOG[produkId].labelPcsPerM2));
}

export function hitungLogistik(items: ItemLogistik[], jenisTruk: JenisTruk = "engkel"): HasilLogistik {
  const baris: BarisLogistik[] = items.map((it) => {
    cekNonNegatif("pcs", it.pcs);
    const perPalet = pcsPerPalet(it.produkId);
    const palet = ceilAman(it.pcs / perPalet);
    const berat1 = beratPcsKg(it.produkId, it.tebalCm);
    return {
      ...it,
      pcsPerPalet: perPalet,
      palet,
      beratPcsKg: berat1,
      beratKg: it.pcs * berat1 + palet * BERAT_PALET_KG.nilai,
    };
  });
  const paletTotal = baris.reduce((a, b) => a + b.palet, 0);
  const beratTotalKg = baris.reduce((a, b) => a + b.beratKg, 0);
  const kap = KAPASITAS_TRUK[jenisTruk].nilai;
  const trip = paletTotal === 0 ? 0 : Math.max(ceilAman(beratTotalKg / kap.beratKg), ceilAman(paletTotal / kap.palet));
  return { baris, paletTotal, beratTotalKg, jenisTruk, trip, sementara: true };
}
