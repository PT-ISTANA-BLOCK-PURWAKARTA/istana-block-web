# Rekonstruksi app live -> Operasional web: keputusan pemilik (27 Okt 2026)

Konteks: app.kirimistanablock.com dipakai operasional harian dan menjalankan kode lebih baru dari repo GitHub
istana-block-inventori-ops (commit tunggal 18 Okt). Kode terbaru tidak bisa didapat; rekonstruksi dari bundel JS
live (`bundel-2026-10-26/`) + backup .sql (menunggu pemilik). Spesifikasi: `spek-pelanggan-rating-spesifikasi.md`,
`spek-stok-cat-produksi-api.md`.

| # | Topik | Keputusan |
|---|---|---|
| 1 | Stok Barang | GABUNG ke stok web (satu sumber kebenaran): opname = penyesuaian stok web, cat genteng = dokumen konversi natural->warna (stok + jurnal), jenis stok = barang web. Tidak ada angka stok kedua. |
| 2 | Rekap Pelanggan | Port PENUH sebagai menu baru: tabel leads sendiri (tautan opsional ke kontak web), impor/ekspor Excel format sama, penilaian pembeli, 5 Sasaran Mutu ISO otomatis. |
| 3 | Produksi & QC | Bawa SEMUA: Grade A/B/Reject, adukan cor bersama, metode Buis, spesifikasi produk, TTD ketidaksesuaian, uji lumpur skip/TTD bertingkat/ubah hasil, koreksi jam tiba & batalkan status, TTD hadir kalender. |
| 4 | Cutover | App lama JALAN TERUS sampai web setara. Lalu FRESH START (keputusan pemilik 27 Okt): data lama TIDAK dimigrasi; web mulai kosong, data induk (barang, jenis stok, spesifikasi produk, sopir, kendaraan, akun) diisi ulang. Saran: simpan satu backup final app lama sebagai arsip sebelum dimatikan. |

Belum di-port (catatan worklog lama, tetap berlaku): antrean offline sopir (tidak ada juga di app live),
resolve short-link Google Maps, peta live di Ringkasan, peringatan SIM di Ringkasan, reset password pengguna.

