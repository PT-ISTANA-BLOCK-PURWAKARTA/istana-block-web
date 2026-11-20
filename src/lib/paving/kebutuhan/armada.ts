import { ceilAman } from "./util";

/**
 * Aturan armada pengiriman, sama dengan kalkulator di halaman wilayah (LocalEstimator):
 * luas paving <= 55 m2 -> 1 rit Colt Diesel; <= 110 m2 -> 1 rit Fuso Crane; selebihnya ceil(m2 / 100) rit Fuso Crane.
 * Sumber: kalkulator armada halaman wilayah, src/components/LocalEstimator.tsx (dipakai ulang di sana).
 */
export const ARMADA_BATAS_COLT_M2 = 55;
export const ARMADA_BATAS_FUSO_M2 = 110;
export const ARMADA_M2_PER_RIT_BESAR = 100;

export type JenisArmada = "colt-diesel" | "fuso-crane";

export interface HasilArmada {
  jenis: JenisArmada;
  rit: number;
  /** Mis. "1 rit Fuso Crane". */
  label: string;
}

export function hitungArmada(luasPavingM2: number): HasilArmada {
  if (luasPavingM2 <= ARMADA_BATAS_COLT_M2) {
    return { jenis: "colt-diesel", rit: luasPavingM2 > 0 ? 1 : 0, label: "1 rit Colt Diesel" };
  }
  const rit = luasPavingM2 <= ARMADA_BATAS_FUSO_M2 ? 1 : ceilAman(luasPavingM2 / ARMADA_M2_PER_RIT_BESAR);
  return { jenis: "fuso-crane", rit, label: `${rit} rit Fuso Crane` };
}
