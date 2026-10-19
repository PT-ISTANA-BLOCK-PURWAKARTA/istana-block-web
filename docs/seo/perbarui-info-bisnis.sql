-- Isi info bisnis di D1 untuk data terstruktur LocalBusiness, peta, dan profil resmi.
-- Sumber: audit SEO 19 Okt 2026 (temuan P9, TB-08, LK-03, LK-05, AI-04). Nilai berasal dari situs lama
-- (blok JSON-LD HomeAndConstructionBusiness di https://istanablockpurwakarta.com/ dan tautan Maps di /kontak/).
-- BERKAS INI TIDAK DIJALANKAN OTOMATIS. Jalankan sendiri, satu kali, setelah kode baru tayang.
--
-- SEBELUM MENJALANKAN: cocokkan "Rating Google" dan "Jumlah ulasan Google" di panel /situs -> Info & kontak
-- (bawaan 4,8 dan 42) dengan Google Business Profile. Chip rating di beranda hanya tampil bila maps_url
-- terisi, jadi berkas ini membuat chip itu muncul. Perbaiki angkanya dulu bila berbeda.
--
-- 1) Cadangkan database dulu (dari folder repo, simpan di luar repo):
--      npx wrangler d1 export istana-block-db --remote --output ../backup-sebelum-info-bisnis.sql
-- 2) Jalankan:
--      npx wrangler d1 execute DB --remote --file=docs/seo/perbarui-info-bisnis.sql
--    Perbarui lokal dulu bila mau mencoba: ganti --remote dengan --local.
-- 3) Hasil baru terlihat setelah cache halaman publik habis (sekitar 5 menit).
--
-- Cara kerja:
--  * Kunci baru (geo_lat, geo_lng, same_as) memakai INSERT OR IGNORE: bila barisnya sudah ada
--    (mis. sudah Anda isi lewat panel /situs), tidak ditimpa.
--  * maps_url hanya diisi bila masih kosong. Tautan yang sudah Anda isi sendiri tidak ditimpa.
--  * Menjalankan berkas ini dua kali aman.
--
-- Catatan isi:
--  * geo_lat dan geo_lng adalah titik pin profil Google Maps "Istana Block Purwakarta" (dari tautan
--    maps.app.goo.gl di /kontak situs lama). JSON-LD situs lama memakai -6.5832958 / 107.4663459,
--    selisihnya sekitar 20 meter; titik pin Maps dipilih supaya sama dengan Google Business Profile.
--  * same_as: Instagram dan Facebook dari footer dan JSON-LD situs lama, ditambah URL Maps. Kanal YouTube
--    lama (@istanablockpurwakarta4260) SENGAJA tidak dimasukkan karena menjawab 404. Tambahkan kanal
--    yang benar lewat panel setelah ada keputusan, satu URL per baris.
--  * maps_embed_url TIDAK diisi di sini. Isi dari Google Business Profile: Bagikan -> Sematkan peta ->
--    salin src (diawali https://www.google.com/maps/embed). Embed lama berbasis pencarian alamat dan
--    tidak lolos pemeriksaan situs. Selama kosong, /kontak menampilkan tombol "Buka di Google Maps".
--  * Nomor telepon utama (telephone di JSON-LD) adalah keputusan pemilik dan tidak diubah di sini.

-- ---------------------------------------------------------------------------
-- A. Kunci baru (tabel settings)
-- ---------------------------------------------------------------------------

INSERT OR IGNORE INTO settings (key, value) VALUES ('geo_lat', '-6.5831124');
INSERT OR IGNORE INTO settings (key, value) VALUES ('geo_lng', '107.4663503');

-- Satu URL per baris (char(10) = pemisah baris).
INSERT OR IGNORE INTO settings (key, value) VALUES (
  'same_as',
  'https://www.instagram.com/pt.istanablock' || char(10) ||
  'https://www.facebook.com/istanablock' || char(10) ||
  'https://maps.google.com/?cid=6901861555312700265'
);

-- ---------------------------------------------------------------------------
-- B. Tautan Google Maps (profil bisnis). Hanya mengisi yang kosong.
-- ---------------------------------------------------------------------------

-- Baris dibuat dulu bila belum ada (mis. panel belum pernah disimpan), lalu diisi bila nilainya kosong.
INSERT OR IGNORE INTO settings (key, value) VALUES ('maps_url', '');

UPDATE settings
   SET value = 'https://maps.google.com/?cid=6901861555312700265'
 WHERE key = 'maps_url'
   AND value = '';

-- ---------------------------------------------------------------------------
-- Pemeriksaan sesudah dijalankan (jalankan terpisah, sebagai --command):
--   SELECT key, value FROM settings WHERE key IN ('geo_lat', 'geo_lng', 'same_as', 'maps_url', 'maps_embed_url', 'google_rating', 'google_review_count');
-- Lalu uji https://istanablockpurwakarta.com/ di Rich Results Test dan Schema Markup Validator
-- (cari HomeAndConstructionBusiness: geo, sameAs, hasMap, openingHoursSpecification, postalCode).
-- ---------------------------------------------------------------------------
