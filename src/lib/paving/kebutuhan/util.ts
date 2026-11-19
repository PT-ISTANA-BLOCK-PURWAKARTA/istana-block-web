/** Pembulatan ke atas yang kebal galat floating point (mis. 3.0000000000000004 -> 3). */
export function ceilAman(x: number): number {
  return Math.ceil(x - 1e-9) || 0; // || 0 membuang -0
}

export function bulat2(x: number): number {
  return Math.round(x * 100) / 100;
}

/** Lempar RangeError bila angka bukan bilangan hingga >= 0. */
export function cekNonNegatif(nama: string, v: number): number {
  if (!Number.isFinite(v) || v < 0) throw new RangeError(`${nama} harus bilangan >= 0, diterima ${v}`);
  return v;
}
