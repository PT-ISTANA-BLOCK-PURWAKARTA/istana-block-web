// Aturan harga untuk sopir: nominal rupiah tidak boleh sampai ke sopir. Dipakai server & klien.

/**
 * Samarkan nominal uang di teks bebas (catatan PO, alasan batal, dll.) sebelum ditampilkan ke sopir.
 * Menangkap: "Rp 1.500.000", "IDR 2jt", kata kunci uang + angka ("harga 250rb", "DP: 1.000"),
 * singkatan "150rb"/"3 juta", dan angka berformat ribuan >= 1.000.000.
 */
export const hidePrices = (text: string | null) => text?.replace(/\b(rp\.?|idr)\s*[\d.,]+(\s*(rb|ribu|jt|juta))?/gi, "Rp •••").replace(/\b(harga|total|saldo|sisa|bayar|dibayar|dp|uang muka|ongkir|tagihan|nominal)(\s*:?\s*)[\d.,]+(\s*(rb|ribu|jt|juta))?/gi, "$1$2•••").replace(/\b\d+([.,]\d+)?\s*(rb|ribu|jt|juta)\b/gi, "•••").replace(/\b\d{1,3}(\.\d{3}){2,}(,\d+)?\b/g, "•••") ?? null;
