> Arsip worklog porting 21 Okt; status terkini ada di docs/STATUS.md

# Worklog: port istana-block-inventori-ops → menu OPERASIONAL

Tanggal: 2026-10-21 (dihentikan atas permintaan pemilik sekitar 05.15 WIB)
Cabang: `fitur/operasional-inventori` (dari `origin/main` ed35a50). Belum di-push, belum di-deploy, dan migrasi belum dijalankan ke remote.
Worktree: `C:\Users\Sarimusan\ibw-port`. Lokasi ini di luar folder PROJECTS karena hook worktree sesi Claude salah mengira folder ISTANA_BLOCK_PURWAKARTA bagian dari checkout PROJECTS.
Salinan untuk build/preview di WSL: `~/ibw-ops` (disalin dengan tar, berisi `.dev.vars` dengan AUTH_SECRET acak lokal).

Catatan kerja lengkap (peta kedua repo, keputusan K1–K9, fondasi skema, hasil review) ada di
`C:\Users\Sarimusan\AppData\Roaming\Claude\side-session-notes\local_b7f4601a-dbc1-4aa3-819b-3249c62f02ee\`:
`keputusan-port-operasional.md`, `peta-inventori-ops.md`, `peta-web-operasional.md`, `fondasi.md`, `lib-shared.md`,
`panduan-subagen.md`, `review-keamanan.md`, `review-kebenaran.md`, `integrasi-todo.md`, `siapkan-uji.sh`.

## Yang sudah selesai

Commit lokal (urut):
- `cb753d9` Fondasi: migrasi `drizzle/0005_operasional_inventori.sql` (20 tabel baru + kolom baru di ops_orders, ops_deliveries, ops_drivers, ops_vehicles, inv_productions, users; hanya CREATE & ALTER ADD, tanpa DROP), peran baru `qc`, `mandor`, `satpam`, `manajer_qc`, `pimpinan` + 18 izin, menu Operasional (grup Mutu & Kantor), route berkas R2 privat, helper `src/lib/ops/*`, cron `*/5` di `wrangler.jsonc` + `scheduled()` di `worker.ts`, `kiriman` ditambahkan ke NO_CACHE.
- `b94d13d` Kerangka push & cron per modul.
- `dc89267` Delapan paket fitur:
  - pengiriman bertahap (dimuat/berangkat/tiba/tertunda/terkirim), aplikasi sopir, papan muatan, lacak publik `/kiriman/[token]`;
  - PO batal/hapus dengan alasan, impor Zahir `.fp3`, peringatan SIM/STNK/KIR;
  - QC (mix desain, catatan harian, uji kuat tekan, ACC & TTD);
  - barang masuk, uji lumpur pasir, nilai supplier;
  - produksi lapangan;
  - kalender, Web Push VAPID, cron;
  - laporan pimpinan, rekap ISO F-IB-01..16;
  - piket, log aktivitas & backup.
- `8f5e395` Perbaikan hasil dua review: izin berkas per folder, harga PO hanya untuk keuangan, `laborCost` produksi dikunci, anggaran fetch push di cron, tanggal posting SJ oleh sopir, `hidePrices` diperketat, batas 10 langganan push per akun, backup paging keyset.
- Commit worklog ini: SheetJS dipindah ke aset statis `public/vendor/xlsx-0.20.3.mjs` lewat `loadXlsx()` (`src/lib/ops/excel.ts`), dan `"minify": true` di `wrangler.jsonc` & `wrangler.demo.jsonc`. **Perubahan ini BELUM terbukti lolos build**, lihat langkah 1.

Verifikasi yang sudah lolos:
- `npx tsc --noEmit` nol error (di Windows, sebelum perubahan SheetJS terakhir).
- Build OpenNext di WSL lolos untuk commit `8f5e395`.

## Sesi lanjutan 2026-10-21 pagi (orkestrator Opus + subagen Sonnet)

Langkah 1–3 di bawah SELESAI:
- Build OpenNext lolos (percobaan 1). `wrangler deploy --dry-run`: **2.783 KiB gzip** (12.693 KiB mentah). Itu di bawah 3.072 KiB, tapi margin hanya ~290 KiB. Tidak ada "SheetJS" di chunks server.
- D1 lokal dan 8 akun uji siap. `siapkan-uji.sh` tidak bisa dijalankan dari path `side-session-notes` di WSL, karena folder AppData Claude ter-virtualisasi. Salin dulu ke `~` lalu buang CRLF.
- Uji preview dikerjakan 2 penguji paralel per kelompok peran, lalu uji regresi. Tidak ada 500. Pengiriman bertahap jalan end-to-end: stok keluar dan jurnal HPP seimbang. Hak akses silang benar. `/kiriman` tanpa harga.
- Perbaikan hasil uji:
  - Picker dan server produksi difilter per kategori. Helper baru `itemProductionCategory` menurunkan kategori dari kategori produk web/kode PVG/nama; grass block = precast.
  - TTD tidak lagi terbuka untuk izin `iso`.
  - Layout HP uji tekan.
  - Flash uji pasir dan hapus produksi.
  - Status tautan lacak.
  - Teks SJ tanpa sopir.
  - Input foto `accept`/`capture`.
- Impor Zahir hanya diuji tampilan formnya, karena belum ada contoh `.fp3`.

Keputusan pemilik baru (TIDAK diubah, sama dengan sumber/main):
- DIPUTUSKAN pemilik: kantor tetap mengisi harga di form PO, dan harga/nilai PO kini juga tampil di detail & daftar PO untuk izin `pesanan` (selain keuangan). Peran `lihat_ops` lain tetap tanpa harga.
- Mix harian tanpa template: "disetujui" terisi bawaan Semen 80/Pasir 500/…, dan actual boleh kosong ("Sesuai"). Ini sama dengan sumber `QcPage.tsx`.
- Aturan turunan kategori barang produksi (karena `fin_items` tanpa kolom kategori) perlu dikonfirmasi pada data nyata.
- Kosmetik tersisa:
  - teks "Sopir diberi tahu." di panel Batalkan jadwal untuk SJ tanpa sopir;
  - `/favicon.ico` 404;
  - MIME Excel `octet-stream`;
  - menu gudang tanpa Armada/Sopir/Pelanggan, tapi URL-nya terbuka read-only.

## Sisa pekerjaan (urut, status awal sesi lanjutan)

1. **Ukuran bundel Worker (penghalang deploy).**
   - Ukuran gzip (`wrangler deploy --dry-run`): main 2.540 KiB; cabang ini 3.556 KiB, melewati batas Workers Free 3.072 KiB.
   - Dengan `--minify` saja: 2.968 KiB. Lolos, tapi margin tipis.
   - Build terakhir gagal karena `import("/vendor/xlsx-0.20.3.mjs")` ditelusuri esbuild OpenNext. Sudah diubah menjadi `new URL(XLSX_URL, window.location.origin).href` tapi **belum dibuild ulang** (build dihentikan).
   - Langkah: `npx tsc --noEmit`, sinkronkan ke `~/ibw-ops`, jalankan `~/build_ops.sh` (pengawas macet 900 dtk; status OK kini juga mensyaratkan `handler.mjs`), lalu `npx wrangler deploy --dry-run --outdir /tmp/x`. Target gzip jauh di bawah 3.072 KiB, dan pastikan tidak ada "SheetJS" di `.open-next/server-functions/default/.next/server/chunks`.
   - Bila tetap mepet: pertimbangkan Workers Paid (README sudah menyarankannya karena error 1102), atau gabungkan sub-halaman (setiap halaman menambah client-reference-manifest; total manifest naik dari 2,3 MB menjadi 5,0 MB mentah).
2. **D1 lokal + akun uji.** Jalankan `bash /mnt/c/Users/Sarimusan/AppData/Roaming/Claude/side-session-notes/local_b7f4601a-dbc1-4aa3-819b-3249c62f02ee/siapkan-uji.sh` di WSL (migrasi lokal, seed, `demo-erp.sql`, akun owner/kantor/pimpinan/qc/mandor/satpam/gudang/sopir). Kredensial ditulis ke `~/ibw-ops/akun-uji.local.txt`. Catatan: `wrangler d1 ... --local` crash di Windows, hanya jalan di WSL.
3. **Uji preview lokal** (`npx wrangler dev --port 8787` di `~/ibw-ops`, atau `~/preview_start.sh` yang diarahkan ke ibw-ops). Belum satu halaman pun dibuka di browser. Uji per peran:
   - pesanan, impor Zahir (butuh contoh `.fp3` asli), pengiriman (alur dimuat → berangkat → tiba → terkirim, stok/jurnal HPP), tugas sopir di layar 375 px, `/kiriman/<token>`;
   - muatan, barang masuk + foto, uji pasir, bahan baku, QC + cetak + TTD, produksi (mandor precast/qc paving);
   - kalender + .ics, laporan, rekap ISO + Excel F-IB, piket, keamanan (backup File System Access di Chrome/Edge);
   - badge menu (QC, kalender, keamanan), situs publik tidak berubah (cache `worker.ts`).
   Perbaiki bug yang ditemukan, lalu ulangi tsc + build.
4. **Commit & push** cabang `fitur/operasional-inventori`, buka PR ke `main`. Pemilik sudah memberi izin push setelah selesai; deploy & migrasi remote TETAP menunggu perintah eksplisit.

## Tindak lanjut di luar cakupan / keputusan pemilik
- **Kunci VAPID** (push belum aktif tanpa ini): `node scripts/make-vapid-keys.mjs`, isi `vars.VAPID_PUBLIC_KEY` di `wrangler.jsonc`, lalu `npx wrangler secret put VAPID_PRIVATE_KEY`.
- **Sebelum `db:migrate:remote`**: backup `wrangler d1 export istana-block-db --remote`.
- **Migrasi DATA dari D1 inventori-ops** (id `1acb30ac-…`, KV `PHOTOS`) ke D1/R2 web: perlu skrip impor terpisah.
- **App lama**: matikan `app.kirimistanablock.com` setelah data dipindah.
- **Belum di-port**: antrean offline sopir (localStorage), resolve koordinat dari short-link Google Maps, peta live di Ringkasan.
- **Keputusan konservatif yang perlu dikonfirmasi** (detail di `keputusan-port-operasional.md`):
  - tabel web dipertahankan (bukan tabel inventori-ops);
  - Duty Phone diganti piket per akun;
  - barang masuk tidak memposting stok;
  - peran `operasional` tidak punya izin `stok` (hanya mengubah produksi miliknya ≤7 hari);
  - PO hasil impor Zahir wajib punya barang `lainnya` bila nama barang tidak cocok;
  - tautan lacak publik tidak kedaluwarsa (sama dengan sumber).
- **Temuan review yang sengaja dibiarkan**:
  - owner/manajer_qc bisa membuat dan meng-ACC data QC sendiri;
  - backup memuat hash password/PIN (khusus owner);
  - anti-dobel impor Zahir tanpa unique index;
  - header noindex `/kiriman` di `next.config.ts` (halaman sudah noindex sendiri; next.config/robots adalah wilayah sesi SEO).
