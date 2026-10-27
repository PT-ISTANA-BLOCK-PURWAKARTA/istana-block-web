> TIDAK DIPAKAI — pemilik memutuskan fresh start 27 Okt 2026 (data app lama tidak dimigrasi). Skrip ini dan guard arsip `src/lib/erp/archive.ts` dibiarkan (inert).

# Migrasi data inventori-ops -> istana-block-web

Skrip satu kali, offline (Node 24, hanya modul bawaan; tanpa `npm install`). Spesifikasi lengkap: `docs/arsip/migrasi-data-inventori-ops.md`.

## Pakai

    node scripts/migrasi-inventori-ops/migrasi.mjs --backup <folder backup> --snapshot <snap.sql> --out <folder keluaran> [--final] [--open=stop|skip] [--cutover <ISO>]

- `--backup`: folder berisi `database/backup-*.sql` (yang terbaru dipakai) dan `foto/`.
- `--snapshot`: hasil `wrangler d1 export DB --remote --output snap.sql` (juga cadangan sebelum impor). Wajib.
- `--out`: folder keluaran. Harus DI LUAR repo (pengecualian: `fixture/` yang di-gitignore). Kredensial ditulis ke `<out>/../rahasia/akun-baru.csv`.
- Default **dry-run**: hanya `laporan/*.csv` + `laporan/hitungan.csv`. Tinjau `cocok-*.csv`, `perlu-kredensial.csv`, `foto-hilang.csv`, `foto-yatim.csv`, `peringatan.csv` sebelum `--final`.
- `--final`: menulis `00-prep.sql` ... `07-iso.sql` (pecah otomatis <=1000 pernyataan / <=2 MB: `03-pesanan-kirim-2.sql`, ...), `08-verifikasi.sql`,
  `r2-manifest.json`, `unggah-r2.ps1`, `plan/user-map.json`.
- PO/pengiriman terbuka (F3): dry-run hanya memperingatkan; `--final` BERHENTI (kode keluar 2) dengan daftar `laporan/po-terbuka.csv`.
  `--open=skip` melewati PO terbuka beserta turunannya (`laporan/pesanan-dilewati.csv`).
- `--cutover`: waktu cutover ISO (mis. `2026-10-31T00:00:00+07:00`). Default = waktu backup dari nama berkas, supaya keluaran deterministik.

## Urutan impor

1. Cadangkan D1, uji dulu `--local` (`wrangler d1 execute DB --local --file=snap.sql`, lalu berkas di bawah).
2. `wrangler d1 execute DB --remote --file=<out>/00-prep.sql`, lalu `01-users`, `02-master`, `03-pesanan-kirim*`, `04-qc`, `05-terima-produksi`, `06-piket-kalender`, `07-iso` berurutan; berhenti di kesalahan pertama (semua `INSERT OR IGNORE`, aman diulang).
3. Foto: `powershell -File <out>\unggah-r2.ps1 -Local` atau `-Remote` (wajib pilih salah satu; dijalankan dari folder repo atau `-Repo <path>`). Bila workerd crash di Windows (`-Local`), tambah `-Wsl [-WslRepo ~/salinan-repo]`: wrangler dijalankan di WSL (state R2 lokal = `.wrangler` salinan WSL itu).
4. `wrangler d1 execute DB --remote --file=<out>/08-verifikasi.sql`: kolom `nilai` harus sama dengan `harapan` di semua baris.

## Berkas masukan opsional

- `<out>/plan/alias-barang.csv` (`nama_sumber,item_web`): padanan manual nama barang sumber -> id/nama `fin_items` web. Dipakai ulang tiap proses.
- `<out>/plan/user-map.json`: peta id pengguna sumber -> web (dibuat `--final`, dipakai ulang; jangan dihapus setelah impor).

## Proses ulang

Aman: id deterministik `iops-<tabel>-<id>`, kredensial lama di `akun-baru.csv` dipakai lagi (PIN/password tetap, hanya salt hash baru), baris `iops-*` di snapshot diabaikan saat pencocokan data induk.
`akun-baru.csv` berisi sandi/PIN polos: JANGAN di-commit, hapus setelah dibagikan.

## API untuk modul (`lib/*.mjs` mengekspor `migrate(ctx)`)

`lib/core.mjs`: `lit`, `insert`, `sec`, `wibDate`, `iid`, `normalizePhone`, `normName`, `writeCsv`, `readCsv`, `class Ctx`:
`src`/`web` (DatabaseSync), `cutoverSec`, `backupDir`, `rows`, `webRows`, `emit(berkas, stmt)`, `report(nama, baris)`, `count(tabelSumber, n)`, `warn(pesan)`,
`user(id)`, `officer(nama)`, `contact(id)`, `item({productId,name,unit})`, `driver(id)`, `vehicle(id)`, `photo(urlAtauKey, folder, meta)`,
`skipOrder(id)` / `isSkipped(id)`. Tabel target yang di-emit dihitung otomatis untuk `08-verifikasi.sql`.
Urutan modul: `pengguna` -> `induk` -> `pesanan-kirim` -> `mutu-lainnya`.
