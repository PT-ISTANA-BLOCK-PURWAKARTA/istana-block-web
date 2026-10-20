// Form rekaman mutu ISO 9001:2015 / SNI (F-IB-01 s/d F-IB-15) — kolom, dropdown, dan rumus kolom abu-abu
// disalin dari file Excel di folder "Data Form Istana Block" (Rev. 00, terbit 15/10/2026).
// Dipakai bersama oleh server (validasi & rekap) dan aplikasi (input, tabel, Excel).

import { addDays, daysBetween } from "../../erp/util";

// Tanggal bisnis = teks YYYY-MM-DD WIB; addDays/daysBetween identik dengan src/lib/erp/util.ts, jadi dipakai ulang dari sana.
export { addDays, daysBetween };

export type IsoValue = string | number | null;
export type IsoValues = Record<string, IsoValue>;
/**
 * Peran yang boleh menginput form (nama peran web, keputusan K3).
 * Padanan inventori-ops: superadmin -> owner, admin -> operasional. Hak sebenarnya dijaga izin `iso` di server;
 * daftar `inputRoles` di bawah hanya meniru kolom "roles input" form kertas.
 */
export type IsoInputRole = "owner" | "operasional" | "qc" | "mandor" | "satpam" | "manajer_qc" | "pimpinan";

export const ISO_CODES = ["F-IB-01", "F-IB-02", "F-IB-03", "F-IB-04", "F-IB-05", "F-IB-06", "F-IB-07", "F-IB-08", "F-IB-09", "F-IB-10", "F-IB-11", "F-IB-12", "F-IB-13", "F-IB-14", "F-IB-15"] as const;
export type IsoCode = (typeof ISO_CODES)[number];

// ---------------------------------------------------------------------------
// Dropdown (sheet "Lists") & tabel standar (sheet "Standar")
// ---------------------------------------------------------------------------

export const LISTS = {
  tipePelanggan: ["Proyek", "Material/Toko", "Retail"],
  bayar: ["Cash", "Tempo"],
  lini: ["Paving Block", "Precast", "Genteng Beton", "Buis Beton", "Lainnya"],
  sesuai3: ["Sesuai", "Tidak Sesuai", "Perlu Perbaikan"],
  jenisUji: ["Serapan Air", "Kuat Tekan"],
  mutu: ["A", "B", "C", "D"],
  lab: ["Internal", "Eksternal (KAN)"],
  param: ["pH Air", "Suhu Ruang", "Kelembaban"],
  jenisJadwal: ["Kalibrasi", "Maintenance"],
  pelaksana: ["Internal", "Vendor"],
  jenisLog: ["Pemeriksaan Rutin", "Kerusakan/Gangguan"],
  kondisiMesin: ["Baik", "Perlu Perbaikan", "Rusak/Berhenti"],
  prioritas: ["Tinggi", "Sedang", "Rendah"],
  kategoriVendor: ["Material", "Jasa Maintenance/IT", "Transportasi", "Lainnya"],
  satuan: ["Sak", "Kg", "Ton", "m3", "Liter", "Pcs", "Unit", "Rit"],
  bahanAlat: ["Bahan Baku", "Alat"],
  statusMinta: ["Tersedia", "Kurang", "Pending", "Selesai"],
  kegiatanPalet: ["Pengecekan", "Penggunaan", "Kerusakan"],
  kondisiPalet: ["Normal", "Retak", "Patah", "Lapuk"],
  bersih: ["Bersih", "Kotor"],
  yaTidak: ["Ya", "Tidak"],
  tindakanPalet: ["Tidak Ada", "Perbaikan", "Pemisahan", "Penggantian", "Pemusnahan"],
  statusPalet: ["Layak", "Diperbaiki", "Dipisahkan", "Dimusnahkan"],
  shift: ["Pagi", "Siang", "Malam"],
  baikTidak: ["Baik", "Tidak"],
  statusCetakan: ["Diajukan", "Disetujui", "Proses Pembuatan", "Selesai", "Ditolak"],
  jenisRapat: ["Mingguan", "Bulanan", "Tinjauan Manajemen", "Koordinasi"],
  openClosed: ["Open", "Closed"],
  sumberNcr: ["Produk Reject", "Material Masuk", "Proses Produksi", "Keluhan Pelanggan", "Audit Internal", "Pengiriman/Lapangan"],
  disposisi: ["Rework", "Scrap", "Concession", "Retur ke Pemasok", "Tidak Ada"],
  nilai5: ["1", "2", "3", "4", "5"],
  /** Tambahan aplikasi untuk F-IB-15: dipakai menghitung Sasaran Mutu bagian D (keluhan valid). */
  kategoriKeluhan: ["Mutu produk", "Terlambat", "Jumlah/jenis tidak sesuai", "Rusak saat tiba", "Pelayanan", "Hasil pemasangan", "Lainnya"],
} as const;

/** SNI 03-0691-1996 Bata Beton (Paving Block): kuat tekan rata-rata min (MPa) & penyerapan air rata-rata maks (%). */
export const SNI_PAVING: Record<string, { strength: number; strengthMin: number; absorption: number; use: string }> = {
  A: { strength: 40, strengthMin: 35, absorption: 3, use: "Perkerasan jalan" },
  B: { strength: 20, strengthMin: 17, absorption: 6, use: "Pelataran parkir" },
  C: { strength: 15, strengthMin: 12.5, absorption: 8, use: "Pejalan kaki" },
  D: { strength: 10, strengthMin: 8.5, absorption: 10, use: "Taman & penggunaan lain" },
};

/** Standar lingkungan kerja (F-IB-05). */
export const ENVIRONMENT_LIMITS: Record<string, { min: number; max: number; unit: string }> = {
  "pH Air": { min: 6.5, max: 8.5, unit: "pH" },
  "Suhu Ruang": { min: 23, max: 27, unit: "°C" },
  "Kelembaban": { min: 50, max: 70, unit: "%RH" },
};

/** 1 MPa = 10,197 kg/cm² (rumus kolom "Kuat Tekan (kg/cm²)" F-IB-04). */
export const KGCM2_PER_MPA = 10.197;

// ---------------------------------------------------------------------------
// Tanggal (YYYY-MM-DD) & angka
// ---------------------------------------------------------------------------

export const isDay = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
export const num = (value: IsoValue | undefined) => typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value.replace(",", "."))) ? Number(value.replace(",", ".")) : null;
const text = (value: IsoValue | undefined) => value === null || value === undefined ? "" : String(value);

/**
 * Hari libur mingguan perusahaan: Jumat (form produksi lama berjalan Sabtu–Kamis).
 * Dipakai untuk "≤ 7 hari kerja" pada Sasaran Mutu.
 */
export const WEEKLY_OFF_DAY = 5;
export function workingDaysBetween(from: string, to: string) {
  let days = 0;
  for (let day = from; day < to; day = addDays(day, 1)) if (new Date(`${addDays(day, 1)}T00:00:00Z`).getUTCDay() !== WEEKLY_OFF_DAY) days += 1;
  return days;
}

// ---------------------------------------------------------------------------
// Definisi form
// ---------------------------------------------------------------------------

export type IsoColumn = {
  key: string;
  label: string;
  /** Jenis isian untuk kolom putih. Kolom abu-abu (otomatis) memakai `auto`. */
  type: "date" | "time" | "text" | "number" | "select";
  options?: readonly string[];
  required?: boolean;
  /** Rumus kolom abu-abu (sama dengan rumus di file Excel). */
  auto?: (values: IsoValues, today: string) => IsoValue;
  format?: "percent" | "decimal1" | "decimal2" | "integer";
  /** Diisi otomatis dengan nama akun yang menginput (masih bisa diubah). */
  defaultUser?: boolean;
  /** Kolom yang boleh dilengkapi pada baris yang datang dari aplikasi. */
  supplement?: boolean;
  /** Kolom tambahan aplikasi (tidak ada di form kertas) — ikut di Excel paling kanan. */
  extra?: boolean;
  hint?: string;
  width?: number;
};

export type IsoForm = {
  code: IsoCode;
  title: string;
  short: string;
  fileName: string;
  clause: string;
  procedure: string;
  replaces: string;
  /** Kolom tanggal yang dibaca rekap per periode (kolom B pada file). */
  dateKey: string;
  columns: IsoColumn[];
  /** Data diambil otomatis dari halaman lain di aplikasi. */
  app?: { page: string; pageLabel: string; note: string };
  /** Baris boleh ditambah langsung di halaman Rekap Form (input manual). */
  manual?: { hint: string };
  /** Daftar induk (F-IB-06): semua baris selalu tampil; periode menghitung jadwal jatuh tempo. */
  master?: boolean;
  inputRoles: IsoInputRole[];
  /** Kolom "No" pada form: nomor urut, atau nomor NCR yang tersimpan. */
  numberLabel: string;
};

const OFFICE: IsoInputRole[] = ["owner", "operasional"];
const QC_TEAM: IsoInputRole[] = ["owner", "operasional", "qc"];
const PLANT: IsoInputRole[] = ["owner", "operasional", "qc", "mandor"];

const ratio = (part: number | null, whole: number | null) => part === null || whole === null || whole === 0 ? null : part / whole;
const sni = (values: IsoValues) => SNI_PAVING[text(values.mutu)];
const env = (values: IsoValues) => ENVIRONMENT_LIMITS[text(values.parameter)];
const VENDOR_CRITERIA = ["ketepatan", "kualitas", "kerapihan", "keselamatan", "respon", "penyelesaian"] as const;
export const WAREHOUSE_ITEMS = ["1. Kebersihan area", "2. Kerapihan susunan barang", "3. Kondisi palet", "4. Kondisi produk jadi", "5. Jalur forklift aman", "6. Penataan sesuai area", "7. Label barang lengkap", "8. Tidak ada barang rusak", "9. APAR tersedia & aman", "10. Pencahayaan baik"];

export const ISO_FORMS: IsoForm[] = [
  {
    code: "F-IB-01", title: "DATA PELANGGAN (PROYEK, MATERIAL, RETAIL)", short: "Data pelanggan", fileName: "F-IB-01 Data Pelanggan.xlsx",
    clause: "8.2", procedure: "PM-IB-08.02, 08.03", replaces: "Form Data Pelanggan - 3 sheet (Proyek, Material, Retail)",
    dateKey: "tanggal", numberLabel: "No", inputRoles: OFFICE,
    app: { page: "/", pageLabel: "Ringkasan (PO)", note: "Satu baris per PO. Tipe pelanggan & pembayaran cukup diisi sekali per pelanggan — PO berikutnya mengikuti otomatis." },
    columns: [
      { key: "tanggal", label: "Tanggal", type: "date", required: true },
      { key: "tipe", label: "Tipe Pelanggan", type: "select", options: LISTS.tipePelanggan, supplement: true },
      { key: "nama", label: "Nama Perusahaan / Toko / Customer", type: "text", required: true, width: 28 },
      { key: "proyek", label: "Nama Proyek (khusus Proyek)", type: "text", supplement: true, width: 26 },
      { key: "alamat", label: "Alamat / Lokasi", type: "text", width: 30 },
      { key: "produk", label: "Jenis Produk", type: "text", width: 26 },
      { key: "bayar", label: "Pembayaran", type: "select", options: LISTS.bayar, supplement: true },
      { key: "pic", label: "PIC / Kontak", type: "text" },
      { key: "hp", label: "No. HP", type: "text" },
      { key: "keterangan", label: "Keterangan", type: "text", supplement: true, width: 28 },
    ],
  },
  {
    code: "F-IB-02", title: "LAPORAN TARGET & REALISASI PRODUKSI HARIAN", short: "Laporan produksi", fileName: "F-IB-02 Laporan Produksi Harian.xlsx",
    clause: "8.1, 8.5.1, 8.5.2", procedure: "PM-IB-08.01, 08.09, 08.10", replaces: "Form Target & Realisasi Produksi Mingguan",
    dateKey: "tanggal", numberLabel: "No", inputRoles: [],
    app: { page: "/produksi", pageLabel: "Hasil Produksi", note: "Diisi mandor (precast) & QC (paving) di menu Hasil Produksi: leader, target, semen; kode batch dibuat otomatis." },
    columns: [
      { key: "tanggal", label: "Tanggal", type: "date", required: true },
      { key: "leader", label: "Leader", type: "text" },
      { key: "lini", label: "Lini Produksi", type: "select", options: LISTS.lini },
      { key: "produk", label: "Nama Produk", type: "text", width: 24 },
      { key: "batch", label: "Kode Batch", type: "text", width: 15 },
      { key: "target", label: "Target (pcs)", type: "number" },
      { key: "realisasi", label: "Realisasi (pcs)", type: "number" },
      { key: "reject", label: "Reject (pcs)", type: "number" },
      { key: "semen", label: "Semen Terpakai (sak)", type: "number" },
      { key: "pencapaian", label: "Pencapaian", type: "number", format: "percent", auto: v => ratio(num(v.realisasi), num(v.target)) },
      { key: "rejectPersen", label: "Reject %", type: "number", format: "percent", auto: v => num(v.reject) === null ? null : ratio(num(v.reject), num(v.realisasi)) },
      { key: "status", label: "Status", type: "text", auto: v => { const r = ratio(num(v.realisasi), num(v.target)); return r === null ? null : r >= 1 ? "Tercapai" : "Tidak Tercapai"; } },
      { key: "catatan", label: "Catatan", type: "text", width: 32 },
    ],
  },
  {
    code: "F-IB-03", title: "PENGIMPLEMENTASIAN MIX DESAIN", short: "Mix desain", fileName: "F-IB-03 Mix Desain.xlsx",
    clause: "8.5.1", procedure: "PM-IB-08.09", replaces: "Pengimplementasian Mix Desain",
    dateKey: "tanggal", numberLabel: "No", inputRoles: QC_TEAM,
    app: { page: "/qc", pageLabel: "QC & Produksi → Mix desain", note: "Dari catatan mix desain harian QC. Kode batch diambil dari hasil produksi paving di tanggal yang sama (bisa dilengkapi)." },
    columns: [
      { key: "tanggal", label: "Tanggal", type: "date", required: true },
      { key: "item", label: "Item Pekerjaan / Produk", type: "text", width: 26 },
      { key: "batch", label: "Kode Batch", type: "text", supplement: true, width: 15 },
      { key: "disetujui", label: "Mix Desain Disetujui", type: "text", width: 34 },
      { key: "hasil", label: "Hasil di Lapangan", type: "text", width: 34 },
      { key: "status", label: "Status", type: "select", options: LISTS.sesuai3 },
      { key: "catatan", label: "Catatan", type: "text", width: 24 },
      { key: "paraf", label: "Paraf QC", type: "text" },
    ],
  },
  {
    code: "F-IB-04", title: "HASIL UJI MUTU PRODUK (KUAT TEKAN & PENYERAPAN AIR)", short: "Uji mutu produk", fileName: "F-IB-04 Uji Mutu Produk.xlsx",
    clause: "8.6", procedure: "PM-IB-08.13", replaces: "Form Uji Serapan Air Produk + Form Uji Kuat Tekan (produk)",
    dateKey: "tanggalUji", numberLabel: "No", inputRoles: QC_TEAM,
    app: { page: "/qc", pageLabel: "QC & Produksi → Uji kuat tekan", note: "Uji kuat tekan internal otomatis dari laporan uji tekan QC (batas standar mengikuti mutu K & umur benda uji)." },
    manual: { hint: "Tambah di sini untuk uji serapan air dan hasil lab eksternal (KAN) — mutu SNI A/B/C/D." },
    columns: [
      { key: "tanggalUji", label: "Tanggal Uji", type: "date", required: true },
      { key: "produk", label: "Nama Produk", type: "text", required: true, width: 22 },
      { key: "batch", label: "Kode Batch", type: "text", supplement: true, width: 15 },
      { key: "tanggalProduksi", label: "Tgl Produksi", type: "date" },
      { key: "umur", label: "Umur (hari)", type: "number", format: "integer", auto: v => isDay(v.tanggalUji) && isDay(v.tanggalProduksi) ? daysBetween(v.tanggalProduksi, v.tanggalUji) : null },
      { key: "jenisUji", label: "Jenis Uji", type: "select", options: LISTS.jenisUji, required: true },
      { key: "mutu", label: "Mutu Target (SNI)", type: "select", options: LISTS.mutu, required: true },
      { key: "beratKering", label: "Berat Kering / Awal (g)", type: "number", hint: "Khusus serapan air" },
      { key: "beratBasah", label: "Berat Basah / Akhir (g)", type: "number", hint: "Khusus serapan air" },
      { key: "beban", label: "Beban Maks (kN)", type: "number", hint: "Khusus kuat tekan" },
      { key: "luas", label: "Luas Bidang Tekan (cm²)", type: "number", hint: "Khusus kuat tekan" },
      { key: "hasilUji", label: "Hasil", type: "number", format: "decimal2", auto: v => {
        if (v.jenisUji === "Serapan Air") { const dry = num(v.beratKering), wet = num(v.beratBasah); return dry && wet !== null ? ((wet - dry) / dry) * 100 : null; }
        if (v.jenisUji === "Kuat Tekan") { const load = num(v.beban), area = num(v.luas); return load !== null && area ? (load * 10) / area : null; }
        return null;
      } },
      { key: "satuan", label: "Satuan", type: "text", auto: v => v.jenisUji === "Serapan Air" ? "%" : v.jenisUji === "Kuat Tekan" ? "MPa" : null },
      { key: "kgcm2", label: "Kuat Tekan (kg/cm²)", type: "number", format: "decimal1", auto: v => { const load = num(v.beban), area = num(v.luas); return v.jenisUji === "Kuat Tekan" && load !== null && area ? ((load * 10) / area) * KGCM2_PER_MPA : null; } },
      { key: "batas", label: "Batas Standar", type: "number", format: "decimal1", auto: v => { const s = sni(v); return !s ? null : v.jenisUji === "Serapan Air" ? s.absorption : v.jenisUji === "Kuat Tekan" ? s.strength : null; } },
      { key: "statusUji", label: "Status", type: "text", auto: v => strengthStatus(v) },
      { key: "lab", label: "Lab Penguji", type: "select", options: LISTS.lab, supplement: true },
      { key: "catatan", label: "Catatan", type: "text", width: 24 },
      { key: "paraf", label: "Paraf QC", type: "text", defaultUser: true },
    ],
  },
  {
    code: "F-IB-05", title: "MONITORING LINGKUNGAN KERJA (pH AIR, SUHU & KELEMBABAN)", short: "Monitoring lingkungan", fileName: "F-IB-05 Monitoring Lingkungan Kerja.xlsx",
    clause: "7.1.4", procedure: "PM-IB-07.04, 08.17", replaces: "Laporan Pengecekan Kadar pH Air + Laporan Temperatur Suhu Ruang & Kelembaban",
    dateKey: "tanggal", numberLabel: "No", inputRoles: QC_TEAM,
    manual: { hint: "QC mencatat pH air, suhu ruang, dan kelembaban. Batas & status terhitung otomatis." },
    columns: [
      { key: "tanggal", label: "Tanggal", type: "date", required: true },
      { key: "jam", label: "Jam", type: "time" },
      { key: "parameter", label: "Parameter", type: "select", options: LISTS.param, required: true },
      { key: "lokasi", label: "Lokasi / Titik Pengecekan", type: "text", required: true, width: 22 },
      { key: "hasil", label: "Hasil Ukur", type: "number", required: true, format: "decimal2" },
      { key: "batasMin", label: "Batas Min", type: "number", auto: v => env(v)?.min ?? null },
      { key: "batasMaks", label: "Batas Maks", type: "number", auto: v => env(v)?.max ?? null },
      { key: "satuan", label: "Satuan", type: "text", auto: v => env(v)?.unit ?? null },
      { key: "status", label: "Status", type: "text", auto: v => { const limit = env(v), value = num(v.hasil); return !limit || value === null ? null : value >= limit.min && value <= limit.max ? "Sesuai" : "Tidak Sesuai"; } },
      { key: "kondisi", label: "Kondisi", type: "text", auto: v => {
        const limit = env(v), value = num(v.hasil);
        if (!limit || value === null) return null;
        if (v.parameter === "pH Air") return value < limit.min ? "Asam" : value > limit.max ? "Basa" : "Normal";
        return value < limit.min ? "Di bawah standar" : value > limit.max ? "Di atas standar" : "Normal";
      } },
      { key: "tindakan", label: "Tindakan / Catatan", type: "text", width: 26 },
      { key: "paraf", label: "Paraf QC", type: "text", defaultUser: true },
    ],
  },
  {
    code: "F-IB-06", title: "JADWAL KALIBRASI ALAT UKUR & MAINTENANCE MESIN", short: "Jadwal kalibrasi/maintenance", fileName: "F-IB-06 Jadwal Kalibrasi dan Maintenance.xlsx",
    clause: "7.1.3, 7.1.5", procedure: "PM-IB-07.03, 07.05, 07.09", replaces: "Penjadwalan Kalibrasi + Penjadwalan Maintenance",
    dateKey: "terakhir", numberLabel: "No", inputRoles: PLANT, master: true,
    manual: { hint: "Daftar alat ukur & mesin. Setelah dikalibrasi/diservis, ubah \"Tgl Terakhir\" — jadwal berikutnya & status terhitung otomatis, riwayat tersimpan. Pengingat dikirim ke HP QC tiap pagi bila jatuh tempo ≤ 7 hari." },
    columns: [
      { key: "nama", label: "Nama Mesin / Alat", type: "text", required: true, width: 26 },
      { key: "kode", label: "Kode Alat", type: "text" },
      { key: "jenis", label: "Jenis", type: "select", options: LISTS.jenisJadwal, required: true },
      { key: "pekerjaan", label: "Jenis Pekerjaan", type: "text", width: 22 },
      { key: "frekuensi", label: "Frekuensi (hari)", type: "number", required: true, format: "integer" },
      { key: "terakhir", label: "Tgl Terakhir", type: "date", required: true },
      { key: "berikutnya", label: "Jadwal Berikutnya", type: "date", auto: v => { const days = num(v.frekuensi); return isDay(v.terakhir) && days !== null ? addDays(v.terakhir, Math.round(days)) : null; } },
      { key: "sisaHari", label: "Sisa Hari", type: "number", format: "integer", auto: (v, today) => { const days = num(v.frekuensi); return isDay(v.terakhir) && days !== null ? daysBetween(today, addDays(v.terakhir, Math.round(days))) : null; } },
      { key: "status", label: "Status", type: "text", auto: (v, today) => { const days = num(v.frekuensi); if (!isDay(v.terakhir) || days === null) return null; const left = daysBetween(today, addDays(v.terakhir, Math.round(days))); return left < 0 ? "TERLAMBAT" : left <= 7 ? "SEGERA" : "Terjadwal"; } },
      { key: "pelaksana", label: "Pelaksana", type: "select", options: LISTS.pelaksana },
      { key: "sertifikat", label: "No. Sertifikat / Bukti", type: "text" },
      { key: "keterangan", label: "Keterangan", type: "text", width: 22 },
    ],
  },
  {
    code: "F-IB-07", title: "LOG PEMERIKSAAN, KERUSAKAN & PERBAIKAN MESIN", short: "Log mesin", fileName: "F-IB-07 Log Mesin.xlsx",
    clause: "7.1.3", procedure: "PM-IB-07.03, 07.09", replaces: "Laporan Kontroling Mesin + Permasalahan & Pengajuan Maintenance Mesin",
    dateKey: "tanggal", numberLabel: "No", inputRoles: PLANT,
    manual: { hint: "Pemeriksaan rutin & kerusakan mesin. Laporan \"Mesin trouble\" dari Hasil Produksi muncul sebagai saran untuk dicatat di sini." },
    columns: [
      { key: "tanggal", label: "Tanggal", type: "date", required: true },
      { key: "mesin", label: "Nama Mesin", type: "text", required: true, width: 22 },
      { key: "jenis", label: "Jenis Catatan", type: "select", options: LISTS.jenisLog, required: true },
      { key: "kondisi", label: "Kondisi", type: "select", options: LISTS.kondisiMesin, required: true },
      { key: "uraian", label: "Kondisi Aktual / Uraian Masalah", type: "text", width: 30 },
      { key: "tindakan", label: "Tindakan Sementara", type: "text", width: 22 },
      { key: "pengajuan", label: "Pengajuan Maintenance", type: "text", width: 22 },
      { key: "prioritas", label: "Prioritas", type: "select", options: LISTS.prioritas },
      { key: "sparepart", label: "Sparepart Diganti", type: "text" },
      { key: "downtime", label: "Downtime (jam)", type: "number", format: "decimal1" },
      { key: "selesai", label: "Tgl Selesai", type: "date" },
      { key: "status", label: "Status", type: "text", auto: v => !isDay(v.tanggal) ? null : v.kondisi === "Baik" ? "Closed" : isDay(v.selesai) ? "Closed" : "Open" },
      { key: "paraf", label: "Paraf QC", type: "text", defaultUser: true },
    ],
  },
  {
    code: "F-IB-08", title: "EVALUASI KINERJA VENDOR / PEMASOK", short: "Evaluasi vendor", fileName: "F-IB-08 Evaluasi Vendor.xlsx",
    clause: "8.4", procedure: "PM-IB-08.06, 08.07", replaces: "Form Penilaian Vendor (docx) + Performa Vendor IT (Maintenance Mesin)",
    dateKey: "tanggal", numberLabel: "No", inputRoles: QC_TEAM,
    app: { page: "/bahan-baku", pageLabel: "Catatan Bahan Baku", note: "Satu baris per supplier & ekspedisi pada periode ini, dihitung dari penilaian barang masuk: kualitas (tier QC) dan ketepatan waktu (kecepatan kirim), skala 1–5." },
    manual: { hint: "Tambah evaluasi lengkap 6 kriteria (mis. vendor jasa maintenance/IT, transportasi)." },
    columns: [
      { key: "tanggal", label: "Tanggal", type: "date", required: true },
      { key: "vendor", label: "Nama Vendor", type: "text", required: true, width: 24 },
      { key: "kategori", label: "Kategori", type: "select", options: LISTS.kategoriVendor, required: true },
      { key: "pekerjaan", label: "Pekerjaan / Material", type: "text", width: 24 },
      { key: "picVendor", label: "PIC Vendor", type: "text" },
      { key: "picInternal", label: "PIC Internal", type: "text", defaultUser: true },
      { key: "ketepatan", label: "Ketepatan Waktu (1-5)", type: "select", options: LISTS.nilai5 },
      { key: "kualitas", label: "Kualitas (1-5)", type: "select", options: LISTS.nilai5 },
      { key: "kerapihan", label: "Kerapihan Kerja (1-5)", type: "select", options: LISTS.nilai5 },
      { key: "keselamatan", label: "Keselamatan Kerja (1-5)", type: "select", options: LISTS.nilai5 },
      { key: "respon", label: "Respon & Komunikasi (1-5)", type: "select", options: LISTS.nilai5 },
      { key: "penyelesaian", label: "Penyelesaian Masalah (1-5)", type: "select", options: LISTS.nilai5 },
      { key: "nilai", label: "Nilai Rata-rata", type: "number", format: "decimal2", auto: v => { const scores = VENDOR_CRITERIA.flatMap(key => { const n = num(v[key]); return n === null ? [] : [n]; }); return scores.length ? scores.reduce((sum, n) => sum + n, 0) / scores.length : null; } },
      { key: "hasilEvaluasi", label: "Hasil Evaluasi", type: "text", auto: v => vendorVerdict(v.nilai) },
      { key: "catatan", label: "Catatan", type: "text", width: 30 },
    ],
  },
  {
    code: "F-IB-09", title: "PEMERIKSAAN MATERIAL / BARANG MASUK", short: "Material masuk", fileName: "F-IB-09 Pemeriksaan Material Masuk.xlsx",
    clause: "8.4.2, 8.4.3", procedure: "PM-IB-08.06, 08.08", replaces: "Form Barang Masuk",
    dateKey: "tanggal", numberLabel: "No", inputRoles: QC_TEAM,
    app: { page: "/barang-masuk", pageLabel: "Barang Masuk", note: "Dari penerimaan barang satpam + tier QC + uji lumpur. Paraf QC kosong = belum diperiksa QC." },
    columns: [
      { key: "tanggal", label: "Tanggal", type: "date", required: true },
      { key: "suratJalan", label: "No. Surat Jalan / PO", type: "text" },
      { key: "supplier", label: "Supplier", type: "text", width: 22 },
      { key: "barang", label: "Nama Barang", type: "text", width: 22 },
      { key: "jumlah", label: "Jumlah", type: "number" },
      { key: "satuan", label: "Satuan", type: "text" },
      { key: "hasil", label: "Hasil Pemeriksaan", type: "select", options: ["Diterima", "Diterima Bersyarat", "Ditolak/Retur"] },
      { key: "kondisi", label: "Kondisi / Catatan Pemeriksaan", type: "text", width: 34 },
      { key: "tindakan", label: "Tindakan", type: "text", supplement: true, width: 20 },
      { key: "paraf", label: "Paraf QC", type: "text" },
    ],
  },
  {
    code: "F-IB-10", title: "PERMINTAAN BAHAN BAKU & ALAT (INTERNAL)", short: "Permintaan bahan & alat", fileName: "F-IB-10 Permintaan Bahan dan Alat.xlsx",
    clause: "8.4, 7.1", procedure: "PM-IB-08.06", replaces: "Perencanaan & Delivery Order Pemesanan Bahan & Alat - 2 sheet (BAHAN, ALAT)",
    dateKey: "tanggal", numberLabel: "No", inputRoles: PLANT,
    manual: { hint: "Permintaan bahan baku/alat dari lapangan. Ubah status ke \"Selesai\" dan isi tanggal selesai saat barang sudah ada." },
    columns: [
      { key: "tanggal", label: "Tanggal", type: "date", required: true },
      { key: "jenis", label: "Jenis", type: "select", options: LISTS.bahanAlat, required: true },
      { key: "nama", label: "Nama Bahan / Alat", type: "text", required: true, width: 22 },
      { key: "jumlah", label: "Jumlah", type: "number" },
      { key: "satuan", label: "Satuan", type: "select", options: LISTS.satuan },
      { key: "tujuan", label: "Tujuan / Area", type: "text" },
      { key: "peminta", label: "Peminta", type: "text", defaultUser: true },
      { key: "status", label: "Status", type: "select", options: LISTS.statusMinta, required: true },
      { key: "selesai", label: "Tgl Selesai", type: "date" },
      { key: "lama", label: "Lama Proses (hari)", type: "number", format: "integer", auto: v => isDay(v.tanggal) && isDay(v.selesai) ? daysBetween(v.tanggal, v.selesai) : null },
      { key: "paraf", label: "Paraf", type: "text" },
    ],
  },
  {
    code: "F-IB-11", title: "LOG PALET (PENGECEKAN, PENGGUNAAN & KERUSAKAN)", short: "Log palet", fileName: "F-IB-11 Log Palet.xlsx",
    clause: "8.5.4", procedure: "PM-IB-08.11, SOP Pemakaian Palet", replaces: "Form SOP Pemakaian Palet - sheet Pengecekan, Data Penggunaan, Laporan Kerusakan",
    dateKey: "tanggal", numberLabel: "No", inputRoles: PLANT,
    manual: { hint: "Pengecekan, penggunaan, dan kerusakan palet." },
    columns: [
      { key: "tanggal", label: "Tanggal", type: "date", required: true },
      { key: "kegiatan", label: "Kegiatan", type: "select", options: LISTS.kegiatanPalet, required: true },
      { key: "palet", label: "Kode / Jenis Palet", type: "text", required: true },
      { key: "area", label: "Area", type: "text" },
      { key: "jumlah", label: "Jumlah", type: "number", format: "integer" },
      { key: "kondisi", label: "Kondisi Fisik", type: "select", options: LISTS.kondisiPalet },
      { key: "kebersihan", label: "Kebersihan", type: "select", options: LISTS.bersih },
      { key: "layak", label: "Layak Pakai", type: "select", options: LISTS.yaTidak },
      { key: "pengguna", label: "Digunakan Oleh", type: "text" },
      { key: "kerusakan", label: "Jenis Kerusakan", type: "text" },
      { key: "tindakan", label: "Tindakan", type: "select", options: LISTS.tindakanPalet },
      { key: "statusAkhir", label: "Status Akhir", type: "select", options: LISTS.statusPalet },
      { key: "paraf", label: "Paraf QC", type: "text", defaultUser: true },
    ],
  },
  {
    code: "F-IB-12", title: "CHECKLIST GUDANG", short: "Checklist gudang", fileName: "F-IB-12 Checklist Gudang.xlsx",
    clause: "8.5.4, 7.1.4", procedure: "PM-IB-08.11, 08.17", replaces: "Form SOP Pemakaian Palet - sheet Checklist Gudang",
    dateKey: "tanggal", numberLabel: "No", inputRoles: PLANT,
    manual: { hint: "10 butir pemeriksaan gudang; skor = jumlah \"Baik\" ÷ butir yang diisi." },
    columns: [
      { key: "tanggal", label: "Tanggal", type: "date", required: true },
      { key: "shift", label: "Shift", type: "select", options: LISTS.shift, required: true },
      { key: "area", label: "Area Gudang", type: "text", required: true },
      { key: "pemeriksa", label: "PIC Pemeriksa", type: "text", defaultUser: true },
      ...WAREHOUSE_ITEMS.map((label, index): IsoColumn => ({ key: `c${index + 1}`, label, type: "select", options: LISTS.baikTidak, width: 12 })),
      { key: "skor", label: "Skor", type: "number", format: "percent", auto: v => { const filled = WAREHOUSE_ITEMS.map((_, i) => v[`c${i + 1}`]).filter(value => value === "Baik" || value === "Tidak"); return filled.length ? filled.filter(value => value === "Baik").length / filled.length : null; } },
      { key: "catatan", label: "Catatan", type: "text", width: 26 },
    ],
  },
  {
    code: "F-IB-13", title: "PEMESANAN PEMBUATAN CETAKAN", short: "Pemesanan cetakan", fileName: "F-IB-13 Pemesanan Cetakan.xlsx",
    clause: "8.3, 7.1.3", procedure: "PM-IB-08.05", replaces: "Form Pemesanan Pembuatan Cetakan",
    dateKey: "tanggal", numberLabel: "No", inputRoles: PLANT,
    manual: { hint: "Pengajuan cetakan baru / revisi cetakan beserta statusnya." },
    columns: [
      { key: "tanggal", label: "Tanggal", type: "date", required: true },
      { key: "produk", label: "Nama Produk", type: "text", required: true },
      { key: "ukuran", label: "Ukuran P x L x T (mm)", type: "text" },
      { key: "model", label: "Model", type: "text" },
      { key: "target", label: "Target Produksi", type: "text", hint: "Contoh: 200 pcs/hari" },
      { key: "cavity", label: "Jumlah Cavity", type: "number", format: "integer" },
      { key: "spesifikasi", label: "Spesifikasi Cetakan", type: "text", width: 26 },
      { key: "status", label: "Status", type: "select", options: LISTS.statusCetakan, required: true },
      { key: "selesai", label: "Tgl Selesai", type: "date" },
      { key: "catatan", label: "Catatan", type: "text", width: 24 },
    ],
  },
  {
    code: "F-IB-14", title: "LOG RAPAT & TINDAK LANJUT KEPUTUSAN", short: "Rapat & tindak lanjut", fileName: "F-IB-14 Rapat dan Tindak Lanjut.xlsx",
    clause: "7.4, 9.3", procedure: "PM-IB-07.07, 09.03", replaces: "Melengkapi Form Berita Acara Rapat (docx tetap dipakai untuk daftar hadir & tanda tangan)",
    dateKey: "tanggal", numberLabel: "No", inputRoles: PLANT,
    manual: { hint: "Satu baris per keputusan rapat. Paling mudah diisi dari Kalender → Rekap rapat & training (notulen + keputusan otomatis masuk ke sini); rapat yang belum direkap muncul sebagai saran." },
    columns: [
      { key: "tanggal", label: "Tanggal Rapat", type: "date", required: true },
      { key: "jenis", label: "Jenis Rapat", type: "select", options: LISTS.jenisRapat, required: true },
      { key: "pimpinan", label: "Pimpinan Rapat", type: "text" },
      { key: "peserta", label: "Jml Peserta", type: "number", format: "integer" },
      { key: "topik", label: "Topik Pembahasan", type: "text", required: true, width: 26 },
      { key: "keputusan", label: "Hasil / Keputusan", type: "text", required: true, width: 30 },
      { key: "pj", label: "Penanggung Jawab", type: "text" },
      { key: "target", label: "Target Waktu", type: "date" },
      { key: "status", label: "Status", type: "select", options: LISTS.openClosed, required: true },
      { key: "selesai", label: "Tgl Selesai", type: "date" },
      { key: "ketepatan", label: "Ketepatan", type: "text", auto: (v, today) => {
        if (!isDay(v.tanggal) || !v.status) return null;
        if (v.status === "Open") return !isDay(v.target) ? "Berjalan" : today > v.target ? "TERLAMBAT" : "Berjalan";
        return !isDay(v.selesai) || !isDay(v.target) ? "Selesai" : v.selesai > v.target ? "Selesai terlambat" : "Tepat waktu";
      } },
    ],
  },
  {
    code: "F-IB-15", title: "KETIDAKSESUAIAN (NCR), KELUHAN PELANGGAN & TINDAKAN KOREKTIF", short: "NCR & keluhan", fileName: "F-IB-15 NCR dan Keluhan Pelanggan.xlsx",
    clause: "8.7, 9.1.2, 10.2", procedure: "PM-IB-08.14, 10.01, 09.02", replaces: "- (form baru: wajib menurut PM-IB-08.14 & 10.01)",
    dateKey: "tanggal", numberLabel: "No. NCR", inputRoles: PLANT,
    manual: { hint: "Nomor NCR dibuat otomatis. Barang masuk yang ditolak & benda uji yang gagal muncul sebagai saran. Isi \"Kategori keluhan\" untuk keluhan valid agar Sasaran Mutu bagian D terhitung." },
    columns: [
      { key: "tanggal", label: "Tanggal", type: "date", required: true },
      { key: "sumber", label: "Sumber", type: "select", options: LISTS.sumberNcr, required: true },
      { key: "uraian", label: "Uraian Ketidaksesuaian", type: "text", required: true, width: 30 },
      { key: "produk", label: "Produk / Batch", type: "text" },
      { key: "jumlah", label: "Jumlah", type: "number" },
      { key: "disposisi", label: "Disposisi", type: "select", options: LISTS.disposisi },
      { key: "akar", label: "Akar Penyebab", type: "text", width: 24 },
      { key: "korektif", label: "Tindakan Korektif", type: "text", width: 26 },
      { key: "pj", label: "PJ", type: "text" },
      { key: "target", label: "Target", type: "date" },
      { key: "status", label: "Status", type: "select", options: LISTS.openClosed, required: true },
      { key: "closed", label: "Tgl Closed", type: "date" },
      { key: "efektif", label: "Efektif?", type: "select", options: LISTS.yaTidak },
      { key: "umur", label: "Umur (hari)", type: "number", format: "integer", auto: (v, today) => !isDay(v.tanggal) ? null : daysBetween(v.tanggal, isDay(v.closed) ? v.closed : today) },
      { key: "kategori", label: "Kategori Keluhan", type: "select", options: LISTS.kategoriKeluhan, extra: true, hint: "Khusus keluhan pelanggan yang sudah diverifikasi QC (valid)." },
    ],
  },
];

export const FORM_BY_CODE = Object.fromEntries(ISO_FORMS.map(form => [form.code, form])) as Record<IsoCode, IsoForm>;

/** Status uji F-IB-04: serapan air ≤ batas, kuat tekan ≥ batas. */
function strengthStatus(values: IsoValues) {
  const result = num(values.hasilUji), limit = num(values.batas);
  if (result === null || limit === null) return null;
  return values.jenisUji === "Serapan Air" ? (result <= limit ? "LULUS" : "TIDAK LULUS") : (result >= limit ? "LULUS" : "TIDAK LULUS");
}

export function vendorVerdict(score: IsoValue | undefined) {
  const value = num(score ?? null);
  return value === null ? null : value >= 4 ? "Baik - Disetujui (AVL)" : value >= 3 ? "Cukup - Perlu Pembinaan" : "Kurang - Evaluasi Ulang";
}

/**
 * Lengkapi kolom abu-abu, berurutan dari kiri (kolom kanan memakai hasil kolom kiri).
 * Baris dari aplikasi boleh membawa nilai otomatisnya sendiri
 * (mis. batas kuat tekan sesuai mutu K & umur) — nilai itu dipakai bila `keepGiven`.
 */
export function computeIsoValues(form: IsoForm, values: IsoValues, today: string, skip: string[] = [], keepGiven = false): IsoValues {
  const result: IsoValues = { ...values };
  for (const column of form.columns) {
    if (!column.auto || skip.includes(column.key)) continue;
    if (keepGiven && values[column.key] !== undefined && values[column.key] !== null) continue;
    result[column.key] = column.auto(result, today);
  }
  return result;
}

/** Kolom yang bisa diisi (putih) pada input manual. */
export const inputColumns = (form: IsoForm) => form.columns.filter(column => !column.auto);

/**
 * Bersihkan isian dari aplikasi: hanya kolom yang dikenal, tipe yang benar, pilihan yang valid.
 * Mengembalikan pesan kesalahan pertama bila ada.
 */
export function cleanIsoValues(form: IsoForm, input: Record<string, unknown>, options: { onlySupplement?: boolean } = {}): { values: IsoValues; error?: string } {
  const values: IsoValues = {};
  for (const column of inputColumns(form)) {
    if (options.onlySupplement && !column.supplement) continue;
    const raw = input[column.key];
    const empty = raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "");
    if (empty) {
      if (column.required && !options.onlySupplement) return { values, error: `Kolom "${column.label}" wajib diisi` };
      values[column.key] = null;
      continue;
    }
    if (column.type === "number") {
      const value = num(typeof raw === "number" ? raw : String(raw));
      if (value === null || Math.abs(value) > 1e9) return { values, error: `Kolom "${column.label}" harus angka` };
      values[column.key] = value;
    } else if (column.type === "date") {
      if (!isDay(raw) || Number.isNaN(Date.parse(`${raw}T00:00:00Z`))) return { values, error: `Tanggal "${column.label}" tidak valid` };
      values[column.key] = raw;
    } else if (column.type === "time") {
      if (typeof raw !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(raw)) return { values, error: `Jam "${column.label}" tidak valid (contoh 08:30)` };
      values[column.key] = raw;
    } else if (column.type === "select") {
      const value = String(raw).trim();
      if (column.options && !column.options.includes(value)) return { values, error: `Pilihan "${column.label}" tidak dikenal` };
      values[column.key] = value;
    } else {
      values[column.key] = String(raw).trim().slice(0, 500);
    }
  }
  return { values };
}

/** Kelompok produk untuk Sasaran Mutu (uji mutu & reject per jenis produk). */
export type ProductClass = "paving" | "uditch" | "kanstin" | "buisVibrasi" | "buisTumbuk" | "greffel" | "lainnya";
export function productClass(name: string | null | undefined, category?: string | null): ProductClass {
  const value = String(name ?? "").toLowerCase();
  if (category === "paving" || /paving|bata\s*beton|hexagon|cacing|grass\s*block/.test(value)) return "paving";
  if (/u[\s-]?ditch/.test(value)) return "uditch";
  if (/kanstin|kereb|kerb/.test(value)) return "kanstin";
  if (/buis|gorong/.test(value)) return /tumbuk/.test(value) ? "buisTumbuk" : "buisVibrasi";
  if (/gr[ae]f+el|gravel|grevel/.test(value)) return "greffel";
  return "lainnya";
}
