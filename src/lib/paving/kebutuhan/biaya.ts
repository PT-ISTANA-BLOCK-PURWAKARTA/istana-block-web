import { ONGKIR_ZONA, TARIF_PASANG_PER_M2, LABEL_BEBAN, type KelasBeban } from "./konstanta-sementara";
import { cekNonNegatif } from "./util";

export interface BarisBiaya {
  kode: "ongkir" | "pasang" | "material";
  label: string;
  qty: number;
  satuan: string;
  hargaSatuan: number;
  subtotal: number;
  /** true bila hargaSatuan berasal dari konstanta sementara. */
  sementara: boolean;
}

export interface HasilBiaya {
  baris: BarisBiaya[];
  total: number;
}

export interface InputBiaya {
  trip: number;
  jarakKm: number;
  /** Luas pasang per kelas beban (m²). */
  pasang: Array<{ kelas: KelasBeban; luasM2: number }>;
  /** Opsional: total pcs dan harga per pcs dari pemilik (bukan konstanta sementara). */
  material?: { pcs: number; hargaPerPcs: number };
}

/** Ongkir per trip (Rp) menurut zona jarak (km). */
export function ongkirPerTrip(jarakKm: number): number {
  cekNonNegatif("jarakKm", jarakKm);
  const { zona, lebihKmTarif } = ONGKIR_ZONA.nilai;
  const z = zona.find((x) => jarakKm <= x.sampaiKm);
  if (z) return z.tarifPerTrip;
  const terakhir = zona[zona.length - 1];
  return terakhir.tarifPerTrip + Math.ceil(jarakKm - terakhir.sampaiKm) * lebihKmTarif;
}

export function hitungBiaya(input: InputBiaya): HasilBiaya {
  cekNonNegatif("trip", input.trip);
  const baris: BarisBiaya[] = [];

  if (input.material && input.material.pcs > 0) {
    const { pcs, hargaPerPcs } = input.material;
    cekNonNegatif("hargaPerPcs", hargaPerPcs);
    baris.push({
      kode: "material", label: "Paving", qty: pcs, satuan: "pcs",
      hargaSatuan: hargaPerPcs, subtotal: Math.round(pcs * hargaPerPcs), sementara: false,
    });
  }

  if (input.trip > 0) {
    const tarif = ongkirPerTrip(input.jarakKm);
    baris.push({
      kode: "ongkir", label: `Ongkir (${input.jarakKm} km)`, qty: input.trip, satuan: "trip",
      hargaSatuan: tarif, subtotal: tarif * input.trip, sementara: true,
    });
  }

  for (const p of input.pasang) {
    cekNonNegatif("luasM2", p.luasM2);
    if (p.luasM2 === 0) continue;
    const tarif = TARIF_PASANG_PER_M2[p.kelas].nilai;
    baris.push({
      kode: "pasang", label: `Jasa pasang (${LABEL_BEBAN[p.kelas].toLowerCase()})`, qty: p.luasM2, satuan: "m²",
      hargaSatuan: tarif, subtotal: Math.round(p.luasM2 * tarif), sementara: true,
    });
  }

  return { baris, total: baris.reduce((a, b) => a + b.subtotal, 0) };
}
