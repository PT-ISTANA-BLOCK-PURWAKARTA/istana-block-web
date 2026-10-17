/** Perhitungan total dokumen (dipakai editor di klien dan server action agar hasilnya sama). */

export type DocLineInput = { qty: number; price: number };

export function lineAmount(l: DocLineInput) {
  return Math.round(l.qty * l.price);
}

export function docTotals(lines: DocLineInput[], opts: { discount?: number; ongkir?: number; taxable?: boolean; taxRate?: number }) {
  const subtotal = lines.reduce((a, l) => a + lineAmount(l), 0);
  const discount = Math.max(0, Math.min(opts.discount ?? 0, subtotal));
  const ongkir = Math.max(0, opts.ongkir ?? 0);
  const dpp = subtotal - discount + ongkir;
  const tax = opts.taxable ? Math.round((dpp * (opts.taxRate ?? 0)) / 100) : 0;
  return { subtotal, discount, ongkir, dpp, tax, total: dpp + tax };
}
