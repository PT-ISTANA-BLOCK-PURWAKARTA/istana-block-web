// Susunan menu ubin (gaya Zahir Accounting 6, disegarkan) dan katalog Pusat Laporan.
// Ubin/laporan tanpa `href` = fitur Zahir yang belum ada di web → tampil terkunci dengan label "Segera".
import type { IconName } from "@/components/panel/Icon";

export type TileColor = "blue" | "navy" | "red" | "crimson" | "lime" | "green" | "purple" | "salmon" | "brown" | "cyan" | "orange";
export type Tile = { label: string; href?: string; icon: IconName; color: TileColor; w?: 1 | 2; h?: 1 | 2; note?: string };
export type Hub = { slug: string; title: string; sub: string; tiles: Tile[] };

export const HUBS: Hub[] = [
  {
    slug: "data",
    title: "Data-Data",
    sub: "Data induk: nama alamat, rekening perkiraan, produk.",
    tiles: [
      { label: "Data Nama Alamat", href: "/akuntansi/kontak", icon: "users", color: "blue", w: 2 },
      { label: "Data Rekening", href: "/akuntansi/akun", icon: "list", color: "red" },
      { label: "Data Mata Uang", icon: "cash", color: "navy", note: "Rupiah saja" },
      { label: "Data Proyek", icon: "clipboard", color: "green" },
      { label: "Data Produk", href: "/akuntansi/barang", icon: "box", color: "crimson", h: 2 },
      { label: "Satuan Pengukuran", icon: "adjust", color: "lime" },
      { label: "Data Pajak", icon: "doc", color: "purple" },
      { label: "Data Departemen", icon: "id", color: "salmon" },
      { label: "Data Gudang", href: "/operasional/stok", icon: "stack", color: "brown" },
      { label: "Data Harta Tetap", href: "/akuntansi/harta-tetap", icon: "factory", color: "cyan" },
    ],
  },
  {
    slug: "buku-besar",
    title: "Buku Besar",
    sub: "Rekening perkiraan, jurnal umum, buku besar dan neraca saldo.",
    tiles: [
      { label: "Daftar Rekening Perkiraan", href: "/akuntansi/akun", icon: "list", color: "red" },
      { label: "Buku Besar", href: "/akuntansi/laporan/buku-besar", icon: "ledger", color: "blue", w: 2 },
      { label: "Neraca Saldo", href: "/akuntansi/laporan/neraca-saldo", icon: "adjust", color: "navy" },
      { label: "Transaksi Jurnal Umum", href: "/akuntansi/jurnal/baru", icon: "book", color: "lime", w: 2 },
      { label: "Daftar Jurnal", href: "/akuntansi/jurnal", icon: "doc", color: "blue" },
      { label: "Kunci Periode", href: "/akuntansi/pengaturan", icon: "lock", color: "purple" },
      { label: "Anggaran", href: "/akuntansi/anggaran", icon: "chart", color: "salmon" },
      { label: "Jejak Audit", href: "/akuntansi/laporan/jejak-audit", icon: "shield", color: "crimson" },
      { label: "Neraca - 12 Bulan", href: "/akuntansi/laporan/neraca-12", icon: "ledger", color: "brown" },
      { label: "Laba Rugi - 12 Bulan", href: "/akuntansi/laporan/laba-rugi-12", icon: "report", color: "cyan" },
    ],
  },
  {
    slug: "penjualan",
    title: "Penjualan",
    sub: "Dari penawaran harga sampai pembayaran piutang.",
    tiles: [
      { label: "Penawaran Harga", href: "/operasional/penawaran", icon: "mail", color: "blue" },
      { label: "Order Penjualan", href: "/operasional/pesanan", icon: "clipboard", color: "navy" },
      { label: "Pengiriman Barang (Penjualan)", href: "/operasional/pengiriman", icon: "truck", color: "red", w: 2 },
      { label: "Invoice Penjualan", href: "/akuntansi/penjualan", icon: "invoice", color: "lime", w: 2 },
      { label: "Piutang Usaha", href: "/akuntansi/laporan/piutang", icon: "book", color: "crimson" },
      { label: "Pembayaran Piutang Usaha", href: "/akuntansi/penerimaan", icon: "receive", color: "purple" },
      { label: "Uang Muka Penjualan", href: "/akuntansi/uang-muka", icon: "pay", color: "salmon" },
      { label: "Retur Penjualan", href: "/akuntansi/retur", icon: "undo", color: "brown" },
      { label: "Kartu Piutang", href: "/akuntansi/laporan/kartu?jenis=piutang", icon: "ledger", color: "green" },
      { label: "Pengembalian Kelebihan (Kredit)", href: "/akuntansi/uang-muka#kembali", icon: "send", color: "cyan" },
    ],
  },
  {
    slug: "pembelian",
    title: "Pembelian",
    sub: "Penerimaan barang, faktur pemasok dan pembayaran hutang.",
    tiles: [
      { label: "Permintaan Penawaran", icon: "mail", color: "blue" },
      { label: "Pesanan Pembelian", icon: "clipboard", color: "navy" },
      { label: "Order Pembelian", icon: "cart", color: "red" },
      { label: "Penerimaan Barang Pembelian", href: "/operasional/barang-masuk", icon: "truck", color: "navy" },
      { label: "Invoice Pembelian", href: "/akuntansi/pembelian", icon: "cart", color: "lime", w: 2 },
      { label: "Hutang Usaha", href: "/akuntansi/laporan/hutang", icon: "book", color: "crimson" },
      { label: "Pembayaran Hutang Usaha", href: "/akuntansi/pembayaran", icon: "pay", color: "purple" },
      { label: "Uang Muka Pembelian", href: "/akuntansi/uang-muka?jenis=pembelian", icon: "receive", color: "salmon" },
      { label: "Retur Pembelian", href: "/akuntansi/retur?jenis=pembelian", icon: "undo", color: "brown" },
      { label: "Kartu Hutang", href: "/akuntansi/laporan/kartu?jenis=hutang", icon: "ledger", color: "green" },
      { label: "Penerimaan Kembalian (Debit)", href: "/akuntansi/uang-muka?jenis=pembelian#kembali", icon: "send", color: "cyan" },
    ],
  },
  {
    slug: "kas-bank",
    title: "Kas & Bank",
    sub: "Kas masuk, kas keluar, transfer dan rekonsiliasi bank.",
    tiles: [
      { label: "Kas Keluar", href: "/akuntansi/kas/baru?jenis=keluar", icon: "pay", color: "blue", h: 2 },
      { label: "Kas Masuk", href: "/akuntansi/kas/baru?jenis=masuk", icon: "receive", color: "navy", h: 2 },
      { label: "Transfer Kas", href: "/akuntansi/kas/baru?jenis=transfer", icon: "adjust", color: "purple", w: 2 },
      { label: "Giro Masuk", href: "/akuntansi/giro", icon: "doc", color: "lime" },
      { label: "Giro Keluar", href: "/akuntansi/giro?jenis=keluar", icon: "doc", color: "crimson" },
      { label: "Rekonsiliasi Bank", href: "/akuntansi/kas/rekonsiliasi", icon: "checkCheck", color: "salmon", w: 2 },
      { label: "Daftar Kas & Bank", href: "/akuntansi/kas", icon: "cash", color: "cyan", w: 2 },
    ],
  },
  {
    slug: "persediaan",
    title: "Persediaan",
    sub: "Produk, stok per gudang, opname, pindah barang dan produksi.",
    tiles: [
      { label: "Data Produk", href: "/akuntansi/barang", icon: "box", color: "red" },
      { label: "Pemakaian / Penyesuaian Barang", href: "/operasional/stok", icon: "stack", color: "green" },
      { label: "Pindah Barang", href: "/operasional/transfer-stok", icon: "truckGo", color: "purple" },
      { label: "Rencana Pesanan", href: "/operasional/rencana-pesanan", icon: "calendar", color: "lime" },
      { label: "Stock Opname", href: "/operasional/stok", icon: "checkCheck", color: "orange" },
      { label: "Produksi", href: "/operasional/produksi", icon: "factory", color: "blue" },
      
      
      { label: "Barang Masuk", href: "/operasional/barang-masuk", icon: "inbox", color: "orange" },
      { label: "Target Produksi", href: "/operasional/target-produksi", icon: "award", color: "cyan" },
      
      
    ],
  },
  {
    slug: "lainnya",
    title: "Lainnya",
    sub: "Gaji, kasbon karyawan, pengaturan keuangan dan akun.",
    tiles: [
      { label: "Gaji & Slip Gaji", href: "/akuntansi/gaji", icon: "report", color: "blue", w: 2 },
      { label: "Kasbon Karyawan", href: "/akuntansi/kasbon", icon: "cash", color: "orange" },
      { label: "Pengaturan Keuangan", href: "/akuntansi/pengaturan", icon: "gear", color: "navy" },
      { label: "Anggaran", href: "/akuntansi/anggaran", icon: "chart", color: "salmon" },
      { label: "Harta Tetap", href: "/akuntansi/harta-tetap", icon: "factory", color: "cyan" },
      { label: "Akun Saya", href: "/akuntansi/profil", icon: "user", color: "purple" },
    ],
  },
];

export const hubBySlug = (slug: string) => HUBS.find((h) => h.slug === slug);

/* ---------------- Pusat Laporan ---------------- */
export type ReportLink = { label: string; href?: string };
export type ReportTab = { name: string; items: ReportLink[] };
export type ReportCat = { key: string; label: string; icon: IconName; color: TileColor; tabs: ReportTab[] };

const ys = () => `${new Date().getFullYear()}-01-01`;

export const REPORT_CATS: ReportCat[] = [
  {
    key: "keuangan",
    label: "Laporan Keuangan",
    icon: "chart",
    color: "blue",
    tabs: [
      {
        name: "Laporan Keuangan",
        items: [
          { label: "Arus Kas - Rangkuman", href: "/akuntansi/laporan/arus-kas" },
          { label: "Arus Kas - Rincian", href: "/akuntansi/laporan/arus-kas-rincian" },
          { label: "Grafik - Laba Rugi - 12 Bulan", href: "/akuntansi" },
          { label: "Laba Rugi - 12 Bulan", href: "/akuntansi/laporan/laba-rugi-12" },
          { label: "Laba Rugi - Anggaran vs Realisasi", href: "/akuntansi/laporan/anggaran?jenis=lr" },
          { label: "Laba Rugi - Perbandingan 2 Kolom", href: "/akuntansi/laporan/laba-rugi" },
          { label: "Laba Rugi - Years to Date", href: `/akuntansi/laporan/laba-rugi?from=${ys()}` },
          { label: "Laba Rugi Standar", href: "/akuntansi/laporan/laba-rugi" },
          { label: "Neraca - 12 Bulan", href: "/akuntansi/laporan/neraca-12" },
          { label: "Neraca - Anggaran vs Realisasi", href: "/akuntansi/laporan/anggaran?jenis=neraca" },
          { label: "Neraca - Perbandingan 2 Kolom", href: "/akuntansi/laporan/neraca" },
          { label: "Neraca Saldo", href: "/akuntansi/laporan/neraca-saldo" },
          { label: "Neraca Standar", href: "/akuntansi/laporan/neraca" },
        ],
      },
      {
        name: "Buku Besar",
        items: [
          { label: "Buku Besar - Standar", href: "/akuntansi/laporan/buku-besar" },
          { label: "Buku Besar - Mutasi", href: "/akuntansi/laporan/buku-besar-mutasi" },
          { label: "Daftar Jurnal - Semua Transaksi", href: "/akuntansi/jurnal" },
          { label: "Daftar Rekening", href: "/akuntansi/akun" },
          { label: "Jejak Audit - Rangkuman", href: "/akuntansi/laporan/jejak-audit" },
          { label: "Jejak Audit - Rincian", href: "/akuntansi/laporan/jejak-audit?mode=rincian" },
          { label: "Jurnal Umum", href: "/akuntansi/jurnal" },
        ],
      },
      {
        name: "Kas Dan Bank",
        items: [
          { label: "Jurnal - Kas Keluar", href: "/akuntansi/kas?jenis=keluar" },
          { label: "Jurnal - Kas Masuk", href: "/akuntansi/kas?jenis=masuk" },
          { label: "Jurnal - Transfer Kas", href: "/akuntansi/kas?jenis=transfer" },
          { label: "Rekonsiliasi Bank", href: "/akuntansi/kas/rekonsiliasi" },
        ],
      },
    ],
  },
  {
    key: "penjualan",
    label: "Laporan Penjualan dan Piutang",
    icon: "invoice",
    color: "navy",
    tabs: [
      {
        name: "Penjualan",
        items: [
          { label: "eFaktur Penjualan" },
          { label: "Jurnal - Penjualan", href: "/akuntansi/penjualan" },
          { label: "Penawaran Harga - Rangkuman", href: "/operasional/penawaran" },
          { label: "Pengiriman Barang - Rangkuman", href: "/operasional/pengiriman" },
          { label: "Pengiriman Barang - Status", href: "/operasional/muatan" },
          { label: "Penjualan - Rangkuman", href: "/akuntansi/laporan/penjualan" },
          { label: "Penjualan Per Pelanggan - Rangkuman", href: "/akuntansi/laporan/per-kontak?jenis=penjualan" },
          { label: "Penjualan Per Pelanggan - Rincian", href: "/akuntansi/laporan/per-kontak?jenis=penjualan&rinci=1" },
          { label: "Penjualan Per Barang", href: "/akuntansi/laporan/penjualan" },
          { label: "Penjualan Per Salesman" },
          { label: "Retur Penjualan - Rangkuman", href: "/akuntansi/retur" },
          { label: "Rekap Pelanggan", href: "/operasional/rekap-pelanggan" },
        ],
      },
      {
        name: "Piutang Usaha",
        items: [
          { label: "Kartu Piutang - Mata Uang Dasar", href: "/akuntansi/laporan/kartu?jenis=piutang" },
          { label: "Mutasi Piutang - Mata Uang Dasar", href: "/akuntansi/laporan/kartu?jenis=piutang&mode=mutasi" },
          { label: "Pembayaran Pelanggan - Mata Uang Dasar", href: "/akuntansi/penerimaan" },
          { label: "Piutang Usaha Per Pelanggan - Rincian", href: "/akuntansi/laporan/piutang" },
          { label: "Piutang Usaha Per Salesman" },
          { label: "Surat Tagihan Untuk Pelanggan" },
        ],
      },
    ],
  },
  {
    key: "pembelian",
    label: "Laporan Pembelian Hutang",
    icon: "cart",
    color: "green",
    tabs: [
      {
        name: "Pembelian",
        items: [
          { label: "Jurnal - Pembelian", href: "/akuntansi/pembelian" },
          { label: "Pembelian - Rangkuman", href: "/akuntansi/pembelian" },
          { label: "Pembelian per Pemasok - Rangkuman", href: "/akuntansi/laporan/per-kontak?jenis=pembelian" },
          { label: "Pembelian per Pemasok - Rincian", href: "/akuntansi/laporan/per-kontak?jenis=pembelian&rinci=1" },
          { label: "Penerimaan Barang Pembelian", href: "/operasional/barang-masuk" },
          { label: "Pesanan Pembelian - Rangkuman" },
          { label: "Retur Pembelian - Rangkuman", href: "/akuntansi/retur?jenis=pembelian" },
          { label: "Uang Muka Pemasok", href: "/akuntansi/uang-muka?jenis=pembelian" },
        ],
      },
      {
        name: "Hutang Usaha",
        items: [
          { label: "Kartu Hutang - Mata Uang Dasar", href: "/akuntansi/laporan/kartu?jenis=hutang" },
          { label: "Mutasi Hutang - Mata Uang Dasar", href: "/akuntansi/laporan/kartu?jenis=hutang&mode=mutasi" },
          { label: "Pembayaran Hutang - Mata Uang Dasar", href: "/akuntansi/pembayaran" },
          { label: "Rangkuman Hutang - Mata Uang Dasar", href: "/akuntansi/laporan/hutang" },
          { label: "Rincian Hutang - Mata Uang Dasar", href: "/akuntansi/laporan/hutang" },
        ],
      },
    ],
  },
  {
    key: "barang",
    label: "Laporan Barang",
    icon: "box",
    color: "orange",
    tabs: [
      {
        name: "Persediaan",
        items: [
          { label: "Barang Terjual", href: "/akuntansi/laporan/penjualan" },
          { label: "Daftar Barang - Umum", href: "/akuntansi/barang" },
          { label: "Daftar Barang Per Gudang", href: "/operasional/stok" },
          { label: "Daftar Harga Jual Barang", href: "/akuntansi/barang" },
          { label: "Formulir Stok Opname", href: "/operasional/stok" },
          { label: "Kartu Stok - Umum" },
          { label: "Mutasi Barang Per Gudang", href: "/operasional/transfer-stok" },
          { label: "Transaksi Persediaan - Produksi", href: "/operasional/produksi" },
          { label: "Barang Keluar (Muatan)", href: "/operasional/muatan" },
        ],
      },
      {
        name: "Analisa Produk",
        items: [
          { label: "Barang Paling Laris", href: "/akuntansi/laporan/penjualan" },
          { label: "Laba Rugi Barang - Rincian" },
          { label: "Penjualan Per Pelanggan Per Barang", href: "/operasional/rekap-pelanggan" },
          { label: "Perputaran Barang Paling Cepat" },
        ],
      },
    ],
  },
  {
    key: "lainnya",
    label: "Laporan Lainnya",
    icon: "report",
    color: "lime",
    tabs: [
      { name: "Proyek", items: [{ label: "Daftar Proyek" }, { label: "Laba Rugi Proyek" }] },
      { name: "Harta Tetap", items: [{ label: "Analisa Penyusutan Harta Tetap", href: "/akuntansi/laporan/harta-tetap?mode=analisa" }, { label: "Analisa Penyusutan Per Kelompok Harta Tetap", href: "/akuntansi/laporan/harta-tetap?mode=kelompok" }, { label: "Daftar Harta Tetap", href: "/akuntansi/laporan/harta-tetap" }, { label: "Kode Rekening Harta Tetap", href: "/akuntansi/laporan/harta-tetap?mode=rekening" }] },
      { name: "Nama Dan Alamat", items: [{ label: "Daftar Nama Alamat", href: "/akuntansi/kontak" }] },
      { name: "Karyawan", items: [{ label: "Gaji & Slip Gaji", href: "/akuntansi/gaji" }, { label: "Kasbon Karyawan", href: "/akuntansi/kasbon" }] },
    ],
  },
];
