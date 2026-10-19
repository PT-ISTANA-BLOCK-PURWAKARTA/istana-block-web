-- Data awal Istana Block (dari situs lama, Oktober 2026). Jalankan sekali setelah migrasi.
DELETE FROM products;
DELETE FROM articles;
DELETE FROM pages;
INSERT INTO products (slug, name, category, summary, description, price_from, price_to, unit, image_key, specs, price_rows, faq, tkdn, published, featured, sort_order, wa_text) VALUES ('paving-block', 'Paving Block', 'Paving', 'Bata (Truepave), hexagon, ubin (Fullpave), dan grass block. Tebal 6 dan 8 cm, warna abu, merah, dan hitam.', '## Pilihan motif

- **Truepave / bata** — motif paling umum untuk carport, halaman, dan jalan lingkungan.
- **Hexagon (segi enam)** — kuat mengunci untuk area parkir dan kawasan industri.
- **Fullpave / ubin** — permukaan rata dan rapi untuk teras dan trotoar.
- **Grass block** — area resapan dengan rumput di tengahnya.

Hitung kebutuhan per motif dan warna di [kalkulator pola paving](/pola-paving), lalu kirim hasilnya ke admin untuk penawaran lengkap.', 80000, NULL, 'm²', '/img/produk/paving-block.webp', '[{"label": "Mutu beton", "value": "K-350 – K-450, berstandar SNI"}, {"label": "Tebal", "value": "6 cm dan 8 cm"}, {"label": "Warna", "value": "Abu natural, merah, hitam"}, {"label": "Isi per m²", "value": "Bata 44 · hexagon 27 · ubin 22 · grass block 7,5"}]', '[{"group": "Paving block (material)", "variant": "Truepave / bata 21 × 10,5 cm", "detail": "44 pcs/m² · tebal 6 & 8 cm", "price": null, "unit": "m²"}, {"group": "Paving block (material)", "variant": "Hexagon / segi enam 20 × 20 cm", "detail": "27 pcs/m² · abu & merah", "price": null, "unit": "m²"}, {"group": "Paving block (material)", "variant": "Fullpave / ubin 21 × 21 cm", "detail": "22 pcs/m²", "price": null, "unit": "m²"}, {"group": "Paving block (material)", "variant": "Fullpave 30 × 30 cm", "detail": "11 pcs/m²", "price": null, "unit": "m²"}, {"group": "Paving block (material)", "variant": "Grass block 45 × 30 cm", "detail": "7,5 pcs/m² · tebal 6 & 8 cm", "price": null, "unit": "m²"}]', '[{"q": "Apakah harga sudah termasuk ongkir?", "a": "Belum. Ongkir dihitung dari jarak, volume, dan akses jalan ke titik bongkar, lalu dicantumkan di penawaran."}, {"q": "Berapa jumlah paving per meter persegi?", "a": "Bata/Truepave 44 pcs, hexagon 27 pcs, ubin 21×21 22 pcs, Fullpave 30×30 11 pcs, dan grass block 7,5 pcs per m². Tambahkan cadangan sekitar 5% untuk potongan tepi."}, {"q": "Bisa sekalian dipasang?", "a": "Bisa, untuk area minimal 200 m² dengan lahan siap pasang. Lihat paket Jasa Pasang Paving."}]', '91,58', 1, 1, 1, 'Halo Istana Block, saya ingin tanya harga paving block. Jenis (Truepave/hexagon/Fullpave/grass block): ..., Tebal (6/8 cm): ..., Warna: ..., Luas (m²): ..., Lokasi kirim: ...');
INSERT INTO products (slug, name, category, summary, description, price_from, price_to, unit, image_key, specs, price_rows, faq, tkdn, published, featured, sort_order, wa_text) VALUES ('u-ditch', 'U-Ditch', 'Saluran', 'Saluran drainase beton pracetak untuk jalan, perumahan, dan kawasan industri. Ukuran 30×30 sampai 80×80 cm, panjang 1,2 m, lengkap dengan cover heavy duty.', 'U-Ditch dicetak basah (wet cast) di pabrik Purwakarta dengan sambungan male–female sehingga pemasangan lebih cepat dan rapat. Cover heavy duty tersedia untuk saluran yang dilintasi kendaraan.', 270000, 840000, 'unit', '/img/produk/u-ditch.webp', '[{"label": "Mutu beton", "value": "K-350 (K-400 sesuai pesanan)"}, {"label": "Tulangan", "value": "U-50 drawn wire & BJDT"}, {"label": "Ukuran", "value": "300×300 – 800×800 mm"}, {"label": "Panjang", "value": "1,2 m per unit, sambungan male–female"}]', '[{"group": "U-Ditch (lebar × tinggi × panjang, mm)", "variant": "300 × 300 × 1200", "detail": "163,3 kg", "price": 270000, "unit": "unit"}, {"group": "U-Ditch (lebar × tinggi × panjang, mm)", "variant": "300 × 400 × 1200", "detail": "196,1 kg", "price": 305000, "unit": "unit"}, {"group": "U-Ditch (lebar × tinggi × panjang, mm)", "variant": "400 × 400 × 1200", "detail": "248,6 kg", "price": 365000, "unit": "unit"}, {"group": "U-Ditch (lebar × tinggi × panjang, mm)", "variant": "400 × 500 × 1200", "detail": "284,8 kg", "price": 415000, "unit": "unit"}, {"group": "U-Ditch (lebar × tinggi × panjang, mm)", "variant": "400 × 600 × 1200", "detail": "314,9 kg", "price": 440000, "unit": "unit"}, {"group": "U-Ditch (lebar × tinggi × panjang, mm)", "variant": "500 × 500 × 1200", "detail": "373,8 kg", "price": 465000, "unit": "unit"}, {"group": "U-Ditch (lebar × tinggi × panjang, mm)", "variant": "500 × 600 × 1200", "detail": "416 kg", "price": 525000, "unit": "unit"}, {"group": "U-Ditch (lebar × tinggi × panjang, mm)", "variant": "500 × 700 × 1200", "detail": "456,8 kg", "price": 595000, "unit": "unit"}, {"group": "U-Ditch (lebar × tinggi × panjang, mm)", "variant": "600 × 600 × 1200", "detail": "472 kg", "price": 640000, "unit": "unit"}, {"group": "U-Ditch (lebar × tinggi × panjang, mm)", "variant": "600 × 700 × 1200", "detail": "513,5 kg", "price": 740000, "unit": "unit"}, {"group": "U-Ditch (lebar × tinggi × panjang, mm)", "variant": "600 × 800 × 1200", "detail": "553,6 kg", "price": 815000, "unit": "unit"}, {"group": "U-Ditch (lebar × tinggi × panjang, mm)", "variant": "800 × 800 × 1200", "detail": "653,7 kg", "price": 840000, "unit": "unit"}, {"group": "Cover heavy duty", "variant": "300 × 600", "detail": "beban titik 5 ton", "price": 130000, "unit": "unit"}, {"group": "Cover heavy duty", "variant": "400 × 600", "detail": "beban titik 11,25 ton", "price": 170000, "unit": "unit"}, {"group": "Cover heavy duty", "variant": "500 × 600", "detail": "beban titik 11,25 ton", "price": 260000, "unit": "unit"}, {"group": "Cover heavy duty", "variant": "600 × 600", "detail": "beban titik 11,25 ton", "price": 320000, "unit": "unit"}, {"group": "Cover heavy duty", "variant": "800 × 600", "detail": "beban titik 11,25 ton", "price": 445000, "unit": "unit"}]', '[{"q": "Apakah harga sudah termasuk ongkir?", "a": "Belum. Ongkir dihitung dari jarak, volume, dan akses jalan ke titik bongkar, lalu dicantumkan di penawaran."}, {"q": "Berapa minimal pemesanan?", "a": "Eceran untuk renovasi rumah dilayani. Pengiriman ke Jabodetabek diprioritaskan untuk pesanan skala proyek."}, {"q": "Bisa minta salinan sertifikat TKDN?", "a": "Bisa, untuk dokumen tender. Minta lewat WhatsApp."}]', '78,61', 1, 1, 2, 'Halo Istana Block, saya ingin tanya harga U-Ditch. Ukuran: ..., Jumlah (unit/meter saluran): ..., Perlu cover (ya/tidak): ..., Lokasi kirim: ...');
INSERT INTO products (slug, name, category, summary, description, price_from, price_to, unit, image_key, specs, price_rows, faq, tkdn, published, featured, sort_order, wa_text) VALUES ('buis-beton', 'Buis Beton', 'Buis', 'Buis beton tumbuk, cor, dan bertulang diameter dalam Ø20–80 cm untuk sumur, gorong-gorong, dan sumur resapan. Tutup buis tersedia.', 'TKDN 100% berlaku untuk buis beton tanpa tulangan.', 65000, 1115000, 'pcs', '/img/produk/buis-beton.webp', '[{"label": "Mutu beton", "value": "K-300, dicetak basah"}, {"label": "Diameter dalam", "value": "Ø20 – Ø80 cm"}, {"label": "Jenis", "value": "Tumbuk, cor, bertulang"}, {"label": "Tulangan", "value": "U-50 drawn wire & BJDT"}]', '[{"group": "Buis beton", "variant": "Ø20 × 100 cm, tumbuk", "detail": "50 kg", "price": 65000, "unit": "pcs"}, {"group": "Buis beton", "variant": "Ø30 × 100 cm, tumbuk", "detail": "96 kg", "price": 85000, "unit": "pcs"}, {"group": "Buis beton", "variant": "Ø40 × 100 cm, tumbuk", "detail": "116,5 kg", "price": 105000, "unit": "pcs"}, {"group": "Buis beton", "variant": "Ø50 × 100 cm, tumbuk", "detail": "170 kg", "price": 185000, "unit": "pcs"}, {"group": "Buis beton", "variant": "Ø60 × 100 cm, tumbuk", "detail": "211 kg", "price": 240000, "unit": "pcs"}, {"group": "Buis beton", "variant": "Ø60 × 100 cm, cor", "detail": "245 kg", "price": 330000, "unit": "pcs"}, {"group": "Buis beton", "variant": "Ø80 × 50 cm, tumbuk", "detail": "230 kg", "price": 260000, "unit": "pcs"}, {"group": "Buis beton", "variant": "Ø80 × 50 cm, cor", "detail": "292 kg", "price": 300000, "unit": "pcs"}, {"group": "Buis beton", "variant": "Ø80 × 100 cm, cor", "detail": "584 kg", "price": 680000, "unit": "pcs"}, {"group": "Buis beton", "variant": "Ø80 × 100 cm, bertulang", "detail": "592 kg", "price": 1115000, "unit": "pcs"}, {"group": "Tutup buis", "variant": "Ø100 cm, tebal 8 cm", "detail": "", "price": 270000, "unit": "buah"}]', '[{"q": "Apa beda buis tumbuk, cor, dan bertulang?", "a": "Buis tumbuk dipadatkan dengan cara ditumbuk dan cocok untuk sumur atau resapan. Buis cor lebih padat dan berat. Buis bertulang memakai tulangan baja untuk beban yang lebih besar seperti gorong-gorong di bawah jalan."}, {"q": "Apakah harga sudah termasuk ongkir?", "a": "Belum. Ongkir dicantumkan di penawaran sesuai lokasi."}]', '100', 1, 1, 3, 'Halo Istana Block, saya minta penawaran buis beton. Diameter: ... cm, Jenis (tumbuk/cor/bertulang): ..., Jumlah: ... pcs, Perlu tutup (ya/tidak): ..., Lokasi kirim: ...');
INSERT INTO products (slug, name, category, summary, description, price_from, price_to, unit, image_key, specs, price_rows, faq, tkdn, published, featured, sort_order, wa_text) VALUES ('kanstin', 'Kanstin', 'Kanstin', 'Kanstin S, KS 20–30, DKI, taman, jumbo, trotoar, dan stopper ban untuk pembatas jalan, taman, dan pengunci paving.', '', 15000, NULL, 'buah', '/img/produk/kanstin.webp', '[{"label": "Jenis", "value": "S, KS 20/25/30, DKI, taman, jumbo, trotoar, stopper ban"}, {"label": "Fungsi", "value": "Pembatas jalan, taman, dan pengunci tepi paving"}]', '[{"group": "Kanstin", "variant": "Kanstin S", "detail": "40 × 30 × 15 cm", "price": null, "unit": "buah"}, {"group": "Kanstin", "variant": "Kanstin KS 20", "detail": "40 × 20 × 10 cm", "price": null, "unit": "buah"}, {"group": "Kanstin", "variant": "Kanstin KS 25", "detail": "40 × 25 cm, lebar 12/15 cm", "price": null, "unit": "buah"}, {"group": "Kanstin", "variant": "Kanstin KS 28", "detail": "40 × 28 cm, lebar 12/15 cm", "price": null, "unit": "buah"}, {"group": "Kanstin", "variant": "Kanstin KS 30", "detail": "60 × 30 cm, lebar 18/22 cm", "price": null, "unit": "buah"}, {"group": "Kanstin", "variant": "Kanstin 60 × 30 (21/26)", "detail": "60 × 30 cm, lebar 21/26 cm", "price": null, "unit": "buah"}, {"group": "Kanstin", "variant": "Stopper ban", "detail": "60 × 16 cm, lebar 7/16,5 cm", "price": null, "unit": "buah"}, {"group": "Kanstin", "variant": "Kanstin DKI", "detail": "", "price": null, "unit": "buah"}, {"group": "Kanstin", "variant": "Kanstin taman", "detail": "", "price": null, "unit": "buah"}, {"group": "Kanstin", "variant": "Kanstin jumbo", "detail": "", "price": null, "unit": "buah"}, {"group": "Kanstin", "variant": "Kanstin trotoar", "detail": "", "price": null, "unit": "buah"}]', '[{"q": "Apakah harga sudah termasuk ongkir?", "a": "Belum. Ongkir dicantumkan di penawaran sesuai lokasi."}]', NULL, 1, 1, 4, 'Halo Istana Block, saya ingin tanya harga kanstin. Jenis (S/KS/DKI/taman/jumbo/trotoar/stopper ban): ..., Jumlah (buah) atau panjang total (m): ..., Lokasi kirim: ...');
INSERT INTO products (slug, name, category, summary, description, price_from, price_to, unit, image_key, specs, price_rows, faq, tkdn, published, featured, sort_order, wa_text) VALUES ('genteng-beton', 'Genteng Beton', 'Atap', 'Genteng beton Garuda dan Flat, lengkap dengan nok, lisplang, nok ujung, dan triway dari pabrik yang sama.', '', 4500, NULL, 'pcs', '/img/produk/genteng-beton.webp', '[{"label": "Model", "value": "Garuda (gelombang) dan Flat"}, {"label": "Kebutuhan", "value": "10 pcs/m² (Garuda & Flat)"}, {"label": "Aksesoris", "value": "Nok, lisplang, nok ujung, triway"}]', '[{"group": "Genteng & aksesoris", "variant": "Genteng beton Garuda", "detail": "34 × 42 cm · 10 pcs/m²", "price": null, "unit": "pcs"}, {"group": "Genteng & aksesoris", "variant": "Genteng beton Flat", "detail": "42 × 33 cm · 10 pcs/m²", "price": null, "unit": "pcs"}, {"group": "Genteng & aksesoris", "variant": "Nok Garuda", "detail": "25 × 36 cm · 3 pcs/m", "price": null, "unit": "pcs"}, {"group": "Genteng & aksesoris", "variant": "Nok Flat", "detail": "24,5 × 42 cm · 2,5 pcs/m", "price": null, "unit": "pcs"}, {"group": "Genteng & aksesoris", "variant": "Lisplang", "detail": "", "price": null, "unit": "pcs"}, {"group": "Genteng & aksesoris", "variant": "Nok ujung", "detail": "", "price": null, "unit": "pcs"}, {"group": "Genteng & aksesoris", "variant": "Triway", "detail": "", "price": null, "unit": "pcs"}]', '[{"q": "Apakah harga sudah termasuk ongkir?", "a": "Belum. Ongkir dicantumkan di penawaran sesuai lokasi."}]', NULL, 1, 1, 5, 'Halo Istana Block, saya ingin tanya harga genteng beton. Model (Garuda/Flat): ..., Luas atap (m²): ..., Aksesoris (nok/lisplang/nok ujung/triway): ..., Lokasi kirim: ...');
INSERT INTO products (slug, name, category, summary, description, price_from, price_to, unit, image_key, specs, price_rows, faq, tkdn, published, featured, sort_order, wa_text) VALUES ('greffel-beton', 'Greffel Beton', 'Saluran', 'Saluran beton setengah lingkaran untuk drainase perumahan dan pinggir jalan.', '', NULL, NULL, 'pcs', '/img/produk/greffel-beton.webp', '[{"label": "Ukuran", "value": "20 – 50 × 100 cm"}]', '[{"group": "Greffel", "variant": "Greffel 20 cm", "detail": "panjang 100 cm · Ø dalam 20 / luar 27 cm", "price": null, "unit": "pcs"}, {"group": "Greffel", "variant": "Greffel 30 cm", "detail": "panjang 100 cm · Ø dalam 30 / luar 37 cm", "price": null, "unit": "pcs"}, {"group": "Greffel", "variant": "Greffel 40 cm", "detail": "panjang 100 cm · Ø dalam 40 / luar 48 cm", "price": null, "unit": "pcs"}, {"group": "Greffel", "variant": "Greffel 50 cm", "detail": "panjang 100 cm", "price": null, "unit": "pcs"}]', '[]', NULL, 1, 1, 6, 'Halo Istana Block, saya ingin tanya harga greffel beton. Ukuran: ..., Jumlah: ... pcs, Lokasi kirim: ...');
INSERT INTO products (slug, name, category, summary, description, price_from, price_to, unit, image_key, specs, price_rows, faq, tkdn, published, featured, sort_order, wa_text) VALUES ('jasa-pasang-paving', 'Jasa Pasang Paving', 'Jasa', 'Paving sekaligus pemasangan. Minimal 200 m², lahan siap pasang, survei lokasi dulu. Garansi 1 bulan.', '', 180000, 230000, 'm²', '/img/produk/jasa-pasang-paving.webp', '[{"label": "Luas minimal", "value": "200 m²"}, {"label": "Garansi", "value": "1 bulan"}, {"label": "Survei lokasi", "value": "Gratis, sebelum pengerjaan"}]', '[{"group": "Paket paving + pemasangan", "variant": "Small", "detail": "Leveling, abu batu, pasang, stamper kodok, finishing", "price": 180000, "unit": "m²"}, {"group": "Paket paving + pemasangan", "variant": "Medium", "detail": "Small + pemadatan pondasi & base course", "price": 220000, "unit": "m²"}, {"group": "Paket paving + pemasangan", "variant": "Large", "detail": "Medium + makadam/sirdam, stamper kuda", "price": 230000, "unit": "m²"}]', '[{"q": "Bagaimana jika luas di bawah 200 m²?", "a": "Hubungi admin; biaya alat dan mobilisasi akan dihitung terpisah."}]', NULL, 1, 0, 10, 'Halo Istana Block, saya ingin tanya paket paving + pemasangan. Paket (Small/Medium/Large): ..., Luas: ... m², Kondisi lahan: ..., Lokasi: ...');
INSERT INTO articles (slug, title, excerpt, content, published, published_at) VALUES ('cara-menghitung-kebutuhan-paving-block', 'Cara Menghitung Kebutuhan Paving Block per m²', 'Rumus sederhana dan tabel isi per m² untuk motif bata, hexagon, ubin, dan grass block, lengkap dengan contoh hitungan carport.', 'Jumlah paving yang perlu dipesan bergantung pada motif, karena tiap motif punya isi per meter persegi yang berbeda.

## Isi paving per m²

| Motif | Ukuran | Isi per m² |
|---|---|---|
| Truepave / bata | 21 × 10,5 cm | 44 pcs |
| Hexagon | 20 × 20 cm | 27 pcs |
| Fullpave / ubin | 21 × 21 cm | 22 pcs |
| Fullpave | 30 × 30 cm | 11 pcs |
| Grass block | 45 × 30 cm | 7,5 pcs |

## Rumus

**Jumlah paving = panjang × lebar × isi per m² × 1,05**

Angka 1,05 adalah cadangan 5% untuk potongan di tepi dan sudut.

Contoh: carport 10 × 5 m dengan paving bata → 50 m² × 44 × 1,05 = **2.310 pcs**.

## Jangan lupa kanstin

Tepi area paving perlu dikunci dengan kanstin agar paving tidak bergeser. Ukur keliling area yang tidak menempel dinding, lalu bagi dengan panjang satu kanstin.

Gunakan [kalkulator pola paving](/pola-paving) untuk menghitung otomatis per motif dan warna, lalu kirim hasilnya ke admin untuk penawaran lengkap dengan ongkir.', 1, unixepoch());
INSERT INTO pages (slug, title, kind, excerpt, content, published, seo_title, seo_description) VALUES ('paving-block-karawang-cikampek', 'Paving Block Karawang & Cikampek', 'area', 'Paving block, U-Ditch, dan buis beton dikirim dari pabrik Purwakarta ke Karawang dan Cikampek dengan armada sendiri. Jarak, wilayah, dan cara cek ongkir.', 'Pabrik Istana Block ada di Pasawahan, Purwakarta. Pesanan untuk Karawang dan Cikampek dikirim langsung dari pabrik dengan armada sendiri, yaitu truk crane dan truk flatbed.

## Jarak dan waktu tempuh dari pabrik

| Tujuan | Rute | Jarak | Waktu tempuh mobil* |
|---|---|---|---|
| Cikampek | Jl. Raya Purwakarta–Cikampek | ±29 km | ±55 menit |
| Karawang Barat | Tol Cipularang, lanjut Tol Jakarta–Cikampek | ±48 km | ±1 jam 10 menit |

\*Perkiraan waktu tempuh mobil menurut Google Maps. Truk bermuatan biasanya lebih lama. Jadwal kirim yang pasti dicantumkan admin di penawaran.

## Wilayah yang dilayani

**Kecamatan:** Karawang Barat, Karawang Timur, Telukjambe Timur, Telukjambe Barat, Klari, Cikampek, Kotabaru, Jatisari, Purwasari, Rengasdengklok, dan Cilamaya.

**Kawasan industri dan perumahan:** KIIC, Suryacipta, dan Kota Bukit Indah.

Lokasi Anda tidak ada di daftar? Kirim alamat atau titik peta lewat WhatsApp, admin akan memastikan bisa tidaknya dikirim.

## Produk yang bisa dikirim

| Produk | Keterangan | Harga mulai* |
|---|---|---|
| [Paving block](/produk/paving-block) | Truepave (bata), hexagon, Fullpave (ubin), grass block; tebal 6 dan 8 cm | Rp80.000/m² (mutu K-350) |
| [U-Ditch](/produk/u-ditch) | 12 ukuran, 30×30 sampai 80×80 cm, panjang 120 cm; cover heavy duty tersedia | Rp270.000/unit |
| [Buis beton](/produk/buis-beton) | Diameter dalam Ø20–80 cm; tumbuk, cor, dan bertulang | Rp65.000/pcs |

\*Harga pabrik, belum termasuk ongkir, dan bisa berubah. Daftar harga per ukuran ada di halaman tiap produk.

[Kanstin](/produk/kanstin), [genteng beton](/produk/genteng-beton), dan [greffel beton](/produk/greffel-beton) bisa dikirim bersama dalam satu penawaran dan satu jadwal. Untuk proyek dengan banyak jenis material, lihat [Paket Material Proyek](/paket-proyek).

## Pilihan paving sesuai pemakaian

| Pemakaian | Saran |
|---|---|
| Gudang dan area kendaraan berat | Truepave 8 cm, pola tulang ikan (herringbone), mutu K-400 atau K-450 |
| Rumah dan carport | Truepave 6 cm atau grass block |
| Area publik | Hexagon, dengan cadangan 10% untuk potongan di tepi |
| Toko dan kafe | Fullpave, atau Fullpave 21 dengan bingkai Truepave |

Hitung jumlah paving per pola dan warna di [kalkulator pola paving](/pola-paving).

## Cara ongkir dihitung

Ongkir tidak termasuk dalam harga produk dan ditulis terpisah di penawaran. Besarnya bergantung pada tiga hal:

- **Jarak** dari pabrik di Pasawahan ke titik bongkar.
- **Volume pesanan.** Makin penuh muatan satu truk, makin rendah ongkir per unit.
- **Akses di titik bongkar,** yaitu apakah truk bisa masuk dan ada ruang untuk menurunkan barang.

## Cara memesan

1. **Hitung kebutuhan:** luas (m²) untuk paving, jumlah unit atau panjang saluran untuk U-Ditch, jumlah pcs untuk buis beton.
2. **Kirim lewat WhatsApp** ke 0813 8888 5141: produk, volume, alamat atau titik peta, dan kondisi akses truk.
3. **Terima penawaran tertulis** berisi harga produk, ongkir, dan perkiraan jadwal kirim.
4. **Konfirmasi pesanan:** DP dibayar saat PO, pelunasan saat barang tiba di lokasi. Admin lalu mengonfirmasi jadwal kirim.

## Dokumen TKDN

Paving block, U-Ditch, dan buis beton tanpa tulangan bersertifikat TKDN dari Kementerian Perindustrian. Salinannya bisa diminta untuk tender atau pengajuan material. Rinciannya ada di halaman [Sertifikat TKDN](/sertifikat-tkdn).

## Pertanyaan umum

### Berapa lama pengiriman ke Karawang atau Cikampek?

Bergantung pada stok, volume, dan jarak. Admin mencantumkan perkiraan jadwal kirim di penawaran. Sebagai gambaran, perjalanan mobil dari pabrik ke Cikampek sekitar 55 menit; truk bermuatan lebih lama.

### Apakah harga di situs sudah termasuk ongkir?

Belum. Harga produk dan ongkir ditulis terpisah di penawaran, sehingga Anda bisa melihat biaya masing-masing.

### Bisa kirim ke dalam KIIC atau Suryacipta?

Bisa, keduanya termasuk wilayah yang dilayani. Sebutkan nama kawasan, blok, dan titik bongkar saat minta penawaran agar akses truk bisa diperhitungkan.

### Bisa pesan dalam jumlah kecil?

Bisa. Pesanan eceran untuk renovasi rumah juga dilayani; syarat skala proyek hanya berlaku untuk Jabodetabek. Ongkir per unit lebih tinggi bila muatannya sedikit.

### Bisa sekalian dipasang?

Jasa pasang paving tersedia untuk area minimal 200 m², dengan lahan siap pasang dan survei lokasi lebih dulu. Lihat [Jasa Pasang Paving](/produk/jasa-pasang-paving) dan tanyakan ketersediaan tim untuk lokasi Anda.
', 1, 'Paving Block Karawang & Cikampek | Istana Block', 'Paving block, U-Ditch, dan buis beton dari pabrik Purwakarta dikirim ke Karawang dan Cikampek dengan armada sendiri. Cek jarak, wilayah, dan ongkir.');
INSERT INTO pages (slug, title, kind, excerpt, content, published, seo_title, seo_description) VALUES ('paving-block-subang', 'Paving Block Subang', 'area', 'Paving block, U-Ditch, dan buis beton dikirim dari pabrik Purwakarta ke Subang lewat Kalijati atau Tol Cipali. Jarak, kecamatan, dan cara cek ongkir.', 'Pesanan untuk Kabupaten Subang dikirim langsung dari pabrik Istana Block di Pasawahan, Purwakarta, dengan truk crane dan truk flatbed milik sendiri. Ke Subang kota ada dua jalur: jalan raya lewat Campaka–Kalijati, atau Tol Cipali.

## Jarak dan waktu tempuh dari pabrik

| Tujuan | Rute | Jarak | Waktu tempuh mobil* |
|---|---|---|---|
| Subang kota | Campaka–Kalijati | ±51 km | ±1 jam 25 menit |
| Subang kota | Tol Cipali (Cikopo–Palimanan) | ±72 km | ±1 jam 15 menit |

\*Perkiraan waktu tempuh mobil menurut Google Maps. Truk bermuatan biasanya lebih lama. Jadwal kirim yang pasti dicantumkan admin di penawaran.

## Wilayah yang dilayani

**Kecamatan:** Kalijati, Cipeundeuy, Pabuaran, Purwadadi, Cibogo, Pagaden, Subang kota, Jalancagak, dan Pamanukan.

Lokasi Anda tidak ada di daftar? Kirim alamat atau titik peta lewat WhatsApp, admin akan memastikan bisa tidaknya dikirim.

## Produk yang bisa dikirim

| Produk | Keterangan | Harga mulai* |
|---|---|---|
| [Paving block](/produk/paving-block) | Truepave (bata), hexagon, Fullpave (ubin), grass block; tebal 6 dan 8 cm | Rp80.000/m² (mutu K-350) |
| [U-Ditch](/produk/u-ditch) | 12 ukuran, 30×30 sampai 80×80 cm, panjang 120 cm; cover heavy duty tersedia | Rp270.000/unit |
| [Buis beton](/produk/buis-beton) | Diameter dalam Ø20–80 cm; tumbuk, cor, dan bertulang | Rp65.000/pcs |

\*Harga pabrik, belum termasuk ongkir, dan bisa berubah. Daftar harga per ukuran ada di halaman tiap produk.

[Kanstin](/produk/kanstin), [genteng beton](/produk/genteng-beton), dan [greffel beton](/produk/greffel-beton) bisa dikirim bersama dalam satu penawaran dan satu jadwal. Untuk menghitung jumlah paving per pola dan warna, pakai [kalkulator pola paving](/pola-paving).

## Cara ongkir dihitung

Ongkir tidak termasuk dalam harga produk dan ditulis terpisah di penawaran. Besarnya bergantung pada tiga hal:

- **Jarak** dari pabrik di Pasawahan ke titik bongkar.
- **Volume pesanan.** Makin penuh muatan satu truk, makin rendah ongkir per unit.
- **Akses di titik bongkar,** yaitu apakah truk bisa masuk dan ada ruang untuk menurunkan barang.

## Cara memesan

1. **Hitung kebutuhan:** luas (m²) untuk paving, jumlah unit atau panjang saluran untuk U-Ditch, jumlah pcs untuk buis beton.
2. **Kirim lewat WhatsApp** ke 0813 8888 5141: produk, volume, nama kecamatan dan alamat atau titik peta, serta kondisi akses truk.
3. **Terima penawaran tertulis** berisi harga produk, ongkir, dan perkiraan jadwal kirim.
4. **Konfirmasi pesanan:** DP dibayar saat PO, pelunasan saat barang tiba di lokasi. Admin lalu mengonfirmasi jadwal kirim.

## Dokumen TKDN

Paving block, U-Ditch, dan buis beton tanpa tulangan bersertifikat TKDN dari Kementerian Perindustrian. Salinannya bisa diminta untuk tender atau pengajuan material. Rinciannya ada di halaman [Sertifikat TKDN](/sertifikat-tkdn).

## Pertanyaan umum

### Berapa lama pengiriman ke Subang?

Bergantung pada stok, volume, dan jarak. Admin mencantumkan perkiraan jadwal kirim di penawaran. Perjalanan mobil dari pabrik ke Subang kota sekitar 1 jam 15 menit sampai 1 jam 25 menit, tergantung jalur; truk bermuatan lebih lama.

### Apakah Pamanukan dan Jalancagak juga dilayani?

Ya, keduanya termasuk wilayah yang dilayani. Untuk lokasi lain di Subang, kirim alamat atau titik peta agar admin bisa memastikan.

### Apakah harga di situs sudah termasuk ongkir?

Belum. Harga produk dan ongkir ditulis terpisah di penawaran. Makin banyak muatan per truk, makin rendah ongkir per unit.

### Bisa pesan dalam jumlah kecil?

Bisa. Pesanan eceran untuk renovasi rumah juga dilayani; syarat skala proyek hanya berlaku untuk Jabodetabek. Ongkir per unit lebih tinggi bila muatannya sedikit.
', 1, 'Paving Block Subang dari Pabrik Purwakarta | Istana Block', 'Paving block, U-Ditch, dan buis beton dikirim dari pabrik Purwakarta ke Subang dengan armada sendiri. Lihat jarak, rute, kecamatan, dan cara cek ongkir.');
INSERT INTO pages (slug, title, kind, excerpt, content, published, seo_title, seo_description) VALUES ('paving-block-bekasi-cikarang', 'Paving Block Bekasi & Cikarang', 'area', 'Paving block, U-Ditch, dan buis beton ke Bekasi dan Cikarang untuk pesanan skala proyek. Jarak dari pabrik, kawasan industri, dan cara memesan.', 'Bekasi dan Cikarang termasuk wilayah Jabodetabek. Ke wilayah ini Istana Block mengirim khusus untuk pesanan skala proyek dengan volume minimal. Barang dikirim langsung dari pabrik di Pasawahan, Purwakarta, dengan truk crane dan truk flatbed milik sendiri.

## Khusus pesanan skala proyek

Pengiriman ke Bekasi dan Cikarang ditujukan untuk:

- kontraktor jalan, drainase, dan lanskap;
- pengembang perumahan;
- pengelola kawasan industri, gudang, dan pabrik;
- instansi pemerintah dan BUMN yang membutuhkan dokumen TKDN.

Volume minimal per pengiriman: ditentukan per proyek. Admin menyampaikan ketentuan minimal order bersama penawaran.

## Jarak dan waktu tempuh dari pabrik

| Tujuan | Rute | Jarak | Waktu tempuh mobil* |
|---|---|---|---|
| Cikarang | Tol Jakarta–Cikampek | ±63 km | ±1 jam 10 menit |
| Kota Bekasi | — | ±88 km | ±1 jam 30 menit |

\*Perkiraan waktu tempuh mobil menurut Google Maps. Truk bermuatan biasanya lebih lama. Jadwal kirim yang pasti dicantumkan admin di penawaran.

## Wilayah yang dilayani

**Kecamatan dan kota:** Cikarang Utara, Cikarang Selatan, Cikarang Barat, Cikarang Timur, Cikarang Pusat, Cibitung, Tambun, Setu, Serang Baru, dan Kota Bekasi.

**Kawasan industri:** Jababeka, EJIP, MM2100, dan Delta Silicon.

## Produk untuk proyek

| Produk | Keterangan | Harga mulai* |
|---|---|---|
| [Paving block](/produk/paving-block) | Truepave (bata), hexagon, Fullpave (ubin), grass block; tebal 6 dan 8 cm | Rp80.000/m² (mutu K-350) |
| [U-Ditch](/produk/u-ditch) | 12 ukuran, 30×30 sampai 80×80 cm, panjang 120 cm; cover heavy duty tersedia | Rp270.000/unit |
| [Buis beton](/produk/buis-beton) | Diameter dalam Ø20–80 cm; tumbuk, cor, dan bertulang | Rp65.000/pcs |

\*Harga pabrik, belum termasuk ongkir, dan bisa berubah. Daftar harga per ukuran ada di halaman tiap produk.

Paving, kanstin, U-Ditch, buis, dan genteng untuk satu proyek bisa digabung dalam satu penawaran dan satu jadwal kirim. Lihat [Paket Material Proyek](/paket-proyek).

## Cara ongkir dihitung

Ongkir tidak termasuk dalam harga produk dan ditulis terpisah di penawaran. Besarnya bergantung pada tiga hal:

- **Jarak** dari pabrik di Pasawahan ke titik bongkar.
- **Volume pesanan.** Makin penuh muatan satu truk, makin rendah ongkir per unit.
- **Akses di titik bongkar,** yaitu apakah truk bisa masuk dan ada ruang untuk menurunkan barang.

## Cara memesan

1. **Kirim kebutuhan lewat WhatsApp** ke 0813 8888 5141: gambar kerja, BoQ, atau daftar produk dan volume, beserta lokasi proyek.
2. **Jelaskan akses di lokasi:** nama kawasan, blok, dan titik bongkar, serta apakah truk crane bisa masuk.
3. **Terima ketentuan minimal order dan penawaran tertulis** berisi harga produk, ongkir, dan perkiraan jadwal kirim.
4. **Konfirmasi pesanan:** DP dibayar saat PO, pelunasan saat barang tiba di lokasi. Admin lalu mengonfirmasi jadwal kirim.

## Dokumen TKDN untuk tender

Paving block (TKDN 91,58%), U-Ditch (78,61%), dan buis beton tanpa tulangan (100%) bersertifikat TKDN dari Kementerian Perindustrian. Salinan sertifikat untuk dokumen tender bisa diminta lewat WhatsApp. Nomor dan masa berlakunya ada di halaman [Sertifikat TKDN](/sertifikat-tkdn).

## Pertanyaan umum

### Bisa kirim untuk kebutuhan rumah tinggal di Bekasi?

Pengiriman ke Bekasi dan Cikarang diutamakan untuk volume proyek. Untuk kebutuhan kecil, tanyakan dulu ke admin sebelum memesan.

### Berapa minimal order ke Bekasi atau Cikarang?

Ketentuannya disampaikan admin setelah Anda mengirim produk, volume, dan lokasi proyek, bersama penawaran harga dan ongkir.

### Bisa kirim ke Jababeka, EJIP, MM2100, atau Delta Silicon?

Bisa, keempatnya termasuk wilayah yang dilayani. Sebutkan nama kawasan, blok, dan titik bongkar agar akses truk bisa diperhitungkan.

### Apakah harga di situs sudah termasuk ongkir?

Belum. Harga produk dan ongkir ditulis terpisah di penawaran.

### Bisa minta salinan sertifikat TKDN untuk tender?

Bisa. Minta lewat WhatsApp dengan menyebutkan produk dan nama proyek atau instansi.
', 1, 'Paving Block Bekasi & Cikarang untuk Proyek | Istana Block', 'Paving block, U-Ditch, dan buis beton untuk proyek di Bekasi dan Cikarang, dari pabrik Purwakarta. Dokumen TKDN tersedia. Cek jarak dan cara pesan.');
INSERT INTO pages (slug, title, kind, excerpt, content, published, seo_title, seo_description) VALUES ('sertifikat-tkdn', 'Sertifikat TKDN', 'info', 'Nomor, nilai, dan masa berlaku sertifikat TKDN Kemenperin untuk paving block, U-Ditch, dan buis beton Istana Block, serta cara meminta salinannya.', 'PT Istana Block Purwakarta memegang tiga sertifikat TKDN dari Kementerian Perindustrian, untuk paving block, U-Ditch, dan buis beton tanpa tulangan. Ketiganya berlaku 18 Agustus 2026 sampai 18 Agustus 2031.

## Apa itu TKDN

TKDN (Tingkat Komponen Dalam Negeri) adalah besarnya kandungan dalam negeri pada suatu produk, dinyatakan dalam persen. Nilainya dihitung dari komponen yang dipakai untuk membuat produk, seperti bahan, tenaga kerja, dan alat produksi. Sertifikatnya diterbitkan Kementerian Perindustrian setelah perhitungan itu diverifikasi.

## Mengapa penting untuk pengadaan pemerintah dan BUMN

Instansi pemerintah, pemerintah daerah, dan BUMN wajib mengutamakan produk dalam negeri dalam pengadaan barang dan jasa. Nilai TKDN pada sertifikat menjadi bukti yang dipakai panitia untuk menilai pemenuhan kewajiban itu, misalnya saat menyusun spesifikasi, mengevaluasi penawaran, atau memberi preferensi harga.

Bagi kontraktor, material bersertifikat TKDN memudahkan pemenuhan dokumen tender dan laporan penggunaan produk dalam negeri.

## Daftar sertifikat

| Produk | Lingkup ukuran | Nilai TKDN | Nomor sertifikat | Masa berlaku |
|---|---|---|---|---|
| [Buis beton](/produk/buis-beton) tanpa tulangan | 20×100 cm s.d. 80×100 cm | 100% | 9632/SJ-IND.8/TKDN/LVI/08/2026 | 18 Agustus 2026 – 18 Agustus 2031 |
| [Paving block](/produk/paving-block) natural dan berwarna | 10×10×6 cm s.d. 45×30×10 cm | 91,58% | 9656/SJ-IND.8/TKDN/LVI/08/2026 | 18 Agustus 2026 – 18 Agustus 2031 |
| [U-Ditch](/produk/u-ditch) | 30×30×120 cm s.d. 100×100×120 cm | 78,61% | 9657/SJ-IND.8/TKDN/LVI/08/2026 | 18 Agustus 2026 – 18 Agustus 2031 |

Ketiga sertifikat atas nama PT Istana Block Purwakarta dan dapat dicek di situs resmi TKDN Kementerian Perindustrian dengan nomor sertifikat di atas.

Lingkup ukuran mengikuti sertifikat. Ketersediaan ukuran tertentu, terutama U-Ditch di atas 80×80 cm, tanyakan ke admin.

Buis beton bertulang, kanstin, genteng beton, dan greffel beton tidak tercakup dalam sertifikat ini.

## Meminta salinan sertifikat

Salinan sertifikat untuk dokumen tender atau pengajuan material bisa diminta lewat WhatsApp ke 0813 8888 5141. Sertakan:

1. nama perusahaan atau instansi dan nama proyek;
2. produk yang dibutuhkan: paving block, U-Ditch, atau buis beton;
3. keperluannya, misalnya dokumen tender atau pengajuan material ke konsultan pengawas.

Jika sekaligus membutuhkan penawaran harga, sebutkan juga volume dan lokasi proyek.

## Produk bersertifikat TKDN

- [Paving block](/produk/paving-block): Truepave, hexagon, Fullpave, dan grass block.
- [U-Ditch](/produk/u-ditch): saluran beton pracetak dengan sambungan male–female, panjang 1,2 m per unit.
- [Buis beton](/produk/buis-beton): TKDN 100% berlaku untuk buis tanpa tulangan.

Untuk pengadaan beberapa produk sekaligus, lihat [Paket Material Proyek](/paket-proyek).
', 1, 'Sertifikat TKDN Paving, U-Ditch & Buis Beton | Istana Block', 'Paving block TKDN 91,58%, U-Ditch 78,61%, dan buis beton tanpa tulangan 100%. Nomor sertifikat Kemenperin, masa berlaku, dan cara meminta salinan.');
INSERT INTO pages (slug, title, kind, excerpt, content, published, seo_title, seo_description) VALUES ('profil', 'Profil Perusahaan', 'info', 'PT Istana Block Purwakarta: pabrik paving block, U-Ditch, buis beton, kanstin, dan genteng beton di Pasawahan, Purwakarta, sejak 2016.', 'Istana Block Purwakarta adalah pabrik beton pracetak di Pasawahan, Kabupaten Purwakarta, yang berdiri sejak 2016. Badan usahanya PT Istana Block Purwakarta.

## Produk

- **[Paving block](/produk/paving-block):** Truepave (bata), hexagon (segi enam), Fullpave (ubin 21×21 dan 30×30 cm), dan grass block. Tebal 6 dan 8 cm, warna abu natural, merah, dan hitam.
- **[U-Ditch](/produk/u-ditch):** ukuran 30×30 sampai 80×80 cm, panjang 1,2 m per unit, dengan cover heavy duty.
- **[Buis beton](/produk/buis-beton):** tumbuk, cor, dan bertulang, diameter dalam Ø20–80 cm, beserta tutup buis.
- **[Kanstin](/produk/kanstin):** Kanstin S, KS 20–30, DKI, taman, jumbo, trotoar, dan stopper ban.
- **[Genteng beton](/produk/genteng-beton):** model Garuda dan Flat, dengan nok, lisplang, nok ujung, dan triway.
- **[Greffel beton](/produk/greffel-beton).**

Harga acuan tiap ukuran tercantum di halaman produk. Beberapa produk bisa dipesan sekaligus dalam satu penawaran; lihat [Paket Material Proyek](/paket-proyek).

## Pabrik dan lokasi

Alamat pabrik: Jl. Terusan Kapten Halim No.121, Kec. Pasawahan, Purwakarta, Jawa Barat 41172.

Pabrik punya akses ke Tol Cipularang, Tol Jakarta–Cikampek, dan Tol Cipali. Jam operasional Sabtu–Kamis, 07.30–17.00.

Anda bisa datang ke pabrik untuk melihat dan memeriksa produk sebelum memesan. Kunjungan dijadwalkan lebih dulu lewat admin.

## Pengiriman dengan armada sendiri

Pesanan dikirim dengan truk crane dan truk flatbed milik sendiri ke:

- seluruh Kabupaten Purwakarta;
- Jawa Barat: Karawang, Cikampek, Subang, Bandung, Cimahi, Bandung Barat, Cianjur, dan Sumedang;
- Jabodetabek, khusus pesanan skala proyek.

Ongkir dihitung dari jarak, volume, dan akses di titik bongkar. Rinciannya ada di [Area Pengiriman](/area-pengiriman).

## Jasa pemasangan

Selain menjual material, kami memasang paving block untuk area minimal 200 m² dengan lahan siap pasang. Lokasi disurvei dan diukur lebih dulu tanpa biaya, dan pemasangan bergaransi 1 bulan. Lihat [Jasa Pasang Paving](/produk/jasa-pasang-paving). Kanstin juga bisa dipasang; ketentuannya tanyakan ke admin.

## Cara kami menjaga mutu

- **Mutu beton per produk:** paving block K-350 sampai K-450, U-Ditch K-350 (K-400 sesuai pesanan), buis beton K-300.
- **U-Ditch dan buis beton dicetak basah (wet cast).** U-Ditch dipadatkan dengan getaran frekuensi tinggi dan memakai sambungan male–female.
- **Tulangan** U-Ditch dan buis bertulang memakai kawat U-50 (drawn wire) dan BJDT.
- **Paving block** dicetak dengan mesin press di pabrik sendiri.
- **Pemeriksaan oleh pembeli:** pelanggan proyek dapat mengunjungi pabrik untuk memeriksa mutu sebelum produksi dan pengiriman.

## Sertifikat TKDN

Paving block (91,58%), U-Ditch (78,61%), dan buis beton tanpa tulangan (100%) bersertifikat TKDN dari Kementerian Perindustrian, berlaku 18 Agustus 2026 sampai 18 Agustus 2031. Nomor sertifikat ada di halaman [Sertifikat TKDN](/sertifikat-tkdn).

## Proyek dan klien

Dokumentasi hasil pemasangan dapat dilihat di [galeri](/galeri).

## Hubungi kami

Nomor WhatsApp, telepon, email, dan jam operasional ada di halaman [Kontak](/kontak). Foto kegiatan pabrik dan proyek ada di [Galeri](/galeri).
', 1, 'Profil Istana Block Purwakarta, Pabrik Beton Sejak 2016', 'PT Istana Block Purwakarta memproduksi paving block, U-Ditch, buis beton, kanstin, dan genteng beton di Pasawahan sejak 2016, dengan armada kirim sendiri.');
INSERT INTO pages (slug, title, kind, excerpt, content, published, seo_title, seo_description) VALUES ('privacy-policy', 'Kebijakan Privasi', 'info', 'Data apa yang diproses saat Anda membuka situs Istana Block atau menghubungi kami lewat WhatsApp, telepon, dan email, serta hak Anda menurut UU PDP.', '**Berlaku sejak:** 15 Oktober 2026

Kebijakan ini menjelaskan data pribadi apa yang diproses saat Anda membuka istanablockpurwakarta.com atau menghubungi kami, untuk apa data itu dipakai, dan apa hak Anda menurut Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP).

## Siapa kami

Pengendali data adalah PT Istana Block Purwakarta, Jl. Terusan Kapten Halim No.121, Kec. Pasawahan, Purwakarta, Jawa Barat 41172. Email: cs@istanablock.com.

## Ringkasnya

- Situs ini tidak punya formulir untuk pengunjung. Anda tidak perlu mengisi data apa pun di situs.
- Situs ini memuat Google Tag Manager untuk menjalankan Google Analytics (statistik kunjungan) dan Google Ads (pengukuran iklan). Penjelasan dan cara menolaknya ada di bagian "Pengukuran kunjungan dan iklan".
- Cookie yang dibuat situs ini sendiri hanya satu, untuk login admin. Cookie pengukuran dan iklan dipasang oleh Google, lihat bagian "Cookie".
- Kami baru menerima data pribadi Anda bila Anda sendiri menghubungi kami lewat WhatsApp, telepon, atau email.

## Data teknis saat Anda membuka situs

Situs ini di-hosting di Cloudflare. Setiap kali halaman dibuka, Cloudflare memproses data teknis yang dikirim browser Anda, seperti alamat IP, waktu akses, alamat halaman, serta jenis browser dan perangkat. Data ini dipakai untuk menayangkan halaman, menangkal serangan, dan mencatat gangguan teknis. Kami dapat melihat catatan teknis tersebut untuk memperbaiki gangguan, tetapi tidak memakainya untuk mengenali pengunjung, membuat profil, atau beriklan.

Catatan teknis disimpan dalam jangka waktu terbatas sesuai pengaturan layanan Cloudflare.

Percobaan login yang gagal ke panel admin dicatat bersama alamat IP untuk membatasi upaya menebak kata sandi.

## Cookie

| Cookie | Dipasang oleh | Untuk siapa | Fungsi | Masa berlaku |
|---|---|---|---|---|
| `ib_session` | Situs ini | Admin yang login | Menjaga sesi login panel admin | 7 hari, atau sampai admin keluar |
| Cookie keamanan Cloudflare | Cloudflare | Pengunjung, bila fitur keamanan Cloudflare aktif | Membedakan pengunjung manusia dari bot | Ditentukan Cloudflare |
| Cookie Google Analytics dan Google Ads (berawalan `_ga` dan `_gcl`) | Google, lewat skrip yang dimuat situs ini | Pengunjung | Mengukur kunjungan dan klik tombol WhatsApp atau telepon, serta menghubungkan klik iklan dengan pesan yang masuk | Ditentukan Google |

Cookie `ib_session` hanya dibuat setelah admin berhasil login, bersifat HttpOnly sehingga tidak bisa dibaca skrip di halaman, dan tidak dipasang untuk pengunjung biasa. Cookie keamanan Cloudflare tidak dipakai untuk iklan.

## Pengukuran kunjungan dan iklan

Situs ini memuat Google Tag Manager, yang menjalankan Google Analytics dan Google Ads. Keduanya dikelola Google dan memasang cookie pengukuran dan iklan di browser Anda saat Anda membuka situs.

Yang diukur: halaman yang dibuka, sumber kunjungan (misalnya klik dari iklan Google), jenis perangkat dan browser, perkiraan lokasi, dan apakah Anda menekan tombol WhatsApp atau telepon. Kami memakai data ini untuk mengetahui halaman mana yang dibaca dan apakah iklan menghasilkan pesan atau panggilan. Google Ads juga dapat memakainya untuk menampilkan iklan Istana Block kepada orang yang pernah membuka situs ini.

Situs ini tidak punya formulir, sehingga kami tidak mengirim nama, nomor telepon, atau email Anda ke Google lewat situs. Data diproses oleh Google dan dapat disimpan di luar Indonesia. Cara Google memakai data dari situs yang memakai layanannya dijelaskan di [policies.google.com/technologies/partner-sites](https://policies.google.com/technologies/partner-sites).

Cara mengatur atau menolak:

- Hapus atau blokir cookie lewat pengaturan browser, atau buka situs dalam mode pribadi. Tombol WhatsApp dan telepon tetap berfungsi tanpa cookie.
- Pasang [add-on browser Google Analytics Opt-out](https://tools.google.com/dlpage/gaoptout) untuk menolak pengukuran Google Analytics.
- Atur atau matikan personalisasi iklan di [adssettings.google.com](https://adssettings.google.com).
- Di ponsel, atur atau setel ulang ID iklan lewat pengaturan perangkat.

## Tautan ke WhatsApp, telepon, email, dan peta

Tombol WhatsApp, telepon, email, dan Google Maps di situs ini membuka aplikasi atau layanan pihak ketiga: WhatsApp milik Meta, aplikasi telepon, aplikasi email Anda, dan Google Maps. Saat tombol WhatsApp ditekan, browser Anda membuka WhatsApp beserta teks pesan yang sudah terisi; teks ini bisa Anda ubah atau hapus sebelum dikirim. Pemrosesan data di layanan tersebut tunduk pada kebijakan privasi masing-masing penyedia.

## Data yang kami terima saat Anda menghubungi kami

Jika Anda menghubungi kami, kami menerima data yang Anda kirim. Biasanya berupa:

- nama dan nomor WhatsApp atau telepon, atau alamat email;
- alamat atau titik lokasi pengiriman dan pemasangan;
- kebutuhan produk dan volume, serta dokumen yang Anda kirim seperti gambar kerja atau BoQ;
- nama perusahaan atau instansi dan nama proyek, untuk pesanan proyek;
- data yang diperlukan untuk penagihan dan pembayaran.

## Untuk apa data dipakai

- Menyusun penawaran harga dan ongkir.
- Menjadwalkan produksi, pengiriman, survei, dan pemasangan.
- Mengirim dokumen yang Anda minta, misalnya salinan sertifikat TKDN.
- Menagih dan mencatat pembayaran.
- Menangani keluhan dan garansi pemasangan.
- Memenuhi kewajiban hukum, misalnya pembukuan dan perpajakan.

Dasar pemrosesannya adalah permintaan Anda, pelaksanaan perjanjian jual beli atau jasa, dan kewajiban hukum. Kami tidak memakai data Anda untuk promosi tanpa persetujuan Anda.

## Dengan siapa data dibagikan

Kami tidak menjual atau menyewakan data pribadi. Data hanya dibagikan sejauh diperlukan kepada:

- penyedia layanan yang kami pakai untuk berkomunikasi dan menjalankan situs, yaitu WhatsApp (Meta), penyedia layanan email kami, Cloudflare, dan Google (Analytics dan Google Ads);
- bank atau penyedia pembayaran yang memproses transfer Anda;
- instansi berwenang, bila diwajibkan peraturan perundang-undangan.

Sebagian penyedia layanan tersebut dapat memproses data di luar Indonesia.

## Testimoni

Jika testimoni Anda ditampilkan di situs, kami hanya memuat nama dan isi yang Anda setujui. Anda bisa meminta testimoni dihapus kapan saja lewat email.

## Berapa lama data disimpan

Percakapan dan data pesanan disimpan selama diperlukan untuk tujuan di atas, termasuk masa garansi, lalu selama diwajibkan peraturan, misalnya untuk dokumen pajak. Setelah itu data dihapus atau dianonimkan.

## Keamanan

Situs dilayani lewat HTTPS. Panel admin hanya bisa dibuka dengan akun dan kata sandi, dan kata sandi disimpan dalam bentuk hash, bukan teks asli. Akses ke percakapan dan data pesanan dibatasi pada staf yang menangani pesanan.

## Hak Anda

Menurut UU PDP, Anda berhak:

- mendapat informasi tentang data yang kami proses dan tujuannya;
- mengakses dan meminta salinan data pribadi Anda;
- memperbaiki atau melengkapi data yang keliru;
- meminta penghapusan data, atau mengakhiri dan membatasi pemrosesannya;
- menarik persetujuan yang pernah Anda berikan;
- memperoleh data Anda dalam format yang umum dipakai untuk diberikan ke pihak lain;
- mengajukan keberatan dan menuntut ganti rugi atas pelanggaran pemrosesan data pribadi sesuai peraturan.

Kirim permintaan ke cs@istanablock.com dengan subjek "Permintaan Data Pribadi". Sebutkan nomor WhatsApp atau email yang Anda pakai saat menghubungi kami agar datanya bisa ditemukan. Kami dapat meminta konfirmasi identitas sebelum memproses permintaan dan akan menanggapinya dalam batas waktu yang diatur UU PDP. Data tertentu, misalnya bukti transaksi, tetap harus kami simpan bila diwajibkan peraturan.

## Perubahan kebijakan

Jika cara kami memproses data berubah, misalnya karena situs menambah formulir atau layanan pengukuran lain, kebijakan ini diperbarui lebih dulu dan tanggal berlakunya diganti.

## Kontak

PT Istana Block Purwakarta
Jl. Terusan Kapten Halim No.121, Kec. Pasawahan, Purwakarta, Jawa Barat 41172
Email: cs@istanablock.com
', 1, 'Kebijakan Privasi | Istana Block Purwakarta', 'Cara PT Istana Block Purwakarta memproses data saat Anda membuka situs atau menghubungi kami, cookie yang dipakai, dan hak Anda menurut UU PDP No. 27/2022.');
