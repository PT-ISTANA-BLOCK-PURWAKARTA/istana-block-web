// Nilai awal formulir uji kuat tekan (dipakai halaman server dan komponen klien; bukan modul "use client").
import type { MaterialLine } from "@/db/erp";
import { STANDARD_AREA_CM2 } from "@/lib/ops/shared/strength";
import { numText } from "./labels";

export type SampleInitial = { sampleName: string; madeAt: string; testedAt: string; weightKg: string; areaCm2: string; maxLoadKn: string };
export type StrengthInitial = {
  id?: string;
  reportDate: string;
  companyName: string;
  address: string;
  concreteGrade: string;
  addressedTo: string;
  composition: MaterialLine[];
  notes: string;
  samples: SampleInitial[];
};

/** Luas bidang bawaan (cm²) seperti pada tabel standar form. */
export const defaultArea = () => numText(Math.round(STANDARD_AREA_CM2 * 100) / 100);

export const emptySample = (testedAt: string, prev?: SampleInitial): SampleInitial => ({
  sampleName: prev?.sampleName ?? "",
  madeAt: prev?.madeAt ?? "",
  testedAt: prev?.testedAt || testedAt,
  weightKg: "",
  areaCm2: prev?.areaCm2 || defaultArea(),
  maxLoadKn: "",
});

export const newStrength = (reportDate: string, composition: MaterialLine[]): StrengthInitial => ({
  reportDate, companyName: "", address: "", concreteGrade: "K-350", addressedTo: "", composition, notes: "", samples: [emptySample(reportDate)],
});
