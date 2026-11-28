// Invoice penjualan (padanan invoice app lama, tabel ops_sales_invoices): penerbit, nomor, status, hitungan total.

export const INVOICE_ISSUERS = [
  { key: "ib", label: "PT. Istana Block Purwakarta", prefix: "IN-IB-" },
  { key: "ibn", label: "CV. Istana Bangun Nusantara", prefix: "IN-IBN-" },
  { key: "polos", label: "Tanpa kop (kosongan)", prefix: "IN-K-" },
  { key: "eib", label: "Ekspedisi Istana Block", prefix: "IN-EIB-" },
  // Invoice U-Ditch: tetap PT. Istana Block (kop sama), dibedakan judul INVOICE U-DITCH & nomor sendiri; pembukuan terpisah dari IB.
  { key: "ud", label: "PT. Istana Block · U-Ditch", prefix: "IN-UD-" },
] as const;
export const issuerOf = (key: string | null | undefined) => INVOICE_ISSUERS.find((i) => i.key === key) ?? INVOICE_ISSUERS[0];
/** Nomor invoice manual terakhir sebelum memakai aplikasi: IN-IB-0001256 (22 Sep 2026). */
export const LAST_MANUAL_INVOICE_SEQ = 1256;
export const invoiceNumber = (seq: number, issuer = "ib") => `${issuerOf(issuer).prefix}${String(seq).padStart(7, "0")}`;

export const INVOICE_STATUS_LABEL: Record<string, string> = { draft: "Draft", terkirim: "Terkirim", dp: "DP", lunas: "Lunas", batal: "Batal" };
export const PAYMENT_METHODS = ["Transfer BCA Istana Block", "Transfer BCA Hamad Salim Hilabi", "Transfer BCA Muhamad Abdulah", "Transfer BCA Cepi", "Tunai", "Lainnya"];
export const INVOICE_NOTE = "Barang yang sudah dibeli tidak dapat dikembalikan atau ditukar";
export const EIB_BANK = { name: "BCA A/N CEPI SEPTIAN KUSUMAH", account: "2313318109" } as const;
/** Cara bayar Invoice U-Ditch: masuk saldo Lina di Operational U-Ditch (tunai → Cash Lina, selain itu → TF Lina). */
export const UDITCH_PAYMENT_METHODS = ["Transfer BCA Muhamad Abdulah (TF Lina)", "Tunai (Cash Lina)", "Lainnya"];
/** Rekening invoice U-Ditch (dipakai invoice U-Ditch IN-IB-0001273/1275/1283/1284 sebelumnya). */
export const UDITCH_BANK = { name: "BCA A/N MUHAMAD ABDULAH", account: "231 330 3900" } as const;

export type InvoiceLine = { name: string; unit: string; quantity: number; price: number; plateNumber?: string; driverName?: string; cargo?: string };

/** Total → PPN → Grand total → uang muka (nominal, atau persen dari grand total) → sisa. Dibulatkan ke rupiah. */
export function invoiceTotals(items: InvoiceLine[], ppnPercent: number, downPaymentPercent: number | null, downPaymentAmount: number | null = null) {
  const total = Math.round(items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.price) || 0), 0));
  const ppn = Math.round((total * (ppnPercent || 0)) / 100);
  const grandTotal = total + ppn;
  const downPayment = downPaymentAmount ? Math.min(grandTotal, Math.round(downPaymentAmount)) : downPaymentPercent ? Math.round((grandTotal * downPaymentPercent) / 100) : null;
  return { total, ppn, grandTotal, downPayment, remaining: downPayment === null ? null : grandTotal - downPayment };
}

export type InvoiceFormValue = {
  id?: string; number: string; issuer: string; invoiceDate: string; quotationId: string; customerName: string; customerAddress: string; customerPhone: string; poNumber: string;
  items: { name: string; unit: string; quantity: string; price: string; plateNumber?: string; driverName?: string; cargo?: string }[]; route?: string; shipDate?: string; ppnPercent: string; dpMode: "none" | "persen" | "nominal"; downPaymentPercent: string; downPaymentAmount: string;
  note: string; bankName: string; bankAccount: string; signerId: string; signerName: string;
};

export const wibDay = (d: Date) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
