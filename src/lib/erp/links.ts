/** Tautan ke dokumen asal sebuah jurnal (aman di klien). */
export const SOURCE_LABEL: Record<string, string> = {
  manual: "Jurnal umum",
  faktur: "Faktur penjualan",
  penerimaan: "Penerimaan",
  pembelian: "Faktur pembelian",
  pembayaran: "Pembayaran",
  kas: "Kas & bank",
  pengiriman: "Surat jalan",
  produksi: "Hasil produksi",
  penyesuaian: "Penyesuaian stok",
};

export function sourceHref(source: string, sourceId: string | null, journalId: string) {
  if (!sourceId) return `/akuntansi/jurnal/${journalId}`;
  switch (source) {
    case "faktur":
      return `/akuntansi/penjualan/${sourceId}`;
    case "penerimaan":
      return `/akuntansi/penerimaan/${sourceId}`;
    case "pembelian":
      return `/akuntansi/pembelian/${sourceId}`;
    case "pembayaran":
      return `/akuntansi/pembayaran/${sourceId}`;
    case "kas":
      return `/akuntansi/kas/${sourceId}`;
    case "pengiriman":
      return `/operasional/pengiriman/${sourceId}`;
    case "produksi":
      return `/operasional/produksi/${sourceId}`;
    case "penyesuaian":
      return `/operasional/stok/penyesuaian/${sourceId}`;
    default:
      return `/akuntansi/jurnal/${journalId}`;
  }
}
