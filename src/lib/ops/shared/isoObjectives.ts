// Form Sasaran Mutu (F-IB-16): 30 sasaran, target, dan sumber angkanya.
// Sasaran bertanda `auto` dihitung dari data aplikasi; sisanya diisi manual per bulan di halaman Rekap Form ISO.

export type ObjectiveAuto =
  | "test:paving" | "test:uditch" | "test:kanstin" | "test:buis" | "test:greffel"
  | "delivery:onTime" | "delivery:gps" | "complaint:quantity" | "complaint:quality" | "complaint:delivery" | "complaint:service" | "complaint:closed7"
  | "reject:paving" | "reject:uditch" | "reject:kanstin" | "reject:buisVibrasi" | "reject:buisTumbuk" | "reject:greffel";

export type Objective = { no: number; group: string; text: string; target: number; targetLabel: string; basis: string; period: string; pic: string; auto?: ObjectiveAuto; dataSource?: string };

export const OBJECTIVE_GROUPS = [
  { id: "A", title: "A. KUALITAS PRODUK (acuan nilai minimum SNI: lihat Lampiran)" },
  { id: "B", title: "B. KECEPATAN PENGIRIMAN" },
  { id: "C", title: "C. PELAYANAN & KEPUASAN PELANGGAN" },
  { id: "D", title: "D. KELUHAN PELANGGAN (keluhan valid = sudah diverifikasi QC)" },
  { id: "E", title: "E. REJECT PRODUK (INTERNAL PRODUKSI) (reject = retak, gompal, keropos, dimensi di luar toleransi, gagal uji)" },
] as const;

const test = "F-IB-04 Uji mutu produk (LULUS ÷ diuji)";
const reject = "Hasil Produksi: jumlah jadi ÷ (jadi + reject)";
const complaint = "Pengiriman selesai dikurangi NCR F-IB-15 berkategori";

export const QUALITY_OBJECTIVES: Objective[] = [
  { no: 1, group: "A", text: "Paving press hydraulic memenuhi kuat tekan & penyerapan air sesuai mutu SNI yang dipesan", target: 1, targetLabel: "100%", basis: "Total: lot diuji · Tercapai: lot lulus uji lab (SNI 03-0691-1996)", period: "Per lot / bulanan", pic: "QC Produksi", auto: "test:paving", dataSource: test },
  { no: 2, group: "A", text: "U-Ditch precast memenuhi kuat tekan ≥ mutu beton rencana", target: 1, targetLabel: "100%", basis: "Total: benda uji · Tercapai: lulus uji tekan (SNI 1974:2011)", period: "Bulanan", pic: "QC Produksi", auto: "test:uditch", dataSource: test },
  { no: 3, group: "A", text: "Kanstin wetcast memenuhi mutu beton fc' 30 MPa", target: 1, targetLabel: "100%", basis: "Total: benda uji · Tercapai: lulus uji tekan (acuan SNI 2442:2020)", period: "Bulanan", pic: "QC Produksi", auto: "test:kanstin", dataSource: test },
  { no: 4, group: "A", text: "Buis beton vibrasi & tumbuk memenuhi mutu beton K-300", target: 1, targetLabel: "100%", basis: "Total: benda uji · Tercapai: lulus uji tekan", period: "Bulanan", pic: "QC Produksi", auto: "test:buis", dataSource: test },
  { no: 5, group: "A", text: "Greffel beton tumbuk memenuhi mutu beton rencana", target: 1, targetLabel: "100%", basis: "Total: benda uji · Tercapai: lulus uji tekan", period: "Bulanan", pic: "QC Produksi", auto: "test:greffel", dataSource: test },
  { no: 6, group: "A", text: "Dimensi produk (tebal, panjang, diameter) dalam batas toleransi", target: 0.98, targetLabel: "≥ 98%", basis: "Total: sampel diukur · Tercapai: dalam toleransi (paving: tebal ±8%)", period: "Mingguan", pic: "QC Produksi" },
  { no: 7, group: "A", text: "Produk lolos inspeksi visual (tidak retak, gompal, keropos) sebelum dikirim", target: 0.99, targetLabel: "≥ 99%", basis: "Total: unit diinspeksi saat muat · Tercapai: unit lolos inspeksi", period: "Bulanan", pic: "QC & Mandor Pengiriman" },
  { no: 8, group: "B", text: "Pengiriman tepat waktu sesuai jadwal yang disepakati dengan pelanggan", target: 0.95, targetLabel: "≥ 95%", basis: "Total: jumlah pengiriman (surat jalan) · Tercapai: tiba tepat waktu", period: "Bulanan", pic: "Mandor Pengiriman", auto: "delivery:onTime", dataSource: "Pengiriman selesai; tepat waktu = selesai paling lambat tanggal kirim yang diminta" },
  { no: 9, group: "B", text: "Pengiriman stok ready ke Purwakarta & sekitarnya tiba ≤ 2 hari kerja", target: 0.9, targetLabel: "≥ 90%", basis: "Total: pengiriman stok ready · Tercapai: tiba ≤ 2 hari kerja sejak PO/pembayaran", period: "Bulanan", pic: "Mandor Pengiriman" },
  { no: 10, group: "B", text: "Jumlah & jenis barang sesuai surat jalan", target: 1, targetLabel: "100%", basis: "Total: jumlah pengiriman · Tercapai: tanpa selisih jumlah/jenis", period: "Bulanan", pic: "Mandor Pengiriman", auto: "complaint:quantity", dataSource: `${complaint} "Jumlah/jenis tidak sesuai"` },
  { no: 11, group: "B", text: "Produk tiba dalam kondisi baik (rusak ≤ 0,5%)", target: 0.995, targetLabel: "≥ 99,5%", basis: "Total: unit dikirim · Tercapai: unit tiba tidak rusak", period: "Bulanan", pic: "Mandor Pengiriman" },
  { no: 12, group: "B", text: "Pengiriman terpantau GPS untuk info estimasi tiba ke pelanggan", target: 1, targetLabel: "100%", basis: "Total: trip pengiriman · Tercapai: trip terpantau GPS", period: "Bulanan", pic: "Mandor Pengiriman", auto: "delivery:gps", dataSource: "Pengiriman selesai yang punya titik GPS dari HP sopir" },
  { no: 13, group: "C", text: "Chat WhatsApp / telepon direspons ≤ 15 menit pada jam kerja", target: 0.9, targetLabel: "≥ 90%", basis: "Total: chat/telepon masuk (sampel) · Tercapai: direspons ≤ 15 menit", period: "Bulanan", pic: "Administrasi / MarCom" },
  { no: 14, group: "C", text: "Penawaran harga + ongkir terkirim ≤ 1 hari kerja", target: 0.9, targetLabel: "≥ 90%", basis: "Total: permintaan penawaran · Tercapai: terkirim ≤ 1 hari kerja", period: "Bulanan", pic: "MarCom & Sertifikasi" },
  { no: 15, group: "C", text: "Survei lokasi / konsultasi pemasangan terjadwal ≤ 3 hari kerja", target: 0.9, targetLabel: "≥ 90%", basis: "Total: permintaan survei · Tercapai: terjadwal ≤ 3 hari kerja", period: "Bulanan", pic: "Divisi Proyek Lapangan" },
  { no: 16, group: "C", text: "Pelanggan puas (nilai survei kepuasan ≥ 80 dari 100)", target: 0.85, targetLabel: "≥ 85%", basis: "Total: responden survei · Tercapai: memberi nilai ≥ 80", period: "Per semester", pic: "MarCom & Sertifikasi" },
  { no: 17, group: "C", text: "Ulasan Google baru bintang 4–5 (rating saat ini 4,8 dari 42 ulasan)", target: 0.9, targetLabel: "≥ 90%", basis: "Total: ulasan baru periode ini · Tercapai: ulasan bintang 4–5", period: "Bulanan", pic: "MarCom & Sertifikasi" },
  { no: 18, group: "D", text: "Pengiriman tanpa keluhan mutu produk (retak, gompal, warna, dimensi)", target: 0.99, targetLabel: "≥ 99%", basis: "Total: jumlah pengiriman · Tercapai: tanpa keluhan mutu valid", period: "Bulanan", pic: "QC Produksi", auto: "complaint:quality", dataSource: `${complaint} "Mutu produk"` },
  { no: 19, group: "D", text: "Pengiriman tanpa keluhan pengiriman (terlambat, kurang, rusak)", target: 0.98, targetLabel: "≥ 98%", basis: "Total: jumlah pengiriman · Tercapai: tanpa keluhan pengiriman valid", period: "Bulanan", pic: "Mandor Pengiriman", auto: "complaint:delivery", dataSource: `${complaint} "Terlambat", "Jumlah/jenis tidak sesuai", "Rusak saat tiba"` },
  { no: 20, group: "D", text: "Transaksi tanpa keluhan pelayanan (respon lambat, informasi salah)", target: 0.99, targetLabel: "≥ 99%", basis: "Total: jumlah transaksi / PO · Tercapai: tanpa keluhan pelayanan valid", period: "Bulanan", pic: "Administrasi / MarCom", auto: "complaint:service", dataSource: "PO baru dikurangi NCR F-IB-15 berkategori \"Pelayanan\"" },
  { no: 21, group: "D", text: "Proyek jasa pasang paving & kanstin tanpa keluhan hasil pemasangan", target: 0.95, targetLabel: "≥ 95%", basis: "Total: proyek pasang selesai · Tercapai: tanpa keluhan valid", period: "Per semester", pic: "Divisi Proyek Lapangan" },
  { no: 22, group: "D", text: "Keluhan ditanggapi (respon awal) ≤ 24 jam", target: 1, targetLabel: "100%", basis: "Total: keluhan masuk · Tercapai: ditanggapi ≤ 24 jam", period: "Bulanan", pic: "Administrasi / MarCom" },
  { no: 23, group: "D", text: "Keluhan selesai (closed) ≤ 7 hari kerja", target: 0.9, targetLabel: "≥ 90%", basis: "Total: keluhan valid · Tercapai: selesai ≤ 7 hari kerja", period: "Bulanan", pic: "Manajer Perusahaan", auto: "complaint:closed7", dataSource: "NCR F-IB-15 sumber \"Keluhan Pelanggan\" yang closed ≤ 7 hari kerja (Jumat libur)" },
  { no: 24, group: "D", text: "Unit terkirim tanpa retur / penggantian (retur ≤ 0,5%)", target: 0.995, targetLabel: "≥ 99,5%", basis: "Total: unit dikirim · Tercapai: unit tidak diretur", period: "Bulanan", pic: "QC Produksi" },
  { no: 25, group: "E", text: "Paving press hydraulic lolos QC (reject ≤ 2%)", target: 0.98, targetLabel: "≥ 98%", basis: "Total: unit diproduksi · Tercapai: unit lolos QC", period: "Bulanan", pic: "Manajer / Leader Produksi", auto: "reject:paving", dataSource: reject },
  { no: 26, group: "E", text: "U-Ditch precast lolos QC (reject ≤ 1%)", target: 0.99, targetLabel: "≥ 99%", basis: "Total: unit diproduksi · Tercapai: unit lolos QC", period: "Bulanan", pic: "Manajer / Leader Produksi", auto: "reject:uditch", dataSource: reject },
  { no: 27, group: "E", text: "Kanstin wetcast lolos QC (reject ≤ 2%)", target: 0.98, targetLabel: "≥ 98%", basis: "Total: unit diproduksi · Tercapai: unit lolos QC", period: "Bulanan", pic: "Manajer / Leader Produksi", auto: "reject:kanstin", dataSource: reject },
  { no: 28, group: "E", text: "Buis beton vibrasi precast lolos QC (reject ≤ 2%)", target: 0.98, targetLabel: "≥ 98%", basis: "Total: unit diproduksi · Tercapai: unit lolos QC", period: "Bulanan", pic: "Manajer / Leader Produksi", auto: "reject:buisVibrasi", dataSource: `${reject} (ukuran/tipe tanpa kata "tumbuk")` },
  { no: 29, group: "E", text: "Buis beton tumbuk lolos QC (reject ≤ 3%)", target: 0.97, targetLabel: "≥ 97%", basis: "Total: unit diproduksi · Tercapai: unit lolos QC", period: "Bulanan", pic: "Manajer / Leader Produksi", auto: "reject:buisTumbuk", dataSource: `${reject} (ukuran/tipe berisi kata "tumbuk")` },
  { no: 30, group: "E", text: "Greffel beton tumbuk lolos QC (reject ≤ 3%)", target: 0.97, targetLabel: "≥ 97%", basis: "Total: unit diproduksi · Tercapai: unit lolos QC", period: "Bulanan", pic: "Manajer / Leader Produksi", auto: "reject:greffel", dataSource: reject },
];

export type ObjectiveStatus = "TERCAPAI" | "BELUM TERCAPAI" | "BELUM DIISI";

export function objectiveResult(objective: Objective, total: number | null, achieved: number | null) {
  if (!total || achieved === null) return { percent: null, status: "BELUM DIISI" as ObjectiveStatus };
  const percent = achieved / total;
  return { percent, status: (Math.round(percent * 10_000) >= Math.round(objective.target * 10_000) ? "TERCAPAI" : "BELUM TERCAPAI") as ObjectiveStatus };
}
