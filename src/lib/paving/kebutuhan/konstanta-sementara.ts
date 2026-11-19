/**
 * Konstanta SEMENTARA kalkulator kebutuhan lapangan (tahap T4).
 *
 * Pemilik belum mengirim data pabrik. Seluruh angka di bawah adalah ASUMSI
 * kerja, bukan data resmi. Setiap konstanta membawa `sementara: true` agar UI
 * dapat memberi label "perkiraan" dan `sumber` yang menjelaskan alasannya.
 * Ganti nilai di file ini saja saat data pabrik masuk; modul lain tidak berubah.
 */

import type { ProductId } from "../catalog";

export type KelasBeban = "pejalan" | "motor" | "mobil" | "truk-ringan" | "truk-berat";
export type JenisTruk = "engkel" | "fuso";
export type BentukLahan = "sederhana" | "tak-simetris";

export interface KonstantaSementara<T> {
  nilai: T;
  sementara: true;
  sumber: string;
}

function s<T>(nilai: T, sumber: string): KonstantaSementara<T> {
  return { nilai, sementara: true, sumber };
}

export const KELAS_BEBAN: KelasBeban[] = ["pejalan", "motor", "mobil", "truk-ringan", "truk-berat"];

export const LABEL_BEBAN: Record<KelasBeban, string> = {
  pejalan: "Pejalan kaki",
  motor: "Motor / mobil kecil",
  mobil: "Mobil / carport",
  "truk-ringan": "Truk ringan",
  "truk-berat": "Truk berat / industri",
};

// SEMENTARA — tunggu konfirmasi pabrik
/** Tebal minimum (cm) per kelas beban. Acuan umum SNI 03-0691 (6/8/10 cm). */
export const TEBAL_MIN_CM: Record<KelasBeban, KonstantaSementara<number>> = {
  pejalan: s(6, "Acuan umum SNI 03-0691: 6 cm untuk pejalan kaki"),
  motor: s(6, "Acuan umum SNI 03-0691: 6 cm untuk beban ringan"),
  mobil: s(8, "Acuan umum SNI 03-0691: 8 cm untuk kendaraan ringan"),
  "truk-ringan": s(10, "Acuan umum SNI 03-0691: 10 cm untuk truk"),
  "truk-berat": s(10, "Acuan umum SNI 03-0691: 10 cm untuk truk/industri"),
};

// SEMENTARA — tunggu konfirmasi pabrik
/** Produk katalog yang dianggap cocok per kelas beban (disaring lagi menurut tebal). */
export const PRODUK_PER_BEBAN: KonstantaSementara<Record<KelasBeban, ProductId[]>> = s(
  {
    pejalan: ["truepave", "hexagon", "fp21", "fp30", "grass"],
    motor: ["truepave", "hexagon", "fp21", "fp30", "grass"],
    mobil: ["truepave", "hexagon", "grass"],
    "truk-ringan": ["truepave", "hexagon"],
    "truk-berat": ["truepave", "hexagon"],
  },
  "Penilaian umum bentuk produk; ubin 21/30 tidak untuk kendaraan",
);

// SEMENTARA — tunggu konfirmasi pabrik
/** Tebal pasir alas (cm) per kelas beban. */
export const PASIR_ALAS_CM: Record<KelasBeban, KonstantaSementara<number>> = {
  pejalan: s(3, "Praktik lapangan umum: 3 cm"),
  motor: s(3, "Praktik lapangan umum: 3 cm"),
  mobil: s(5, "Mengikuti abu batu 5 cm di katalog (BED_DEPTH_M)"),
  "truk-ringan": s(5, "Praktik lapangan umum: 5 cm"),
  "truk-berat": s(5, "Praktik lapangan umum: 5 cm"),
};

// SEMENTARA — tunggu konfirmasi pabrik
/** Tebal sirtu / base course (cm) per kelas beban. */
export const SIRTU_CM: Record<KelasBeban, KonstantaSementara<number>> = {
  pejalan: s(10, "Praktik lapangan umum: 10 cm"),
  motor: s(10, "Praktik lapangan umum: 10 cm"),
  mobil: s(15, "Praktik lapangan umum: 15 cm"),
  "truk-ringan": s(20, "Mengikuti base course 20 cm di katalog (BASE_DEPTH_M)"),
  "truk-berat": s(25, "Praktik lapangan umum: 25 cm"),
};

// SEMENTARA — tunggu konfirmasi pabrik
/** Abu batu pengisi nat: m³ per m² terpasang. */
export const ABU_NAT_M3_PER_M2 = s(0.002, "Perkiraan 2 mm lapisan abu batu untuk menyapu nat");

// SEMENTARA — tunggu konfirmasi pabrik
/** Faktor gembur-ke-padat untuk pasir alas dan sirtu (beli lebih banyak dari volume padat). */
export const FAKTOR_PADAT = s(1.2, "Material lepas menyusut ±20% saat dipadatkan");

// SEMENTARA — tunggu konfirmasi pabrik
/** Faktor susut/tercecer abu batu pengisi nat. */
export const FAKTOR_SUSUT_ABU = s(1.1, "Perkiraan 10% tercecer saat penyapuan");

// SEMENTARA — tunggu konfirmasi pabrik
/** Panjang standar kanstin (cm). */
export const KANSTIN_PANJANG_CM = s(60, "Mengikuti bawaan estimate.ts (kanstinLengthCm 60)");

// SEMENTARA — tunggu konfirmasi pabrik
/** Faktor sisa potong/pecah (%) menurut bentuk lahan. */
export const SISA_POTONG_PERSEN: Record<BentukLahan, KonstantaSementara<number>> = {
  sederhana: s(5, "Praktik umum: 5% untuk persegi/pola sederhana (opsi cadangan 5%)"),
  "tak-simetris": s(10, "Praktik umum: 10% untuk bentuk tak simetris (opsi cadangan 10%)"),
};

// SEMENTARA — tunggu konfirmasi pabrik
/** Luas terpasang (m²) yang muat dalam satu palet. */
export const M2_PER_PALET = s(8, "Asumsi tumpukan palet kayu standar paving");

// SEMENTARA — tunggu konfirmasi pabrik
/** Kerapatan beton paving (kg/m³). */
export const DENSITAS_KG_M3 = s(2300, "Beton paving umum 2200-2400 kg/m³");

// SEMENTARA — tunggu konfirmasi pabrik
/** Faktor rongga grass block (bagian padat dari bidang 45 × 30). */
export const FAKTOR_PADAT_GRASS = s(0.75, "Rongga rumput ±25% dari bidang");

// SEMENTARA — tunggu konfirmasi pabrik
/** Berat palet kayu kosong (kg). */
export const BERAT_PALET_KG = s(25, "Palet kayu standar");

// SEMENTARA — tunggu konfirmasi pabrik
/** Kapasitas angkut per trip: berat (kg) dan jumlah palet. */
export const KAPASITAS_TRUK: Record<JenisTruk, KonstantaSementara<{ beratKg: number; palet: number }>> = {
  engkel: s({ beratKg: 4000, palet: 4 }, "Truk engkel (CDE) ±4 ton"),
  fuso: s({ beratKg: 8000, palet: 8 }, "Truk fuso ±8 ton"),
};

// SEMENTARA — tunggu konfirmasi pabrik
/** Ongkir per trip (Rp) menurut zona jarak; di atas zona terakhir ditambah tarif per km. */
export const ONGKIR_ZONA: KonstantaSementara<{
  zona: Array<{ sampaiKm: number; tarifPerTrip: number }>;
  lebihKmTarif: number;
}> = s(
  {
    zona: [
      { sampaiKm: 10, tarifPerTrip: 250_000 },
      { sampaiKm: 25, tarifPerTrip: 450_000 },
      { sampaiKm: 50, tarifPerTrip: 750_000 },
      { sampaiKm: 100, tarifPerTrip: 1_400_000 },
    ],
    lebihKmTarif: 12_000,
  },
  "Tarif karangan untuk kerangka; belum ada tarif ekspedisi resmi",
);

// SEMENTARA — tunggu konfirmasi pabrik
/** Tarif pasang (Rp per m²) per kelas beban. */
export const TARIF_PASANG_PER_M2: Record<KelasBeban, KonstantaSementara<number>> = {
  pejalan: s(35_000, "Upah tukang umum; belum ada tarif resmi"),
  motor: s(40_000, "Upah tukang umum; belum ada tarif resmi"),
  mobil: s(50_000, "Upah tukang umum; belum ada tarif resmi"),
  "truk-ringan": s(60_000, "Upah tukang umum; belum ada tarif resmi"),
  "truk-berat": s(75_000, "Upah tukang umum; belum ada tarif resmi"),
};

/** Daftar datar untuk tabel PR / label UI. */
export const DAFTAR_KONSTANTA_SEMENTARA: ReadonlyArray<{ nama: string; nilai: string; sumber: string }> = [
  { nama: "TEBAL_MIN_CM", nilai: "6 / 6 / 8 / 10 / 10", sumber: TEBAL_MIN_CM.pejalan.sumber },
  { nama: "PRODUK_PER_BEBAN", nilai: "lihat berkas", sumber: PRODUK_PER_BEBAN.sumber },
  { nama: "PASIR_ALAS_CM", nilai: "3 / 3 / 5 / 5 / 5", sumber: "Praktik lapangan umum" },
  { nama: "SIRTU_CM", nilai: "10 / 10 / 15 / 20 / 25", sumber: "Praktik lapangan umum" },
  { nama: "ABU_NAT_M3_PER_M2", nilai: String(ABU_NAT_M3_PER_M2.nilai), sumber: ABU_NAT_M3_PER_M2.sumber },
  { nama: "FAKTOR_PADAT", nilai: String(FAKTOR_PADAT.nilai), sumber: FAKTOR_PADAT.sumber },
  { nama: "FAKTOR_SUSUT_ABU", nilai: String(FAKTOR_SUSUT_ABU.nilai), sumber: FAKTOR_SUSUT_ABU.sumber },
  { nama: "KANSTIN_PANJANG_CM", nilai: String(KANSTIN_PANJANG_CM.nilai), sumber: KANSTIN_PANJANG_CM.sumber },
  { nama: "SISA_POTONG_PERSEN", nilai: "5 (sederhana) / 10 (tak simetris)", sumber: "Praktik umum" },
  { nama: "M2_PER_PALET", nilai: String(M2_PER_PALET.nilai), sumber: M2_PER_PALET.sumber },
  { nama: "DENSITAS_KG_M3", nilai: String(DENSITAS_KG_M3.nilai), sumber: DENSITAS_KG_M3.sumber },
  { nama: "FAKTOR_PADAT_GRASS", nilai: String(FAKTOR_PADAT_GRASS.nilai), sumber: FAKTOR_PADAT_GRASS.sumber },
  { nama: "BERAT_PALET_KG", nilai: String(BERAT_PALET_KG.nilai), sumber: BERAT_PALET_KG.sumber },
  { nama: "KAPASITAS_TRUK", nilai: "engkel 4000 kg/4 palet; fuso 8000 kg/8 palet", sumber: "Kapasitas umum" },
  { nama: "ONGKIR_ZONA", nilai: "250rb/450rb/750rb/1,4jt per trip; +12rb/km >100 km", sumber: ONGKIR_ZONA.sumber },
  { nama: "TARIF_PASANG_PER_M2", nilai: "35rb/40rb/50rb/60rb/75rb", sumber: "Upah tukang umum" },
];
