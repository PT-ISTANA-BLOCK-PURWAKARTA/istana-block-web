# Peta gap porting inventori-ops → istana-block-web

Tanggal: 6 November 2026.
Dasar: `istana-block-inventori-ops` @ `0c5fc7e` (93 migrasi `0000`–`0092`, 51 tabel, 35 modul worker) dibanding `istana-block-web` @ `12ca171` (migrasi `0000`–`0006`, 61 tabel).

Dokumen ini peta kerja, bukan janji. Angka dihasilkan dengan mengurai `CREATE TABLE` / `ALTER TABLE … ADD` di kedua folder migrasi lalu membandingkan himpunan kolom (lihat bagian 6).

## Ringkasan

| | Jumlah |
|---|---|
| Tabel ops yang sudah punya padanan di web | 36 |
| Tabel ops yang belum ada di web | 12 |
| Golongan kolom baru pada tabel lama yang belum ada | 11 |

Konvensi porting tetap seperti keputusan 21 Okt: **tabel web dipertahankan** (`ops_*`, `qc_*`, `inv_*`, `fin_*`, `iso_records`), bukan memakai nama tabel inventori-ops. Migrasi web hanya `CREATE TABLE` dan `ALTER TABLE … ADD`, tanpa `DROP`.

## 1. Tabel yang sudah punya padanan

| ops | web | catatan |
|---|---|---|
| `orders` | `ops_orders` | |
| `orderItems` | `ops_order_lines` | |
| `deliveries` | `ops_deliveries` | |
| `deliveryProofs` | `ops_delivery_proofs` | |
| `deliveryStatusHistory` | `ops_delivery_history` | |
| `deliveryNotifications` | `ops_notifications` | digabung dengan notifikasi QC |
| `qualityControlNotifications` | `ops_notifications` | idem |
| `drivers` | `ops_drivers` | |
| `vehicles` | `ops_vehicles` | |
| `driverLocations` | `ops_positions` | |
| `publicTrackingLinks` | `ops_tracking_links` | |
| `pushSubscriptions` | `ops_push_subscriptions` | |
| `customers` | `fin_contacts` | pelanggan = kontak keuangan |
| `products` / `users` | `products` / `users` | |
| `activityLogs` | `ops_activity_logs` | |
| `backupRuns` | `ops_backup_runs` | |
| `calendarEvents` / `Participants` / `Reminders` / `Results` | `ops_calendar_*` | |
| `dutyShifts` | `ops_duty_shifts` | |
| `goodsReceipts` | `ops_goods_receipts` | |
| `mixDesigns` / `mixDesignLogs` | `qc_mix_designs` / `qc_mix_logs` | |
| `strengthTests` / `strengthTestSamples` | `qc_strength_tests` / `qc_strength_samples` | |
| `sandTests` | `qc_sand_tests` | |
| `productSpecs` | `qc_product_specs` | |
| `isoRecords` | `iso_records` | |
| `customerLeads` | `ops_customer_leads` | |
| `orderDeletionAudit` | `ops_order_deletions` | |
| `productionBatches` | `inv_production_batches` | |
| `productionOutputs` | `inv_productions` | |
| `stockCounts` | `inv_counts` | |
| `invoices` | `fin_invoices` | **beda arti**: `fin_invoices` = faktur pembelian/AP keuangan, `invoices` ops = dokumen tagihan penjualan (lihat irisan A) |
| `sessions` | — | web pakai cookie + JWT (`src/lib/session.ts`), tidak perlu tabel |

## 2. Tabel yang belum ada di web

| ops | migrasi asal | modul worker | irisan |
|---|---|---|---|
| `quotations` | `0049` | `quotations.ts` | A |
| `invoices` (dokumen jual + pembayaran + shipments) | `0054`, `0056`, `0057`, `0060`, `0086`, `0087` | `invoices.ts` | A |
| `uditchEntries` | `0059`, `0064` | `uditch.ts` | A |
| `deliveryNotes` | `0061`, `0062`, `0066`, `0089` | `deliveryNotes.ts` | B |
| `plannedOrders` | `0051` | `plan.ts` | B |
| `driverSchedules` | `0068` | `driverSchedule.ts` | C |
| `fleetExpenses` | `0070`, `0073`, `0079`, `0081` | `fleet.ts` | C |
| `productionTargets` + `productionTargetReasons` | `0088` | `productionTargets.ts` | D |
| `productionDeletions` | `0090` | `productionDeletions.ts` | D |
| `payslips` | `0063`, `0065` | `payslips.ts` | E |
| `stockTransfers` | `0034`, `0052`, `0055` | `stock.ts` | F |
| `customerAddresses` | `0000`, `0067` | `arrivals.ts` | F |

## 3. Kolom baru pada tabel lama yang belum ada

| ops | kolom | migrasi | tabel web |
|---|---|---|---|
| `orders` | `isInternal` | `0066` | `ops_orders` |
| `deliveries` | `loadedByName`, `loadNote`, `arrivalCorrectedByName` | `0031`, `0025` | `ops_deliveries` |
| `orderItems` | `loadedQuantity`, `stockKey` | `0031`, `0034` | `ops_order_lines` |
| `goodsReceipts` | `testSkippedByName`, `settledBy`, `settledByName`, `settledAt` | `0027`, `0092` | `ops_goods_receipts` |
| `productionOutputs` | `rejectLeaderAckAt/By`, `rejectManagerAckAt/By`, `mixPart` | `0038`, `0040` | `inv_productions` |
| `productSpecs` | `photoUrl` | `0050` | `qc_product_specs` |
| `strengthTests` | `absorption`, `absorptionOnCertificate`, `makerSignedBy`, `makerSignedAt` | `0071`, `0078` | `qc_strength_tests` |
| `strengthTestSamples` | `surface` | `0072` | `qc_strength_samples` |
| `pushSubscriptions` | `lastSentAt`, `lastResult`, `lastTitle` | `0080` | `ops_push_subscriptions` |
| `users` | `canManageUditch` | `0059` | `users` |
| `vehicles` | `tag` (+ master/tag crane/dump truck, `0074`–`0077`) | `0069`, `0074`–`0077` | `ops_vehicles` |

## 4. Irisan porting yang diusulkan

Urut dari yang paling berdiri sendiri ke yang paling menyentuh stok/jurnal.

> **Status 6 Nov 2026.** Paritas kolom pada tabel yang sudah ada (bagian 3) sudah ditulis sebagai `drizzle/0007_paritas_kolom_ops.sql` (22 `ALTER TABLE … ADD`, tanpa `DROP`) dan sudah dicocokkan ke `src/db/erp.ts`. Diuji dengan menjalankan migrasi `0000`–`0007` berurutan ke SQLite kosong: 292 pernyataan lolos, semua 22 kolom baru ada dengan tipe sesuai. Belum dijalankan ke D1 mana pun (menunggu akses akun).
> `canManageUditch` sengaja **tidak** dibuat sebagai kolom: web memakai peran + izin di `src/lib/roles.ts`, jadi penanda itu menjadi izin baru saat modul uditch di-port.
> Master kendaraan `0074`–`0077` (tag crane, dump truck, hapus Fortuner) belum ikut; hanya `vehicles.tag` yang diambil.

**A. Faktur penjualan, penawaran, uditch.**
Tabel: `quotations`, dokumen faktur, `uditchEntries`. Modul: `quotations.ts`, `invoices.ts`, `uditch.ts`, `shared/invoice.ts`, `shared/uditch.ts`. Pembayaran faktur menyentuh `fin_*`, jadi irisan ini perlu keputusan pemilik: faktur jual masuk ke piutang keuangan atau berdiri sendiri.

**B. Surat jalan & rencana pesanan.**
Tabel: `deliveryNotes`, `plannedOrders`; kolom `ops_orders.is_internal`. Modul: `deliveryNotes.ts`, `plan.ts`, `loading.ts`.

**C. Armada & sopir.**
Tabel: `driverSchedules`, `fleetExpenses`; master/tag/foto/approval kendaraan. Modul: `fleet.ts`, `driverSchedule.ts`, `driverRecap.ts`. Route web sudah ada (`/operasional/armada`, `/operasional/sopir`), jadi ini penambahan di dalam halaman yang ada.

**D. Produksi lanjutan.**
Tabel: `productionTargets`, `productionTargetReasons`, `productionDeletions`; kolom ACC reject, `mixPart`, semen putih paving (`0091`). Modul: `productionTargets.ts`, `productionDeletions.ts`, `production.ts`.

**E. Gaji.**
Tabel: `payslips` (+ penanda tangan). Modul: `payslips.ts`. Berdiri sendiri, tidak menyentuh stok.

**F. Sisa kecil.**
`stockTransfers` (+ foto & penanda tangan), `customerAddresses` + pin/via (`0067`), uji kuat tekan absorpsi/permukaan/TTD pembuat (`0071`, `0072`, `0078`), foto spesifikasi (`0050`), `lastResult` push (`0080`), `canManageUditch` (`0059`), settle laporan cepat barang masuk (`0092`).

## 5. Catatan teknis dan risiko

- **Penamaan.** ops memakai camelCase (`loadedQuantity`), web snake_case (`loaded_qty`). Porting = terjemahan, bukan salinan; setiap kolom perlu dipetakan ke kolom web yang sudah ada lebih dulu sebelum menambah kolom baru.
- **Ukuran bundel.** Build terakhir 2,93 MB gzip terhadap batas Workers Free 3,07 MB. Irisan A–D masing-masing menambah halaman dan server function; kemungkinan besar perlu Workers Paid lebih dulu (lihat `STATUS.md` bagian 6).
- **Akses D1 asli.** Login wrangler yang aktif hanya akun `Abdussalimsan@gmail.com`, dan akun itu melaporkan 0 database D1 lewat `wrangler d1 list` maupun API `/accounts/{id}/d1/database`. D1 `1acb30ac-2450-4386-aef6-66645d1705bf` (akun Istana Block, app lama) tidak terjangkau, jadi verifikasi schema ke instance asli belum bisa dikerjakan.
- **Fresh start tetap berlaku.** Migrasi data dibatalkan (`arsip/migrasi-data-inventori-ops.md`); irisan di atas hanya membawa schema dan perilaku, bukan data.

## 6. Cara angka ini didapat

Skrip pengurai membaca semua `*.sql` di `drizzle/` (web) dan `migrations/` (ops), mengambil nama tabel dari `CREATE TABLE` dan nama kolom dari isi definisi tabel serta `ALTER TABLE … ADD [COLUMN]`, lalu:

1. memasangkan tabel ops ke tabel web lewat kemiripan himpunan kolom (Jaccard) dengan penyesuaian nama setelah prefiks `ops_`/`qc_`/`inv_`/`fin_`;
2. menandai tabel ops tanpa pasangan ≥ 0,45 sebagai *belum ada*;
3. memeriksa setiap kolom hasil `ALTER TABLE` pada migrasi `0021`+ terhadap seluruh teks migrasi web.

Batas ketelitian: pemeriksaan kolom di langkah 3 bersifat pencocokan teks, sehingga kolom bernama pendek dan umum (mis. `tag`, `notes`) bisa terbaca ada padahal tidak, dan sebaliknya. Verifikasi akhir tetap dilakukan per irisan saat migrasi ditulis.
