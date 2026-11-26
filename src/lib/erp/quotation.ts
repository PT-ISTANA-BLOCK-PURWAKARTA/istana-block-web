// Data bersama Surat Penawaran (form klien + halaman server): tipe, contoh catatan, rekening.
export type QItem = { name: string; size: string; note: string; unit: string; price: string; quantity: string };
export type QTerm = { label: string; lines: string };
export type QuotationValue = {
  id?: string; number?: string; quoteDate: string; projectName: string; projectCity: string; customerName: string; customerAddress: string; customerPhone: string;
  attnName: string; attnPhone: string; work: string; location: string; items: QItem[]; terms: QTerm[]; bankName: string; bankAccount: string;
  signerId: string; signerName: string; signerTitle: string; customerSignTitle: string;
};
export type Signer = { id: number; name: string; title: string; hasSignature: boolean };

const lines = (...l: string[]) => l.join("\n");
export const TERM_TEMPLATES: { key: string; label: string; terms: QTerm[] }[] = [
  { key: "material", label: "Material dikirim (palet)", terms: [
    { label: "LINGKUNGAN PEKERJAAN", lines: "Harga di atas belum termasuk pengeluaran lapangan atau koordinasi lapangan" },
    { label: "HARGA DIATAS", lines: lines("Sewaktu-waktu bisa berubah", "Belum Termasuk PPN", "Belum Termasuk Bongkar") },
    { label: "PENGIRIMAN", lines: "Menggunakan Palet, 1 Palet isi 432 pcs" },
    { label: "CHARGE", lines: "Dikenakan Biaya Rp. 50.000/pcs Jika Palet Hilang" },
    { label: "PEMBAYARAN", lines: lines("Pembayaran dilakukan Dua Termin :", "1. Down Payment 30%", "2. Pembayaran Tahap Terakhir Sebelum Barang Di Bongkar") },
  ] },
  { key: "uditch", label: "U-Ditch (crane & truck)", terms: [
    { label: "LINGKUNGAN PEKERJAAN", lines: "Harga di atas belum termasuk pengeluaran lapangan atau koordinasi lapangan" },
    { label: "HARGA DIATAS", lines: lines("Sewaktu-waktu bisa berubah", "Belum Termasuk PPN", "Belum Termasuk Bongkar") },
    { label: "PENGIRIMAN", lines: "Menggunakan Crane Dan Armada Truck" },
    { label: "CHARGE", lines: "Dikenakan Biaya Rp. 30.000/Unit Setting U DITCH" },
    { label: "PEMBAYARAN", lines: lines("Pembayaran dilakukan Dua Termin :", "1. Down Payment 30%", "2. Pembayaran Tahap Terakhir Sebelum Barang Di Bongkar") },
  ] },
  { key: "proyek", label: "Proyek (3 termin + opname)", terms: [
    { label: "LINGKUNGAN PEKERJAAN", lines: "Harga di atas belum termasuk pengeluaran lapangan atau koordinasi lapangan" },
    { label: "HARGA DIATAS", lines: lines("Sewaktu-waktu bisa berubah", "Belum Termasuk PPN") },
    { label: "SPESIFIKASI TEKNIK", lines: "Sesuai gambar ataupun perintah penanggung jawab yang ada di lapangan setempat" },
    { label: "BELUM TERMASUK", lines: lines("Perubahan design atau konstruksi di lapangan", "Langsiran material dari bongkaran ke tempat pasang") },
    { label: "HASIL OPNAME", lines: "Volume di atas akan dihitung kembali berdasarkan hasil lapangan yang dihitung bersama dan disesuaikan dengan berita acara yang ditandatangani pelaksana lapangan" },
    { label: "DEPOSIT", lines: "Dilakukan deposit 30% dari jumlah nilai project" },
    { label: "PEMBAYARAN", lines: lines("Pembayaran dilakukan Tiga Termin :", "1. Down Payment 30%", "2. Pembayaran Tahap Ke 2 40%", "3. Pelunasan 30% Setelah Barang Terkirim Semua Sebelum Bongkar") },
  ] },
];
export const BANK_ACCOUNTS = [
  { name: "BCA A/N ISTANA BLOCK PURWAKARTA", account: "231 272 3434" },
  { name: "BCA A/N HAMAD SALIM HILABI", account: "231 322 3434" },
  { name: "BCA A/N MUHAMAD ABDULAH", account: "231 330 3900" },
] as const;
export const emptyItem = (): QItem => ({ name: "", size: "", note: "Terkirim", unit: "m2", price: "", quantity: "" });


export const QUOTATION_STATUS_LABEL: Record<string, string> = { draft: "Draft", terkirim: "Terkirim", diterima: "Diterima", ditolak: "Ditolak" };

/** Ubah baris penawaran tersimpan (JSON) menjadi isian form. */
export function quotationFormOf(q: {
  id: string; number: string; quoteDate: Date; projectName: string | null; projectCity: string | null; customerName: string; customerAddress: string | null; customerPhone: string | null;
  attnName: string | null; attnPhone: string | null; work: string | null; location: string | null; items: Record<string, unknown>[]; terms: Record<string, unknown>[];
  bankName: string | null; bankAccount: string | null; signerId: number | null; signerName: string | null; signerTitle: string | null; customerSignTitle: string | null;
}, copy: boolean, todayIso: string): QuotationValue {
  const day = new Date(q.quoteDate.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
  return {
    id: copy ? undefined : q.id, number: copy ? undefined : q.number, quoteDate: copy ? todayIso : day,
    projectName: q.projectName ?? "", projectCity: q.projectCity ?? "", customerName: q.customerName, customerAddress: q.customerAddress ?? "", customerPhone: q.customerPhone ?? "",
    attnName: q.attnName ?? "", attnPhone: q.attnPhone ?? "", work: q.work ?? "", location: q.location ?? "",
    items: q.items.map((i) => ({ name: String(i.name ?? ""), size: String(i.size ?? ""), note: String(i.note ?? ""), unit: String(i.unit ?? ""), price: i.price != null ? String(i.price) : "", quantity: i.quantity ? String(i.quantity) : "" })),
    terms: q.terms.map((t) => ({ label: String(t.label ?? ""), lines: Array.isArray(t.lines) ? (t.lines as string[]).join("\n") : String(t.lines ?? "") })),
    bankName: q.bankName ?? "", bankAccount: q.bankAccount ?? "", signerId: q.signerId ? String(q.signerId) : "", signerName: q.signerName ?? "", signerTitle: q.signerTitle ?? "", customerSignTitle: q.customerSignTitle ?? "PENANGGUNG JAWAB",
  };
}

export function emptyQuotation(todayIso: string): QuotationValue {
  return {
    quoteDate: todayIso, projectName: "", projectCity: "", customerName: "", customerAddress: "", customerPhone: "", attnName: "", attnPhone: "", work: "", location: "",
    items: [emptyItem()], terms: TERM_TEMPLATES[0].terms.map((t) => ({ ...t })), bankName: BANK_ACCOUNTS[0].name, bankAccount: BANK_ACCOUNTS[0].account,
    signerId: "", signerName: "", signerTitle: "", customerSignTitle: "PENANGGUNG JAWAB",
  };
}

export const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
/** Nomor surat penawaran: 01.236/IBP/XI/2026 (urut tetap, bulan & tahun dari tanggal surat). */
export const quotationNumber = (seq: number, day: string) => `01.${String(seq).padStart(3, "0")}/IBP/${ROMAN[Number(day.slice(5, 7)) - 1]}/${day.slice(0, 4)}`;
export const LAST_MANUAL_QUOTATION_SEQ = 235;
