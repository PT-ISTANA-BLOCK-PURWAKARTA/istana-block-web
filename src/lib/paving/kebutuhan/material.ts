import {
  ABU_NAT_M3_PER_M2,
  FAKTOR_PADAT,
  FAKTOR_SUSUT_ABU,
  KANSTIN_PANJANG_CM,
  PASIR_ALAS_CM,
  SIRTU_CM,
  type KelasBeban,
} from "./konstanta-sementara";
import { bulat2, ceilAman, cekNonNegatif } from "./util";

export interface OpsiMaterial {
  /** Keliling (m) untuk kanstin. Bila tidak diberikan, kanstin tidak dihitung. */
  kelilingM?: number;
  /** Panjang kanstin (cm). Bawaan dari konstanta sementara (60). */
  kanstinPanjangCm?: number;
}

export interface MaterialPendukung {
  kelas: KelasBeban;
  luasM2: number;
  pasirAlas: { tebalCm: number; m3: number };
  sirtu: { tebalCm: number; m3: number };
  abuNat: { m3: number };
  kanstin?: { kelilingM: number; panjangCm: number; pcs: number };
  sementara: true;
}

/** Volume material pendukung (m³, sudah dikali faktor padat/susut) dari luas bersih. */
export function hitungMaterialPendukung(
  luasM2: number,
  kelas: KelasBeban,
  opsi: OpsiMaterial = {},
): MaterialPendukung {
  cekNonNegatif("luasM2", luasM2);
  const pasirTebal = PASIR_ALAS_CM[kelas].nilai;
  const sirtuTebal = SIRTU_CM[kelas].nilai;

  const hasil: MaterialPendukung = {
    kelas,
    luasM2,
    pasirAlas: { tebalCm: pasirTebal, m3: bulat2(luasM2 * (pasirTebal / 100) * FAKTOR_PADAT.nilai) },
    sirtu: { tebalCm: sirtuTebal, m3: bulat2(luasM2 * (sirtuTebal / 100) * FAKTOR_PADAT.nilai) },
    abuNat: { m3: bulat2(luasM2 * ABU_NAT_M3_PER_M2.nilai * FAKTOR_SUSUT_ABU.nilai) },
    sementara: true,
  };

  if (opsi.kelilingM !== undefined) {
    cekNonNegatif("kelilingM", opsi.kelilingM);
    const panjangCm = opsi.kanstinPanjangCm ?? KANSTIN_PANJANG_CM.nilai;
    if (!(panjangCm > 0)) throw new RangeError(`kanstinPanjangCm harus > 0, diterima ${panjangCm}`);
    hasil.kanstin = {
      kelilingM: opsi.kelilingM,
      panjangCm,
      pcs: ceilAman((opsi.kelilingM * 100) / panjangCm),
    };
  }
  return hasil;
}
