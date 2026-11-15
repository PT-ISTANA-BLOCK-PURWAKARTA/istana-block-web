// Perhitungan form "Hasil Uji Kuat Tekan Beton" (Lab Istana Block Purwakarta).

/** 1 kN = 101,97 kgf. Kekuatan (kg/cm²) = tekanan maksimum (kN) × 101,97 ÷ luas bidang (cm²). */
export const KGF_PER_KN = 101.97162;

/**
 * Tabel "STANDARISASI" pada form (mutu K-350): 3 hari 160, 14 hari 308, 21 hari 336, 28 hari 350 kg/cm².
 * Disimpan sebagai rasio terhadap kuat tekan 28 hari agar berlaku untuk mutu lain (K-300, K-400, ...).
 */
export const STANDARD_AGE_RATIOS: { days: number; ratio: number }[] = [
  { days: 3, ratio: 160 / 350 },
  { days: 14, ratio: 308 / 350 },
  { days: 21, ratio: 336 / 350 },
  { days: 28, ratio: 1 },
];

/** Luas bidang benda uji pada tabel standar form (759,50 kN ↔ 350 kg/cm²). */
export const STANDARD_AREA_CM2 = (759.5 * KGF_PER_KN) / 350;

export function strengthKgCm2(maxLoadKn: number | null | undefined, areaCm2: number | null | undefined) {
  if (!maxLoadKn || !areaCm2 || areaCm2 <= 0) return null;
  return (maxLoadKn * KGF_PER_KN) / areaCm2;
}

/** "K-350" / "K 350" / "350" → 350 (kuat tekan karakteristik 28 hari, kg/cm²). */
export function gradeValue(grade: string | null | undefined) {
  const match = String(grade ?? "").match(/(\d+(?:[.,]\d+)?)/);
  return match ? Number(match[1].replace(",", ".")) : null;
}

/** Rasio kuat tekan pada umur tertentu, interpolasi linier antar titik tabel standar. */
export function ageRatio(days: number) {
  const table = STANDARD_AGE_RATIOS;
  if (days <= 0) return 0;
  if (days <= table[0].days) return table[0].ratio * (days / table[0].days);
  for (let i = 1; i < table.length; i++) {
    const previous = table[i - 1];
    const next = table[i];
    if (days <= next.days) return previous.ratio + ((next.ratio - previous.ratio) * (days - previous.days)) / (next.days - previous.days);
  }
  return 1;
}

export function ageDays(madeAt: Date | string | null | undefined, testedAt: Date | string | null | undefined) {
  if (!madeAt || !testedAt) return null;
  const day = (value: Date | string) => { const date = new Date(value); return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()); };
  return Math.round((day(testedAt) - day(madeAt)) / 86_400_000);
}

export function targetStrength(grade: string | null | undefined, days: number | null) {
  const value = gradeValue(grade);
  if (!value || days === null) return null;
  return value * ageRatio(days);
}

/** Tabel standar untuk mutu & luas bidang tertentu (kolom UMUR / TEKANAN MAKSIMUM / KEKUATAN). */
export function standardTable(grade: string | null | undefined, areaCm2 = STANDARD_AREA_CM2) {
  const value = gradeValue(grade);
  if (!value) return [];
  return STANDARD_AGE_RATIOS.map(({ days, ratio }) => {
    const strength = value * ratio;
    return { days, strength, maxLoadKn: (strength * areaCm2) / KGF_PER_KN };
  });
}

export type SampleResult = { ageDays: number | null; strength: number | null; target: number | null; passed: boolean | null };

export function evaluateSample(grade: string, sample: { madeAt?: Date | string | null; testedAt?: Date | string | null; maxLoadKn?: number | null; areaCm2?: number | null }): SampleResult {
  const days = ageDays(sample.madeAt, sample.testedAt);
  const strength = strengthKgCm2(sample.maxLoadKn, sample.areaCm2);
  const target = targetStrength(grade, days);
  // Bandingkan pada 2 desimal (seperti yang tercetak), agar 308,00 vs target 308,00 dihitung memenuhi.
  const round2 = (value: number) => Math.round(value * 100) / 100;
  return { ageDays: days, strength, target, passed: strength !== null && target !== null ? round2(strength) >= round2(target) : null };
}

export type BatchAverage = {
  batch: string;
  name: string;
  testedAt: Date | string | null | undefined;
  indexes: number[];
  strengths: number[];
  loads: number[];
  ageDays: number | null;
  target: number | null;
  count: number;
  strength: number | null;
  maxLoadKn: number | null;
  passed: boolean | null;
};

/**
 * Rata-rata per batch & fase umur: benda uji dengan batch (atau nama bila batch kosong) dan tanggal uji sama.
 * Hanya kelompok ≥ 2 benda uji. Hasil memenuhi bila rata-rata kekuatan ≥ target umur.
 */
export function batchAverages(
  grade: string,
  samples: { batchCode?: string | null; sampleName: string; madeAt?: Date | string | null; testedAt?: Date | string | null; maxLoadKn?: number | null; areaCm2?: number | null }[],
): BatchAverage[] {
  const day = (value: Date | string | null | undefined) => {
    if (!value) return "";
    if (typeof value === "string") return value.slice(0, 10);
    return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  };
  const groups = new Map<
    string,
    { batch: string; name: string; testedAt: Date | string | null | undefined; indexes: number[]; strengths: number[]; loads: number[]; ageDays: number | null; target: number | null }
  >();
  samples.forEach((sample, index) => {
    const label = sample.batchCode?.trim() || sample.sampleName.trim();
    if (!label) return;
    const key = `${label.toLowerCase()}|${day(sample.testedAt)}`;
    const result = evaluateSample(grade, sample);
    const group = groups.get(key) ?? {
      batch: sample.batchCode?.trim() ?? "",
      name: sample.sampleName.trim(),
      testedAt: sample.testedAt,
      indexes: [],
      strengths: [],
      loads: [],
      ageDays: result.ageDays,
      target: result.target,
    };
    group.indexes.push(index);
    if (result.strength !== null) group.strengths.push(result.strength);
    if (sample.maxLoadKn) group.loads.push(sample.maxLoadKn);
    groups.set(key, group);
  });
  const mean = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);
  const round2 = (value: number) => Math.round(value * 100) / 100;
  return [...groups.values()]
    .filter((group) => group.indexes.length >= 2)
    .map((group) => {
      const strength = mean(group.strengths);
      return {
        ...group,
        count: group.indexes.length,
        strength,
        maxLoadKn: mean(group.loads),
        passed: strength !== null && group.target !== null ? round2(strength) >= round2(group.target) : null,
      };
    });
}

