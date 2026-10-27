# Spesifikasi hasil rekonstruksi: Rekap Pelanggan, ReceiptRatings, ProductSpecsTab

Sumber: bundel live `bundel-2026-10-26/` (minified) dibanding kode lama 18 Okt (`istana-block-inventori-ops`).
Tanda: **[pasti]** = terbaca langsung di klien; **[tebakan]** = disimpulkan dari field/pola penamaan; **[server?]** = tidak terlihat dari klien.
Pola lama yang dipakai sebagai acuan: tabel & kolom camelCase (`goodsReceipts`, `createdAt`), tRPC router bersarang (`receipts.list`), tanggal form disimpan teks `YYYY-MM-DD` (`isoRecords.recordDate`), timestamp `integer timestamp_ms`, JSON lewat `text mode json`.

---------------------------------------------------------------------

## 0. Ringkasan delta yang ditemukan

| Area | Baru dibanding sumber lama |
|---|---|
| Menu/rute | `Rekap Pelanggan` (`/rekap-pelanggan`), `Stok Barang` (`/stok`), menu QC berganti nama `QC, Produksi & Uji Mutu` |
| Router tRPC baru | `customers.*` (5 prosedur), `production.specs/saveSpec/removeSpec`, `iso.arrivals/correctArrival`, `sand.skipTest/skipped/editResult/ack*`, plus `monitor.*`, `stock.*`, `production.createBatch/...` (di luar cakupan, lihat bagian 5) |
| Sasaran Mutu (F-IB-16) | Semua 30 target jadi `75%`; 5 jenis `auto` baru bersumber dari Rekap Pelanggan (bagian 1.9) |
| Barang masuk | Moda kirim ketiga `sendiri`, skip uji lumpur, kolom `quarry` hilang dari form catat, kurva nilai overall per bulan |
| QC | Tab baru `Uji mutu` (panel F-IB-04) dan `Spesifikasi produk` |

---------------------------------------------------------------------

## 1. REKAP PELANGGAN (`CustomersPage-*.js`)

### 1.1 Menu, rute, izin (DashboardLayout + index) [pasti]

- Menu: label `Rekap Pelanggan`, path `/rekap-pelanggan`, `roles: ["superadmin","admin"]`, `showIf: user => !!user.canViewSummary`.
- Filter menu: `item.roles.includes(user.role) || item.showIf?.(user)` (jadi OR). Akun peran apa pun dengan flag `canViewSummary` melihat menunya.
- Guard rute: `/rekap-pelanggan` -> `roles: ["superadmin","admin"]` saja. Peran lain (mis. qc dengan `canViewSummary`) diarahkan ke beranda perannya. Ada ketidakselarasan menu vs rute; ikuti rute (superadmin, admin).
- Di halaman tidak ada pembatasan tombol per peran: Impor Excel, Tambah, Ubah, Hapus, Nilai tampil untuk semua yang lolos guard. Penegakan izin per prosedur = [server?].
- Tidak ada flag `canXxx` baru. Flag di bundel: `canCompleteOrders, canApproveQc, canSignAsLeader, canViewSandTests, canViewSummary, canRatePrice` (semua sudah ada di skema lama).

### 1.2 Layar (teks persis)

Header:
- Eyebrow `Rekap pelanggan` (ikon users-round), H1 `Konsumen & penilaian pembeli`.
- Paragraf: `Konsumen dari iklan Google Ads dan sumber lain: siapa yang membeli, nilai penjualannya, alasan yang tidak membeli, dan **penilaian pembeli untuk layanan, kualitas, dan kecepatan** (1–5 bintang). Kepuasan pembeli otomatis masuk Sasaran Mutu no. 16.`
- Tombol: `Impor Excel` (outline), `Excel` (hijau, disabled bila daftar tersaring kosong), `Tambah konsumen` (oranye).

Filter periode (kartu):
- `Dari tanggal`, `Sampai tanggal` (input date; perubahan ke nilai kosong diabaikan), tombol cepat `Bulan ini`, `Bulan lalu`, `Tahun ini`, `Semua` (`Semua` = `2020-01-01` s/d hari ini). Bawaan = `Tahun ini`.
- Kotak cari, placeholder `Cari nama, WA, produk...` (substring huruf kecil pada name, phone, address, product, notes).
- Query hanya jalan bila `from <= to`.

Kartu ringkasan (5; semua dihitung dari SELURUH data periode, bukan dari chip status/cari):

| Judul | Nilai | Sub-teks |
|---|---|---|
| `Konsumen` | jumlah baris | `bertanya / dihubungi` |
| `Membeli` | jumlah status membeli | `closing {round(membeli/total*100)}%` atau `-` bila 0 konsumen |
| `Nilai penjualan` | `Rp ` + `toLocaleString("id-ID")` jumlah `saleValue` pembeli (`-` bila 0) | `dari konsumen yang membeli` |
| `Follow up` | jumlah status follow_up | `perlu dihubungi lagi` |
| `Pembeli puas` | `round(puas/dinilai*100)%` atau `-` | bila ada yang dinilai: `{puas} dari {dinilai} dinilai` + (bila ada bintang) ` · bintang rata² {round(rata N)}/100` + ` · {k} komplain ({m} belum di-get back)`; bila belum: `{n} pembeli belum dinilai` |

Dua kartu lagi:
- `Alasan tidak membeli`: lima pil `{jumlah} {label}` (jumlah baris yang `reasons` memuat kode itu, status apa pun), tooltip = hint.
- `Rata-rata penilaian pembeli (1–5)`: bintang + `Layanan x,x`, `Kualitas x,x`, `Kecepatan x,x`. Rata-rata atas pembeli (status membeli) yang nilainya non-null, `toFixed(1)` lalu titik -> koma; `-` bila kosong.

Chip status (filter klien saja): `Semua`, `Membeli`, `Pembeli belum dinilai`, `Komplain`, `Komplain belum di-get back`, `Follow up`, `Tidak membeli`.
- `belum_dinilai` = status membeli DAN kepuasan `null`; `komplain` = feedback komplain; `belum_getback` = komplain dan getbackDate kosong; selebihnya cocok status.

Tabel (`min-w-[1150px]`), kolom: `Tanggal` (+ sumber di baris kedua), `Pelanggan` (nama; baris kecil `phone · address`), `Produk` (+ notes kecil), `Status` (pil + alasan tidak membeli merah, dipisah koma), `Nilai` (rata kanan; hanya bila membeli, selain itu `-`), `Layanan`, `Kualitas`, `Kecepatan` (5 bintang kecil bila membeli, selain itu `-`), `Keterangan`, kolom aksi.
- Urutan: server mengirim urut naik tanggal; klien `.reverse()` sehingga terbaru di atas. Maks 500 baris tampil, lalu `Menampilkan 500 dari {n} — persempit tanggal atau cari nama. Excel berisi semua.`
- Kosong: `Belum ada data konsumen pada periode ini.`; memuat: `Memuat...`.
- Tanggal: bila `contactDate` berakhiran `-01` ditampilkan bulan penuh (mis. `Oktober 2026`), selain itu `dd mmm yyyy` (`id-ID`). Ini karena baris impor hanya presisi bulan (1.6).
- Warna status: membeli hijau, follow_up kuning, tidak_membeli abu.
- Sel `Keterangan` (hanya pembeli): feedback puas -> pil `Puas`; komplain -> pil `Komplain` + isi komplain + `Get back {tanggal}` (+ ` · {getbackByName}`) atau `Belum di-get back` (kuning) + pil hasil (`Puas setelah get back` hijau / `Tetap tidak puas` merah); belum diisi -> `belum ada`; bukan pembeli -> `-`.
- Aksi per baris: tombol `Nilai` / `Get back` / `Ubah nilai` (hanya status membeli; teks = `Nilai` bila kepuasan null dan feedback kosong, `Get back` bila komplain tanpa getbackResult, selain itu `Ubah nilai`), ikon pensil (aria `Ubah`), ikon sampah (aria `Hapus`, `window.confirm("Hapus {name}?")`, toast `Data dihapus`).

### 1.3 Form `Tambah konsumen` / `Ubah konsumen` (dialog)

- Deskripsi: `Konsumen yang bertanya / membeli. Penilaian layanan, kualitas, dan kecepatan diisi setelah membeli.`
- Bidang & bawaan: `Tanggal` (date, wajib, hari ini), `Sumber` (select; bawaan `Google Ads`; opsi `Google Ads`, `WhatsApp`, `Instagram / Facebook`, `Datang langsung`, `Telepon`, `Referensi`, `Pelanggan lama`, `Lainnya`; nilai tersimpan di luar daftar tetap ditambahkan), `Nama pelanggan` (wajib), `No. WA` (inputMode tel), `Alamat`, `Produk yang ditanyakan / dibeli` (placeholder `Contoh: PV BATA 6CM ABU 120M2`), `Status` (chip `Membeli` / `Follow up` / `Tidak membeli`; bawaan `follow_up`), `Nilai penjualan (Rp)` (disabled bila status bukan membeli), `Harga nett (Rp)`, `Harga tawar (Rp)`, `Alasan tidak membeli` (muncul bila status != membeli; chip toggle bertanda `✓ `, multi-pilih, tooltip = hint), `Keterangan`.
- Angka: hanya digit (`replace(/[^\d]/g,"")` lalu `Number`, kosong -> `undefined`); `1.500.000` dan `Rp 1500000` sama-sama 1500000.
- Tombol `Simpan` / `Menyimpan...`; sukses toast `Data konsumen tersimpan`; gagal toast pesan server atau `Gagal menyimpan`.
- `reasons` tetap dikirim walau status sudah diganti ke membeli (state tidak dikosongkan); pembersihan = [server?].

### 1.4 Dialog `Penilaian pembeli`

- Judul `Penilaian pembeli`, subjudul `{name} · {product}`.
- Tiga baris bintang 1–5: `Layanan` (`ratingService`), `Kualitas` (`ratingQuality`), `Kecepatan` (`ratingSpeed`). Klik bintang yang sama = batal (null). Keterangan: `1 Sangat buruk`, `2 Buruk`, `3 Cukup`, `4 Baik`, `5 Sangat baik`; null = `belum dinilai`.
- `Catatan dari pembeli (opsional)` (textarea 2 baris, placeholder `Contoh: pengiriman cepat, sopir ramah`).
- `Keterangan pembeli`: toggle `Puas` / `Komplain` (klik lagi = null).
- Jika `Komplain`: blok merah: `Tanggal komplain` (bawaan hari ini), `Isi komplain` (placeholder `Contoh: paving ada yang retak 20 pcs`), subjudul `Get back (hubungi kembali pembeli)`, `Tanggal get back`, `Tindakan / catatan get back` (placeholder `Contoh: diganti 20 pcs, dikirim ulang 12/10`), `Hasil setelah get back` (toggle `Puas setelah get back` / `Tetap tidak puas`; bantuan `Isi tanggal get back sebelum memilih hasilnya.` selama tanggal kosong).
- Pratinjau (bila N atau kepuasan bukan null): `Nilai bintang: {N} / 100 · Dihitung PUAS|BELUM PUAS di Sasaran Mutu`.
- Validasi klien: komplain tanpa isi -> toast `Tulis isi komplain pembeli`; komplain dengan hasil get back tanpa tanggal get back -> `Isi tanggal get back dulu`.
- Tombol `Simpan penilaian` / `Menyimpan...`; toast `Penilaian tersimpan`.

### 1.5 Prosedur tRPC `customers.*` (semua baru)

| Prosedur | Tipe | Input (kunci objek) | Output yang dipakai UI |
|---|---|---|---|
| `customers.leads` | query | `{ from: "YYYY-MM-DD", to: "YYYY-MM-DD" }` | `Lead[]` urut naik tanggal |
| `customers.saveLead` | mutation (upsert) | `{ id?, contactDate, source, name, phone, address, product, status, saleValue?, priceNett?, priceOffer?, reasons: string[], notes }` | tidak dipakai |
| `customers.rateLead` | mutation | `{ id, ratingService, ratingQuality, ratingSpeed (1..5 atau null), ratingNote (string, boleh ""), feedback ("puas"\|"komplain"\|null), complaintDate?, complaintNote?, getbackDate?, getbackNote?, getbackResult ("puas"\|"tidak_puas"\|null) }` | tidak dipakai |
| `customers.removeLead` | mutation | `{ id }` | tidak dipakai; klien refetch `leads` |
| `customers.importLeads` | mutation | `{ leads: ImportLead[] }` (potongan <= 300 per panggilan) | `{ added: number, skipped: number }` |

Bentuk `Lead` (output `leads`), semua field yang dibaca UI:
`id, contactDate (string YYYY-MM-DD), source, name, phone|null, address|null, product|null, status ("membeli"|"follow_up"|"tidak_membeli"), saleValue|null, priceNett|null, priceOffer|null, reasons: string[], notes|null, ratingService|null, ratingQuality|null, ratingSpeed|null, ratingNote|null, feedback ("puas"|"komplain"|null), complaintDate|null, complaintNote|null, getbackDate|null, getbackNote|null, getbackResult ("puas"|"tidak_puas"|null), getbackByName|null, ratedByName|null`.

Detail kiriman `rateLead` [pasti]: bila feedback bukan komplain, `complaintDate/Note` dan `getbackDate/Note` dikirim `undefined` dan `getbackResult: null`; bila komplain, `getbackResult` dikirim hanya jika `getbackDate` terisi, selain itu `null`.

Kode alasan tidak membeli (`reasons[]`):

| code | label | singkatan | judul kolom Excel impor | hint (tooltip) |
|---|---|---|---|---|
| `harga_mahal` | Harga mahal | HM | `HARGA MAHAL` | Ada kompetitor yang menjual barang sejenis dengan harga lebih murah |
| `min_order` | Min order | MO | `MIN ORDER` | Tidak masuk SOP kiriman pabrik (min 15 m² area Purwakarta & 1 truk luar Purwakarta) |
| `luar_provinsi` | Luar provinsi | LP | `LUAR PROVINSI` | Konsumen berdomisili di luar Jawa Barat |
| `tidak_ada_info` | Tidak ada info | TI | `TIDAK ADA INFO` | Konsumen tidak membalas lagi setelah direspon |
| `tidak_tersedia` | Tidak tersedia | TT | `TIDAK TERSEDIA` | Jenis / ukuran produk yang ditanyakan tidak diproduksi |

Label status: `membeli` = `Membeli`, `follow_up` = `Follow up`, `tidak_membeli` = `Tidak membeli`.

### 1.6 Impor Excel [pasti, logika klien lengkap]

Dialog `Impor file penilaian konsumen`; deskripsi: `Format file "TABEL PENILAIAN KONSUMEN GOOGLE ADS" (satu sheet per bulan). Data yang sudah pernah diimpor tidak dobel dan penilaiannya tidak tertimpa.` Tombol `Pilih file Excel` (`.xlsx,.xls`), pustaka `xlsx` dimuat malas, `sheet_to_json(header:1, blankrows:false, defval:"")`.

Per sheet:
1. Cari di 6 baris pertama sel yang mengandung `PERIODE` (case-insens.); ambil `(NAMABULAN) (4 digit)` di akhir sel (huruf besar). Nama bulan ID/EN: JANUARI/JANUARY ... DESEMBER/DECEMBER (MEI/MAY, AGUSTUS/AUGUST, OKTOBER/OCTOBER). `contactDate = "{tahun}-{bulan 2 digit}-01"`.
2. Baris header = baris pertama yang punya sel `NAMA PELANGGAN`. Sheet tanpa periode atau header -> masuk `skipped`: `{nama sheet} (judul periode / kolom NAMA PELANGGAN tidak ditemukan)`.
3. Kolom dari baris header (cocok persis, huruf besar): `NO`, `NAMA PELANGGAN`, `NO WA`, `ALAMAT`, `NAMA PRODUK`, `PRODUK TERJUAL`, `HARGA NETT`, `HARGA TAWAR`, `KETERANGAN`. Baris SETELAH header = sub-header lima alasan (`HARGA MAHAL` dst.).
4. Data mulai baris header+2, berhenti di baris yang sel mana pun berawalan `JUMLAH`. Baris dipakai bila `NO` hanya digit DAN (ada nama ATAU telepon ATAU produk bukan `-`/`0`/kosong).
5. Pembersihan: spasi dirapikan; `-`, `0`, kosong = kosong. Angka: number > 0 dipakai langsung; teks -> buang non-digit -> Number (0 -> null). Telepon: hanya digit, panjang >= 6, awalan `62` -> `0`, bila tak berawalan `0` ditambah `0`; selain itu null. Nama kosong -> telepon -> `(tanpa nama)`.
6. Status: `PRODUK TERJUAL` berisi angka > 0 atau teks `YES|YA|TERJUAL|CLOSING` -> `membeli` (`saleValue` = angka sel itu); teks mengandung `FOLLOW` -> `follow_up`; ada centang alasan (sel `YES|YA|V|✓|1`) -> `tidak_membeli`; selain itu `follow_up`.
7. `ImportLead` yang dikirim: `{ importKey, contactDate, source:"Google Ads", name, phone, address|null, product|null, status, saleValue|null, priceNett|null, priceOffer|null, reasons: code[], notes|null }`.
   - `importKey = "{YYYY-MM}|{NO}|{(nama||telepon||'').toLowerCase()}"` dipotong 120 karakter; dipakai server untuk anti-dobel.
- Pratinjau: `{file}: {n} konsumen dari {m} bulan ({Bulan Tahun, ...})`, hitungan per status (`Membeli x · Follow up y · Tidak membeli z`), `Sheet dilewati: ...`, tombol `Impor {n} konsumen` / `Mengimpor...`.
- Error: `Tidak ada data konsumen yang terbaca`, `File tidak bisa dibaca`, `Gagal impor`. Sukses: `{added} konsumen ditambahkan` + ` · {skipped} sudah ada (dilewati)`.
- Rating tidak boleh tertimpa saat impor ulang (klaim teks dialog) = [server?].

### 1.7 Ekspor Excel [pasti]

Tombol `Excel` mengekspor daftar TERSARING (chip + cari), urut naik, via `excelRecap`:
- Berkas `Rekap-Pelanggan_{from}_sd_{to}.xlsx`. Judul `Rekap pelanggan & penilaian konsumen`, subjudul `Periode {tgl from} s/d {tgl to}`, sheet tunggal `Rekap pelanggan`, `dateNF dd/mm/yyyy`.
- Aturan `excelRecap(nama, seksi[{title, sheetName, rows[]}], opsi)`: total baris semua seksi <= 60 -> satu sheet berisi seksi berurutan; lebih -> satu sheet per seksi (judul `{title} — {seksi}`), autofilter + baris beku. Header kolom = gabungan kunci objek baris.
- Seksi 1, sheet `Per bulan` (judul `Ringkasan per bulan`): `Bulan` (nama bulan panjang), `Konsumen`, `Membeli`, `Closing (%)` (= `round(membeli/konsumen*1000)/10`, satu desimal), `Follow up`, `Tidak membeli`, `Nilai penjualan (Rp)`, lalu lima kolom bernama label alasan (`Harga mahal`, `Min order`, `Luar provinsi`, `Tidak ada info`, `Tidak tersedia`) berisi jumlah.
- Seksi 2, sheet `Penilaian` (judul `Penilaian pembeli (layanan, kualitas, kecepatan, puas / komplain, get back)`): hanya pembeli yang punya bintang atau feedback. Kolom: `No`, `Tanggal`, `Nama`, `Produk`, `Layanan (1-5)`, `Kualitas (1-5)`, `Kecepatan (1-5)`, `Nilai (0-100)`, `Keterangan` (Puas/Komplain), `Tgl komplain`, `Isi komplain`, `Tgl get back`, `Catatan get back`, `Hasil get back`, `Puas (Sasaran Mutu)` (`Ya`/`Tidak`/kosong), `Catatan`, `Dinilai oleh`.
- Seksi 3, sheet `Konsumen` (judul `Daftar konsumen`): `No`, `Tanggal`, `Sumber`, `Nama pelanggan`, `No WA`, `Alamat`, `Produk`, `Status`, `Nilai penjualan (Rp)`, `Harga nett`, `Harga tawar`, `Alasan tidak membeli` (label dipisah `, `), `Layanan`, `Kualitas`, `Kecepatan`, `Puas/Komplain`, `Hasil get back`, `Keterangan`.
- Kekhasan (kemungkinan bug klien): ringkasan `Per bulan` ikut tersaring chip status/cari sehingga closing bisa menyesatkan.

### 1.8 Perhitungan [pasti]

- Skor bintang `N` = `round(rata-rata bintang non-null * 20)`, skala 0–100; `null` bila ketiganya kosong. (rata 4 -> 80)
- Kepuasan `I`:
  - feedback `komplain` -> `getbackResult === "puas"` (belum di-get back = tidak puas);
  - selain itu bila `N` ada -> `N >= 80`;
  - bila `N` kosong -> `feedback === "puas"` atau `null` (belum dinilai).
  - Feedback `puas` + rata bintang < 4 tetap `false`.
- % closing: kartu = `round(membeli/total*100)` (bulat); Excel = satu desimal.
- Rata-rata per aspek: aritmetika atas pembeli bernilai non-null, `toFixed(1)` koma desimal.
- Nilai penjualan total = jumlah `saleValue` baris `membeli` (null dianggap 0).
- Agregasi per bulan hanya di Excel (`Per bulan`), kunci bulan = `contactDate.slice(0,7)`.

### 1.9 Keterkaitan Sasaran Mutu (IsoRecapPage)

Tipe `auto` baru di daftar 30 sasaran (semua `target: 0.75`, label `≥ 75%`) [pasti, teks]:

| No | Teks | auto | dataSource / catatan |
|---|---|---|---|
| 13 | Chat WhatsApp / telepon direspons ≤ 15 menit pada jam kerja | `leads:chat` + `manualAchieved` | Total = chat konsumen masuk di Rekap Pelanggan; tercapai diisi manual per bulan (dialog: `Jumlah total` = `Otomatis dari data aplikasi`, `Jumlah tercapai` input; tombol baris `Isi tercapai`; `iso.setObjective` dengan `total: null`) |
| 14 | Penawaran harga + ongkir terkirim ≤ 1 hari kerja | `leads:offer` | konsumen yang menanyakan produk vs yang sudah diberi harga (harga nett / membeli) |
| 16 | Pelanggan puas (nilai survei kepuasan ≥ 80 dari 100) | `survey:satisfaction` | pembeli yang dinilai; puas = bintang ≥ 80 atau keterangan Puas; komplain puas hanya bila get back hasilnya puas |
| 20 | Transaksi tanpa keluhan pelayanan (respon lambat, informasi salah) | `leads:noComplaint` | pembeli tanpa keterangan Komplain |
| 22 | Keluhan ditanggapi (respon awal) ≤ 24 jam | `leads:getback24` | pembeli komplain yang di-get back ≤ 1 hari setelah tanggal komplain |

Rumus tepat (total/tercapai, kolom tanggal acuan, periode semester) = [server?]. Tafsiran wajar [tebakan]: bulan = `contactDate`; no.16 total = baris dengan kepuasan non-null, tercapai = kepuasan `true`.

Delta lain di sasaran: no.8 dataSource `Pengiriman selesai; tepat waktu = tiba di lokasi paling lambat tanggal kirim yang diminta`; no.28/29 `(metode Cor)` / `(metode Tumbuk)` (dulu berbasis kata "tumbuk" di spesifikasi). Target seragam 75%.

---------------------------------------------------------------------

## 2. RECEIPT RATINGS (`ReceiptRatings-*.js`, `ReceiptsPage-*.js`, `SandRecordsPage-*.js`)

Chunk `ReceiptRatings` = modul bersama (`SpeedChip`, `PriceChip`, `OverallBadge`, `DeliveryDialog`, `PriceDialog`, bobot/grade); setara `components/ReceiptRatings.tsx` lama. Perubahan fungsinya kecil.

### 2.1 Yang TIDAK berubah (identik sumber lama) [pasti]

- Bobot `quality 40 / speed 30 / price 30`; `qualityPoints = round((4-tier)/3*100)`; `threeLevelPoints = (r-1)/2*100`; `overall = round(Σ nilai*bobot / Σ bobot terisi)`; `complete` bila ketiganya ada. Grade `A>=80 Sangat baik`, `B>=60 Baik`, `C>=40 Cukup`, `D>=0 Kurang`.
- Kecepatan `3 Cepat / 2 Standard / 1 Lambat`; harga `3 Affordable / 2 Sedang / 1 Mahal`; tier `1 Bagus / 2 Banyak brangkal / 3 Banyak lumpur / 4 Brangkal & lumpur`; patokan lumpur `<=5% bagus`, `<=10% cukup`, selainnya lewat.
- `receipts.evaluateDelivery/evaluatePrice/evaluateQuality/create/list/remove/sources` tetap dengan nama sama.
- Dialog `Nilai pengiriman (kantor)` (tag, jumlah+satuan, `Dikirim oleh`, `Kecepatan pengiriman`, `Keterangan pengiriman`, tombol `Simpan penilaian pengiriman`) dan `Nilai harga` (`Harga`, `Keterangan harga (opsional)`, `Simpan penilaian harga`, disabled sampai ada pilihan).
- Izin tombol: nilai kirim = superadmin/admin; nilai harga = `user.canRatePrice`; nilai tier QC = `qc|superadmin`; hapus = kantor, atau pembuat dalam 24 jam.

### 2.2 Yang BARU / berubah [pasti]

1. **Moda kirim ketiga `sendiri`.** `DELIVERY_MODES = ["quarry","ekspedisi","sendiri"]`; label `quarry` -> `Dikirim oleh supplier / quarry` (dulu `Vendor quarry / supplier`), `ekspedisi` -> `Ekspedisi pihak ketiga`, `sendiri` -> `Diambil sendiri (armada Istana Block)`. Dialog `Dikirim oleh` kini 3 kolom (dulu 2). Tampilan ringkas: `ekspedisi` -> `{nama||"Ekspedisi"} (ekspedisi)`; `sendiri` -> `Diambil sendiri (armada Istana Block)`; `quarry` -> `Dikirim oleh supplier / quarry`. Di Catatan Bahan Baku: `Armada Istana Block (ambil sendiri)`; Excel kolom `Via armada quarry`, `Via ekspedisi`, `Diambil sendiri`. `expeditionName` hanya wajib untuk `ekspedisi` (`Isi nama ekspedisi`).
2. **Form catat barang masuk**: bidang `Quarry (asal tambang)` DIHAPUS; `receipts.create` mengirim `quarry: undefined`. Label `Supplier / quarry` (bahan baku) atau `Supplier / toko` (barang lain). Teks: `Terima barang masuk`, `Catat setiap barang yang datang: jenis, jumlah, dan foto muatan / surat jalan.`, toggle `Bahan baku (pasir, abu batu, ...)` / `Barang lain (semen, besi, ...)`, `Tag (kategori inventory)` (placeholder `Contoh: Pasir Cimalaka`), `Plat truk`, `Sopir`, `No. surat jalan`, `Ada banyak brangkal (batu / kerikil besar)?` (`Tidak` / `Ya, banyak brangkal`), `Foto barang / muatan / surat jalan (maks. 3)`, `Status` (`Diterima` / `Ditolak / dikembalikan`), tombol `Simpan barang masuk`. Tanpa foto: konfirmasi `Belum ada foto barang. Tetap simpan?`. Setelah simpan bahan baku: tombol `Mulai uji lumpur` -> `/uji-pasir?barang={id}`.
3. **Skip uji lumpur** pada kartu: bahan baku belum diuji tetapi ada `testSkippedAt` -> `Tanpa uji lumpur — {level} — {alasan}`; level `tidak` = `Tidak berlumpur`, `sedikit` = `Lumpur sedikit`, `sedang` = `Lumpur sedang`. Field baru `receipts.list`: `testSkippedAt, testSkipLevel, testSkipReason, testSkippedByName`. Pengisian lewat `sand.skipTest` (bagian 4).
4. **Catatan Bahan Baku (SandRecordsPage)**: periode bawaan `3 bulan` (chip `Bulan ini` / `3 bulan` / `Tahun ini` + 2 input date). Kartu `Peringkat nilai overall` (batang 0–100, garis putih di 40/60/80, batang pudar = sementara, tooltip `Kualitas x · Kecepatan y · Harga z`), kurva BARU `Kurva nilai overall per bulan (N supplier dengan penilaian terbanyak)` (SVG, maks 4 supplier terbanyak kiriman dinilai; titik per bulan = `overall` gabungan baris supplier itu di bulan tsb; muncul bila >= 2 bulan, selain itu `Kurva muncul bila periode berisi penilaian minimal 2 bulan — pilih "3 bulan" atau "Tahun ini".`), kelompok grade A–D, filter chip bahan & tag, kartu `Nilai overall rata-rata`, `{n} belum tier QC · {m} belum nilai kirim · {k} belum nilai harga`, `Lewat batas 10%`, tombol `Cetak ringkasan` dan `Excel`. Semua dihitung di klien dari `receipts.list({from,to,category:"bahan_baku"})` + `receipts.sources`; tidak ada prosedur baru.
5. Dialog QC tier (evaluateQuality): pilihan `Tier {n} · {label}`, saran `(saran dari hasil uji: Tier x)`, centang `Banyak brangkal (batu / kerikil besar)`, `Keterangan material / supplier` (placeholder `Contoh: butiran halus, pasir basah, banyak batu besar, warna gelap.`), tombol `Simpan tier`.
6. Excel barang masuk `Barang-Masuk_{from}_sd_{to}.xlsx`: kolom `Dikirim oleh` memuat label moda baru; `Nilai overall` & `Grade` dihitung klien.

### 2.3 tRPC `receipts.*`

| Prosedur | Input | Catatan |
|---|---|---|
| `receipts.create` | `receivedAt: Date, category: "bahan_baku"\|"lainnya", itemName, quantity (>0), unit, tag?, supplier?, quarry? (kini selalu undefined), vehiclePlate?, driverName?, deliveryNoteNo?, deliveryMode? ("quarry"\|"ekspedisi"\|"sendiri"), expeditionName?, hasBrangkal? (hanya bahan baku), status ("diterima"\|"ditolak"), notes?, photos[]` | output `{id}`; maks 3 foto |
| `receipts.evaluateDelivery` | `{ id, deliveryMode, expeditionName?, speedRating? (1..3), deliveryNote?, tag?, quantity?, unit }` | mode wajib; ekspedisi wajib nama |
| `receipts.evaluatePrice` | `{ id, priceRating (1..3), priceNote? }` | |
| `receipts.evaluateQuality` | `{ id, tier (1..4), qualityNote?, hasBrangkal? }` | |
| `receipts.list` | `{ from: Date, to: Date, category? }` | output tambahan baru: `testSkippedAt, testSkipLevel, testSkipReason, testSkippedByName`; selebihnya seperti lama (`test`, `tier`, `tierConfirmed`, `*ByName`, `photoUrls`, ...) |
| `receipts.sources` | tanpa | `{ suppliers, quarries, expeditions, tags, otherItems }` |
| `receipts.remove` | `{ id }` | |

---------------------------------------------------------------------

## 3. PRODUCT SPECS TAB (`ProductSpecsTab-*.js`) dan tab `Uji mutu` (`QcPage-*.js`)

### 3.1 Tab QC [pasti]

Halaman `QC, Produksi & Uji Mutu` (route `/qc`, peran superadmin/admin/qc), H1 `Mix desain & uji kuat tekan`. Tab (bawaan `mix`): `Mix desain harian`, `Uji kuat tekan`, **`Uji mutu`**, **`Spesifikasi produk`**, `Template` (+ ` (n)` bila ada diajukan), `Rekap`. `ProductSpecsTab` dipasang dengan `canEdit: true` tetap (tak digerbangi peran di klien).

**Tab `Uji mutu`** = panel formulir ISO **F-IB-04** (`FormPanel` dari IsoRecapPage) dengan pemilih periode `Minggu ini` / `Minggu lalu` / `Bulan ini` + dua input date `s/d` (bawaan bulan berjalan). Isi: tabel `HASIL UJI MUTU PRODUK (KUAT TEKAN & PENYERAPAN AIR)` (klausul 8.6), kolom sama dengan Rekap Form ISO; tombol khusus F-IB-04 untuk peran input: `Input uji serap paving` (form baris baru dengan nilai awal `jenisUji: "Serapan Air"`, `produk: "Paving "`, `lab: "Internal"`), `Preview & cetak`, `F-IB-04.xlsx`. Rumus kolom abu-abu: Serapan Air hasil = `(beratBasah - beratKering) / beratKering * 100` (%); Kuat Tekan hasil = `beban(kN) * 10 / luas(cm²)` (MPa); `kgcm2 = MPa * 10,197`; `Umur` = selisih hari tanggalProduksi ke tanggalUji. Panggilan: `iso.rows` (paging `offset`/`nextOffset`), `iso.suggestions`, `iso.save`, `iso.supplement`, `iso.remove`, `iso.overview` (semua ada di sumber lama; bukan prosedur baru).

### 3.2 Tab `Spesifikasi produk`

Teks pembuka: `Berat dan spesifikasi tiap ukuran (data awal dari flyer Buis Beton, U-Ditch, dan Genteng Beton). Pilihan ini muncul saat mandor / QC menginput hasil produksi, beserta perkiraan berat total.`

Tombol atas: `Cetak` (pratinjau lanskap), `Excel` (keduanya disabled bila 0 spesifikasi), `Tambah spesifikasi` (bila `canEdit`).

Satu kartu per kategori: `{label} ({jumlah})` + tombol `Ukuran` (ikon plus) per kategori. Kategori (key -> label): `paving` Paving, `genteng` Genteng Beton, `buis` Buis Beton, `tutup_buis` Tutup Buis Beton, `kanstin` Kanstin, `uditch` U-Ditch, `tutup_uditch` Tutup U-Ditch, `greffel` Greffel, `grass` Grass Block (`lainnya` dikecualikan). Kosong: `Belum ada spesifikasi.`; memuat: `Memuat...`.

Tabel kolom: `Ukuran / tipe` (nama tebal + pil varian + catatan kecil), `Berat` (rata kanan), `Spesifikasi` (pil `kunci: nilai`), kolom aksi (pensil `Ubah`, sampah `Hapus` dengan konfirmasi `Hapus {label kategori} {nama}?`). Baris tak aktif pudar.

Format berat: null -> `-`; `>= 1000` -> `{x/1000, maks 3 desimal} ton`; selain itu `{x, maks 3 desimal} kg` (lokal id-ID).

Form `Tambah spesifikasi` / `Ubah spesifikasi` (dialog): deskripsi `Ukuran / tipe ini muncul sebagai pilihan saat input hasil produksi, beserta beratnya.`
- `Kategori` (select; bawaan `uditch`; ganti ke selain `buis` mengosongkan `variant`).
- `Ukuran / tipe` (wajib, placeholder `Contoh: 40×40×120 (cm)`).
- Kategori `buis`: `Metode` (select `-`, `Tumbuk`, `Cor`, `Tulangan`; tersimpan di `variant` = `tumbuk|cor|tulangan`); kategori lain: `Varian (opsional)` teks bebas (placeholder `Contoh: HD, warna`).
- `Berat per buah (kg)` (desimal, koma boleh; harus > 0, selain itu toast `Berat harus angka (kg)`).
- `Spesifikasi lain`: baris `Nama (mis. Tebal)` / `Nilai (mis. 70 mm)`, tombol hapus baris (aria `Hapus baris`), `Baris` (tambah); baris awal bawaan kunci `Mutu`. Dikirim sebagai objek `{ [kunci.trim()]: nilai.trim() }`, baris kosong dibuang.
- `Catatan`; centang `Aktif (tampil sebagai pilihan saat input produksi)`.
- Tombol `Simpan` / `Menyimpan...`; toast `Spesifikasi tersimpan`, `Dihapus`.

Cetak (lanskap): judul `Spesifikasi & Berat Produk`, subjudul `Per {tanggal panjang id-ID}`, satu seksi per kategori berisi spesifikasi AKTIF saja, kolom `Ukuran / tipe` (16%), `Varian`, `Berat / buah` (kanan), `Spesifikasi` (52%, `kunci: nilai` dipisah baris), `Catatan`; catatan kaki `Ukuran U-Ditch & cover dalam centimeter. Dimensi dapat disesuaikan permintaan.`

Excel `Spesifikasi-Produk.xlsx` (judul `Spesifikasi & berat produk`, sheet tunggal `Spesifikasi produk` bila <= 60 baris, kalau tidak satu sheet per kategori bernama label kategori): kolom `No`, `Ukuran / tipe`, `Varian` (label metode untuk buis), `Berat (kg)`, lalu kolom dinamis dari semua kunci `specs`, `Catatan`, `Status` (`Aktif`/`Nonaktif`); baris tak aktif ikut.

Pemakaian di halaman lain [pasti]: `ProductionPage` memanggil `production.specs`, memfilter `isActive && line === kunci lini && (bukan buis, atau variant cocok metode)`, mencocokkan nama dengan isian `spec`, lalu menampilkan `Berat {x} / buah` dan total = `weightKg * jumlah` (tidak untuk satuan `m`). Spesifikasi dengan `specs.Varian === "Spesial"` diberi tanda `★ Spesial`.

### 3.3 Prosedur

| Prosedur | Tipe | Input | Output |
|---|---|---|---|
| `production.specs` | query | tanpa | `Spec[]`: `{ id, line, name, variant|null, weightKg|null, specs: Record<string,string>, notes|null, isActive }` |
| `production.saveSpec` | mutation (upsert) | `{ id?, line, name, variant (string, "" bila kosong), weightKg?, specs: Record<string,string>, notes (string), isActive }` | tak dipakai |
| `production.removeSpec` | mutation | `{ id }` | tak dipakai; klien refetch `specs` |

---------------------------------------------------------------------

## 4. Perubahan sekitar yang ikut terlihat (di luar tiga fitur, tetapi terkait)

- `iso.arrivals` (query `{from,to}`) dan `iso.correctArrival` (mutation `{ deliveryId, arrivedAt: Date|null, reason }`, alasan min. 10 huruf, `null` = batalkan koreksi). Dialog `Pengiriman tepat waktu` (Sasaran no.8): baris `{ id, poNumber, customer, driver, requested, arrivedAt, completedAt, onTime, arrivalCorrectedAt, arrivalCorrectedByName, arrivalCorrectionMadeAt, arrivalCorrectionReason }`; tombol `Koreksi` hanya bila `user.canCompleteOrders`.
- `sand.skipTest` `{ receiptId, level?: "tidak"|"sedikit"|"sedang", reason? }` (tanpa `level` = batalkan skip; toast `Uji lumpur dilewati` / `Dikembalikan ke daftar yang perlu diuji`; UI `Pilih kondisi lumpur: Tidak berlumpur / Lumpur sedikit / Lumpur sedang`, tombol `Simpan skip`), `sand.skipped` (query `{from,to}`), `sand.editResult` (`{ id, readingUnit, sandHeightCm, siltHeightCm, decision, photo?, reason (min 5 huruf), ... }` -> `{ siltPercent, ackReset }`), `sand.ackSecretary/ackManager/ackLeader`. "Sekretaris" = username dalam daftar `["arel"]`.

---------------------------------------------------------------------

## 5. Daftar prosedur tRPC baru

Cakupan tiga fitur: `customers.leads`, `customers.saveLead`, `customers.rateLead`, `customers.removeLead`, `customers.importLeads`, `production.specs`, `production.saveSpec`, `production.removeSpec`.
Terkait: `iso.arrivals`, `iso.correctArrival`, `sand.skipTest`, `sand.skipped`, `sand.editResult`, `sand.ackSecretary`, `sand.ackManager`, `sand.ackLeader`.
Di luar cakupan (dari diff nama saja): `calendar.signAttendance`, `monitor.loadItems/stockOptions/stockOut/updateLoad`, `operations.revertDelivery`, `production.createBatch/updateBatch/removeBatch/ackRejectLeader/ackRejectManager/pavingFromMixLogs`, `reports.deliveries`, `stock.options/paint/paintings/removePaint/saveCount/summary`.
Prosedur lama yang tak lagi dipanggil klien: `production.create/list/remove/update` (pada bagian ProductionPage ada `production.create/update` masih dipakai di satu dialog; belum tuntas dipetakan), dan `sand.complete/deleteDraft/start` (cek ulang di SandTestPage).

---------------------------------------------------------------------

## 6. Dugaan skema D1 [tebakan, gaya camelCase seperti `goodsReceipts`]

### 6.1 `customerLeads` (baru)

Jangan memakai `customers`/`customerAddresses` (sudah milik tabel PO). Dugaan kolom:

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | integer PK autoinc | |
| `importKey` | text, unique index (nullable) | kunci anti-dobel impor |
| `contactDate` | text `YYYY-MM-DD` | baris impor: tanggal 1 bulan |
| `source` | text not null default `Google Ads` | |
| `name` | text not null | |
| `phone`, `address`, `product`, `notes` | text | |
| `status` | text enum `membeli,follow_up,tidak_membeli` not null | bawaan `follow_up` |
| `saleValue`, `priceNett`, `priceOffer` | integer (Rupiah) | |
| `reasons` | text mode json `string[]` default `'[]'` | |
| `ratingService`, `ratingQuality`, `ratingSpeed` | integer 1–5 | |
| `ratingNote` | text | |
| `ratedBy` (FK users), `ratedAt` | integer | -> `ratedByName` lewat join |
| `feedback` | text enum `puas,komplain` | |
| `complaintDate`, `getbackDate` | text `YYYY-MM-DD` | |
| `complaintNote`, `getbackNote` | text | |
| `getbackResult` | text enum `puas,tidak_puas` | |
| `getbackBy` (FK users) | integer | -> `getbackByName` |
| `createdBy`, `createdAt`, `updatedAt` | seperti tabel lain | |

Indeks dugaan: `(contactDate)`, `(status)`.

### 6.2 `productSpecs` (baru)

`id` PK; `line` text (`paving|genteng|buis|tutup_buis|kanstin|uditch|tutup_uditch|greffel|grass`); `name` text not null; `variant` text (buis = `tumbuk|cor|tulangan`); `weightKg` real; `specs` text mode json `Record<string,string>` default `'{}'`; `notes` text; `isActive` boolean default true; `createdAt`, `updatedAt`. Indeks `(line, name)`.

### 6.3 Perubahan tabel lama

- `goodsReceipts`: enum `deliveryMode` + `"sendiri"` (enum aplikasi, tanpa DDL); kolom baru `testSkippedAt` (ts), `testSkipLevel` (text `tidak|sedikit|sedang`), `testSkipReason` (text), `testSkippedBy` (FK users) -> `testSkippedByName`. `quarry` mungkin masih ada.
- `deliveries`: `arrivalCorrectedAt`, `arrivalCorrectedBy`, `arrivalCorrectionMadeAt`, `arrivalCorrectionReason` (jam asli `arrivedAt` tetap tersimpan).
- `sandTests`: kemungkinan jejak edit hasil (`editedAt/By/Reason`) dan `secretaryAckName/At/Signature` (selain `managerAck*`, `leaderAck*` yang tampil di `sandDocuments`).
- `isoRecords` (F-IB-16 `kind="objective"`): tak berubah; target 75% kemungkinan konstanta kode `shared/isoObjectives.ts`, bukan data.

---------------------------------------------------------------------

## 7. Tidak bisa diketahui dari klien (logika server / data)

1. Izin tiap prosedur `customers.*`, `production.*Spec`; apakah `rateLead` menolak baris non-membeli.
2. Cara server menghitung `added` / `skipped` impor: apakah `importKey` unik; impor ulang memperbarui kolom lain atau mengabaikan seluruhnya; batas panjang string.
3. Urutan & batas baris `customers.leads` (klien mengandaikan naik menurut `contactDate`, tie-break tak diketahui).
4. Normalisasi `phone` di server, pembersihan `reasons` saat status membeli, validasi `getbackDate >= complaintDate`.
5. Pengisi `ratedBy/ratedAt/getbackBy` (dari sesi) dan pencatatan ke `activityLogs`.
6. Rumus pasti Sasaran Mutu `leads:chat|offer|noComplaint|getback24` dan `survey:satisfaction`: kolom tanggal acuan, definisi "sudah diberi harga" (`priceNett` atau `priceOffer`), "1 hari" (kalender vs hari kerja), perlakuan semester; apakah total `leads:chat` = jumlah lead bulan itu.
7. Isi awal (seed) `productSpecs`: hanya tertulis "data awal dari flyer Buis Beton, U-Ditch, dan Genteng Beton"; angka berat, nama ukuran, kunci spesifikasi (`Mutu`, `Tebal`, `Varian`, ...) hanya dari backup `.sql`.
8. Aturan unik/bentrok `productSpecs`, apakah `removeSpec` menolak bila dipakai produksi, validasi `line`.
9. Pemetaan `deliveryMode = "sendiri"` ke penilaian vendor F-IB-08/F-IB-09 dan perlakuan `speedRating` armada sendiri.
10. DDL migrasi sebenarnya (0021 dst.), indeks, nama kolom persis.
11. Akun/flag produksi (`canViewSummary`, `canRatePrice`, `canCompleteOrders`) yang menentukan siapa melihat menu dan tombol.

## 8. Celah terbesar yang hanya bisa ditutup backup .sql atau tebakan

1. Seed `productSpecs` dan seluruh isi `customerLeads` (riwayat impor, rating) hanya ada di D1 produksi.
2. DDL asli (nama tabel `customerLeads` / `productSpecs` hanya tebakan; kolom, indeks, unik `importKey`).
3. Logika server: izin per prosedur, anti-dobel impor, rumus lima sasaran mutu otomatis baru.
4. Perilaku `sendiri` pada penilaian vendor F-IB-08 dan peringkat supplier.
5. Data pengguna/flag yang menentukan siapa memakai tiap menu/tombol.
