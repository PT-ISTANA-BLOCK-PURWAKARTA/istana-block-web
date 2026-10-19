-- Perbarui judul (title) dan deskripsi (meta) halaman publik di D1.
-- Sumber: audit SEO 19 Okt 2026 (temuan P7, P3(b); tabel usulan judul dan meta di Bab 6.4).
-- BERKAS INI TIDAK DIJALANKAN OTOMATIS. Jalankan sendiri, satu kali, setelah kode baru tayang.
--
-- 1) Cadangkan database dulu (dari folder repo, simpan di luar repo):
--      npx wrangler d1 export istana-block-db --remote --output ../backup-sebelum-judul-meta.sql
-- 2) Jalankan:
--      npx wrangler d1 execute DB --remote --file=docs/seo/perbarui-judul-meta.sql
--    Perbarui lokal dulu bila mau mencoba: ganti --remote dengan --local.
-- 3) Hasil baru terlihat setelah cache halaman publik habis (sekitar 5 menit).
--
-- Cara kerja: setiap UPDATE bersyarat. Baris hanya berubah bila nilainya masih sama dengan
-- nilai awal dari kode/seed, atau masih kosong (NULL atau ''). Judul atau deskripsi yang sudah
-- Anda ubah sendiri lewat panel /situs TIDAK ditimpa, dan menjalankan berkas ini dua kali aman.
-- Kolom updated_at sengaja tidak disentuh: tanggal "Harga diperbarui" di halaman produk memakai
-- kolom itu dan tidak boleh maju hanya karena judul diganti.
--
-- Catatan isi:
--  * Judul <= 60 karakter, deskripsi <= 155 karakter (sudah dihitung).
--  * Semua angka dan nama tempat berasal dari seed/seed.sql di repo ini. Tidak ada klaim sertifikasi
--    mutu, ongkir, atau peringkat harga yang tidak terbukti di data. Judul memuat "2026": ganti
--    tahunnya tiap Januari.
--  * Deskripsi produk memuat harga mulai. Bila harga di panel berubah, ubah deskripsinya juga.
--  * Judul yang diisi di sini sudah lengkap dengan merek; kode memakai title.absolute untuk judul
--    dari D1, jadi tidak ada lagi akhiran "| Istana Block Purwakarta" kedua.
--  * Pengaturan beranda (hero_title, hero_subtitle, seo_title) tidak dibuatkan INSERT: bila barisnya
--    belum ada, nilai bawaan baru di src/lib/settings.ts langsung berlaku setelah deploy.

-- ---------------------------------------------------------------------------
-- A. Pengaturan beranda (tabel settings)
-- ---------------------------------------------------------------------------

-- H1 beranda memuat kata kunci utama (sama dengan H1 situs lama).
UPDATE settings
   SET value = 'Pabrik Paving Block & Beton Precast di Purwakarta'
 WHERE key = 'hero_title'
   AND value = 'Beton yang tertata, dari pabrik ke halaman Anda.';

-- Tagline lama pindah ke awal paragraf pembuka.
UPDATE settings
   SET value = 'Beton yang tertata, dari pabrik ke halaman Anda. Paving block, U-Ditch, buis beton, kanstin, dan genteng beton. Mutu K-350 sampai K-450, bersertifikat TKDN, dikirim dengan armada sendiri ke Jawa Barat dan Jabodetabek.'
 WHERE key = 'hero_subtitle'
   AND value = 'Paving block, U-Ditch, buis beton, kanstin, dan genteng beton. Mutu K-350 sampai K-450, bersertifikat TKDN, dikirim dengan armada sendiri ke Jawa Barat dan Jabodetabek.';

-- Judul beranda = judul situs lama, dipertahankan 4 sampai 8 minggu pertama setelah pindah domain
-- agar efek migrasi terpisah dari efek ganti judul. Panjangnya 61 karakter, sama dengan situs lama.
UPDATE settings
   SET value = 'Pabrik Paving Block & Beton Precast Purwakarta | Istana Block'
 WHERE key = 'seo_title'
   AND value = 'Paving Block, U-Ditch & Buis Beton Purwakarta | Istana Block';

-- ---------------------------------------------------------------------------
-- B. Halaman produk (tabel products). Judul dan deskripsi diperiksa terpisah.
-- ---------------------------------------------------------------------------

-- paving-block
UPDATE products
   SET seo_title = 'Harga Paving Block Purwakarta 2026 per m² | Istana Block'
 WHERE slug = 'paving-block' AND (seo_title IS NULL OR seo_title = '');
UPDATE products
   SET seo_description = 'Harga paving block Purwakarta 2026 mulai Rp80.000/m² dari pabrik. Bata, hexagon, ubin, grass block; K-350–K-450, TKDN 91,58%. Minta penawaran via WA.'
 WHERE slug = 'paving-block' AND (seo_description IS NULL OR seo_description = '');

-- u-ditch (12 ukuran + 5 ukuran cover di tabel harga; "12 ukuran" ada di deskripsi karena judul dibatasi 60 karakter)
UPDATE products
   SET seo_title = 'Harga U-Ditch Purwakarta 2026 + Cover | Istana Block'
 WHERE slug = 'u-ditch' AND (seo_title IS NULL OR seo_title = '');
UPDATE products
   SET seo_description = 'Harga U-Ditch Purwakarta 2026: 12 ukuran, 30×30 Rp270.000 s.d. 80×80 Rp840.000/unit; cover heavy duty mulai Rp130.000. TKDN 78,61%. Tanya via WA.'
 WHERE slug = 'u-ditch' AND (seo_description IS NULL OR seo_description = '');

-- buis-beton (TKDN 100% hanya untuk buis tanpa tulangan, jadi ditulis begitu)
UPDATE products
   SET seo_title = 'Harga Buis Beton Purwakarta 2026 per Buah | Istana Block'
 WHERE slug = 'buis-beton' AND (seo_title IS NULL OR seo_title = '');
UPDATE products
   SET seo_description = 'Harga buis beton Purwakarta 2026 mulai Rp65.000 (Ø20) s.d. Rp1.115.000 (Ø80 bertulang), tutup buis Rp270.000. TKDN 100% tanpa tulangan. Tanya via WA.'
 WHERE slug = 'buis-beton' AND (seo_description IS NULL OR seo_description = '');

-- kanstin
UPDATE products
   SET seo_title = 'Harga Kanstin Beton Purwakarta 2026 | Istana Block'
 WHERE slug = 'kanstin' AND (seo_title IS NULL OR seo_title = '');
UPDATE products
   SET seo_description = 'Harga kanstin beton Purwakarta mulai Rp15.000/buah: Kanstin S, KS 20–30, DKI, taman, jumbo & stopper ban dari pabrik. Minta harga + ongkir via WA.'
 WHERE slug = 'kanstin' AND (seo_description IS NULL OR seo_description = '');

-- genteng-beton
UPDATE products
   SET seo_title = 'Harga Genteng Beton Purwakarta 2026 | Istana Block'
 WHERE slug = 'genteng-beton' AND (seo_title IS NULL OR seo_title = '');
UPDATE products
   SET seo_description = 'Harga genteng beton Purwakarta mulai Rp4.500/pcs: model Garuda & Flat, 10 pcs/m², plus nok, lisplang & triway dari satu pabrik. Minta penawaran via WA.'
 WHERE slug = 'genteng-beton' AND (seo_description IS NULL OR seo_description = '');

-- jasa-pasang-paving (angka paket sengaja tidak ditulis: set harga paket menunggu keputusan pemilik)
UPDATE products
   SET seo_title = 'Jasa Pasang Paving Block Purwakarta per m² | Istana Block'
 WHERE slug = 'jasa-pasang-paving' AND (seo_title IS NULL OR seo_title = '');
UPDATE products
   SET seo_description = 'Jasa pasang paving block Purwakarta & sekitarnya: paket paving + pemasangan per m², min. 200 m², survei lokasi gratis, garansi 1 bulan. Jadwalkan via WA.'
 WHERE slug = 'jasa-pasang-paving' AND (seo_description IS NULL OR seo_description = '');

-- ---------------------------------------------------------------------------
-- C. Halaman area pengiriman (tabel pages)
--    Judul Subang dan Bekasi dari seed sudah sesuai usulan; yang berubah hanya deskripsinya.
-- ---------------------------------------------------------------------------

-- paving-block-karawang-cikampek
UPDATE pages
   SET seo_title = 'Paving Block Karawang & Cikampek dari Pabrik | Istana Block'
 WHERE slug = 'paving-block-karawang-cikampek'
   AND (seo_title IS NULL OR seo_title = '' OR seo_title = 'Paving Block Karawang & Cikampek | Istana Block');
UPDATE pages
   SET seo_description = 'Kirim paving block, U-Ditch & buis beton ke Karawang & Cikampek (±29–48 km) langsung dari pabrik Purwakarta, armada sendiri, TKDN. Cek ongkir via WA.'
 WHERE slug = 'paving-block-karawang-cikampek'
   AND (seo_description IS NULL OR seo_description = ''
        OR seo_description = 'Paving block, U-Ditch, dan buis beton dari pabrik Purwakarta dikirim ke Karawang dan Cikampek dengan armada sendiri. Cek jarak, wilayah, dan ongkir.');

-- paving-block-subang
UPDATE pages
   SET seo_description = 'Paving block, U-Ditch & buis beton ke Subang (Kalijati, Pagaden, Pamanukan) dari pabrik Purwakarta dengan armada sendiri. Cek jarak & ongkir via WhatsApp.'
 WHERE slug = 'paving-block-subang'
   AND (seo_description IS NULL OR seo_description = ''
        OR seo_description = 'Paving block, U-Ditch, dan buis beton dikirim dari pabrik Purwakarta ke Subang dengan armada sendiri. Lihat jarak, rute, kecamatan, dan cara cek ongkir.');

-- paving-block-bekasi-cikarang
UPDATE pages
   SET seo_description = 'Suplai paving block, U-Ditch & buis beton untuk proyek di Bekasi, Cikarang, Jababeka, MM2100. Dokumen TKDN untuk tender. Tanya minimal order via WhatsApp.'
 WHERE slug = 'paving-block-bekasi-cikarang'
   AND (seo_description IS NULL OR seo_description = ''
        OR seo_description = 'Paving block, U-Ditch, dan buis beton untuk proyek di Bekasi dan Cikarang, dari pabrik Purwakarta. Dokumen TKDN tersedia. Cek jarak dan cara pesan.');

-- ---------------------------------------------------------------------------
-- Pemeriksaan sesudah dijalankan (jalankan terpisah, sebagai --command):
--   SELECT slug, length(seo_title) AS panjang_judul, seo_title, length(seo_description) AS panjang_meta
--     FROM products ORDER BY sort_order;
--   SELECT key, value FROM settings WHERE key IN ('hero_title', 'seo_title');
-- ---------------------------------------------------------------------------
