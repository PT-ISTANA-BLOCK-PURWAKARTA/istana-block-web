# Status terkini — 6 November 2026

Ringkasan kondisi situs `istana-block-web` (Next.js + OpenNext Cloudflare + D1). Indeks dokumen lain: [README.md](README.md).

## 1. Produksi

| Item | Kondisi |
|---|---|
| Akun Cloudflare | Istana Block (`a5dec0cac9600d717295b2b7699a3857`), dipatok lewat `account_id` di `wrangler.jsonc`. |
| Worker | `istana-block-web` di `https://istana-block-web.abdussalimsan.workers.dev` |
| Domain `istanablockpurwakarta.com` | Masih WordPress lama. **Belum cutover.** |
| D1 remote | `istana-block-web-db` (`2bd61157-3c54-4dfb-b06a-013499c67708`) di akun Cloudflare **Istanablock** (`a5dec0ca…`). Migrasi 0000–0008 terpasang. |
| Schema 6 Nov | `0007` menambah 22 kolom ke tabel lama, `0008` membuat 13 tabel baru. Keduanya `ADD`/`CREATE` saja, tanpa `DROP`. |
| Data app lama | Diimpor 6 Nov 2026: ±5.398 baris di 31 tabel, dicocokkan ulang dengan sumber. |
| Foto app lama | KV `PHOTOS` → R2 `istana-block-media`: 270 objek. Kolom `*_key` di DB sudah menunjuk key R2. |
| Backup D1 | `backup-sebelum-operasional-2026-10-26.sql`, `backup-sebelum-0006-2026-10-27.sql`, plus ekspor D1 app lama yang menjadi sumber impor. |

Angka impor terbesar: `ops_uditch_entries` 2.150, `ops_activity_logs` 1.110, `ops_customer_leads` 812, `ops_delivery_history` 434, `inv_productions` 163, `ops_order_lines` 115, `ops_orders` 112, `ops_deliveries` 112, `fin_items` 112, `fin_contacts` 51, `ops_delivery_proofs` 46, `users` 29 (id 100001+), `ops_payslips` 24, `ops_delivery_notes` 21, `ops_vehicles` 14, `inv_production_targets` 12, `ops_fleet_expenses` 10, `ops_sales_invoices` 7, `ops_quotations` 4, `ops_driver_schedules` 1.

### Riwayat deploy

| Tanggal | Versi | Isi |
|---|---|---|
| 26 Okt | `651a5d4d` | Port inventori-ops (PR #8) + migrasi 0005 |
| 26 Okt | `750ff122` | SEO (PR #10) |
| 27 Okt | `be40b8f6` | PR #11 (kunci cache parameter iklan) + PR #12 (setara app live) + migrasi 0006 |

Perubahan 6 Nov hanya schema, data, dan dokumen; belum ada versi Worker baru. Halaman untuk 13 tabel baru belum dibuat, jadi deploy menunggu irisan A–F.

## 2. PR yang sudah di-merge

| PR | Isi |
|---|---|
| #8 | Port inventori-ops menjadi menu Operasional. |
| #9 | Skrip migrasi data + guard arsip. Tidak dipakai; penggantinya `scripts/porting/import-inventori-ops.py` (6 Nov). |
| #10 | SEO P1, P8, P5, P12c, P2e. |
| #11 | Daftar parameter pelacak iklan (gclid/utm/fbclid, dll.) yang diabaikan dari kunci cache dilengkapi. |
| #12 | Operasional setara app live (rincian di bawah). |

Isi PR #12: Rekap Pelanggan + Sasaran Mutu 13/14/16/20/22; stok opname & cat genteng digabung ke stok web; produksi Grade A/B/Reject, metode Buis, adukan cor bersama, sinkron mix ke produksi paving, TTD ketidaksesuaian; spesifikasi produk; moda "Diambil sendiri"; uji lumpur (skip, ubah hasil, TTD bertingkat); koreksi jam tiba; batalkan status Selesai/Sampai tanpa menyentuh stok; TTD hadir kalender.

## 3. App lama dan data

- `app.kirimistanablock.com` (akun Cloudflare lain) masih dipakai operasional harian. Versinya lebih baru daripada repo `istana-block-inventori-ops` (commit tunggal 18 Okt); fitur baru direkonstruksi dari bundel JS live (lihat [rekonstruksi-app-live/](rekonstruksi-app-live/KEPUTUSAN.md)).
- **Data lama dimigrasi 6 Nov 2026.** Ekspor D1 app lama → `scripts/porting/import-inventori-ops.py` → 43 berkas SQL → `wrangler d1 execute` ke `istana-block-web-db`. Id baris dipertahankan (pengguna digeser ke 100001+), peran dipetakan ke peran web, foto KV dipindah ke R2 dengan key yang sama. Cara pakai: [porting/README.md](porting/README.md).
- App lama tetap jalan sampai cutover. Setelah cutover app lama ditutup; hindari input ganda di kedua sisi sebelum itu.

## 4. Sisa pekerjaan: kode dan UI

Seluruh tabel hasil porting sudah punya halaman baca di `/operasional` (lihat `docs/porting/PETA-GAP-PORTING.md`). Migrasi `0009_ops_0093_0101` (8 Nov 2026) menutup batch ops 0093–0101 dan menambah empat halaman baru:

| Migrasi ops | Isi web | Halaman |
|---|---|---|
| `0093` | `ops_vehicle_trips` — buku keluar-masuk kendaraan | `/operasional/gerbang` |
| `0094` | `qc_strength_samples.batch_code` | kolom tersimpan, belum ditampilkan di form ISO |
| `0095` | `ops_kasbon_entries` — kasbon & bayar karyawan | `/operasional/kasbon` |
| `0096`–`0099` | sub kategori, trip, jatuh tempo & pelunasan biaya armada | kolom baru di `/operasional/biaya-armada` |
| `0100` | `ops_payslips.pay_kind`, `period_from`, `period_to` | kolom "Jenis · periode" di `/operasional/gaji` |
| `0097` | `ops_fleet_cash` — Dana Cepi | `/operasional/dana-cepi` |
| `0101` | `ops_cepi_loans` — piutang PIC kendaraan | `/operasional/piutang-cepi` |

Yang benar-benar belum, urut prioritas (rencana: [porting/RENCANA-1-3.md](porting/RENCANA-1-3.md)):

1. **Form input/ubah + cetak PDF** dokumen: gaji (slip A5), surat jalan (A4 3 rangkap), penawaran, faktur jual. Halaman baca & aksi sederhana (buat/hapus slip, buat surat jalan) sudah ada.
2. **Faktur jual → piutang** `fin_*`: butuh keputusan akun pendapatan & perlakuan 7 faktur hasil impor.
3. **Form tulis 4 tabel 0009** sudah ada (buku gerbang: catat OUT, "Kembali" untuk IN, hapus rit non-surat-jalan; kasbon; Dana Cepi; piutang Cepi). Sisa: koreksi jam OUT/IN manual dan hapus berjurnal, belum ada uji otomatis.
4. **Workers Paid → deploy → cutover domain** (lihat bagian 6 dan 10).

Catatan data per 8 Nov 2026: `ops_vehicle_trips` sudah berisi 11 rit hasil impor; `ops_kasbon_entries`, `ops_fleet_cash`, `ops_cepi_loans` masih kosong karena app lama juga kosong. `ops_fleet_expenses` berisi 19 baris: 9 baris app lama (7 Nov, 5 ber-sub kategori, 4 ber-`trip_ref`) **ditambah 10 baris lama bertanggal 4 Nov yang sudah tidak ada di app lama** — menunggu keputusan pemilik apakah dihapus.

Ditunda sejak sebelumnya: antrean offline sopir (app live juga tidak punya), resolve short-link Google Maps ke koordinat, peta live di Ringkasan, peringatan SIM di Ringkasan, reset password pengguna.

## 5. Pengujian dan bug terbuka

- Belum diuji di produksi dengan akun nyata, termasuk data hasil impor.
- Di preview lokal belum diuji: impor Excel leads, TTD hadir kalender, peran gudang/sopir, hapus spesifikasi produk, akses kantor ke uji pasir untuk TTD Sekretaris.
- Bug kecil: mix harian dengan nama produk yang tak cocok barang tidak membuat baris produksi, tanpa peringatan.

## 6. Error 1102 (CPU Workers Free 10 ms)

- Render dingin Next sekitar 33 ms CPU (median). Uji 200 permintaan dingin (`?cold=` acak): 27/200 gagal.
- Halaman ter-cache stabil; klik iklan (gclid/utm) dilayani dari cache.
- **Solusi pasti:** Workers Paid + `"limits": {"cpu_ms": 30000}` di `wrangler.jsonc`. Jangan ditambahkan di paket Free.

## 7. SEO dan gerbang cutover

Audit 19 Okt, 12 prioritas ([seo/](seo/README.md)):

| Status | Butir |
|---|---|
| Selesai | P7 |
| Sebagian | P1, P2, P3, P4, P5, P8, P9, P11, P12 |
| Belum | P6 |
| Di luar kode | P10 |

Empat gerbang cutover belum lulus: stabil, pelacakan terbukti, harga & isi, domain.

## 8. Keputusan pemilik yang ditunggu

- Target Sasaran Mutu (app live 75% vs target lama 90/90/85/99/100%).
- Rumus indikator Rekap Pelanggan (tafsiran, ditandai di kode).
- Harga paket pasang.
- Bukti SNI/ISO.
- Jalur domain.

## 9. Tugas pemilik

1. Upgrade Workers Paid.
2. Kunci VAPID: `node scripts/make-vapid-keys.mjs`, lalu `npx wrangler secret put VAPID_PRIVATE_KEY`, kunci publik ke `vars.VAPID_PUBLIC_KEY`, lalu deploy.
3. Buat akun peran qc, mandor, satpam, manajer_qc, pimpinan.
4. Isi ulang data induk: barang + kelompok produksi/metode (nama genteng wajib memuat Natural/Hitam/Merah), spesifikasi produk, sopir, kendaraan.
5. Jalankan `docs/seo/sql-kebijakan-privasi.sql` setelah backup.
6. Isi panel `/situs`: konten produk >= 700 kata, `maps_url`, testimoni, telepon utama.
7. Konversi WhatsApp/telepon dan final URL di Google Ads.
8. Isi `src/data/legacy-uploads.json` dari Search Console.
9. Backup final app lama.
10. Ganti password akun app lama yang sempat dibagikan di chat.

## 10. Cara deploy

Resep build (Next 15.5 di OpenNext; build di WSL, deploy dari Windows):

1. Build di WSL pada salinan `~/ibw-ops`: sinkron dengan tar dari repo, kecuali `node_modules`, `.git`, `.wrangler`, `.next`, `.open-next`, `.dev.vars`.
2. Jalankan `~/build_ops_unsupported.sh`. OpenNext menolak Next 15.5 sejak sekitar 21 Okt, jadi skrip memakai flag `--dangerouslyUseUnsupportedNextVersion`. Upgrade ke Next 16 adalah tindak lanjut.
3. Ukur dengan `wrangler deploy --dry-run`. Batas 3.072 KiB gzip; terakhir 2.927 KiB.
4. Salin `.open-next` ke repo Windows.
5. Deploy dari Windows (login wrangler ada di Windows) dengan `OPEN_NEXT_DEPLOY=true`. Tanpa itu wrangler mengalihkan ke `opennextjs-cloudflare deploy` yang crash di Windows.

Migrasi remote: backup dulu dengan `wrangler d1 export istana-block-db --remote`, lalu `wrangler d1 migrations apply DB --remote`. Catatan: `wrangler d1 --local` hanya jalan di WSL.

## 11. Catatan dokumen

`docs/seo/README.md` ditulis sebelum PR #10 di-merge dan masih berbunyi "belum ada yang dijalankan"; rujuk bagian 7 di atas untuk status SEO terkini.