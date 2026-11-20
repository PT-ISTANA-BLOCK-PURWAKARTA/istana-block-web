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

/** Konstanta yang bersumber dari konten resmi istanablock.com (`sementara: false`). */
export interface KonstantaResmi<T> {
  nilai: T;
  sementara: false;
  sumber: string;
  /** Mutu beton yang dianjurkan (mis. "K-350 s.d. K-400"). */
  mutu?: string;
  /** Catatan tambahan dari sumber, ditampilkan ke pengguna. */
  catatan?: string;
}

function r<T>(nilai: T, sumber: string, tambahan: { mutu?: string; catatan?: string } = {}): KonstantaResmi<T> {
  return { nilai, sementara: false, sumber, ...tambahan };
}

const URL_CARA_PASANG = "https://istanablock.com/artikel/cara-pasang-paving-block";
const URL_PERBEDAAN = "https://istanablock.com/artikel/perbedaan-truepave-hexagon-fullpave-grass-block";

export const KELAS_BEBAN: KelasBeban[] = ["pejalan", "motor", "mobil", "truk-ringan", "truk-berat"];

export const LABEL_BEBAN: Record<KelasBeban, string> = {
  pejalan: "Pejalan kaki",
  motor: "Motor / mobil kecil",
  mobil: "Mobil / carport",
  "truk-ringan": "Truk ringan",
  "truk-berat": "Truk berat / industri",
};

/**
 * Tebal minimum (cm) per kelas beban, mutu, dan catatan.
 * Sumber: https://istanablock.com/artikel/cara-pasang-paving-block (tabel kelas beban). Pabrik tidak menjual tebal 10 cm.
 * Pemetaan kelas: pejalan & motor = Ringan, mobil = Sedang, truk ringan = Berat, truk berat = Sangat berat.
 */
export const TEBAL_MIN_CM: Record<KelasBeban, KonstantaResmi<number>> = {
  pejalan: r(6, `${URL_CARA_PASANG} (kelas Ringan: 6 cm, K-350)`, { mutu: "K-350" }),
  motor: r(6, `${URL_CARA_PASANG} (kelas Ringan: 6 cm, K-350)`, { mutu: "K-350" }),
  mobil: r(6, `${URL_CARA_PASANG} (kelas Sedang: 6 cm, 8 cm bila sering bermanuver)`, {
    mutu: "K-350",
    catatan: "8 cm bila sering bermanuver atau kendaraan berat",
  }),
  "truk-ringan": r(8, `${URL_CARA_PASANG} (kelas Berat: 8 cm, K-350 s.d. K-400)`, { mutu: "K-350 s.d. K-400" }),
  "truk-berat": r(8, `${URL_CARA_PASANG} (kelas Sangat berat: 8 cm, K-400 s.d. K-450)`, {
    mutu: "K-400 s.d. K-450",
    catatan: "perlu perencanaan teknis, konsultasikan ke admin",
  }),
};

/**
 * Produk katalog yang cocok per kelas beban (disaring lagi menurut tebal).
 * Sumber: https://istanablock.com/artikel/perbedaan-truepave-hexagon-fullpave-grass-block (Truepave: jalan, parkir,
 * carport, gudang; Hexagon: trotoar, taman, area publik; Fullpave: teras, selasar, plaza; Grass Block: carport hijau,
 * parkir). Ubin Fullpave tidak untuk kendaraan.
 */
export const PRODUK_PER_BEBAN: KonstantaResmi<Record<KelasBeban, ProductId[]>> = r(
  {
    pejalan: ["truepave", "hexagon", "fp21", "fp30", "grass"],
    motor: ["truepave", "hexagon", "grass"],
    mobil: ["truepave", "grass"],
    "truk-ringan": ["truepave"],
    "truk-berat": ["truepave"],
  },
  `${URL_PERBEDAAN} (kegunaan tiap produk)`,
);

/**
 * Tebal pasir alas / bedding (cm) per kelas beban.
 * Sumber: https://istanablock.com/artikel/cara-pasang-paving-block (bedding abu batu/pasir kasar 3-5 cm untuk semua
 * kelas; contoh carport memakai 4 cm). Nilai di bawah berada di dalam rentang itu.
 */
export const PASIR_ALAS_CM: Record<KelasBeban, KonstantaResmi<number>> = {
  pejalan: r(3, `${URL_CARA_PASANG} (bedding 3-5 cm)`),
  motor: r(3, `${URL_CARA_PASANG} (bedding 3-5 cm)`),
  mobil: r(5, `${URL_CARA_PASANG} (bedding 3-5 cm)`),
  "truk-ringan": r(5, `${URL_CARA_PASANG} (bedding 3-5 cm)`),
  "truk-berat": r(5, `${URL_CARA_PASANG} (bedding 3-5 cm)`),
};

/**
 * Tebal sirtu / base course (cm) per kelas beban.
 * Sumber: https://istanablock.com/artikel/cara-pasang-paving-block (Ringan 10, Sedang 15, Berat 20, Sangat berat 20-25 cm).
 */
export const SIRTU_CM: Record<KelasBeban, KonstantaResmi<number>> = {
  pejalan: r(10, `${URL_CARA_PASANG} (kelas Ringan: 10 cm)`),
  motor: r(10, `${URL_CARA_PASANG} (kelas Ringan: 10 cm)`),
  mobil: r(15, `${URL_CARA_PASANG} (kelas Sedang: 15 cm)`),
  "truk-ringan": r(20, `${URL_CARA_PASANG} (kelas Berat: 20 cm)`),
  "truk-berat": r(25, `${URL_CARA_PASANG} (kelas Sangat berat: 20-25 cm, dipakai 25 cm)`, {
    catatan: "20-25 cm + perencanaan teknis",
  }),
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

/**
 * Biaya (ongkir, jasa pasang, perkiraan total) disembunyikan dari UI dan pesan WhatsApp karena tarifnya
 * karangan. Fungsi hitungnya (biaya.ts) tetap ada.
 */
// aktifkan setelah tarif resmi dari pemilik
export const TAMPILKAN_BIAYA = false;

/** Daftar datar konstanta yang MASIH sementara (tabel PR / label UI). */
export const DAFTAR_KONSTANTA_SEMENTARA: ReadonlyArray<{ nama: string; nilai: string; sumber: string }> = [
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
