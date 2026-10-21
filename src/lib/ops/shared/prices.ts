// Aturan harga untuk sopir: nominal rupiah tidak boleh sampai ke sopir. Dipakai server & klien.

/** Nomor HP (08xx / 62xx / +62xx, 10-13 digit setelah awalan) tidak boleh ikut disamarkan. */
const PHONE = /((?:\+62|\b62|\b0)8\d{8,11}\b)/;

const maskMoney = (text: string) =>
  text
    .replace(/\b(rp\.?|idr)\s*[\d.,]+(\s*(rb|ribu|jt|juta))?/gi, "Rp •••")
    .replace(/\b(harga|total|saldo|sisa|bayar|dibayar|dp|uang muka|ongkir|tagihan|tagih|nominal|cod|lunas|transfer)(\s*:?\s*)\d[\d.,]*(\s*(rb|ribu|jt|juta))?/gi, "$1$2•••")
    .replace(/\b\d+([.,]\d+)?\s*(rb|ribu|jt|juta)\b/gi, "•••")
    .replace(/\b\d{1,3}(\.\d{3}){2,}(,\d+)?\b/g, "•••")
    .replace(/\b\d{6,}\b(?=\s*(rupiah|perak|rp|idr|lunas|cod|tunai|cash|transfer)\b)/gi, "•••");

/**
 * Samarkan nominal uang di teks bebas (catatan PO, alasan batal, dll.) sebelum ditampilkan ke sopir.
 * Menangkap: "Rp 1.500.000", "IDR 2jt", kata kunci uang + angka ("harga 250rb", "DP: 1.000", "COD 1500000", "transfer 2jt"),
 * singkatan "150rb"/"3 juta", angka berformat ribuan >= 1.000.000, dan angka polos >= 6 digit yang diikuti konteks uang
 * ("1500000 rupiah"). Nomor HP dilewati.
 */
export const hidePrices = (text: string | null) => text?.split(PHONE).map((part, i) => (i % 2 ? part : maskMoney(part))).join("") ?? null;
