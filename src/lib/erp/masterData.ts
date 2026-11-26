// Konfigurasi halaman data induk (Zahir: Satuan Pengukuran, Data Pajak, Data Departemen, Data Proyek). Aman di klien.
export type MasterKind = "satuan" | "pajak" | "departemen" | "proyek";
export type MasterField = { name: string; label: string; type: "text" | "number" | "money" | "date" | "select" | "check"; required?: boolean; options?: "accounts" | "contacts" | "status"; full?: boolean; help?: string };

export const MASTER: Record<MasterKind, { title: string; sub: string; table: string; fields: MasterField[] }> = {
  satuan: {
    title: "Satuan Pengukuran",
    sub: "Daftar satuan barang (pcs, m², m³, kg, zak, rit…) yang dipakai di faktur, retur dan pesanan.",
    table: "fin_units",
    fields: [
      { name: "code", label: "Kode satuan", type: "text", required: true },
      { name: "name", label: "Nama", type: "text", required: true },
      { name: "note", label: "Catatan", type: "text", full: true },
      { name: "active", label: "Aktif", type: "check" },
    ],
  },
  pajak: {
    title: "Data Pajak",
    sub: "Jenis pajak dan rekeningnya. Tarif PPN yang dipakai faktur tetap diatur di Pengaturan Keuangan.",
    table: "fin_taxes",
    fields: [
      { name: "code", label: "Kode pajak", type: "text", required: true },
      { name: "name", label: "Nama pajak", type: "text", required: true },
      { name: "rate", label: "Tarif (%)", type: "number", required: true },
      { name: "salesAccountId", label: "Rekening pajak penjualan (keluaran)", type: "select", options: "accounts" },
      { name: "purchaseAccountId", label: "Rekening pajak pembelian (masukan)", type: "select", options: "accounts" },
      { name: "note", label: "Catatan", type: "text", full: true },
      { name: "active", label: "Aktif", type: "check" },
    ],
  },
  departemen: {
    title: "Data Departemen",
    sub: "Bagian usaha (mis. Paving, Genteng, U-Ditch, Kantor). Bisa dipilih di Jurnal Umum dan Kas untuk laporan per departemen.",
    table: "fin_departments",
    fields: [
      { name: "code", label: "Kode", type: "text", required: true },
      { name: "name", label: "Nama departemen", type: "text", required: true },
      { name: "note", label: "Catatan", type: "text", full: true },
      { name: "active", label: "Aktif", type: "check" },
    ],
  },
  proyek: {
    title: "Data Proyek",
    sub: "Proyek (mis. pemasangan U-Ditch, WIP proyek pelanggan). Pilih proyek di Jurnal Umum / Kas, lalu lihat Laba Rugi Proyek.",
    table: "fin_projects",
    fields: [
      { name: "code", label: "Kode proyek", type: "text", required: true },
      { name: "name", label: "Nama proyek", type: "text", required: true },
      { name: "contactId", label: "Pelanggan", type: "select", options: "contacts" },
      { name: "location", label: "Lokasi", type: "text" },
      { name: "startDate", label: "Mulai", type: "date" },
      { name: "endDate", label: "Selesai", type: "date" },
      { name: "budget", label: "Nilai kontrak / anggaran (Rp)", type: "money" },
      { name: "status", label: "Status", type: "select", options: "status" },
      { name: "note", label: "Catatan", type: "text", full: true },
      { name: "active", label: "Aktif", type: "check" },
    ],
  },
};
export const isMasterKind = (s: string): s is MasterKind => s in MASTER;
export const PO_STATUS: Record<string, string> = { draft: "Draft", dikirim: "Dikirim ke pemasok", diterima: "Barang diterima", selesai: "Selesai", batal: "Batal" };
