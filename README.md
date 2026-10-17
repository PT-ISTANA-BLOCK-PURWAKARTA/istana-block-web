# Istana Block Purwakarta — situs web, panel admin, keuangan & operasional

Situs web Istana Block Purwakarta yang dibangun ulang dengan **Next.js 15** dan berjalan di **Cloudflare Workers**. Data disimpan di **Cloudflare D1** dan gambar di **Cloudflare R2**. Panel `/admin` (wajib login) dipakai untuk mengelola produk, tabel harga, artikel, halaman, testimoni, dan informasi kontak tanpa menyentuh kode. Di aplikasi yang sama ada `/keuangan` (pembukuan ala Zahir) dan `/operasional` (pesanan, pengiriman, dan stok), dengan akses per peran pengguna.

![Beranda](docs/screenshots/beranda-atas.webp)

## Tampilan

| Beranda (desktop) | Halaman produk (U-Ditch) |
|---|---|
| ![Beranda penuh](docs/screenshots/beranda.webp) | ![Produk U-Ditch](docs/screenshots/produk-u-ditch.webp) |

| Kalkulator pola & warna | Galeri | Paket proyek |
|---|---|---|
| ![Kalkulator pola paving](docs/screenshots/pola-paving.webp) | ![Galeri](docs/screenshots/galeri.webp) | ![Paket proyek](docs/screenshots/paket-proyek.webp) |

| Area pengiriman | Halaman area (CMS) | Produk + lembar spesifikasi |
|---|---|---|
| ![Area pengiriman](docs/screenshots/area-pengiriman.webp) | ![Halaman area Karawang](docs/screenshots/halaman-area.webp) | ![Produk paving](docs/screenshots/produk-paving.webp) |

| Ponsel — beranda | Ponsel — menu | Ponsel — kalkulator pola | Ponsel — produk |
|---|---|---|---|
| ![Ponsel beranda](docs/screenshots/ponsel-beranda.webp) | ![Ponsel menu](docs/screenshots/ponsel-menu.webp) | ![Ponsel kalkulator pola](docs/screenshots/ponsel-pola.webp) | ![Ponsel produk](docs/screenshots/ponsel-produk.webp) |

Artikel: [docs/screenshots/artikel.webp](docs/screenshots/artikel.webp)

**Panel admin**

| Login | Ringkasan | Daftar produk | Halaman |
|---|---|---|---|
| ![Login admin](docs/screenshots/admin-login.webp) | ![Ringkasan admin](docs/screenshots/admin-ringkasan.webp) | ![Daftar produk](docs/screenshots/admin-produk.webp) | ![Halaman](docs/screenshots/admin-halaman.webp) |

| Ubah produk | Tabel harga | Info & kontak |
|---|---|---|
| ![Ubah produk](docs/screenshots/admin-ubah-produk.webp) | ![Tabel harga](docs/screenshots/admin-tabel-harga.webp) | ![Pengaturan](docs/screenshots/admin-pengaturan.webp) |

**Video fitur di beranda** (16:9 di desktop, 9:16 di ponsel)

| Desktop | Ponsel |
|---|---|
| ![Video fitur desktop](docs/screenshots/beranda-video.webp) | ![Video fitur ponsel](docs/screenshots/ponsel-video.webp) |

Katalog lengkap: [docs/screenshots/katalog.webp](docs/screenshots/katalog.webp)

**Keuangan & operasional**

| Ringkasan keuangan | Faktur penjualan | Cetak faktur |
|---|---|---|
| ![Ringkasan keuangan](docs/screenshots/keu-ringkasan.webp) | ![Faktur](docs/screenshots/keu-faktur.webp) | ![Cetak faktur](docs/screenshots/keu-cetak-faktur.webp) |

| Laba rugi | Neraca | Ringkasan operasional |
|---|---|---|
| ![Laba rugi](docs/screenshots/keu-laba-rugi.webp) | ![Neraca](docs/screenshots/keu-neraca.webp) | ![Ringkasan operasional](docs/screenshots/ops-ringkasan.webp) |

| Pesanan (PO) | Surat jalan | Cetak surat jalan | Ponsel — surat jalan |
|---|---|---|---|
| ![Pesanan](docs/screenshots/ops-pesanan.webp) | ![Surat jalan](docs/screenshots/ops-surat-jalan.webp) | ![Cetak surat jalan](docs/screenshots/ops-cetak-surat-jalan.webp) | ![Ponsel surat jalan](docs/screenshots/ponsel-surat-jalan.webp) |

Data di gambar adalah data uji.

## Fitur

**Situs publik**
- Beranda: hero dengan foto pabrik, keunggulan, logo klien proyek, video fitur, kartu produk dari database, kalkulator cepat (hasil langsung dikirim ke WhatsApp admin) dengan tautan ke kalkulator pola, blok kontraktor + TKDN, paket jasa pasang, cuplikan galeri, FAQ (diisi dari admin), testimoni, artikel terbaru.
- `/pola-paving`: **kalkulator pola & warna**. Pilih jenis paving (5 jenis, 23 motif), warna dasar dan aksen, lalu lihat pratinjau tampak atas berskala asli. Menghitung pcs per warna dari pola berulang (bisa diubah manual per %), cadangan 0/3/5/10%, kanstin 40/60 cm, abu batu alas 5 cm, dan base course 20 cm. Rincian bisa dikirim ke WhatsApp, disalin, atau dicetak; semua pilihan tersimpan di URL sehingga bisa dibagikan.
- `/produk`, `/produk/[slug]`: spesifikasi, tabel harga per grup (misalnya U-Ditch dan Cover heavy duty), lembar spesifikasi & TKDN asli, deskripsi, cara memesan, FAQ, produk terkait. Tombol WhatsApp memakai pesan khusus per produk.
- `/paket-proyek`: paket material untuk kontraktor: alur pemesanan, tabel harga acuan semua produk + TKDN, syarat, logo klien, FAQ.
- `/area-pengiriman`: wilayah kirim beserta jarak dari pabrik, ketentuan Jabodetabek, cara ongkir dihitung, dan tombol cek ongkir. Kartu wilayah otomatis menautkan ke halaman area yang sudah terbit.
- `/galeri`: 24 foto pemasangan dan stok pabrik dengan filter, ukuran asli dibuka saat diklik.
- Halaman dari admin di `/slug`: halaman area (Karawang & Cikampek, Subang, Bekasi & Cikarang) dan halaman informasi (`/profil`, `/sertifikat-tkdn`, `/privacy-policy`).
- `/artikel`, `/artikel/[slug]`: artikel berformat Markdown.
- `/kontak`: alamat, jam buka, telepon kantor, tombol WhatsApp/telepon, dan peta Google Maps bila URL embed diisi di admin.
- **Video fitur** di beranda: rekaman UI asli (kalkulator paving → kirim ke WhatsApp → tabel harga U-Ditch) yang berputar senyap seperti GIF. Desktop, laptop, dan tablet mendatar memakai versi 16:9; ponsel dan tablet yang dipegang tegak memakai 9:16. Format dipilih otomatis dan langsung berganti saat layar diputar atau jendela browser diubah ukurannya (video dan posternya sama-sama ikut). Tombol "Putar dengan suara" memutar versi voice-over 28 detik dengan subtitle. Video baru dimuat saat terlihat, dijeda saat keluar layar, dan tidak autoplay bila pengunjung memilih "kurangi gerakan".
- Desain mengikuti brand: logo resmi dari situs lama, biru logo `#254186`, oranye `#FE5722`, abu beton, motif paving segi enam, huruf Poppins + Plus Jakarta Sans (di-host sendiri, tanpa Google Fonts).
- Menu ringkas di ponsel, bar kontak melayang; tanpa scroll horizontal di layar 390 px.

**SEO**
- Halaman dirender di server (HTML lengkap untuk Google), `<title>`, meta description, canonical, dan Open Graph per halaman. Semua bisa diubah dari admin.
- Data terstruktur JSON-LD: `HomeAndConstructionBusiness` (alamat, telepon kantor; tanpa `aggregateRating` karena rating milik sendiri tidak ditampilkan Google), `Product` + `AggregateOffer` (rentang harga IDR), `BreadcrumbList`, `FAQPage`, `Article`, `WebPage`.
- `sitemap.xml` dan `robots.txt` otomatis dari database; `/admin` diberi `noindex`.
- Redirect 301 dari alamat WordPress lama (`/paving-block/`, `/u-ditch-istana-block-purwakarta/`, `/servis/`, dan lainnya) ke halaman baru dalam **satu kali** pengalihan, termasuk membuang `/` di akhir URL; alamat yang sengaja dihapus mendapat **410 Gone**. Ditangani `src/middleware.ts`, daftarnya ada di `src/data/legacy-redirects.json` (`{ "/lama": "/baru" }` atau `"410"`).

**Panel admin (`/admin`)**
- Login email + password, sesi cookie `httpOnly` 7 hari. Setelah 5 kali gagal, login dari alamat IP itu dikunci 15 menit.
- **Produk & harga:** tambah, ubah, hapus; foto diunggah ke R2 (otomatis dikecilkan ke WebP ≤ 1600 px di browser); spesifikasi, tabel harga, dan FAQ bisa ditambah atau dihapus per baris; status tayang/draf dan tampil di beranda; urutan; SEO.
- **Artikel:** editor Markdown (termasuk tabel), gambar sampul, terbit/draf, SEO.
- **Halaman:** halaman statis di `/slug`, jenis *Area pengiriman* (tombol WhatsApp menanyakan ongkir ke lokasi itu) atau *Informasi*; Markdown, sampul, terbit/draf, SEO. Slug yang dipakai sistem (`produk`, `artikel`, `admin`, …) atau oleh peta redirect lama ditolak.
- **Testimoni:** nama, keterangan, kutipan, rating, urutan. Bagian ulasan di beranda baru muncul kalau sudah ada testimoni.
- **Info & kontak:** WhatsApp, telepon, telepon kantor, email, alamat, jam buka, link & peta embed Google Maps, rating Google, teks & FAQ beranda, syarat pembayaran, kota tujuan kirim, tautan katalog, info TKDN, SEO beranda.
- **Pengguna & peran** (khusus pemilik): tambah atau hapus pengguna dan atur perannya (lihat di bawah). **Akun saya:** ganti nama dan password; setelah password diganti, sesi di perangkat lain otomatis keluar.

## Keuangan (`/keuangan`) & operasional (`/operasional`)

Satu alur dari pesanan sampai pembukuan:

```
Pesanan (PO) ─► Surat jalan ─► truk berangkat ─► terkirim + foto bukti ─► Faktur ─► Penerimaan
   operasional      operasional     stok keluar & HPP otomatis            keuangan    piutang lunas
```

**Peran pengguna.** Diatur pemilik di `/admin/pengguna`. Satu orang boleh punya beberapa peran; setelah login ia langsung masuk ke modulnya, dan bisa berpindah modul dari sidebar.

| Peran | Bisa membuka |
|---|---|
| Pemilik | semua modul + mengatur pengguna & peran |
| Situs | `/admin` (produk, artikel, halaman, info & kontak) |
| Keuangan | `/keuangan`; melihat dokumen operasional (hanya baca) |
| Operasional | `/operasional`; tidak melihat nilai rupiah persediaan maupun laporan keuangan |

Akun lama otomatis berperan *pemilik*.

**Operasional** (meniru aplikasi PO & pengiriman yang dipakai sekarang)
- **Pesanan (PO):** pelanggan, nomor PO pelanggan, proyek, alamat & kontak lokasi, tautan Google Maps, tanggal minta kirim, barang & harga (otomatis dari harga jual), ongkir, diskon, PPN. Bisa disimpan sebagai draf. Status berjalan sendiri: *dikonfirmasi → dikirim sebagian → terkirim*, lalu bisa ditandai *selesai* atau *batal*. Halaman pesanan memperlihatkan per barang berapa yang dipesan, dijadwalkan, dikirim, diterima, dan sudah difaktur.
- **Pengiriman (surat jalan):** dijadwalkan dari sisa pesanan (tidak bisa melebihi qty pesanan), pilih armada & sopir. Tombol *Truk berangkat* dan *Tandai terkirim* (nama penerima + foto bukti dari kamera ponsel). Surat jalan bisa dicetak (A4, tanda tangan pengirim–sopir–penerima). Foto bukti disimpan di R2 dan hanya bisa dibuka pengguna yang login.
- **Stok:** stok per barang, yang sudah dijadwalkan kirim, stok bebas, kartu stok. **Hasil produksi** (barang jadi masuk, bahan baku keluar) dan **penyesuaian stok** (stok opname, rusak, atau saldo awal).
- **Pelanggan, armada, sopir.** Data pelanggan sama dengan kontak di modul keuangan.

**Keuangan** (konsep Zahir: semua transaksi menjadi jurnal berpasangan)
- **Penjualan:** faktur penjualan (bisa dibuat dari pesanan; barisnya terisi dari barang yang sudah diterima pelanggan dan belum difaktur), PPN 11% (bisa diubah), ongkir, diskon, jatuh tempo dari termin pelanggan, cetak faktur A4 dengan terbilang & rekening. **Penerimaan** dialokasikan ke satu atau beberapa faktur; kelebihan atau DP sebelum faktur menjadi *uang muka pelanggan* yang nanti bisa dipakai melunasi faktur.
- **Pembelian:** faktur pembelian (barang masuk stok atau biaya langsung ke akun), PPN masukan, **pembayaran** ke pemasok dengan alokasi & uang muka.
- **Kas & bank:** kas masuk, kas keluar, transfer antar-rekening. **Jurnal umum** untuk saldo awal, penyusutan, koreksi.
- **Laporan:** laba rugi, neraca, neraca saldo, buku besar per akun, umur piutang, umur hutang, penjualan per barang & pelanggan. Semua bisa dicetak dan diunduh CSV (pemisah titik koma, langsung rapi di Excel berbahasa Indonesia).
- **Data:** bagan akun (48 akun awal, bisa ditambah), kontak, barang & jasa (bisa diambil dari daftar harga website), pengaturan (tarif PPN, termin, NPWP, rekening di faktur, **tanggal tutup buku**: transaksi sebelum tanggal itu tidak bisa diubah).

**Jurnal otomatis**

| Transaksi | Debit | Kredit |
|---|---|---|
| Faktur penjualan | Piutang usaha, Potongan penjualan | Penjualan (per barang), Pendapatan ongkir, PPN keluaran |
| Penerimaan | Kas/bank (atau Uang muka pelanggan bila memakai DP) | Piutang usaha; kelebihan → Uang muka pelanggan |
| Surat jalan berangkat/terkirim | Harga pokok penjualan | Persediaan barang jadi |
| Faktur pembelian | Persediaan atau akun biaya, PPN masukan | Hutang usaha |
| Pembayaran | Hutang usaha; kelebihan → Uang muka pembelian | Kas/bank |
| Hasil produksi | Persediaan barang jadi | Persediaan bahan baku, Upah produksi (biaya yang diserap) |
| Penyesuaian stok | Persediaan / Selisih persediaan | Selisih persediaan (atau Saldo awal) / Persediaan |

Harga pokok memakai **rata-rata bergerak**. Bila stok kosong, sistem memakai *harga pokok standar* yang diisi di data barang. Mengubah atau menghapus dokumen membuat ulang jurnal dan pergerakan stoknya dalam satu transaksi database. Laba tahun berjalan dihitung otomatis di neraca, jadi tidak perlu jurnal penutup.

> **Biaya produksi.** Saat hasil produksi dicatat tanpa angka biaya, sistem mengisinya supaya nilai barang jadi sama dengan harga pokok standarnya, lalu mengkreditkan akun *Upah Produksi*. Catat upah & biaya produksi yang benar-benar dibayar (lewat kas keluar) ke akun yang sama, supaya selisihnya kecil. Kalau tidak, laba bulan berjalan akan tampak lebih besar daripada kenyataannya.

**Mulai memakai (sekali saja)**
1. `/admin/pengguna`: beri peran *Keuangan* / *Operasional* ke staf.
2. **Keuangan → Barang & jasa → Ambil dari daftar harga website**, lalu isi **harga pokok** (HPP standar) dan stok minimum tiap barang yang dijual.
3. **Keuangan → Daftar akun:** ganti nama akun bank sesuai rekening. **Pengaturan:** NPWP, rekening untuk faktur, tarif PPN, termin.
4. **Jurnal umum:** saldo awal kas/bank, piutang/hutang lama, modal (lawan akun *Saldo awal*).
5. **Operasional → Penyesuaian stok → centang "Saldo awal stok"** untuk stok fisik tiap barang hari ini.
6. Isi armada dan sopir. Setelah itu alur harian cukup: pesanan → jadwal kirim → berangkat → terkirim → faktur → penerimaan.

## Teknologi

| Bagian | Pilihan |
|---|---|
| Framework | Next.js 15.5 (App Router, Server Components, Server Actions), React 19, TypeScript |
| Runtime | Cloudflare Workers lewat [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) |
| Database | Cloudflare D1 (SQLite) + Drizzle ORM; migrasi di folder `drizzle/` |
| Penyimpanan gambar | Cloudflare R2, disajikan lewat `/media/...` dengan cache 1 tahun |
| Auth | JWT HS256 (`jose`) di cookie `httpOnly`; password di-hash PBKDF2-SHA256 (WebCrypto) |
| Validasi | Zod |

## Struktur folder

```
src/
  app/
    (site)/            halaman publik: beranda, produk, pola-paving, paket-proyek, area-pengiriman,
                       galeri, artikel, kontak, dan [slug] untuk halaman dari admin
    admin/login/       halaman login
    admin/(panel)/     halaman admin (semua memanggil requireAdmin)
    admin/actions/     server action CRUD (semua memanggil requireAdmin)
    keuangan/(panel)/  halaman pembukuan; keuangan/actions/ server action-nya;
                       keuangan/cetak/ faktur siap cetak; keuangan/ekspor/ unduhan CSV laporan
    operasional/(panel)/  pesanan, pengiriman, stok, produksi, pelanggan, armada, sopir;
                       operasional/actions/, operasional/cetak/ (surat jalan), operasional/bukti/ (foto bukti terima)
    media/[...key]/    menyajikan gambar dari R2
    reel/[file]/       menyajikan video fitur dengan dukungan Range (wajib untuk Safari/iOS)
    sitemap.ts, robots.ts
  components/          komponen situs (PatternCalculator, Gallery, ClientLogos, FaqList, …)
                       + components/admin (form admin), components/panel (sidebar semua modul),
                       components/erp (form & laporan keuangan), components/ops (form operasional)
  data/                data statis: wilayah kirim, paket proyek, template WhatsApp, galeri,
                       logo klien, lembar spesifikasi, peta redirect alamat lama
  db/schema.ts         skema tabel D1 situs; db/erp.ts skema keuangan & operasional
  lib/                 auth, peran (roles.ts), sesi, password, pengaturan, query, format rupiah
  lib/erp/             logika pembukuan: jurnal, nomor dokumen, harga pokok, laporan, alur pesanan
  middleware.ts        redirect 301/410 alamat lama + penjaga /admin, /keuangan, /operasional
drizzle/               file migrasi SQL (0000 awal, 0001 tabel halaman + pesan WhatsApp produk,
                       0002 tabel keuangan & operasional + peran pengguna, 0003 bagan akun awal)
seed/seed.sql          data awal produk, harga, artikel, dan halaman dari situs lama
scripts/create-admin.mjs  membuat/mereset akun admin
public/brand/          logo resmi (biru & putih)
public/img/            foto dari situs lama: pabrik, produk, galeri, logo klien, lembar TKDN
public/reel/           poster & subtitle video fitur
public/reel-src/       file video fitur (MP4 H.264 + WebM VP9; senyap & bersuara)
tools/reel/            skrip untuk merekam ulang video fitur dari UI asli (lihat tools/reel/README.md)
docs/screenshots/      gambar untuk README ini
```

## Menjalankan di komputer sendiri

Butuh **Node.js 22 atau lebih baru** (Wrangler 4 mensyaratkan Node 22). Perintah di bawah bisa dijalankan di PowerShell maupun terminal biasa, tetapi OpenNext menyarankan **WSL** untuk Windows.

> **Memakai WSL?** Pasang Node di dalam WSL (misalnya lewat nvm: `nvm install 22`), jangan memakai Node/npm Windows. Kalau `npm install` gagal dengan `exec: node: not found` dan path `/mnt/c/...`, itu tandanya WSL sedang memanggil npm Windows. Simpan proyek di folder Linux (`~/projects/...`), bukan di `/mnt/c/...`, supaya `npm install` dan build jauh lebih cepat.

```powershell
npm install
Copy-Item .dev.vars.example .dev.vars        # macOS/Linux: cp .dev.vars.example .dev.vars
# Buka .dev.vars dan isi AUTH_SECRET dengan string acak minimal 32 karakter, misalnya dari:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

npm run db:migrate:local      # membuat tabel di D1 lokal
npm run db:seed:local         # mengisi produk & harga awal
npm run admin:create -- --email admin@istanablock.com --name "Admin" --password "GantiDenganPasswordKuat"

npm run dev                   # http://localhost:3000, admin di http://localhost:3000/admin
```

D1 dan R2 lokal disimulasikan oleh Wrangler (datanya ada di folder `.wrangler/`), jadi tidak perlu akun Cloudflare untuk mencoba. Untuk menguji persis seperti di Cloudflare, jalankan `npm run preview` (build Workers + `wrangler dev` di http://localhost:8787).

## Deploy ke Cloudflare

Domain sudah memakai Cloudflare, jadi semuanya bisa di satu akun. Sebelum mulai, aktifkan **R2** sekali di dashboard: **Storage & databases → R2 → Overview**, lalu selesaikan proses berlangganan R2 (gratis selama pemakaian di bawah kuota; Cloudflare bisa meminta kartu/PayPal sebagai verifikasi). D1 tidak perlu diaktifkan terpisah.

```powershell
npx wrangler login                  # di WSL: buka URL yang muncul di browser Windows
npx wrangler whoami                 # pastikan akun yang benar

# 1. Buat database D1 di region Asia-Pasifik, lalu salin "database_id" dari hasilnya
#    ke wrangler.jsonc (bagian d1_databases). Kalau Wrangler menawarkan menambah
#    binding ke config, pilih "No": binding DB sudah ada.
npx wrangler d1 create istana-block-db --location=apac

# 2. Buat bucket R2 untuk gambar (nama harus sama dengan wrangler.jsonc). Bucket
#    dibiarkan privat: gambar disajikan Worker lewat /media/..., jadi tidak perlu
#    akses publik, domain r2.dev, atau CORS.
npx wrangler r2 bucket create istana-block-media --location=apac

# 3. Isi tabel & data awal di database produksi (seed HANYA sekali di awal:
#    perintah ini menghapus produk, artikel, dan halaman yang ada)
npm run db:migrate:remote
npm run db:seed:remote

# 4. Simpan kunci rahasia sesi. Buat string acak dengan:
#    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
#    Bila Worker belum ada, jawab "Yes" saat ditanya membuat Worker baru.
npx wrangler secret put AUTH_SECRET

# 5. Periksa "SITE_URL" di wrangler.jsonc (dipakai untuk canonical & sitemap), lalu deploy
npm run deploy

# 6. Buat akun admin pertama di produksi
npm run admin:create -- --email admin@istanablock.com --name "Admin" --password "GantiDenganPasswordKuat" --remote
```

Cek setelah deploy: buka `https://<nama-worker>.<akun>.workers.dev/admin`, login, unggah satu foto produk, lalu pastikan gambarnya tampil di halaman produk dan file-nya muncul di bucket R2 (**Storage & databases → R2 → istana-block-media**).

Lalu sambungkan domain: **Cloudflare dashboard → Workers & Pages → istana-block-web → Settings → Domains & Routes → Add → Custom domain** (`istanablockpurwakarta.com` dan `www`). Kalau Cloudflare menolak karena record DNS untuk nama itu sudah ada (A/CNAME ke hosting WordPress), hapus dulu record lama tersebut di menu DNS, lalu ulangi. Siapkan cadangan WordPress sebelumnya.

> **Paket Workers.** Bundle Worker ini sekitar 7,4 MB tanpa kompresi, jauh di bawah batas 64 MiB. Paket gratis membatasi waktu CPU 10 ms per request; halaman biasa aman, tetapi proses login (hash password) bisa melewati batas itu. Kalau login sesekali gagal dengan pesan batas CPU, pakai **Workers Paid (USD 5/bulan)**. Kuota gratis D1 (5 GB, 5 juta baris dibaca/hari) dan R2 (10 GB, 1 juta operasi tulis/bulan) jauh di atas kebutuhan situs ini.

**Cadangan database.** Ekspor isi D1 produksi ke file SQL sebelum perubahan besar:

```powershell
npx wrangler d1 export istana-block-db --remote --output backup-$(Get-Date -Format yyyyMMdd).sql   # bash: backup-$(date +%Y%m%d).sql
```

### Memperbarui situs

```powershell
npm run deploy
```

Kalau skema database diubah (`src/db/schema.ts`): `npm run db:generate`, lalu `npm run db:migrate:remote`, lalu deploy.

> **Memasang modul keuangan & operasional di situs yang sudah jalan.** Ada dua migrasi baru: `drizzle/0002_erp.sql` (tabel keuangan & operasional, kolom `users.roles`) dan `drizzle/0003_coa.sql` (bagan akun awal). Urutannya: cadangkan database (`wrangler d1 export`, lihat di atas) → `npm run db:migrate:remote` → **baru** push ke `main` / deploy. Kalau kode baru tayang duluan, login `/admin` ikut gagal karena kolom `users.roles` belum ada. Migrasinya hanya menambah tabel dan kolom, jadi aman dijalankan selagi versi lama masih tayang. Jangan jalankan `db:seed:remote` lagi.

> **Sudah pernah deploy versi sebelumnya?** Versi ini menambah migrasi `drizzle/0001_pages.sql` (tabel `pages` dan kolom `products.wa_text`). Jalankan `npm run db:migrate:remote` sebelum `npm run deploy`. Halaman area & informasi ikut terisi lewat `npm run db:seed:remote`, tetapi perintah itu juga **menimpa produk & artikel**; kalau data produksi sudah diubah lewat admin, buat halaman-halamannya dari menu **Halaman** saja.

## Pindah dari WordPress — yang perlu dicek

1. **Redirect.** `src/data/legacy-redirects.json` memetakan 194 alamat dari sitemap situs lama: 179 dialihkan 301 ke halaman baru yang paling dekat isinya (produk, kalkulator, area, profil, artikel), 15 halaman yang tidak relevan lagi diberi 410. Kalau nanti artikel lama dipindahkan lewat admin, ganti target redirect-nya ke `/artikel/<slug>`.
2. **Search Console.** Kirim ulang `https://istanablockpurwakarta.com/sitemap.xml` setelah situs baru tayang, lalu pantau laporan *Halaman* untuk 404 yang belum terpetakan.
3. **Google Maps.** Di *Info & kontak*, isi tautan profil Google Bisnis (untuk chip rating dan tombol "Baca ulasan") dan URL embed peta (peta tampil di halaman Kontak).

## Data awal & yang perlu dilengkapi

`seed/seed.sql` berisi data yang diambil dari situs lama (Oktober 2026):

| Produk | Isi awal |
|---|---|
| Paving Block | jenis & isi per m², mulai Rp80.000/m², TKDN 91,58% — **harga per jenis belum ada di situs lama, tampil "Hubungi"** |
| U-Ditch | 12 ukuran + 5 cover heavy duty lengkap dengan berat & harga, TKDN 78,61% |
| Buis Beton | 10 ukuran + tutup buis lengkap dengan harga, TKDN 100% (tanpa tulangan) |
| Kanstin | daftar jenis, mulai Rp15.000/buah — **harga per jenis perlu diisi** |
| Genteng Beton | daftar tipe & aksesoris, mulai Rp4.500/pcs — **harga per tipe perlu diisi** |
| Greffel Beton | daftar ukuran — **harga perlu diisi** |
| Jasa Pasang Paving | Small/Medium/Large **Rp180.000 / 220.000 / 230.000 per m²** — situs lama mencantumkan tiga set angka berbeda di beberapa halaman (sekitar 120–140 rb, 150–190 rb, dan 180–230 rb per m²); pastikan angka yang benar |
| Artikel | 1 artikel: cara menghitung kebutuhan paving |
| Halaman | 3 halaman area (Karawang & Cikampek, Subang, Bekasi & Cikarang) + Profil, Sertifikat TKDN, Kebijakan privasi |

Hal lain:
- **Foto.** Semua foto di `public/img/` diambil dari situs lama (dikonversi ke WebP, tanpa gambar AI, stok, atau ber-watermark pihak lain). Foto paving block dan jasa pasang hanya tersedia 400 px di situs lama; ganti lewat admin dengan file asli bila ada. Asal foto U-Ditch dan genteng beton perlu dipastikan milik sendiri.
- **Logo.** `public/brand/logo-istana-block.webp/.png` (biru) dan `logo-istana-block-putih.webp` (putih, di footer) diambil dari situs lama, lebar 501 px. Ganti dengan file vektor resmi bila ada; nama file tetap sama.
- **Logo klien.** WIKA, Waskita, J.CO, Pertamina, dan Indomaret tampil di beranda dan paket proyek seperti di situs lama. Pastikan izin menampilkannya; daftarnya di `src/data/clients.json`.
- **Testimoni.** Sengaja dibiarkan kosong. Isi dengan ulasan asli dari Google, bukan karangan.

## Keamanan

- Setiap halaman dan server action admin memanggil `requireAdmin()`; modul keuangan dan operasional memanggil `requireModule()` dengan peran yang sesuai. Fungsi ini memverifikasi token **dan** mengecek akun beserta perannya ke database, jadi middleware tidak dijadikan satu-satunya pengaman. Unduhan CSV dan foto bukti terima juga memeriksa peran.
- Password: PBKDF2-SHA256 100.000 iterasi + salt acak; perbandingan hash waktu-konstan.
- Server Actions Next.js menolak request dari origin lain (proteksi CSRF bawaan); cookie `SameSite=Lax`, `Secure` di produksi.
- Unggahan dibatasi JPG/PNG/WebP/AVIF/GIF maksimal 5 MB, dengan nama file acak di R2.
- Markdown dirender tanpa HTML mentah, dan JSON-LD di-escape.
- Header `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`; `/admin`, `/keuangan`, dan `/operasional` diberi `X-Robots-Tag: noindex` dan ditolak di `robots.txt`.

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` | server pengembangan (D1/R2 lokal) |
| `npm run preview` | build Workers lalu jalankan secara lokal seperti di Cloudflare |
| `npm run deploy` | build & deploy ke Cloudflare |
| `npm run typecheck` | cek TypeScript |
| `npm run db:generate` | buat file migrasi dari perubahan `schema.ts` |
| `npm run db:migrate:local` / `:remote` | jalankan migrasi |
| `npm run db:seed:local` / `:remote` | isi data awal (**menghapus semua produk, artikel, dan halaman yang ada**) |
| `npm run admin:create -- --email … --name … --password … [--remote]` | buat atau reset password admin |
