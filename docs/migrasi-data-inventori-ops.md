# Spesifikasi migrasi data: inventori-ops -> istana-block-web (Operasional)

Skrip satu kali, offline. Dokumen ini adalah spesifikasi pemetaan (bukan kode). Acuan: `worker/schema.ts` + `migrations/0000-0020` (sumber),
`src/db/erp.ts` + `drizzle/0005_operasional_inventori.sql` (target), keputusan port K1-K9.

Keputusan pemilik (terkunci): (1) input = folder backup `database/backup-*.sql` + `foto/`; output = berkas `.sql` untuk
`wrangler d1 execute --file` + daftar unggahan R2; (2) PO/pengiriman/produksi lama = ARSIP tanpa stok & jurnal; (3) akun dibuat ulang,
sandi/PIN acak ke berkas lokal; (4) data induk dicocokkan (pelanggan/sopir via HP, kendaraan via plat, barang via nama), tak cocok -> baru.

## 0. Masukan, keluaran, konvensi

| Item | Spesifikasi |
|---|---|
| Masukan 1 | `database/backup-*.sql` terbaru (CREATE TABLE + `INSERT INTO "<tabel>" (...) VALUES (...)`) dan `foto/<key KV>`. Skrip memuatnya ke SQLite sementara (mis. `node:sqlite`/better-sqlite3 in-memory) lalu membaca dengan SELECT. Wajib dibaca UTF-8 (satuan `m³`). |
| Masukan 2 (WAJIB) | Snapshot D1 web: `wrangler d1 export DB --remote --output snap.sql` (sekaligus cadangan sebelum impor). Dipakai untuk pencocokan data induk, `max(users.id)`, dan memeriksa bentrok `batch_code`/nomor. |
| Keluaran | `out/00-prep.sql`, `01-users.sql`, `02-master.sql`, `03-pesanan-kirim.sql`, `04-qc.sql`, `05-terima-produksi.sql`, `06-piket-kalender.sql`, `07-iso.sql`, `08-verifikasi.sql` + `r2-manifest.json` + `laporan/*.csv` + `akun-baru.csv` (kredensial, di luar repo, jangan di-commit). |
| ID target | Teks deterministik `iops-<tabelSumber>-<idSumber>` (mis. `iops-orders-12`). Semua `INSERT OR IGNORE` -> impor ulang aman. Awalan `iops-` sekaligus PENANDA ARSIP (bagian B). |
| Waktu | Sumber `timestamp_ms` -> target detik: `floor(ms/1000)`. Kolom tanggal teks target (`date`, `work_date`, `report_date`, `*_expiry`): `strftime('%Y-%m-%d', ms/1000+25200,'unixepoch')` (WIB). |
| Boolean/JSON | Boolean 0/1 tetap. JSON (`materials`, `issues`, `attendees`, dst.) disalin sebagai teks JSON valid; di dalam JSON, id pengguna ditranslasikan lewat peta pengguna. |
| Uang | Sumber `real` -> target integer rupiah (`round`). Harga baris PO arsip dipaksa 0 (lihat A.3). |
| Mode | `--dry-run` (default): hanya membuat laporan pencocokan + hitungan, tanpa berkas impor. `--final` baru menulis `out/*.sql`. Peta id pengguna disimpan di `plan/user-map.json` dan dipakai ulang pada proses ulang. |

Prasyarat cutover: aplikasi lama dibuat read-only/dihentikan SEBELUM backup final (backup halaman-per-halaman bukan snapshot atomik);
tidak ada pembuatan pengguna di web selama jendela impor; semua PO/pengiriman lama sudah selesai/batal (lihat F3).

## A. Pemetaan per tabel

Sumber 34 tabel aplikasi + `d1_migrations` (35 di backup). `sessions` hanya struktur. Kolom `createdBy/…By` sumber (integer) -> id pengguna web lewat peta pengguna (bagian C).

### A.1 Pengguna & sesi

| Sumber | Target | Aturan |
|---|---|---|
| `users` | `users` | Bagian C. Tidak menyalin hash sandi (format hex/20k iterasi beda). |
| `dutyOfficers` | `users` (tanpa kredensial) | Satu akun per petugas (nama = `name`, `roles` = peran akun bersama, email/HP/hash NULL). Dipakai untuk menautkan riwayat "petugas jaga". Pemilik mengisi HP+PIN lewat `/internal/pengguna`. |
| `dutyShifts` | `ops_duty_shifts` | id `iops-dutyShifts-N`; `user_id` = pengguna petugas (`officerId`); `user_name`=`officerName`; `started_at/ended_at` detik; `handover_note` (NULL->''). Shift terbuka (`endedAt` NULL) ditutup: `ended_at = started_at`. |
| `sessions` | TIDAK dimigrasi | Sesi login lama tak berlaku (JWT `ib_session` baru). |
| `pushSubscriptions` | TIDAK dimigrasi | Endpoint terikat origin/VAPID lama; pengguna berlangganan ulang di web. |

### A.2 Data induk (dicocokkan, bukan disalin)

| Sumber | Target | Pencocokan / aturan |
|---|---|---|
| `customers` + `customerAddresses` | `fin_contacts` | Cocok: HP dinormalisasi (hapus non-digit, `0`/`8` awal -> `62`, bandingkan dengan HP kontak web dinormalisasi juga). Banyak kontak web sama -> pilih `active` lalu `created_at` tertua, catat di laporan. Pelanggan sumber ber-HP sama digabung ke id sumber terkecil. Tak cocok / HP kosong -> baru: id `iops-customers-N`, `kind='pelanggan'`, `name`, `phone` (HP ternormalisasi, bila tidak valid apa adanya), `email` (NULL->''), `note`=`notes`, `address` = alamat utama (`addressText, city, province`), `company` ''. Kontak web yang cocok TIDAK diubah. |
| `products` (kustom per PO, SKU `CUSTOM-…`) | `fin_items` | Cocok: nama dinormalisasi (lower, trim, spasi tunggal) sama persis dengan `fin_items.name` -> pakai item web. Tak cocok -> baru: id `iops-items-<sha1(nama+satuan)[0:12]>`, `code = 'IOPS-' + 8 hex`, `kind='barang_jadi'`, `unit`, `sell_price/buy_price=0`, `track_stock=0`, `active=1`, `note='Dibuat migrasi inventori-ops'`. Tanpa fuzzy match; nama mirip dicatat di laporan agar bisa digabung manual. |
| `productionOutputs.product(+spec)` | `fin_items` | Aturan sama; nama = `product` + (spec ? ` ${spec}` : ''). |
| `drivers` | `ops_drivers` | Cocok via HP ternormalisasi. Baru: id `iops-drivers-N`, `name`, `phone`, `active`=`isAvailable`, `license_no`, `license_expiry` (WIB teks), `note` ''. Data web yang cocok tidak diubah (kecuali `license_*` kosong -> diisi). |
| `vehicles` | `ops_vehicles` | Cocok via plat: huruf besar + hapus semua spasi. Baru: id `iops-vehicles-N`, `plate` (format sumber), `name`=`vehicleType`, `capacity`=`capacityNote`, `active`=`isActive`, `stnk_expiry/kir_expiry` (WIB teks). Plat web tidak unik di skema -> laporan duplikat bila >1 cocok. |

Laporan pencocokan (`laporan/cocok-pelanggan.csv`, `-barang`, `-sopir`, `-kendaraan`, `-pengguna`): kolom `id_sumber, nama, kunci, hasil (cocok|baru|ambigu), id_target`. Wajib ditinjau pemilik sebelum `--final`.

### A.3 Pesanan & pengiriman (ARSIP)

| Sumber | Target | Aturan |
|---|---|---|
| `orders` (+ `customerAddresses` via `deliveryAddressId`) | `ops_orders` | id `iops-orders-N`; `number` = `poNumber` apa adanya (`PO-YYYY-NNNNNN`, beda format dari web `PO/YYMM/NNNN`, unik); `date` = WIB(`orderDate`); `contact_id` = hasil A.2; `address` = `addressText, city, province`; `maps_url` = `shareLocationUrl` (kosong tapi ada lat/lng -> `https://www.google.com/maps?q=lat,lng`); `site_contact` = `recipientName · recipientPhone` bila beda dari pelanggan; `requested_date` = WIB(`requestedDeliveryDate`); `note` = `notes` + `deliveryNotes` + baris `[ARSIP inventori-ops] PO lama <poNumber>` (+ `Konfirmasi bayar oleh: <teks>` bila `paymentConfirmedBy` bukan angka); `ongkir`=`deliveryFee`, `discount`, `taxable=0` (subtotal/total diturunkan, tidak disimpan); `external_ref`=`externalRef` (dipertahankan: anti-dobel impor Zahir); `payment_status` sama; `payment_confirmed_by` = pengguna bila angka & ada di peta, selain itu NULL; `payment_confirmed_at`; `cancel_reason`=`cancellationReason`, `cancelled_by`, `cancelled_at`; `created_by`. Status: draft->`draft`; confirmed/preparing/ready_to_ship/assigned->`dikonfirmasi`; in_delivery/delayed->`dikirim_sebagian`; delivered->`terkirim`; cancelled->`batal`. |
| `orderItems` | `ops_order_lines` | id `iops-orderItems-N`; `order_id`; `item_id` dari `products`/`productNameSnapshot` (A.2); `description`=`specificationSnapshot` (NULL->''); `qty`=`quantity`; `unit`; `price`=0 (sumber memang tak menyimpan harga; kalau ada `unitPrice>0`, tetap 0 dan hitungannya masuk laporan agar tidak muncul sebagai "belum difaktur", `insights.ts:11`); `sort` = urut id. Catatan `notes` baris -> ke `description`. |
| `deliveries` | `ops_deliveries` | id `iops-deliveries-N`; `number` = `SJ-<poNumber>` (1 pengiriman per PO, unik); `order_id`; `date` = WIB(`startedAt` ?? `scheduledAt` ?? `createdAt`); `vehicle_id`/`driver_id` hasil A.2; `status`: unassigned/assigned->`dijadwalkan`, ready->`dimuat`, in_transit->`berangkat`, arrived->`tiba`, delayed->`tertunda`, delivered->`terkirim`, cancelled->`batal`; `loaded_at` = waktu riwayat pertama ke `ready`; `arrived_at`; `delivered_at`=`completedAt`; **`departed_at` = NULL (sengaja, bagian B)**; `delay_reason`; `received_by` ''; `proof_key` NULL (bukti ke `ops_delivery_proofs`); `note` = `driverNotes` + `[ARSIP] berangkat <WIB>` bila `startedAt`; `created_at/updated_at`. |
| (turunan `orderItems`) | `ops_delivery_lines` | id `iops-deliveryLines-<delivery>-<orderItem>`; satu baris per item PO: `delivery_id`, `order_line_id`, `item_id`, `qty`. Dibuat agar detail/ringkasan SJ tampil; tak berdampak ke stok karena tak ada pergerakan stok (B). Dilewati untuk pengiriman `batal`. |
| `deliveryStatusHistory` | `ops_delivery_history` | id `iops-deliveryStatusHistory-N`; `from_status/to_status` dipetakan seperti status di atas; `changed_by` peta pengguna (bila `dutyOfficerName` cocok petugas -> pengguna petugas); `changed_by_driver` id sopir target (teks); `note` + ` (petugas jaga <nama>)`; `created_at` detik. Jam berangkat asli tersimpan di sini. |
| `deliveryProofs` | `ops_delivery_proofs` | id `iops-deliveryProofs-N`; `kind`=`proofType`; `file_key` = `pengiriman/legacy/<deliveryId>/<basename>` (bagian D); `original_name`; `created_by`, `created_by_driver`. Maks 4/SJ sudah dijamin sumber. Baris tanpa berkas di `foto/` dilewati + dilaporkan. |
| `publicTrackingLinks` | `ops_tracking_links` | id `iops-publicTrackingLinks-N`; `token_hash` disalin (SHA-256 hex, sama skemanya); hanya `isRevoked=0` dan (`expiresAt` NULL atau > waktu cutover); web tak punya kedaluwarsa/cabut. `last_accessed_at`. Tautan lama hanya hidup bila domain lama diarahkan ke `/kiriman/<token>`. |
| `orderDeletionAudit` | `ops_order_deletions` | id `iops-orderDeletionAudit-N`; `order_id` = `iops-orders-<originalOrderId>` (dokumen sudah tak ada); `number`=`poNumber`; `customer_name/phone` (NULL->''); `reason`; `snapshot` JSON apa adanya; `deleted_by`; `deleted_at`. |
| `deliveryNotifications`, `qualityControlNotifications` | TIDAK dimigrasi | Efemeral (status dibaca); merujuk id lama. `ops_notifications` mulai kosong. |
| `driverLocations` | TIDAK dimigrasi | Titik GPS 10 dtk volume tinggi, nilai historis rendah; `ops_positions` butuh `vehicle_id` yang tak ada di sumber. Tetap ada di backup `.sql`. |

### A.4 QC, produksi, penerimaan

| Sumber | Target | Aturan |
|---|---|---|
| `mixDesigns` | `qc_mix_designs` | id `iops-mixDesigns-N`; kolom sama; `materials` JSON; `notes` NULL->''; `active`=`isActive`; `approved_by/retired_by/created_by` peta pengguna; `*_at` detik. |
| `mixDesignLogs` | `qc_mix_logs` | id `iops-mixDesignLogs-N`; `work_date` WIB teks; `mix_design_id`->`iops-mixDesigns-N`; JSON material; `status`, `review_status`; `manager_signed_by/at`. `leaderSignedBy/At` TIDAK ada di target -> bila terisi, tambahkan ke `notes`: `[TTD pimpinan lama: <nama pengguna> <tanggal WIB>]`. |
| `strengthTests` | `qc_strength_tests` | id `iops-strengthTests-N`; `report_date` WIB teks; `company_name/address/addressed_to/notes` NULL->''; `composition` JSON; `review_*`; `lab_signed_*`, `leader_signed_*`. |
| `strengthTestSamples` | `qc_strength_samples` | id `iops-strengthTestSamples-N`; `test_id`; `made_at/tested_at` ms -> teks WIB `YYYY-MM-DD`; `weight_kg`, `area_cm2`, `max_load_kn`. |
| `goodsReceipts` | `ops_goods_receipts` | id `iops-goodsReceipts-N`; kolom 1:1 (`receivedAt` detik, `has_brangkal` 0/1/NULL); `photoUrls` -> `photo_keys` (JSON array key R2, bagian D); `dutyOfficerName` -> baris di `notes` `[Petugas jaga: X]` dan `created_by` = pengguna petugas bila cocok; `quality_by/delivery_by/price_by/created_by` peta pengguna; `notes` NULL->''. |
| `sandTests` | `qc_sand_tests` | id `iops-sandTests-N`; `receipt_id`->`iops-goodsReceipts-N`; `sandHeightCm/siltHeightCm`->`sand_height/silt_height`; `start_photo_key`, `photo_key` (bagian D); `dutyOfficerName/completedByName` -> `notes` (`[Petugas jaga: X]`) dan `created_by/completed_by` ke pengguna petugas bila cocok; sisanya 1:1. |
| `productionOutputs` | `inv_productions` + `inv_production_lines` | Header: id `iops-productionOutputs-N`; `number` = `PRD-ARSIP-<id 5 digit>`; `date` WIB(`productionDate`); `labor_cost=0`; `note` = `notes` + `spec` + `[Petugas jaga: X]`; `category`, `batch_code`, `leader`, `target`, `cement_bags`, `boards`, `rejects`, `issues` (JSON), `photo_key`, `created_by`. `batch_code` yang sudah ada di snapshot web diberi akhiran `-A` (generator `nextBatchCode` mengambil angka setelah awalan, jadi tetap aman). Baris: 1 baris `role='hasil'`, `item_id` (A.2), `qty`=`quantity`. TANPA `inv_stock_moves` dan TANPA jurnal. `unit` produksi dicatat di laporan (satuan item diambil dari item). |

### A.5 Kalender, ISO, keamanan

| Sumber | Target | Aturan |
|---|---|---|
| `calendarEvents` | `ops_calendar_events` | id `iops-calendarEvents-N`; `start_at/end_at` detik; `reminder_minutes` JSON; `series_id` apa adanya; NULL->'' untuk `location/description`; `created_by`. |
| `calendarParticipants` | `ops_calendar_participants` | id `iops-calendarParticipants-N`; `event_id`; `user_id` peta pengguna. |
| `calendarReminders` | `ops_calendar_reminders` | id `iops-calendarReminders-N`; `remind_at/sent_at` detik. Pengingat dengan `remind_at` < waktu cutover dan `sent_at` NULL -> `sent_at = remind_at` (cegah semburan push basi pada cron pertama). |
| `calendarResults` | `ops_calendar_results` | id `iops-calendarResults-N`; `event_id`; `attendees` JSON dengan `userId` ditranslasikan; `files` JSON `{url,name,contentType,size}` -> `{key,name,contentType,size}` (`key` = `kalender/legacy/<basename>`, bagian D); `filled_by`. |
| `isoRecords` | `iso_records` | id `iops-isoRecords-N`; `source_key` ditranslasikan: `order:<id>`->`order:iops-orders-<id>`; `customer:<id>`->`customer:<contact_id target>`; `mix:<id>`->`mix:iops-mixDesignLogs-<id>`; `receipt:<id>`->`receipt:iops-goodsReceipts-<id>`; `production:<id>`->`production:iops-productionOutputs-<id>:1` (web memakai `production:<id>:<rn>`); `kind='objective'` (`YYYY-MM:no`) tetap. `data._from`: `event:`/`receipt:`/`production:` ditranslasikan sama. `number` (NCR-…) dipertahankan; generator NCR memakai MAX dari tabel (`iso.ts:46`) sehingga lanjut dari angka tertinggi. `created_by` peta; `history` JSON tetap. Kunci unik (form, source_key): bentrok -> diabaikan + dilaporkan. |
| `activityLogs` | TIDAK dimigrasi (default, lihat F6) | Audit app lama tetap di backup `.sql`. |
| `backupRuns` | TIDAK dimigrasi | Riwayat backup app lama tidak relevan. |
| `d1_migrations` | TIDAK dimigrasi | Metadata alat. |

## B. Arsip tanpa stok & jurnal

### B.1 Bagaimana web menandai "sudah diposting"
Tidak ada kolom/flag. Status posting TURUNAN dari dua hal:
- Surat jalan: `isPosted(status, departed_at)` = `departed_at` terisi DAN status bukan dijadwalkan/dimuat/batal (`src/components/ops/delivery/status.ts:46`, SQL setara `SQL_POSTED` baris 52). Fisiknya: baris `inv_stock_moves(source='pengiriman', source_id=<id SJ>)` + `fin_journals(source='pengiriman', source_id=<id SJ>)`, dibuat oleh `postDeliveryOps` (`src/lib/erp/ops.ts:48`) hanya dari `transition()` (`actions/deliveries.ts:318-330`).
- Produksi: tidak ada status; fisiknya baris `inv_stock_moves/fin_journals(source='produksi', source_id=<id>)`, dibuat/diganti oleh `saveProduction` (`actions/stock.ts:200-212`).

### B.2 Aksi yang bisa membalik / memposting palsu
| Aksi | Lokasi | Risiko pada data arsip |
|---|---|---|
| `transition()` (semua perubahan status; dipakai `setDeliveryStatus`, `completeDelivery`, aksi sopir) | `actions/deliveries.ts:158` | Dari `terkirim` -> `batal` -> `dijadwalkan` -> `berangkat`: mengisi `departed_at=now`, memanggil `postDeliveryOps` pakai `ops_delivery_lines` arsip = stok keluar + jurnal HPP PALSU bertanggal hari ini. Juga bisa `unpost` (hapus baris yang memang tidak ada). |
| `saveDelivery` | `deliveries.ts:48-60` | Menjadwalkan SJ baru pada PO arsip (lalu diposting seperti nyata); mengubah SJ arsip berstatus `dijadwalkan`. |
| `assignDelivery`, `deleteDelivery` | `deliveries.ts:106`, `:448` | Ubah sopir/armada arsip; hapus SJ arsip `batal`/`dijadwalkan`. |
| `saveOrder` (edit), `setOrderStatus` (buka kembali/selesai), `cancelOrder`, `deleteOrder` | `actions/orders.ts:26`, `:126`, `:174`, `:215` | Mengubah/menghapus PO arsip; `refreshOrderStatus` menurunkan ulang status; buka-kembali lalu jadwal SJ baru. |
| Faktur dari PO | `akuntansi/actions/sales.ts:53,84-108` | Menerbitkan FAKTUR PENJUALAN + jurnal piutang/pendapatan atas PO yang sudah ditagih di Zahir (`orderId` arsip, `orderLineId` arsip). |
| `saveProduction` (edit) | `actions/stock.ts:76-88,200-212` | Menyimpan ulang produksi arsip = menghapus lalu MEMBUAT `inv_stock_moves` + jurnal produksi dari baris hasil (stok barang jadi naik palsu). |
| `deleteProduction` | `stock.ts:232-246` | Menghapus dokumen arsip (tak ada stok yang dibalik, tetapi data hilang). |

### B.3 Rancangan aman (tanpa ubah skema tabel)
1. **Penanda = awalan id `iops-`** pada `ops_orders.id`, `ops_deliveries.id`, `inv_productions.id` (dan turunannya). Tidak ada kolom baru. Ditambah teks `[ARSIP inventori-ops]` pada `note` untuk pembaca manusia dan nomor berformat beda (`PO-YYYY-NNNNNN`, `SJ-PO-…`, `PRD-ARSIP-…`).
2. **Keadaan data arsip = "tidak diposting" menurut definisi web sendiri:** `departed_at = NULL` pada SEMUA SJ arsip (termasuk `terkirim`), tidak ada baris `inv_stock_moves`/`fin_journals`, `labor_cost=0`, harga baris PO 0, tidak ada `fin_invoices`. Akibatnya laporan stok/HPP/"belum difaktur"/`SQL_POSTED` tidak melihat arsip. Jam berangkat asli ada di `ops_delivery_history` dan baris `note`. Harga: `SQL_AT_YARD` menjumlah `delivery_lines` SJ yang belum berangkat sebagai "terjadwal" yang mengurangi stok bebas (`insights.ts:41`) -> SJ arsip tidak boleh berstatus terbuka (F3).
3. **Guard kecil (sangat disarankan, ±15 baris)**: berkas baru `src/lib/erp/archive.ts` -> `isArchive(id)` (`id.startsWith("iops-")`) dan `assertLive(id, "<objek>")` yang melempar `UserError("Data arsip inventori-ops bersifat baca-saja.")`. Panggil di:
   - `actions/deliveries.ts`: setelah `d` ditemukan di `transition()` (baris ~161); `saveDelivery` (~54 untuk `existing`, ~58 untuk `order`); `assignDelivery` (~111); `deleteDelivery` (~453).
   - `actions/orders.ts`: `saveOrder` untuk `existing`, `setOrderStatus` (setelah ambil PO, ~130), `cancelOrder` (~181), `deleteOrder` (~222).
   - `akuntansi/actions/sales.ts`: setelah `orderId` ditentukan (baris 53): `if (orderId && isArchive(orderId)) throw …("PO arsip tidak bisa difaktur; buat faktur manual tanpa pesanan.")`.
   - `actions/stock.ts`: `saveProduction` untuk `existing` (~87), `deleteProduction` (~237).
   UI opsional: sembunyikan tombol aksi bila `isArchive(id)` dan tampilkan lencana "Arsip".
4. **Lapis kedua di database (opsional, tanpa ubah tabel):** dua trigger di `00-prep.sql` — `BEFORE INSERT ON inv_stock_moves WHEN NEW.source_id LIKE 'iops-%'` dan hal sama pada `fin_journals` -> `SELECT RAISE(ABORT,'arsip')`. Menjamin posting palsu mustahil walau ada guard terlewat (batch gagal utuh). Catatan: trigger ada di D1 tetapi tidak di `drizzle/` -> dokumentasikan; hapus bila dianggap menyulitkan.
5. Skema tidak diubah. Jika kelak ingin penanda eksplisit, tambahkan `ops_orders.is_archive` lewat migrasi biasa; tidak diperlukan untuk migrasi ini.

## C. Pengguna

| Hal | Aturan |
|---|---|
| Peran sumber -> web (K3) | `superadmin` -> `operasional`; `admin` -> `operasional`; `qc` -> `qc`; `mandor` -> `mandor`; `satpam` -> `satpam`; `driver` -> `sopir`. Bendera: `canApproveQc` -> tambah `manajer_qc`; `canSignAsLeader` / `canRatePrice` / `canViewSummary` -> tambah `pimpinan`. Tidak ada yang otomatis `owner` (F1). |
| Perluasan/penyempitan hak (masuk laporan) | `operasional` web otomatis punya `selesaikan` (admin tanpa `canCompleteOrders` jadi boleh); `pimpinan` menggabung laporan + TTD + nilai harga (tiga bendera terpisah di sumber); `canViewSandTests` pada non-QC tidak punya padanan (hilang); `canViewSandTests`/`canApproveQc` pada akun nonaktif diabaikan. |
| Akun bersama (Duty Phone) | Pengguna yang punya `dutyOfficers` aktif dibuat TANPA kredensial (nonaktif de facto); petugasnya dibuat sebagai pengguna terpisah (A.1). Riwayat bertanda `dutyOfficerName` ditautkan ke pengguna petugas. |
| `isActive=0` | Dibuat tanpa kredensial (web tidak punya kolom aktif; tanpa hash = tak bisa login), supaya riwayat "dibuat oleh" tetap tertaut. |
| Pencocokan akun yang ada | Urutan: email (lowercase) lalu HP ternormalisasi (`normalizePhone`, `src/lib/roles.ts`). Cocok -> PAKAI AKUN WEB (id, hash, peran tidak diubah); perbedaan peran dicatat di `laporan/cocok-pengguna.csv` beserta usulan. Email cocok akun A tetapi HP cocok akun B -> tidak ada yang dipakai; buat baru tanpa HP, tandai konflik. `signature_key` hanya diisi bila kosong. |
| Id baru | `max(users.id)` snapshot + 1, berurutan menurut id sumber, disimpan di `plan/user-map.json` dan dipakai ulang; `INSERT OR IGNORE INTO users (id, …)`. Verifikasi setelah impor: tiap id peta cocok nama/email/HP (cegah id terambil pengguna lain). |
| Kolom `users` | `email` (huruf kecil) hanya bila akun berperan non-lapangan atau sumber memilikinya; `name`; `phone` = HP ternormalisasi `62…`; `password_hash`/`pin_hash`; `driver_id` = id `ops_drivers` target (bagi peran `driver`, via `drivers.userId`); `roles` = JSON array; `signature_key`; `created_at`. |
| Kredensial | Peran lapangan (`operasional, gudang, sopir, qc, mandor, satpam`) + HP valid -> PIN 6 angka acak (ditolak ulang bila gagal `weakPin`: sama semua/berurutan/pola berulang). Akun yang punya peran non-lapangan (`manajer_qc`, `pimpinan`, `owner`, …) -> wajib email + password acak 14 karakter (alfabet tanpa 0/O/1/l/I; web mensyaratkan ≥10). Sesi PIN hanya membawa peran lapangan (`effectiveRoles`), jadi `manajer_qc`/`pimpinan` baru efektif lewat email+password. Tanpa email/HP yang sah -> akun dibuat tanpa kredensial dan masuk `laporan/perlu-kredensial.csv`. |
| Format hash (ikuti `scripts/create-admin.mjs`, `src/lib/password.ts`) | `pbkdf2$100000$<salt base64 16 byte>$<hash base64 32 byte>`; PBKDF2-SHA256, 100.000 iterasi; salt acak 16 byte tiap akun; rahasia = password (kantor) atau PIN (lapangan) sebagai teks UTF-8. Gunakan WebCrypto Node (`webcrypto`) persis seperti skrip tsb. |
| Berkas kredensial | `akun-baru.csv` (nama, peran, email/HP, password/PIN, status) ditulis di folder lokal di luar repo (mis. `~/Documents/migrasi-ops/`); jangan di-commit; hapus setelah dibagikan. Dibuat sekali; proses ulang memakainya kembali (hilang -> pakai `npm run admin:create` untuk reset). |
| Tidak ada paksa-ganti | Web tidak punya `must_change_password`; sarankan pemilik meminta pengguna mengganti PIN/password setelah login pertama. |

## D. Foto & berkas (KV `PHOTOS` -> R2 `MEDIA`, bucket `istana-block-media`)

Sumber menyimpan URL `/files/<key>` pada kolom; di backup berkasnya `foto/<key>` (tanpa metadata KV). Key target: `<folder K5>/legacy/<basename-sumber>`
(cocok regex rute `^(penerimaan|uji-pasir|produksi|ttd|kalender)/[\w\-./]+$` di `operasional/berkas/[...key]/route.ts:7` dan `^pengiriman/[\w\-./]+$` di `operasional/bukti/[...key]/route.ts:12`).
Nama dasar sumber acak (`<epoch>-<token>.<ext>`), jadi unik dan aman diunggah ulang (idempoten).

| Jenis | Key KV sumber | Kolom sumber | Key R2 target | Kolom target |
|---|---|---|---|---|
| Bukti kirim | `delivery-proofs/<deliveryId>/<ts>-<tok>.<ext>` | `deliveryProofs.fileKey` (`fileUrl`) | `pengiriman/legacy/<deliveryId>/<basename>` | `ops_delivery_proofs.file_key` |
| Barang masuk | `receipts/<ts>-<tok>.jpg` | `goodsReceipts.photoUrls` (JSON array URL) | `penerimaan/legacy/<basename>` | `ops_goods_receipts.photo_keys` (JSON array key) |
| Uji pasir | `sand-tests/<ts>-<tok>.jpg` | `sandTests.startPhotoUrl`, `photoUrl` | `uji-pasir/legacy/<basename>` | `qc_sand_tests.start_photo_key`, `photo_key` |
| Produksi | `production/<ts>-<tok>.jpg` | `productionOutputs.photoUrl` | `produksi/legacy/<basename>` | `inv_productions.photo_key` |
| Tanda tangan | `signatures/<userId>-<ts>-<tok>.png` | `users.signatureUrl` | `ttd/legacy/<basename>` | `users.signature_key` |
| Lampiran kalender | `calendar/<ts>-<tok>.<ext>` | `calendarResults.files[].url` (+`name`,`contentType`,`size`) | `kalender/legacy/<basename>` | `ops_calendar_results.files[].key` |
| Lampiran lain | `lampiran/…` (folder tak dikenal) | tidak dirujuk kolom mana pun | tidak diunggah | - (masuk laporan yatim) |

Manifes `r2-manifest.json`: `[{ "src": "<folder>/foto/<key>", "key": "<key target>", "contentType": "<dari ekstensi>", "name": "<hanya kalender, dari JSON files[].name>" }]`.
Unggah: `wrangler r2 object put istana-block-media/<key> --file <src> --content-type <ct> --remote` (tambah `--custom-metadata name=…` untuk kalender bila didukung);
bila wrangler terpasang punya `r2 bulk put` pakai manifes, selain itu loop 4 paralel. Content-type dari ekstensi: jpg/jpeg, png, webp, avif, gif, pdf, doc(x), xls(x), ppt(x); ekstensi lain -> lewati + lapor.
Berkas dirujuk DB tetapi tidak ada di `foto/` -> kolom tunggal diisi NULL / elemen array dibuang + laporan `foto-hilang.csv`. Berkas di `foto/` tanpa rujukan -> `foto-yatim.csv`, tidak diunggah.

## E. Urutan impor, penomoran, batas D1, verifikasi

### E.1 Urutan (tanpa FK di target, urutan demi keterbacaan & kegagalan terlokalisir)
0. Pra: snapshot + cadangan D1; freeze app lama & pembuatan pengguna web; uji `--local` dengan salinan (`wrangler d1 execute DB --local --file=snap.sql` lalu semua berkas); `--dry-run` + tinjau laporan.
1. `00-prep.sql` (trigger opsional B.3.4). 2. `01-users.sql`. 3. `02-master.sql` (kontak, barang, sopir, kendaraan baru). 4. `03-pesanan-kirim.sql` (orders, order_lines, deliveries, delivery_lines, history, proofs, tracking, order_deletions).
5. `04-qc.sql` (mix designs -> logs, strength tests -> samples). 6. `05-terima-produksi.sql` (goods_receipts -> sand_tests, productions + lines). 7. `06-piket-kalender.sql`. 8. `07-iso.sql` (terakhir; kunci bergantung id lain).
9. Unggah R2 (boleh paralel setelah langkah 1; kolom key sudah menunjuk key final). 10. `08-verifikasi.sql` + penyegaran halaman.

### E.2 Penomoran dokumen
- PO: nomor lama `PO-YYYY-NNNNNN` dipertahankan (format web `PO/YYMM/NNNN` -> tak bentrok; indeks unik `ops_orders_number_uq` tetap aman). SJ: `SJ-<nomor PO>`; produksi: `PRD-ARSIP-<id>`.
- `sys_sequences` TIDAK disentuh (nomor arsip tak memakai deret web). Batch produksi dan NCR dipertahankan; generatornya mengambil MAX dari tabel sehingga lanjut dengan benar (`production.ts:53`, `iso.ts:46`).
- Nomor invoice/lainnya di web tidak terpengaruh.

### E.3 Batas D1 dan pemecahan berkas
- Gunakan literal (bukan parameter terikat) sehingga batas ±100 parameter/kueri tidak berlaku. Satu `INSERT OR IGNORE` per baris; tiap pernyataan < 100 KB (batas panjang SQL D1) — JSON panjang dipotong dengan peringatan bila mendekati 90 KB.
- Pisah per tabel dan, bila besar, ≤ ~1.000 pernyataan / ≤ ~2 MB per berkas (`01-users.sql`, `03a-orders.sql`, `03b-lines.sql`, …) agar tiap `wrangler d1 execute --file` tetap di bawah batas durasi/ukuran dan mudah diulang. Tanpa `BEGIN/COMMIT` (D1 menolak transaksi manual). String di-escape `'` -> `''`; teks null -> `NULL`.
- Jalankan berurutan; berhenti di kesalahan pertama (aman diulang karena `OR IGNORE`).

### E.4 Verifikasi (`08-verifikasi.sql` + `laporan/hitungan.csv`)
| Pemeriksaan | Ekspektasi |
|---|---|
| Per tabel sumber: `count(*)` backup vs `count(*) WHERE id LIKE 'iops-%'` target | Sama, kecuali selisih yang dijelaskan: pelanggan digabung (HP sama)/dicocokkan, produk kustom -> item gabungan, pengiriman `batal` tanpa baris `delivery_lines`, tautan lacak dicabut/kedaluwarsa, bukti tanpa berkas, tabel TIDAK dimigrasi. Selisih tak terjelaskan = gagal. |
| Jumlah: `sum(qty)` `orderItems` vs `ops_order_lines` arsip; `sum(quantity)` produksi/penerimaan; hitungan per status PO & SJ | Sama (setelah pemetaan status). |
| Arsip tidak memposting | `SELECT count(*) FROM inv_stock_moves WHERE source_id LIKE 'iops-%'` = 0; `fin_journals`, `fin_invoices.order_id` idem = 0; `ops_deliveries WHERE id LIKE 'iops-%' AND departed_at IS NOT NULL` = 0; `ops_delivery_lines` arsip pada SJ berstatus terbuka = 0. |
| Stok & buku besar tak berubah | `sum(qty), sum(value)` `inv_stock_moves` dan jumlah/saldo `fin_journal_lines` sebelum (snapshot) = sesudah. |
| Rujukan tak yatim | PO->kontak, baris->PO/barang, SJ->PO, riwayat/bukti->SJ, sampel->uji, uji pasir->penerimaan, peserta/hasil->acara, `created_by` -> `users` (query LEFT JOIN … IS NULL = 0). |
| Pengguna | Setiap id di `plan/user-map.json` = baris `users` dengan nama/email/HP sesuai; jumlah akun tanpa kredensial = isi `perlu-kredensial.csv`; tidak ada email/HP ganda. |
| Berkas | Hitungan manifes = objek R2 (`wrangler r2 object get` bertahap/HEAD sampel ≥5% + semua tanda tangan); tiap key di kolom DB ada di manifes atau di `foto-hilang.csv`. |
| Fungsional (manual) | Buka 3 PO arsip, 1 SJ `terkirim` (foto bukti tampil via `/operasional/bukti`), 1 penerimaan (foto via `/operasional/berkas`), 1 uji kuat tekan, 1 rapat + lampiran; coba tombol status/batal/faktur pada arsip -> ditolak guard. |

## F. Risiko & keputusan yang diminta dari pemilik (default konservatif)

1. **Peran Customer Service (`superadmin`).** Sumber: akses penuh + kelola pengguna. Default: `operasional` (+ peran dari bendera), BUKAN `owner` (owner web membuka keuangan & keamanan, lebih luas dari sumber). Pemilik menaikkan manual lewat `/internal/pengguna` bila perlu.
2. **Pengguna kantor tanpa email, atau tanpa HP.** Peran non-lapangan (`manajer_qc`, `pimpinan`) hanya masuk lewat email+password. Default: akun dibuat tanpa kredensial dan dilaporkan; pemilik memberi email/HP. Skrip tidak mengarang email.
3. **PO/pengiriman terbuka saat cutover** (belum delivered/cancelled). Arsip tidak boleh berstatus terbuka (mengurangi stok bebas, muncul di tugas sopir). Default: skrip BERHENTI dengan daftar; selesaikan/batalkan dulu di app lama. Opsi `--open=skip` melewati PO terbuka (tidak dimigrasi, dilaporkan) — dibuat ulang manual di web.
4. **Pencocokan barang hanya nama persis.** Ejaan beda -> item baru `IOPS-xxxx` (`track_stock=0`) yang tidak ikut stok/produksi nyata. Default: dry-run wajib ditinjau; pemilik memberi daftar padanan manual (`plan/alias-barang.csv`) yang dipakai ulang oleh skrip.
5. **`departed_at` NULL pada SJ arsip `terkirim`.** Aman terhadap laporan, tetapi kartu SJ tidak menampilkan jam berangkat di kolomnya (ada di riwayat & catatan). Alternatif (tidak dipilih): isi `departed_at` + andalkan guard B.3.3 + trigger B.3.4 — laporan lalu menganggap arsip "terposting" tanpa baris stok. Default: NULL.
6. **Data tidak dimigrasi:** log aktivitas, riwayat backup, posisi GPS, notifikasi, langganan push. Default: tidak; simpan folder backup lama permanen (arsip audit) dan biarkan app lama read-only ≥ 6 bulan. Pemilik dapat meminta `activityLogs` ikut (id diberi offset karena autoincrement).
7. **Petugas jaga (Gugum, Wawan, dst.) & akun bersama.** Mereka dibuat sebagai akun tanpa kredensial; akun bersama lama nonaktif. Default: pemilik mengisi HP+PIN tiap petugas sebelum go-live; sebelum itu satpam/mandor tidak bisa piket/mencatat (aturan `needsShift`).
8. **Perubahan hak & domain.** Hak berubah seperti C (`selesaikan` meluas, `pimpinan` menggabung, `canViewSandTests` hilang). Tautan lacak lama hanya hidup bila `app.kirimistanablock.com/…/<token>` dialihkan ke `/kiriman/<token>`; default: tidak mengalihkan sampai pemilik memutuskan, app lama tetap read-only dulu.
