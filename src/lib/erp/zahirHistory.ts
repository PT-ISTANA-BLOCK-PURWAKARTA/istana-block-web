// Histori dokumen Zahir (zh_docs, migrasi 0028): Penjualan, Pengiriman (DO), Pembelian, Penerimaan barang (PD)
// Jun–Okt 2026 dari laporan Rincian Zahir. Hanya baca; nilai pembukuan tetap dari jurnal Zahir yang ditautkan.
export const ZH_KINDS = {
  penjualan: { title: "Histori Penjualan Zahir", party: "Pelanggan", hub: "/akuntansi/menu/penjualan" },
  pengiriman: { title: "Histori Pengiriman Zahir", party: "Pelanggan", hub: "/akuntansi/menu/penjualan" },
  pembelian: { title: "Histori Pembelian Zahir", party: "Pemasok", hub: "/akuntansi/menu/pembelian" },
  penerimaan: { title: "Histori Penerimaan Barang Zahir", party: "Pemasok", hub: "/akuntansi/menu/pembelian" },
} as const;
export type ZhKind = keyof typeof ZH_KINDS;
export const isZhKind = (v: unknown): v is ZhKind => typeof v === "string" && v in ZH_KINDS;
