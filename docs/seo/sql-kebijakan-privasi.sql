-- Ganti teks halaman Kebijakan Privasi (slug privacy-policy) di D1 dengan versi yang mengakui Google Tag Manager,
-- Google Analytics, dan Google Ads. Sumber: audit SEO 19 Okt 2026 (temuan P2(e)); teks sama dengan seed/seed.sql
-- dan docs/seo/teks-kebijakan-privasi.md. BERKAS INI TIDAK DIJALANKAN OTOMATIS. Jalankan sendiri, satu kali.
--
-- Alternatif tanpa SQL: tempel lewat panel /situs -> Halaman -> Kebijakan Privasi (langkah di teks-kebijakan-privasi.md).
--
-- SEBELUM MENJALANKAN: pastikan container GTM-PXSMDXD8 hanya berisi tag Google Analytics (G-2GD4L62DJS) dan
-- Google Ads (AW-858211595). Bila ada tag lain (mis. Meta Pixel), tambahkan ke teks. Jalankan sebelum atau pada
-- hari domain dipindah. Bila PT punya penasihat hukum UU PDP, minta ia memeriksa teks dulu.
--
-- 1) Cadangkan database dulu (dari folder repo, simpan di luar repo):
--      npx wrangler d1 export istana-block-db --remote --output ../backup-sebelum-kebijakan-privasi.sql
-- 2) Jalankan:
--      npx wrangler d1 execute DB --remote --file=docs/seo/sql-kebijakan-privasi.sql
--    Coba lokal dulu: ganti --remote dengan --local.
-- 3) Hasil terlihat setelah cache halaman publik habis (sekitar 5 menit).
--
-- Bersyarat: baris hanya berubah bila teksnya MASIH versi lama (masih memuat kalimat "Kami tidak memasang alat
-- analitik"). Teks yang sudah Anda ubah lewat panel TIDAK ditimpa; menjalankan dua kali aman. Cek hasil:
--      SELECT changes();   -- 1 = terganti, 0 = sudah diubah/sudah baru
-- updated_at sengaja tidak disentuh. Tanggal "Berlaku sejak: 15 Oktober 2026" di baris pertama teks adalah
-- keputusan pemilik: ganti dengan tanggal teks ini tayang bila perlu (edit baris itu sebelum menjalankan).

UPDATE pages SET content = '**Berlaku sejak:** 15 Oktober 2026

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
'
WHERE slug = 'privacy-policy' AND content LIKE '%Kami tidak memasang alat analitik%';
