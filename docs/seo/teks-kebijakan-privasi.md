# Teks kebijakan privasi: Google Analytics dan Google Ads

Situs baru memuat Google Tag Manager (lihat `docs/pelacakan-google-ads.md`), yang menjalankan Google Analytics dan Google Ads. Teks kebijakan privasi bawaan (`seed/seed.sql`, halaman `privacy-policy`) sebelumnya menyatakan **tidak ada** alat analitik, iklan pihak ketiga, atau cookie untuk pengunjung. Pernyataan itu tidak lagi benar, jadi teks di bawah menggantikannya. Isinya sama dengan data awal di `seed/seed.sql`.

## Cara memasang (pemilik)

Database produksi tidak di-seed ulang, jadi perubahan di `seed/seed.sql` tidak sampai ke situs yang sudah berjalan. Tempel lewat panel:

1. Buka `/situs` → **Halaman** → **Kebijakan Privasi**.
2. Lakukan enam perubahan di bawah, urut dari atas ke bawah. Teks dalam kotak kode adalah isi yang ditempel (format Markdown).
3. Simpan. Halaman publik memperbarui diri dalam sekitar 5 menit.

Sebelum menempel, buka container GTM-PXSMDXD8 dan pastikan tag yang aktif hanya Google Analytics (G-2GD4L62DJS) dan Google Ads (AW-858211595), sesuai langkah di `docs/pelacakan-google-ads.md`. Bila ada tag lain (misalnya Meta Pixel), tambahkan juga ke teks ini. Tempel teks ini sebelum atau pada hari domain dipindah, bukan sesudahnya.

Teks ini ditulis sebagai panduan praktis, bukan nasihat hukum. Bila PT memakai penasihat hukum untuk kepatuhan UU PDP, minta ia memeriksanya, termasuk apakah situs perlu banner persetujuan cookie.

## 1. Bagian "Ringkasnya": ganti dua butir

Hapus dua butir ini:

```
- Kami tidak memasang alat analitik atau iklan pihak ketiga, seperti Google Analytics, Google Tag Manager, atau Meta Pixel.
- Kami tidak memasang cookie untuk pengunjung umum. Satu-satunya cookie dari situs ini dipakai untuk login admin.
```

Ganti dengan:

````
- Situs ini memuat Google Tag Manager untuk menjalankan Google Analytics (statistik kunjungan) dan Google Ads (pengukuran iklan). Penjelasan dan cara menolaknya ada di bagian "Pengukuran kunjungan dan iklan".
- Cookie yang dibuat situs ini sendiri hanya satu, untuk login admin. Cookie pengukuran dan iklan dipasang oleh Google, lihat bagian "Cookie".
````

## 2. Bagian "Cookie": tambah satu baris tabel

Tambahkan baris ini tepat di bawah baris "Cookie keamanan Cloudflare":

````
| Cookie Google Analytics dan Google Ads (berawalan `_ga` dan `_gcl`) | Google, lewat skrip yang dimuat situs ini | Pengunjung | Mengukur kunjungan dan klik tombol WhatsApp atau telepon, serta menghubungkan klik iklan dengan pesan yang masuk | Ditentukan Google |
````

## 3. Bagian baru: tempel sebelum "Tautan ke WhatsApp, telepon, email, dan peta"

````
## Pengukuran kunjungan dan iklan

Situs ini memuat Google Tag Manager, yang menjalankan Google Analytics dan Google Ads. Keduanya dikelola Google dan memasang cookie pengukuran dan iklan di browser Anda saat Anda membuka situs.

Yang diukur: halaman yang dibuka, sumber kunjungan (misalnya klik dari iklan Google), jenis perangkat dan browser, perkiraan lokasi, dan apakah Anda menekan tombol WhatsApp atau telepon. Kami memakai data ini untuk mengetahui halaman mana yang dibaca dan apakah iklan menghasilkan pesan atau panggilan. Google Ads juga dapat memakainya untuk menampilkan iklan Istana Block kepada orang yang pernah membuka situs ini.

Situs ini tidak punya formulir, sehingga kami tidak mengirim nama, nomor telepon, atau email Anda ke Google lewat situs. Data diproses oleh Google dan dapat disimpan di luar Indonesia. Cara Google memakai data dari situs yang memakai layanannya dijelaskan di [policies.google.com/technologies/partner-sites](https://policies.google.com/technologies/partner-sites).

Cara mengatur atau menolak:

- Hapus atau blokir cookie lewat pengaturan browser, atau buka situs dalam mode pribadi. Tombol WhatsApp dan telepon tetap berfungsi tanpa cookie.
- Pasang [add-on browser Google Analytics Opt-out](https://tools.google.com/dlpage/gaoptout) untuk menolak pengukuran Google Analytics.
- Atur atau matikan personalisasi iklan di [adssettings.google.com](https://adssettings.google.com).
- Di ponsel, atur atau setel ulang ID iklan lewat pengaturan perangkat.
````

## 4. Bagian "Dengan siapa data dibagikan": ubah butir pertama

Ganti:

```
- penyedia layanan yang kami pakai untuk berkomunikasi dan menjalankan situs, yaitu WhatsApp (Meta), penyedia layanan email kami, dan Cloudflare;
```

dengan:

```
- penyedia layanan yang kami pakai untuk berkomunikasi dan menjalankan situs, yaitu WhatsApp (Meta), penyedia layanan email kami, Cloudflare, dan Google (Analytics dan Google Ads);
```

## 5. Bagian "Perubahan kebijakan": ubah satu frasa

Ganti frasa "formulir atau alat analitik" dengan "formulir atau layanan pengukuran lain". Kalimat utuhnya menjadi:

```
Jika cara kami memproses data berubah, misalnya karena situs menambah formulir atau layanan pengukuran lain, kebijakan ini diperbarui lebih dulu dan tanggal berlakunya diganti.
```

## 6. Tanggal berlaku

Baris paling atas halaman berbunyi "Berlaku sejak: 15 Oktober 2026". Karena isi kebijakan berubah, ganti tanggalnya dengan tanggal teks baru ini ditempel. Tanggal itu keputusan pemilik; berkas ini tidak menetapkannya.
