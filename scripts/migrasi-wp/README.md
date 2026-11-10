# Impor konten WordPress → situs baru

Situs lama `istanablockpurwakarta.com` (WordPress + Yoast) punya **196 artikel** (median 1.350 kata).
Situs baru sebelumnya hanya punya **1 artikel**. Skrip di folder ini memindahkan isinya tanpa
mengubah tangan: ambil dari REST API, ubah HTML → Markdown, lalu tulis SQL untuk D1.

## Urutan jalan

```bash
# 1. Ambil seluruh konten (posts, pages) + simpan JSON & teks bersih
python scripts/migrasi-wp/crawl-wp.py      # -> scripts/migrasi-wp/wp-corpus/raw/, <tipe>/<slug>.md

# 2. Unduh gambar isi artikel, ubah ke WebP, siapkan unggahan R2
python scripts/migrasi-wp/wp-gambar.py     # -> wp-corpus/gambar/, gambar-peta.json
#    lalu unggah: satu perintah per baris di wp-corpus/unggah.txt (bisa paralel)
#    npx wrangler r2 object put istana-block-media/<key> --file <path> --content-type image/webp --remote

# 3. HTML -> Markdown (tabel GFM, tanpa HTML mentah, gambar -> /media/<key>)
python scripts/migrasi-wp/wp2md.py         # -> scripts/migrasi-wp/wp-corpus/md/…

# 4. Bentuk SQL impor + rollback
python scripts/migrasi-wp/buat-impor.py    # -> drizzle/data/2026-11-impor-artikel-wp/*.sql
```

Gambar **tidak** disimpan sebagai aset Worker: 510 berkas WebP (29,6 MB, median 1.080 px) masuk R2
bucket `istana-block-media` dengan key `artikel/<slug>/<hash>.webp`, lalu disajikan route
`/media/[...key]` (cache 1 tahun, immutable). Isi artikel menulis `![alt](/media/artikel/...)`.
Alt kosong dari WordPress diisi "judul artikel (gambar N)" agar tidak ada gambar tanpa teks alternatif.

Lalu terapkan ke D1 (satu perintah per berkas):

```bash
npx wrangler d1 execute istana-block-web-db --remote --file drizzle/data/2026-11-impor-artikel-wp/01-artikel.sql --yes
```

## Aturan yang dipakai

- **Duplikat isi** (>0,95 kemiripan) disimpan satu saja; isi <200 kata tidak diimpor.
- **Gambar di dalam isi dibuang**, bukan dipindahkan: 627 berkas media terlalu berat untuk aset Worker,
  dan gambar WordPress akan mati saat cutover. Sampul artikel memakai foto produk yang sudah ada.
- **Tautan internal** dijadikan relatif dan hanya dipertahankan bila sasarannya benar-benar ada di situs
  baru (22 halaman + artikel hasil impor). Sasarannya tidak ada → tautan dilepas, teks tetap.
- **Judul SEO** diambil dari Yoast, akhiran " - Istana Block" dipotong, dipotong ke ≤65 karakter.
  Deskripsi SEO dipotong ke 70–165 karakter.
- `published = 1` dan `published_at` mengikuti tanggal terbit WordPress.

## Batasan D1 yang ditemukan

- `wrangler d1 execute --file` berhenti tanpa galat jelas kalau berkas memuat >50 pernyataan panjang;
  aman dipecah <50 per berkas.
- `--command` membaca argumen CLI, jadi **baris komentar `--` harus dibuang** sebelum dikirim.
- Pecahan SQL: `HANYA="slug-a,slug-b" PER_FILE=1 KELUAR=…/ulang python scripts/migrasi-wp/buat-impor.py`.
