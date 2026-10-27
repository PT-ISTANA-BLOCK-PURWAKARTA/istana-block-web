# Fondasi setara app live (migrasi 0006) - kontrak untuk subagen fitur

Repo `C:\Users\Sarimusan\ibw-port`, cabang `fitur/setara-app-live`. Migrasi `drizzle/0006_setara_app_live.sql` (hanya CREATE TABLE/INDEX + ALTER ADD; sudah diterapkan ke D1 lokal WSL; tsc 0 error). Remote TIDAK disentuh. Impor: `import { getDb, schema } from "@/db"`; enum/tipe dari `@/db/erp`.
Konvensi (K8): id teks UUID, tanggal bisnis teks YYYY-MM-DD WIB, waktu kejadian `integer timestamp` (Date di TS), `*_by` = users.id integer, tanpa FK.

## 1. Keputusan desain (dan alasannya)
- Stok digabung ke stok web: TIDAK ada tabel stok kedua. "Jenis stok" = `fin_items` (barang web). Kunci `line|spec|metode` app live diganti dua atribut opsional di barang: `fin_items.production_line` (ProductLine) dan `fin_items.method` (tumbuk|cor|tulangan). Warna/ukuran/tipe cukup ada di nama/kode barang. Stok barang web dikelompokkan lewat `production_line`.
- Opname = dokumen `inv_counts` + `inv_count_lines`. Simpan = untuk tiap baris selisih (counted - system != 0) buat SATU `inv_adjustments` (kolom baru `count_id` terisi, reason "Opname <no>") + `inv_stock_moves` source `penyesuaian` + jurnal `penyesuaian`, persis `saveAdjustment` di `actions/stock.ts` (tambah: Dr Persediaan/Cr selisih_persediaan; kurang: kebalikan, dinilai HPP rata-rata). Satu `runBatch` per dokumen. Hapus dokumen = hapus adjustments(count_id) + moves + jurnal + baris. Penyesuaian ber-`count_id` jangan diubah dari halaman penyesuaian biasa (arahkan ke dokumen opname).
  Beda dengan app live: opname app live "menghitung ulang mulai dari angka itu"; di web stok = jumlah semua pergerakan, jadi opname hanya menambah/mengurangi selisih. Hasil akhir sama pada waktu opname.
- Cat genteng = `inv_conversions` (from_item natural -> to_item warna, qty 1:1). Simpan = 2 `inv_stock_moves` source `konversi` (nilai keluar = qty x HPP rata-rata via `stockLevels/unitCost`, nilai masuk = sama, jadi nilai persediaan netral), TANPA jurnal bila kedua barang berakun persediaan sama (`inventoryAccount` identik; wajib barang_jadi kedua-duanya, selain itu tolak). `StockSource` ditambah `"konversi"`. Peringatan (bukan blokir) bila qty > stok natural.
- Grade: `inv_productions.quantity-hasil` (baris `inv_production_lines` role hasil) = Grade A (satu-satunya yang memposting stok/jurnal, seperti sekarang). `inv_productions.grade_b` = Grade B (reject masih dijual), `inv_productions.rejects` (lama) = reject tidak dijual; B & reject HANYA dicatat. Satu dokumen produksi = satu produk (seperti app live).
- Adukan cor bersama: tabel `inv_production_batches` (tanggal, total sak, leader, note); tiap produk adukan = satu `inv_productions` dengan `batch_id` = id adukan, `cement_bags` dokumen dikosongkan (rasio sak/buah dihitung dari adukan). Dipilih daripada kolom di header karena semen dicatat sekali untuk beberapa dokumen. Hapus adukan = hapus semua dokumen ber-batch_id (beserta stok/jurnalnya) setelah konfirmasi.
- Buis: `inv_productions.method` (+ `fin_items.method`). Semen curah paving: `cement_kg`. Baris paving otomatis dari mix log: `mix_log_id`; `qc_mix_logs` + `grade_b`, `half_pieces`.
- TTD ketidaksesuaian: kolom di `inv_productions` (bukan iso_records): `reject_manager_by/at` lalu `reject_leader_by/at` (user + waktu; gambar TTD diambil dari `users.signature_key` saat cetak). Hanya baris dengan grade_b>0 atau rejects>0 yang boleh ditandatangani; urutan Manager dulu baru Pimpinan; ubah baris (qty/grade/reject) mereset keempat kolom (usulan; sumber tidak jelas). NCR F-IB-15 tetap di `iso_records`, tidak diubah.
- Spesifikasi produk: `qc_product_specs` (line, name, variant [buis: metode], weight_kg, specs JSON {kunci:nilai}, notes, active, `item_id` opsional ke fin_items). Halaman sendiri, bukan tab /qc (supaya tak menyentuh qc/page.tsx).
- Rekap Pelanggan: `ops_customer_leads` terpisah dari `fin_contacts`; `contact_id` hanya tautan opsional (mis. dari tombol "Jadikan pelanggan").
- Uji lumpur: skip di `ops_goods_receipts` (test_skipped_at/level/reason/by; level tidak|sedikit|sedang; batal skip = kosongkan keempatnya); TTD bertingkat + riwayat ubah hasil di `qc_sand_tests`; moda kirim `sendiri` ditambahkan ke `deliveryModes` (`@/db/erp`) DAN `DELIVERY_MODES`/`DELIVERY_MODE_LABELS` (`lib/ops/shared/sand.ts`, sudah saya sesuaikan; label quarry diganti "Dikirim oleh supplier / quarry"). Komponen yang me-render mode (SupplierBoard.tsx:446, summaries.ts:37/136, ReceiptList.tsx:42, exports.ts) BELUM menangani `sendiri` secara khusus (jatuh ke cabang "quarry"/label umum) - subagen QC perlu merapikan; `expeditionName` hanya wajib untuk ekspedisi (sudah begitu).
- Koreksi jam tiba: kolom di `ops_deliveries` (jam asli `arrived_at` tetap). TTD hadir kalender: `ops_calendar_participants.attendance_signed_at` (peserta menandatangani sendiri; tamu/peserta di luar daftar tidak bisa).
- Revert status SJ (batalkan Selesai/Sampai): tidak butuh kolom; pakai `ops_delivery_history` (note = alasan) dan aturan posting stok K1.

## 2. Tabel baru
| Ekspor `schema.*` | Tabel | Kolom (TS) |
|---|---|---|
| `customerLeads` | ops_customer_leads | id, contactDate, source, name, phone, address, product, status(LeadStatus), saleValue, priceNett, priceOffer (Rupiah int), reasons(LeadReason[]), notes, ratingService/Quality/Speed (1-5|null), ratingNote, ratedBy, ratedAt, feedback(puas|komplain|null), complaintDate, complaintNote, getbackDate, getbackNote, getbackResult(puas|tidak_puas|null), getbackBy, contactId, importKey (UNIK, null boleh), createdBy, createdAt, updatedAt |
| `stockCounts` | inv_counts | id, number (unik, prefix usulan "OPN" via `nextNumber`), date, countedAt, note, createdBy |
| `stockCountLines` | inv_count_lines | id, countId, itemId, systemQty, countedQty |
| `conversions` | inv_conversions | id, number (usulan prefix "KNV"), date, movedAt, fromItemId, toItemId, qty, note, createdBy |
| `productionBatches` | inv_production_batches | id, date, cementBags, leader, note, createdBy |
| `productSpecs` | qc_product_specs | id, line(ProductLine), name, variant, weightKg, specs(Record), notes, active, itemId, createdBy |
Konstanta/tipe baru di `@/db/erp`: `productLines` (paving, genteng, buis, tutup_buis, kanstin, uditch, tutup_uditch, greffel, grass, lainnya), `productionMethods`, `skipLevels`, `leadStatuses`, `leadSources`, `leadReasons` (harga_mahal, min_order, luar_provinsi, tidak_ada_info, tidak_tersedia), `leadFeedbacks`, `getbackResults`, tipe `SandEdit`. Label/singkatan/hint alasan dan teks UI: lihat spek (bagian 1.5).

## 3. Kolom baru di tabel lama
- `fin_items`: production_line, method
- `inv_adjustments`: count_id (index)
- `inv_productions`: grade_b, method, cement_kg, batch_id (index), mix_log_id, reject_manager_by/at, reject_leader_by/at
- `qc_mix_logs`: grade_b, half_pieces
- `ops_goods_receipts`: test_skipped_at, test_skip_level, test_skip_reason, test_skipped_by
- `qc_sand_tests`: secretary_ack_by/at, manager_ack_by/at, leader_ack_by/at, edit_history (SandEdit[] = {at(detik), by, reason, old{readingUnit,sandHeight,siltHeight,siltPercent,decision}}, default [])
- `ops_deliveries`: arrival_corrected_at (jam tiba sebenarnya), arrival_corrected_by, arrival_correction_made_at, arrival_correction_reason (min 10 huruf; batal koreksi = kosongkan keempatnya)
- `ops_calendar_participants`: attendance_signed_at
Catatan `qc_sand_tests`: nama petugas TTD/ubah dicari lewat join users.id. Sekretaris app live = username "arel"; di web diganti izin `ttd_sekretaris`.

## 4. Izin (src/lib/roles.ts) dan peta peran
Perm baru: `rekap_pelanggan`, `opname`, `cat_genteng`, `spesifikasi_produk`, `ttd_sekretaris`. Owner otomatis semua.
| Perm | Peran |
|---|---|
| rekap_pelanggan | owner, operasional (app live: superadmin/admin) |
| opname | owner, operasional, gudang, qc (app live: superadmin/admin/qc; gudang ditambah karena sudah memegang `stok`/penyesuaian) |
| cat_genteng | owner, operasional, gudang, qc, mandor (app live: superadmin/admin/qc/mandor; gudang ditambah, alasan sama) |
| spesifikasi_produk | owner, operasional, qc (kelola; MEMBACA spesifikasi di form produksi tidak butuh izin ini - cukup `produksi_lapangan`/`stok`) |
| ttd_sekretaris | owner, operasional (tidak ada peran sekretaris di web; pemilik bisa menyempitkan nanti) |
Pakai ulang (tanpa perm baru): TTD Manager in charge = `setujui_qc`; TTD Pimpinan = `ttd_pimpinan`; koreksi jam tiba & batalkan status SJ = `selesaikan`; skip uji lumpur & ubah hasil = `uji_pasir` (kantor/QC/satpam); TTD hadir kalender = `kalender` + terdaftar di peserta; adukan cor/grade/buis = `produksi_lapangan` atau `stok` (lewat `productionAccess()`, mandor hanya precast, QC hanya paving); input barang masuk `sendiri` = `barang_masuk`.
Matriks di `/internal/pengguna` sudah ditambah 5 baris. Teks ROLE_LABEL belum diubah.

## 5. Menu dan halaman (ITEMS di operasional/(panel)/layout.tsx; semua placeholder "Sedang disiapkan" + `requirePerm`, timpa isinya)
| Menu | Path | Perm | Ikon | Grup |
|---|---|---|---|---|
| Rekap Pelanggan | /operasional/rekap-pelanggan | rekap_pelanggan | star | Penjualan |
| Stok opname | /operasional/stok/opname | opname | list | Gudang |
| Cat genteng | /operasional/stok/cat-genteng | cat_genteng | box | Gudang |
| Spesifikasi produk | /operasional/spesifikasi-produk | spesifikasi_produk | doc | Mutu |
Halaman turunan (mis. /stok/opname/baru, /stok/opname/[id], /rekap-pelanggan/impor) dibuat subagen fitur di bawah folder yang sama. Menu lama (Barang masuk, Uji lumpur, QC, Produksi, Kalender, Rekap ISO, Muatan, Pengiriman) tidak diubah; fiturnya ditambahkan di halaman yang ada.

## 6. Helper
Tidak ada helper baru. Pakai yang ada: `guard/runBatch/insertMany/nextNumber/stockLevels/unitCost/inventoryAccount/journalOps/deleteJournalOps/loadAccounts/assertOpen/getFinSettings/requireDate/parseRows` (`@/lib/erp/server`), `logActivity` (`@/lib/ops/activity`), `requireShift` (`@/lib/ops/duty`), `downloadWorkbook` (`@/lib/ops/excel`, klien), `saveImage/saveFile` (`@/lib/media`).

## 7. Batasan yang diwariskan / data yang dibutuhkan dari backup .sql app live
- Daftar 22 jenis stok: tidak ada di bundel; setelah fresh start, pemilik/admin membuat barang web (`fin_items`, kind barang_jadi, trackStock) dan mengisi `production_line`/`method`. Daftar persisnya = isi respons `stock.options` / tabel produksi di backup.
- Isi awal `qc_product_specs` (data flyer Buis Beton, U-Ditch, Genteng Beton: nama ukuran, berat, kunci spesifikasi Mutu/Tebal/Varian): hanya dari backup .sql; keputusan pemilik = isi ulang manual atau skrip seed dari backup.
- Pola `batchCode` (PB-261005-01) sudah ada di web (`nextBatchCode`).
- Rumus pasti 5 indikator Sasaran Mutu otomatis dari Rekap Pelanggan (leads:chat|offer|noComplaint|getback24, survey:satisfaction): hanya tafsiran spek (1.9); perlu `iso-core.ts`/`isoObjectives.ts` disambungkan ke `ops_customer_leads`.
- Aturan server yang tak terlihat dari klien (izin per prosedur, anti-dobel impor lanjutan, validasi tanggal komplain/get back) memakai tafsiran konservatif spek.
