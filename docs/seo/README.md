# Perbaikan SEO on-page dan schema: ringkasan, patch SQL, urutan kerja

Sumber: audit SEO 19 Okt 2026 (`laporan/Audit-SEO-Istana-Block-2026-10-19*.md`, prioritas P1 sampai P12 di Bab 3). Cabang ini bertumpuk di atas PR #6 (cache halaman, GTM, `worker.ts`), yang tidak diubah. Semua perubahan di bawah hanya kode dan berkas bantu; **tidak ada yang sudah dijalankan ke D1, Cloudflare, atau Google Ads**.

## 1. Apa yang berubah per butir prioritas

| Butir | Di kode (sudah) | Belum: perlu data/keputusan pemilik atau langkah di luar kode |
|---|---|---|
| **P3** isi halaman produk | `title.absolute` untuk `seo_title` dari panel (produk, halaman, artikel). Judul dan meta 6 produk + 3 halaman area lewat `perbarui-judul-meta.sql` | Isi `description` dan FAQ (paving, U-Ditch, buis, kanstin, genteng, greffel), H1 jasa pasang "…Purwakarta & Karawang": semua isi D1, lewat panel `/situs` |
| **P4** domain dan indeks | (a) `src/lib/host.ts`, `robots.ts`, `middleware.ts`: host selain `SITE_URL` (workers.dev, preview) mendapat `Disallow: /` tanpa sitemap dan header `x-robots-tag: noindex, nofollow` | (b)(c)(d)(e) Workers Route, redirect www, ekspor DNS, `workers_dev: false` setelah H+14: Cloudflare |
| **P5** harga | Hero produk menampilkan "mulai Rp… · belum termasuk ongkir", tanggal "Harga diperbarui", tombol WhatsApp di bawah tabel; bila semua baris tanpa harga: tabel tanpa kolom harga + blok "Harga mengikuti ukuran…"; gambar hero `fetchpriority=high` | Isi `price` per varian paving, kanstin, genteng, greffel; putuskan satu set harga paket pasang paving |
| **P6** artikel | Tidak ada perubahan kode | Ekspor Search Console, 5 artikel baru, ubah target redirect |
| **P7** kata kunci H1/title | Bawaan `hero_title` = "Pabrik Paving Block & Beton Precast di Purwakarta" (tagline pindah ke `hero_subtitle`), `seo_title` beranda = judul situs lama; H1 produk + " Purwakarta" (jasa dan nama yang sudah memuat Purwakarta dikecualikan); akhiran judul ganda hilang | Menjalankan `perbarui-judul-meta.sql` bila D1 sudah punya baris `settings`/`seo_title` |
| **P8** kecepatan dan pratinjau | `public/_headers` (`/_next/static/*` immutable 1 tahun; `/img/*`, `/brand/*`, `/reel/*` 1 hari); `og:image` + `twitter:card` bawaan di `src/app/layout.tsx` | Gambar OG 1200x630 ≤150 KB (sementara foto pabrik 1600x1334); `width`/`height` pada `<img>` produk **belum dikerjakan**; ukur PageSpeed H+28 |
| **P9** schema lokal | `localBusiness()`: `openingHoursSpecification` (Sabtu-Kamis 07.30-17.00, diparse dari `hours`), `postalCode`, `geo`, `hasMap`, `sameAs`; dipindah ke `(site)/layout.tsx` (semua halaman publik, satu node `#business`); `/kontak`: alamat bisa diklik + tombol "Buka di Google Maps"; kunci pengaturan baru `geo_lat`, `geo_lng`, `same_as` (ada di form `/situs`) | Menjalankan `perbarui-info-bisnis.sql`; `maps_embed_url`; nomor telepon utama (LK-02); samakan NAP di listing luar |
| **P10** final URL Ads | Tidak ada (bukan kode) | Google Ads Editor: ganti final URL/sitemap/teks iklan ke path baru, buang "Rp150.000", "gratis ongkir", "ISO" bila tidak terbukti |
| **P11** bukti sosial dan CTA | Chip rating beranda hanya tampil bila tertaut ke `maps_url`; tombol "Cek harga + ongkir ke {area}" di halaman area; `data-cta="kalkulator"` pada tombol WhatsApp kalkulator | Testimoni (izin pelanggan), cocokkan rating 4,8/42 ulasan dengan Google Business Profile, jam balas admin |
| **P12** redirect dan Search Console | (a) 5 kunci baru di `legacy-redirects.json` (`/category/blog-artikel` 301; `/category/uncategorized`, `/author/…`, `/feed`, `/comments/feed` 410); (b) `redirects()` di `next.config.ts`: 5 sitemap WordPress lama 301 ke `/sitemap.xml` | (c) 301 `wp-content/uploads` hanya untuk gambar yang berklik; (d) properti Domain di Search Console |
| **AI-SEO** | `/llms.txt` dan `/pricing.md` (dibangkitkan dari D1, cache 5 menit); JSON-LD `AggregateOffer` hanya dari angka yang tampil di halaman (tanpa `priceValidUntil`/`availability`) | Putuskan apakah `/pricing.md` dirawat; isi harga per varian |

Tambahan: seed kebijakan privasi (`seed/seed.sql`) diperbarui karena teks lama menyangkal Google Tag Manager dan cookie, padahal GTM kini dimuat. Teks siap tempel ada di `teks-kebijakan-privasi.md`.

## 2. Berkas SQL dan cara menjalankannya

Dua patch, **tidak dijalankan otomatis**. Keduanya aman diulang: semua `UPDATE` bersyarat (hanya mengubah nilai yang masih sama dengan nilai lama atau masih kosong), kunci baru memakai `INSERT OR IGNORE`, tidak ada `DELETE`/`DROP`.

| Berkas | Isi |
|---|---|
| `perbarui-judul-meta.sql` | `hero_title`, `hero_subtitle`, `seo_title` beranda; `seo_title` + `seo_description` 6 produk; meta 3 halaman area (judul ≤60, meta ≤155 karakter) |
| `perbarui-info-bisnis.sql` | `geo_lat`, `geo_lng`, `same_as`, dan `maps_url` (hanya bila masih kosong) |

Langkah (dari folder repo, sesudah kode baru tayang):

```powershell
# 1. Cadangan dulu, simpan di luar repo
npx wrangler d1 export istana-block-db --remote --output ../backup-TANGGAL.sql

# 2. (opsional) coba di database lokal
npx wrangler d1 execute DB --local --file=docs/seo/perbarui-judul-meta.sql

# 3. Jalankan ke produksi, satu per satu
npx wrangler d1 execute DB --remote --file=docs/seo/perbarui-judul-meta.sql
npx wrangler d1 execute DB --remote --file=docs/seo/perbarui-info-bisnis.sql
```

Perubahan tampil sesudah cache halaman publik habis (sekitar 5 menit). Pemeriksaan hasilnya ada di komentar bawah tiap berkas.

Peringatan:
- **Jangan jalankan `npm run db:seed:remote` lagi di D1 produksi.** `seed/seed.sql` diawali `DELETE FROM products/articles/pages`: semua isi yang diedit lewat panel dan hasil patch di atas hilang.
- `perbarui-info-bisnis.sql` membuat chip rating beranda tampil (karena `maps_url` terisi). **Cocokkan rating dan jumlah ulasan dengan Google Business Profile lebih dulu** (bawaan 4,8 dan 42 tidak terdokumentasi sumbernya).
- Judul produk memuat "2026": ganti tiap Januari. Meta produk memuat harga mulai: perbarui bila harga berubah.
- Judul dari D1 kini tampil apa adanya (tanpa akhiran merek otomatis). Isi "Judul SEO" di panel lengkap dengan "| Istana Block", maksimal 60 karakter.

## 3. Urutan yang disarankan

1. Tinjau dan gabungkan cabang ini (di atas PR #6); deploy ke staging.
2. Uji dengan curl (lihat bagian 4).
3. Pemilik: cocokkan rating Google, tentukan nomor telepon utama, putuskan `/pricing.md`.
4. Cadangkan D1, jalankan `perbarui-judul-meta.sql`, lalu `perbarui-info-bisnis.sql`.
5. Tempel teks kebijakan privasi lewat `/situs` -> Halaman (sebelum atau pada hari pindah domain).
6. Isi lewat panel: `maps_embed_url`, testimoni, harga per varian, `description`/FAQ produk (P3, P5).
7. Buat pemicu GTM untuk `a[data-cta="kalkulator"]` (konversi **Secondary**; klik itu juga cocok dengan pemicu `wa.me`, jadi jangan dijumlahkan dengan konversi WhatsApp Primary).
8. Uji `/` di Rich Results Test dan Schema Markup Validator (`HomeAndConstructionBusiness`: geo, sameAs, hasMap, openingHoursSpecification, postalCode).
9. Hari pindah domain: Cloudflare (P4 b-d), Google Ads final URL (P10), Search Console: kirim ulang `sitemap.xml`, hapus `sitemap_index.xml`, tambah properti Domain (P12).
10. H+14: `"workers_dev": false` di `wrangler.jsonc` (bukan `wrangler.demo.jsonc`). H+28: ukur PageSpeed (P8e).

## 4. Pemeriksaan sesudah deploy

- `curl -sI https://istana-block-web.abdussalimsan.workers.dev/produk/paving-block` memuat `x-robots-tag: noindex, nofollow`; `/robots.txt` di host itu `Disallow: /` tanpa `Sitemap`.
- `https://istanablockpurwakarta.com` (dan `-A AdsBot-Google`): tanpa `x-robots-tag`, `robots.txt` berisi `Allow: /` dan `Sitemap`. Uji juga `curl -H "X-Forwarded-Host: x.workers.dev" https://istanablockpurwakarta.com/robots.txt`: tetap `Allow: /`.
- `curl -sI /sitemap_index.xml` -> 301 ke `/sitemap.xml`; `/feed` -> 410; `/category/blog-artikel` -> 301 ke `/artikel`.
- `curl -sI /_next/static/<berkas>.js` memuat `cache-control: ... immutable`.
- `/llms.txt` dan `/pricing.md` terbuka dan angkanya sama dengan halaman produk.
- Satu blok `HomeAndConstructionBusiness` per halaman (tidak ganda); satu `<h1>` per halaman.

## 5. Yang perlu pemilik (ringkas)

- **Klaim yang belum terbukti:** "berstandar SNI" (beranda dan spesifikasi paving di seed) dan rentang mutu K-350-K-450 vs buis K-300 vs sertifikat TKDN. Beri bukti atau buang.
- **Harga:** satu set harga paket pasang (D1 180/220/230 ribu vs situs lama 150/170/190 ribu); harga per varian paving, kanstin, genteng, greffel.
- **Kontak dan profil:** nomor telepon utama (JSON-LD `telephone` kini +62264200476 dari telepon kantor, tidak ada di sumber luar); jam Sabtu-Kamis 07.30-17.00 benar menurut Google Business Profile; kanal YouTube yang benar (URL lama 404); cek Instagram dan Facebook masih aktif; `maps_embed_url`.
- **Redirect:** `/author/…` dan `/category/uncategorized` kini 410 (alternatif: 301 ke `/profil` dan `/artikel`, ubah satu baris di `legacy-redirects.json`); daftar gambar `wp-content/uploads` dari Search Console; PDF katalog lama (unggah, isi `catalog_url`, tambah redirect).
- **Kebijakan privasi:** tempel teks, tentukan tanggal "Berlaku sejak" baru, cek isi container GTM-PXSMDXD8 (hanya GA4 + Google Ads?), tanya penasihat hukum soal banner persetujuan cookie.
- **Konten:** gambar OG 1200x630 oleh desainer; 5 artikel baru dan ekspor Search Console (P6); testimoni; jam balas admin; kebijakan retur/cek barang; tanggal asli per artikel bila `lastmod` seragam di sitemap dianggap masalah.

## 6. Catatan QA lintas klaster

Tidak ada masalah yang memblokir. `tsc --noEmit` lulus, tanpa import yatim di berkas yang diubah. Berkas terlarang (`worker.ts`, `GoogleTagManager.tsx`, `open-next.config.ts`, `drizzle/`, `package.json`, `wrangler*.jsonc`) tidak berubah. Catatan kecil yang sengaja tidak diubah:

- `robots.ts` membaca header `Host`. Aman selama middleware OpenNext tetap eksternal (menimpa `x-forwarded-host`); uji curl di bagian 4 membuktikannya.
- `offerCount` pada JSON-LD produk yang memakai harga hero (mis. U-Ditch 14) tidak sama dengan jumlah baris yang tampil (17). Field itu opsional dan tidak berbahaya; bisa dibuang di `productOffers()`.
- Teks privasi menyebut Google menghubungkan klik iklan dengan "pesan yang masuk". Yang terukur hanya klik tombol WhatsApp/telepon. Rapikan frasa itu saat menempel (butir 2 dan 3 di `teks-kebijakan-privasi.md`, dan `seed/seed.sql`).
- "Harga diperbarui" memakai `products.updated_at`, yang maju setiap produk disimpan, bukan hanya saat harga berubah.
- Artikel tanpa "Judul SEO" masih memakai template layout (akhiran 26 karakter), jadi bisa lewat 60 karakter. Isi "Judul SEO" di panel.
- Alamat lama WordPress yang diperluas ke 199 entri (180 -> 301, 19 -> 410); angka di `README.md` utama sudah disesuaikan.

## 7. Tambahan dari analisis kompetitor (20 Okt 2026)

Sumber: riset dua kompetitor (Cisangkan, Conbloc), butir `KOMP-01` sampai `KOMP-11`. Sama seperti tahap sebelumnya: hanya kode dan berkas bantu, **belum ada yang dijalankan ke D1, Cloudflare, staging, atau produksi**, dan `next build` belum dijalankan (hanya `tsc --noEmit`, lulus). Satu-satunya perubahan di `package.json` adalah skrip `cek:seo`; kalimat di bagian 6 bahwa `package.json` tidak berubah berlaku untuk tahap sebelumnya.

### 7.1 Apa yang ditambahkan

| Butir | Berkas | Isi |
|---|---|---|
| **KOMP-01** pagar regresi | `tools/cek-seo.mjs` (baru), `package.json` (skrip `cek:seo`) | Skrip Node tanpa dependensi yang memeriksa sitemap, tiap halaman di HTML mentah, header cache, anggaran JS, TTFB, dan tautan internal. Cara pakai di 7.2 |
| **KOMP-02** CTA produk | `src/app/(site)/produk/[slug]/page.tsx`, `src/components/SiteChrome.tsx` | Produk kategori `Paving`: tautan "Hitung kebutuhan paving" ke `/pola-paving` (tautan `<a>` biasa, terbaca crawler) di hero dan di bawah tabel harga. Bila `catalog_url` terisi: "Unduh katalog (PDF)" dengan `data-cta="katalog"` di hero produk dan kolom Informasi footer. Kosong = tidak dirender, tidak ada tombol mati |
| **KOMP-06** sitemap gambar | `src/app/sitemap.ts` | `/galeri` membawa 24 URL gambar absolut (sama dengan `contentUrl` JSON-LD galeri), produk dan artikel membawa satu gambar (foto produk, sampul artikel). Tanpa foto = tanpa properti `images`. Tidak ada `lastModified` palsu |
| **KOMP-07** robots dan WebSite | `src/app/layout.tsx`, `src/lib/jsonld.ts`, `src/app/(site)/page.tsx` | (a) Situs publik: meta robots eksplisit `index, follow` dengan `max-image-preview:large`, `max-snippet:-1`, `max-video-preview:-1`; mode demo tetap `noindex`. (b) Beranda memuat satu node `WebSite` (`@id` `/#website`, `publisher` merujuk `/#business`), tanpa `SearchAction` karena situs tidak punya pencarian |
| **KOMP-09** gambar Markdown | `src/components/Markdown.tsx` | `<img>` di isi artikel/halaman: `loading="lazy"`, `decoding="async"`, `alt` selalu ada. Sampul artikel tidak lewat Markdown, jadi tidak berubah |

Catatan teknis KOMP-07: Next menulis direktif `max-*` ke `<meta name="googlebot">`, sedangkan `<meta name="robots">` hanya berisi `index, follow`. Google membaca keduanya. Pada host staging, `noindex` tetap datang dari header `x-robots-tag` dan `robots.txt` (`middleware.ts`, `robots.ts`); meta HTML kini `index, follow`, dan Google memakai direktif paling ketat.

### 7.2 Pagar regresi `tools/cek-seo.mjs`

Syarat: Node >= 22, tanpa `npm install`. Dari akar repo (PowerShell):

```powershell
# opsional: catat lokasi pengukur, supaya angka TTFB bisa dibandingkan antar-run
$env:LOKASI_UKUR = "Purwakarta"

# staging
node tools/cek-seo.mjs https://istana-block-web.abdussalimsan.workers.dev

# produksi (T-1 sebelum pindah domain, dan sesudahnya)
node tools/cek-seo.mjs https://istanablockpurwakarta.com

# lewat npm; keluaran mesin-baca untuk disimpan
npm run cek:seo -- https://istanablockpurwakarta.com --json
```

| Opsi | Fungsi |
|---|---|
| `<baseUrl>` | Wajib. Tanpa argumen skrip berhenti dengan exit code 2 |
| `--json` | Keluaran JSON (ringkasan + semua hasil), tanpa teks progres |
| `--skip-ttfb` | Lewati pengukuran TTFB (5 permintaan x 3 halaman) |
| `--prod-host <domain>` | Domain yang dianggap produksi (bawaan `istanablockpurwakarta.com`, `www.`-nya ikut) |
| env `LOKASI_UKUR` | Catatan lokasi ukur di laporan TTFB. Backlog mencatat TTFB kompetitor 0,10-0,21 s vs 0,50-0,80 s tergantung lokasi |

**Arti hasil.** Tiap pemeriksaan berlabel salah satu dari tiga:
- `[LULUS]`: sesuai.
- `[PERINGATAN]`: patut dilihat, **tidak** menggagalkan skrip.
- `[GAGAL]`: pelanggaran; satu saja membuat exit code 1 dan baris akhir `HASIL: GAGAL`. Tanpa GAGAL: exit code 0 dan `HASIL: LULUS`.
- Exit code 2: salah pakai atau skrip sendiri gagal jalan (bukan hasil pemeriksaan).

**Mode host** (otomatis dari baseUrl). Sitemap selalu berisi domain produksi walau dibaca dari staging, jadi origin ditulis ulang ke baseUrl dan canonical dibandingkan lewat path.
- *Produksi* (`istanablockpurwakarta.com`): `noindex` di header/meta = GAGAL; `robots.txt` wajib terbuka dan memuat `Sitemap:`; `<loc>` dan canonical wajib berdomain produksi; pengalihan http dan www ikut diperiksa.
- *Non-produksi* (workers.dev, localhost): `noindex` dan `Disallow: /` justru diharapkan (LULUS); host tanpa itu = GAGAL (PERINGATAN di localhost); pengalihan http/www dilewati.

**Yang diperiksa.**
- Sitemap: terbaca sebagai `<urlset>`, tanpa `/cart`, `/checkout`, `/my-account`, `/tag/`, `/category/`; tiap URL 200 tanpa redirect; `lastmod` yang seragam dan sama dengan waktu permintaan = GAGAL (pola Cisangkan), seragam tapi bertanggal lama = PERINGATAN.
- Tiap halaman (HTML mentah, tanpa JS): tepat satu `<h1>` yang tidak tersembunyi, `lang="id"`, `<title>` maks 65 karakter dan unik, meta description 70-165 karakter, canonical tunggal yang path-nya sama, minimal 150 kata di `<main>` (`/kontak` dan `/galeri` hanya PERINGATAN), tanpa cangkang CSR (`Loading...`, `Memuat...`, `BAILOUT_TO_CLIENT_SIDE_RENDERING`), JSON-LD terparse tanpa `Offer` harga 0 dan tanpa `AggregateRating`, tepat satu node LocalBusiness, tanpa teks cadangan (`XXXX`, `example.com`, `email.com`, `kode_verifikasi`, `lorem ipsum`), ada `og:image`, semua `<img>` beralt.
- Header: satu `Cache-Control` per jenis berkas (dibaca dari header mentah karena `fetch` menggabungkan baris ganda), tanpa arahan yang saling meniadakan, `/_next/static/*` `immutable`, kompresi aktif, sebaran `x-ib-cache` dicatat.
- Ketahanan: 30 permintaan beruntun ke `/` dan satu halaman produk, satu saja 5xx = GAGAL; tautan internal beranda harus 200.
- Anggaran JS (gzip level 9, hanya `<script src>` satu origin): `/` 140 KB, produk 135 KB, `/pola-paving` 150 KB. Lewat batas = PERINGATAN, lewat 20% = GAGAL. Angka ini baseline build 19 Okt + sekitar 25%, usulan saya, bukan standar.
- Dependensi: `package.json` tidak boleh menambah pustaka ikon/UI/slider berat ke `dependencies` (Font Awesome, react-icons, lucide, bootstrap, swiper, jquery, MUI, dll.).
- TTFB: median dan nilai minimum dari 5 permintaan ke `/`, produk, `/kontak`; median > 800 ms = PERINGATAN.

**Kapan dijalankan.**
1. Setelah **setiap deploy ke staging**: pastikan tidak ada GAGAL baru. Staging di Workers Free kadang membalas 503, ulangi sekali sebelum menganggapnya temuan.
2. **T-1 di domain produksi** sebagai bagian go/no-go pindah domain: hasil harus tanpa GAGAL. Simpan keluaran `--json` bersama catatan go/no-go.
3. Ulangi sekali sesudah DNS pindah, lalu setelah tiap perubahan besar pada layout, `middleware.ts`, `worker.ts`, atau dependensi.

Skrip hanya membaca (GET). Ia belum pernah dicoba terhadap HTML Next.js asli; hanya HTML sintetis dan server tiruan. Anggap run pertama sebagai uji skrip itu sendiri: bila ada GAGAL yang tampak janggal, periksa dulu apakah skripnya yang keliru.

### 7.3 Temuan yang sudah diketahui akan muncul di run pertama

- **GAGAL `title` di `/area-pengiriman`**: `Area Pengiriman Paving, U-Ditch & Buis Beton` (44 karakter) + akhiran ` | Istana Block Purwakarta` (26) = 70 karakter, melebihi batas 65. Berkas ini tidak diubah tahap ini. Pilihan pemilik: persingkat judul di `src/app/(site)/area-pengiriman/page.tsx` (maksimal 39 karakter agar total <= 65, mis. `Area Pengiriman Paving & Beton Pracetak`; ini mengurangi kata kunci U-Ditch dan buis di judul), atau naikkan `BATAS.judulMaks` di `tools/cek-seo.mjs` bila 70 diterima. Judul halaman statis lain (`/galeri` 64, `/paket-proyek` 62, `/produk` 62, `/artikel` 58) lolos.
- **PERINGATAN `isi`** di `/kontak` dan `/galeri` (halaman tipis, memang dikecualikan dari GAGAL), dan **PERINGATAN `sitemap-lastmod`** bila semua `updatedAt` produk/artikel identik (mis. sama-sama hasil seed).
- Halaman lain yang kurang dari 150 kata di `<main>`, atau meta description di luar 70-165 karakter, belum bisa diprediksi tanpa HTML nyata; itu hasil run pertama yang sah.

### 7.4 Sengaja ditunda

| Butir | Alasan |
|---|---|
| **KOMP-03** halaman proyek | Kodenya kecil, tetapi isinya (nama proyek, kawasan, tahun, volume, foto, izin testimoni) hanya pemilik yang punya. Halaman proyek tanpa data nyata = konten karangan |
| **KOMP-04** ISR / incremental cache | Keputusan, bukan kode: butuh tiga binding baru dan jalur ISR di Workers via OpenNext belum teruji; ada pembekuan T-15. Evaluasi H+28 bila rasio MISS tinggi atau TTFB buruk. `worker.ts` tetap lapis utama |
| **KOMP-05** query pada kunci cache | Mengubah `worker.ts` (terlarang di tahap ini) dan butuh log Worker untuk membuktikan query liar benar-benar memecah cache. Tunggu log, baru putuskan `QUERY_ROUTES` |
| **KOMP-08** font lokal `next/font/local` | Menunggu skor PageSpeed H+28; tanpa angka, belum terbukti font adalah hambatan. Menyentuh `layout.tsx`, `globals.css`, dan aset font |
| **KOMP-10** kalkulator produk (U-Ditch, buis, kanstin, genteng) | Butuh rumus per produk dari pemilik (panjang/luas per unit, cadangan). Rumus karangan bisa menyesatkan pembeli |
| **KOMP-11** listing Indotrading / marketplace | Di luar kode. Nama usaha, alamat, dan telepon harus persis sama dengan Google Business Profile; tautkan ke halaman produk, lalu isi `same_as` di `/situs` |

Bagian KOMP-02 yang belum: berkas PDF katalog di `public/katalog/` dan aturan cache `/katalog/*` di `public/_headers` (berkas itu dilarang diubah di tahap ini). Selama `catalog_url` kosong, tombol katalog tidak muncul.

### 7.5 Yang perlu pemilik (baru)

- **Jalankan pagar regresi sendiri** dari mesin berjaringan: staging sesudah deploy, lalu produksi pada T-1. Skrip belum pernah dicoba terhadap HTML Next.js asli.
- **Setujui atau ubah ambang** (konstanta di bagian atas `tools/cek-seo.mjs`): judul maks 65, description 70-165, minimal 150 kata di `<main>`, JS 140/135/150 KB gz, PERINGATAN TTFB median > 800 ms, `lastmod` seragam sama dengan waktu permintaan = GAGAL (seragam tapi lama = PERINGATAN, lebih longgar dari bunyi backlog).
- **Putuskan judul `/area-pengiriman`** (lihat 7.3) dan konfirmasi `/kontak` dan `/galeri` memang boleh tipis.
- **Pastikan `/produk/paving-block` ada di sitemap produksi** (dipakai untuk anggaran JS, uji 5xx, dan TTFB; bila tidak ada, skrip memakai produk pertama di sitemap).
- **Setujui daftar `PUSTAKA_BERAT`** untuk penjaga dependensi, atau minta dibuang.
- **Katalog PDF**: pilih berkas mana yang dipakai (PDF lama di WordPress 1.961.587 B, butir MG-15). Isian "Tautan katalog" di `/situs` adalah `<input type="url">`, jadi **harus URL absolut `https://`** (mis. `https://istanablockpurwakarta.com/katalog/nama.pdf` bila ditaruh di `public/katalog/`); path relatif `/katalog/...` ditolak browser meski validasi server menerimanya. Bila ditaruh di `public/katalog/`, tambahkan aturan cache `/katalog/*` di `public/_headers`.
- **GTM**: buat pemicu untuk `a[data-cta="katalog"]` sebagai konversi **Secondary** (seperti `a[data-cta="kalkulator"]` di langkah 7 bagian 3); jangan dijumlahkan dengan konversi WhatsApp Primary. Tautan "Hitung kebutuhan paving" sengaja **tanpa** `data-cta="kalkulator"` karena atribut itu menandai lead WhatsApp di dalam kalkulator; klik masuk ke kalkulator terukur lewat pageview `/pola-paving`.
- **Setelah 30 hari**, bandingkan klik kalkulator dan katalog dengan klik WhatsApp. Tanpa data GA4, dampaknya tidak boleh diklaim.
- **Setelah deploy**: `curl https://istanablockpurwakarta.com/sitemap.xml | grep -c "<image:loc>"` (harapan: 24 + jumlah produk berfoto + artikel bersampul) dan cek Search Console, Sitemap, tanpa galat. Validasi node `WebSite` di Rich Results Test atau Schema Markup Validator; nama situs di hasil pencarian baru berubah setelah Google merayap ulang dan tidak dijamin.
- **Putuskan** apakah halaman CMS (`[slug]`) yang punya sampul ikut masuk sitemap gambar (saat ini tidak; KOMP-06 hanya menyebut galeri, produk, artikel).
- Hero produk paving bisa memuat empat tombol bila `catalog_url` terisi. **Lihat tampilannya di staging pada lebar 375 px.**

### 7.6 Catatan QA lintas klaster (tahap ini)

`tsc --noEmit --incremental false` lulus. Berkas terlarang (`worker.ts`, `GoogleTagManager.tsx`, `open-next.config.ts`, `next.config.ts`, `drizzle/`, `middleware.ts`, `robots.ts`, `host.ts`, `public/_headers`, `docs/pelacakan-google-ads.md`) tidak disentuh tahap ini (stempel waktu semuanya dari tahap sebelumnya). Diperiksa dan bersih:
- Hanya satu node `WebSite` (beranda) dan satu node LocalBusiness (`(site)/layout.tsx`). `isPartOf: { "@type": "WebSite", ... }` di `(site)/[slug]/page.tsx` adalah objek bersarang tanpa `@id`, bukan node kedua; sengaja dibiarkan karena referensi `@id` ke `/#website` akan menggantung di halaman yang tidak memuat node itu.
- Tombol kalkulator: di hero dan di bawah tabel harga (dua blok berbeda), sedangkan varian "ada harga" dan "tanpa harga" di bawah tabel saling eksklusif. Tombol katalog: hero dan footer. Tidak ada duplikat dalam satu blok.
- Tidak ada impor yatim (`localBusiness` dicopot dari beranda, `getEnv` dan `webSite` terpakai). `images` pada sitemap divalidasi terhadap `resolve-route-data.js` Next 15.5 (menambah `xmlns:image` dan `<image:loc>` otomatis); semua 24 `src` galeri ada di `public/`, tanpa duplikat atau karakter yang perlu di-escape.
- Parser sitemap di `cek-seo.mjs` membaca `<loc>`, bukan `<image:loc>`, jadi gambar tidak diperlakukan sebagai halaman. Pemeriksa noindex membaca header dan meta, sehingga `index, follow` eksplisit dari KOMP-07 tidak memicu GAGAL di produksi.
- Aturan lama tetap benar: satu `<h1>` per halaman, satu blok LocalBusiness per halaman.
