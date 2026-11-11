# Impor konten WordPress → situs baru

Situs lama `istanablockpurwakarta.com` (WordPress + Yoast) punya **196 artikel** (median 1.387 kata).
Skrip di folder ini mengambil ulang seluruh isi, gambar isi, dan thumbnail sampul (`featured_media` +
cadangan `og_image` / gambar pertama) melalui REST API, mengubah HTML → Markdown bersih, mengklasifikasikan
topik artikel, dan membentuk SQL untuk D1.

## Urutan jalan

```bash
# 1. Ambil seluruh konten (posts, pages, categories) + metadata media (featured_media)
python scripts/migrasi-wp/crawl-wp.py      # -> wp-corpus/raw/, raw/media_by_id.json, <tipe>/<slug>.md

# 2. Unduh gambar isi + thumbnail sampul, ubah ke WebP (maks 1200 px), siapkan unggahan R2
python scripts/migrasi-wp/wp-gambar.py     # -> wp-corpus/gambar/, gambar-peta.json, cover-peta.json
#    lalu unggah berkas WebP baru ke bucket R2 `istana-block-media`

# 3. HTML -> Markdown bersih berbasis BeautifulSoup4 (tautan pulih, tabel GFM, gambar -> /media/<key>)
python scripts/migrasi-wp/wp2md.py         # -> scripts/migrasi-wp/wp-corpus/md/…

# 4. Bentuk SQL impor + update artikel native + rollback
python scripts/migrasi-wp/buat-impor.py    # -> drizzle/data/2026-11-impor-artikel-wp/*.sql
```

## Aturan yang dipakai

- **Duplikat & halaman area:** 3 slug area kota (`paving-block-bekasi-cikarang`, `paving-block-karawang-cikampek`,
  `paving-block-subang`) tetap menjadi halaman root di tabel `pages`; 1 duplikat 96,8% (`paving-block-murah`)
  dan 1 stub <200 kata (`masih-ragu-pilih-istana-block`) tetap memakai redirect 301 di `src/data/legacy-redirects.json`.
- **Thumbnail sampul (`cover_key`):** 183 artikel bersampul memakai gambar asli hasil scraping WordPress di R2
  (`artikel/<slug>/<hash>.webp`). Khusus 8 artikel yang memang tidak punya gambar di sumbernya (dan artikel native),
  dipakai ilustrasi khusus artikel `/img/artikel/sampul-panduan.webp` — bukan foto produk.
- **Kategori otomatis:** setiap artikel diklasifikasikan ke salah satu dari 6 topik (`Paving & Grass Block`,
  `Genteng & Atap`, `Beton Cor & Konstruksi`, `Buis & Gorong-gorong`, `U-Ditch & Saluran`, `Kanstin`).
- **Tautan internal & eksternal:** dipulihkan penuh oleh `wp2md.py` dan dipetakan lewat
  `src/data/legacy-redirects.json` serta daftar halaman situs baru oleh `buat-impor.py`.
- **Judul & deskripsi SEO:** diambil dari Yoast/ringkasan bersih (tanpa markup Markdown), dipotong rapi ke batas SERP.

## Batasan D1 yang ditemukan

- `wrangler d1 execute --file` bisa berhenti tanpa galat jelas jika berkas memuat terlalu banyak pernyataan panjang;
  `buat-impor.py` memecah keluaran menjadi maks 40 artikel per berkas SQL.
