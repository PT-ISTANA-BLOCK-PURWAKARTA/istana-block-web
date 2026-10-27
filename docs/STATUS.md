# Status terkini — 27 Oktober 2026

Ringkasan kondisi situs `istana-block-web` (Next.js + OpenNext Cloudflare + D1). Indeks dokumen lain: [README.md](README.md).

## 1. Produksi

| Item | Kondisi |
|---|---|
| Worker | `istana-block-web` di `https://istana-block-web.abdussalimsan.workers.dev` |
| Domain `istanablockpurwakarta.com` | Masih WordPress lama. **Belum cutover.** |
| D1 remote | Migrasi 0000–0006 terpasang. |
| Backup D1 sebelum migrasi | Folder lokal pemilik: `backup-sebelum-operasional-2026-10-26.sql`, `backup-sebelum-0006-2026-10-27.sql`. |

### Riwayat deploy

| Tanggal | Versi | Isi |
|---|---|---|
| 26 Okt | `651a5d4d` | Port inventori-ops (PR #8) + migrasi 0005 |
| 26 Okt | `750ff122` | SEO (PR #10) |
| 27 Okt | `be40b8f6` | PR #11 (kunci cache parameter iklan) + PR #12 (setara app live) + migrasi 0006 |

## 2. PR yang sudah di-merge

| PR | Isi |
|---|---|
| #8 | Port inventori-ops menjadi menu Operasional. |
| #9 | Skrip migrasi data + guard arsip. **Tidak dipakai** (fresh start); dibiarkan inert. |
| #10 | SEO P1, P8, P5, P12c, P2e. |
| #11 | Parameter pelacak iklan (gclid/utm) masuk kunci cache. |
| #12 | Operasional setara app live (rincian di bawah). |

Isi PR #12: Rekap Pelanggan + Sasaran Mutu 13/14/16/20/22; stok opname & cat genteng digabung ke stok web; produksi Grade A/B/Reject, metode Buis, adukan cor bersama, sinkron mix ke produksi paving, TTD ketidaksesuaian; spesifikasi produk; moda "Diambil sendiri"; uji lumpur (skip, ubah hasil, TTD bertingkat); koreksi jam tiba; batalkan status Selesai/Sampai tanpa menyentuh stok; TTD hadir kalender.

## 3. App lama dan keputusan data

- `app.kirimistanablock.com` (akun Cloudflare lain) masih dipakai operasional harian. Versinya lebih baru daripada repo `istana-block-inventori-ops` (commit tunggal 18 Okt); fitur baru direkonstruksi dari bundel JS live (lihat [rekonstruksi-app-live/](rekonstruksi-app-live/KEPUTUSAN.md)).
- **Keputusan 27 Okt: fresh start.** Data lama tidak dimigrasi. App lama tetap jalan sampai web dipakai; simpan backup final sebelum dimatikan. Dokumen migrasi dipindah ke [arsip/](arsip/migrasi-data-inventori-ops.md).

## 4. Belum di-port

Sengaja/ditunda: antrean offline sopir (app live juga tidak punya), resolve short-link Google Maps ke koordinat, peta live di Ringkasan, peringatan SIM di Ringkasan, reset password pengguna.

## 5. Pengujian dan bug terbuka

- Belum diuji di produksi dengan akun nyata.
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