# Spek rekonstruksi: Stok Barang, Cat Genteng, Hasil Produksi, Peta API tRPC (bundel live 2026-10-26)

Sumber: bundel minified `bundel-2026-10-26/` vs. sumber lama 18 Okt (`istana-block-inventori-ops`).
Tanda: **[pasti]** = terbaca langsung di klien; **[tebakan]** = disimpulkan; **[server?]** = tidak bisa diketahui dari klien.
Catatan teknis: teks mojibake (`Â²`, `Ã—`, `âˆ’`) di keluaran konsol hanya salah tampil UTF-8; aslinya `m²`, `×`, `−`.
Bundel TIDAK lengkap: chunk `xlsx-Bv_pSZNU.js` (impor Excel di CustomersPage) tidak ikut terunduh.

---------------------------------------------------------------------------------------------------
## 0. Menu & izin yang terlihat (DashboardLayout + rute di index)

Menu baru/berubah dibanding sumber lama:
| Label menu | Path | Peran (rute) | Catatan |
|---|---|---|---|
| Stok Barang | `/stok` | superadmin, admin, qc, mandor, satpam | `StockPage` |
| Rekap Pelanggan | `/rekap-pelanggan` | rute: superadmin, admin; menu tampil bila peran itu ATAU `canViewSummary` | `CustomersPage` (bab 5) |
| QC, Produksi & Uji Mutu | `/qc` | superadmin, admin, qc | label lama "QC & Produksi"; tab baru "Spesifikasi produk" |
Label lain tak berubah: Ringkasan, Laporan Pimpinan, Muatan & Tugas Sopir, Barang Masuk, Uji Lumpur, Catatan Bahan Baku, Hasil Produksi (`/produksi`: superadmin, admin, qc, mandor), Kalender, Rekap Form ISO, Pengguna, Keamanan Data.

Flag izin per-akun di `auth.me`: TIDAK ada flag baru. Dipakai ulang: `canApproveQc` (= "Manager in charge"), `canSignAsLeader` (= "Pimpinan"), `canCompleteOrders` (kantor berwenang), `canViewSummary`, `canViewSandTests`, `canRatePrice`.

Izin di klien untuk fitur stok/produksi [pasti, sisi klien; server mungkin sama/lebih ketat]:
- Lihat Stok Barang: 5 peran di atas.
- Tombol "Stok opname" (header + "Opname" per kelompok): superadmin, admin, qc.
- "Cat genteng" + hapus catatan cat di /stok: superadmin, admin, qc, mandor. Di /produksi tombol "Cat genteng" muncul bila kategori `precast` ada di jatah user (admin/mandor); hapus catatan cat di sana: admin ATAU `createdBy == user.id`.
- Konfirmasi muat ("Sudah dimuat" / "Ubah jumlah muat"): peran monitor lama (superadmin, admin, mandor, satpam) [tebakan dari rute `/muatan`].
- Hasil Produksi: admin/superadmin input `precast` dan `paving`; `qc` hanya `paving`; `mandor` hanya `precast`. Ubah/hapus baris: admin selalu; peran lain hanya baris buatan sendiri, umur < 7 hari (`6048e5` ms), kategori ada di jatahnya.
- TTD ketidaksesuaian: "TTD Manager in charge" butuh `canApproveQc`; "TTD Pimpinan" butuh `canSignAsLeader`.
- Koreksi jam tiba (`iso.correctArrival`) & batalkan status Selesai/Sampai (`operations.revertDelivery`): `canCompleteOrders`.

---------------------------------------------------------------------------------------------------
## 1. STOK BARANG (`/stok`)

### 1.1 Layar & label PERSIS (StockPage)
Header: kicker "Stok"; judul "Stok barang jadi"; teks "Sisa = stok opname + hasil produksi Grade A − barang dimuat. Barang yang dimuat mengurangi stok sesuai jenis yang dipilih saat "Sudah dimuat"."
Tombol: "Cetak", "Excel", "Cat genteng", "Stok opname".
Banner kuning bila `summary.started == false`: "**Stok belum dimulai.** Lakukan **stok opname** pertama (hitung fisik di gudang) supaya sisa stok akurat. Sebelum itu angka di bawah hanya produksi − muatan yang tercatat di aplikasi."
Banner merah bila `summary.unassigned.length > 0`: "N muatan belum dipilih jenis stoknya" + maks 6 item `"{poNumber} ({productName})"` dipisah " · ", lalu "— buka **Muatan** lalu "Ubah jumlah muat"." (tautan `/muatan`).
Filter chip: "Semua" + satu chip per `line` yang ada di data. Tiap kelompok = Card berjudul nama kelompok + tombol "Opname" (peran opname saja).
Baris stok: judul = label tanpa awalan nama kelompok; label berbentuk `(Metode) ukuran` ditampilkan `ukuran · Metode`. Subbaris: "Opname {qty} ({tgl})" atau "Belum opname" (amber); " + produksi {produced}" (hijau); " − dimuat {loaded}" (rose); bila `painted != 0`: " +/− dicat {abs}" (violet); bila `gradeB`: " · Grade B {gradeB}" (amber, info saja). Kanan: `balance` besar + `unit`; **merah bila balance < 0**.
Kartu "Riwayat cat genteng" (di filter Semua/genteng bila ada data): baris "`{tipe}` → `{warna}` · {qty} buah", sub "{tgl} · {movedByName} · {note}", tombol "Hapus" → confirm "Hapus catatan cat ini?" → `stock.removePaint({id})`.
Dialog "Stok opname": deskripsi "Isi jumlah fisik yang ada di gudang. Stok jenis tersebut dihitung ulang mulai dari angka ini. Kosongkan jenis yang tidak dihitung." Chip kelompok (semua kelompok + paving), "Waktu hitung" (datetime-local, default sekarang), daftar jenis kelompok terpilih: nama, "Di aplikasi: {balance} {unit}", input desimal (placeholder "-") + satuan; "Catatan (opsional)" placeholder "Mis. opname akhir bulan"; tombol "Simpan stok opname". Validasi: kosong = dilewati; non-angka/negatif → toast "Jumlah harus angka (0 atau lebih)"; semua kosong → "Isi jumlah fisik minimal satu jenis"; sukses "Stok opname tersimpan (N jenis)". Kelompok tanpa jenis: "Belum ada jenis untuk kategori ini."
Cetak: "Laporan Stok Barang Jadi", subjudul "Per {tanggal-jam}"; per kelompok kolom: Jenis | Stok opname | Produksi | Dicat (+/−) | Dimuat | Sisa stok | Satuan; catatan kaki "Sisa = stok opname + produksi Grade A ± cat genteng − barang dimuat. Jenis yang belum opname dihitung dari data aplikasi saja."; TTD "Dihitung oleh, QC / Gudang", "Diperiksa, Manager in charge", "Mengetahui, Pimpinan". Judul cetak "Stok Barang {yyyy-mm-dd}".
Excel `Stok-Barang-{yyyy-mm-dd}.xlsx`, sheet "Stok", judul "STOK BARANG JADI", kolom: No, Kategori, Jenis, Satuan, Stok opname, Tanggal opname, Produksi (Grade A), Dicat (+/−), Dimuat (keluar), Sisa stok, Grade B (info).

### 1.2 Kelompok barang (`line`) dan satuan
Konstanta di klien (`goods-*.js`), key → label: `paving`=Paving, `genteng`=Genteng Beton, `buis`=Buis Beton, `tutup_buis`=Tutup Buis Beton, `kanstin`=Kanstin, `uditch`=U-Ditch, `tutup_uditch`=Tutup U-Ditch, `greffel`=Greffel, `grass`=Grass Block, `lainnya`=Lainnya (10 key; kategori produksi: paving→`paving`, sisanya `precast`).
Satuan: paving `m²`; precast `buah` / `m`; `unit/pcs/pc/bh` dinormalkan jadi `buah` (fungsi `s`). (Satuan bahan barang masuk beda: sak, kg, ton, liter, batang, pcs, unit, m³.)
**22 kelompok**: BUKAN daftar tetap di klien; diturunkan dari `stock.options` / `stock.summary.rows[].key`. [server?] Nama persis + satuan 22 jenis hanya bisa diambil dari respons live. Dugaan [tebakan]: jenis paving = Model×Ukuran×Warna (Bata 6 cm/8 cm, Ubin 21×21/30×30, Hexagon Utuh/Setengah (trapesium); warna Abu natural/Merah/Hitam) dan jenis non-paving dari `productSpecs` aktif + genteng per tipe × warna (Natural/Hitam/Merah). Konstanta `paving-*.js`:
- Model `bata` ("Bata": "6 cm","8 cm"), `ubin` ("Ubin": "21×21","30×30"), `hexagon` ("Hexagon": "Utuh","Setengah (trapesium)"); warna "Abu natural","Merah","Hitam".
- Nama jenis paving: `"{Label} {ukuran} · {warna}"`, mis. "Bata 6 cm · Abu natural".
- Hexagon "Utuh" berwarna punya pasangan "Hexagon Setengah (trapesium) · {warna}" (untuk hasil belahan).

### 1.3 Format kunci stok (`key`) [pasti dari fungsi `a` di stock-*.js]
`key = "{line}|{spec dinormalkan}|{metode?}"`; normalisasi spec: `(\d)\s*[xX*]\s*(?=\d)` → `$1×`.
- Genteng: `genteng|{tipe} · {warna}|`, warna ∈ Natural/Hitam/Merah (parser `s(key)` → `{type,color}`, default "Natural").
- Paving: `paving|{Model ukuran · Warna}|`.
- Lain (buis dst.): `{line}|{ukuran/tipe}|{metode}` [tebakan: bagian ke-3 = tumbuk|cor|tulangan untuk buis].
- Nilai khusus `none` = opsi "Bukan dari stok produksi" (tak mengurangi stok).
Label dari server mengikuti `h()` di goods: `"{Label kelompok}[ ({Metode})] {spec}"`, metode Tumbuk/Cor/Tulangan; kelompok `lainnya` memakai nama produk bebas.

### 1.4 Aturan pemetaan nama produk → jenis stok (di KLIEN, `stock-*.js` fungsi `d`)
Dipakai untuk **pra-isi dropdown "Diambil dari stok"** pada dialog muat (user bisa ubah). Teks `c = lowercase("{productName} {spec}")`. Regex berurutan, pertama cocok menang:
1. tutup_uditch `/tutup\s*u-?\s*ditch/` · 2. tutup_buis `/tutup\s*buis/` · 3. uditch `/u-?\s*ditch/` · 4. buis `/buis/` · 5. genteng `/genteng|nok/` · 6. kanstin `/kanstin|kansteen/` · 7. greffel `/gref+el|gravel/` · 8. grass `/gras+\s*bl?ok/` · 9. paving `/paving|bata|ubin|hexa|segi ?enam/`.
Normalisasi pembanding `l(x)`: lowercase, hapus spasi, `[x×*]`→`x`, hapus `.`.
- Genteng: tipe unik dari options `line=genteng`, urut panjang turun, ambil tipe pertama yang `l(tipe)` termuat di `l(c)`; warna: `hitam`→Hitam, `merah`→Merah, selain itu Natural → key `genteng|{tipe} · {warna}|`; tak ada tipe cocok → kosong.
- Paving (parser di paving-*.js): batal bila ada `gras`; model `ubin`→ubin, `hexa|segi ?enam`→hexagon, `bata|paving`→bata; ukuran bata `8\s*cm`/`6\s*cm`, ubin `30`/`21`, hexagon `setengah|belah|trapes`→Setengah (trapesium) selain itu Utuh; warna `merah|hitam|abu|natural`. Hanya jadi key bila model+ukuran+warna lengkap.
- Kelompok lain: kandidat = options satu `line`; pilih yang bagian spec-nya (dipecah ` · ` + utuh) memuat token >2 huruf yang termuat di nama; bila tepat 1 → itu; selain itu bila line hanya punya 1 opsi → itu; selain itu kosong (muatan jadi `unassigned`).
Pemetaan **produksi → kelompok**: klien mengirim `category/product/method/spec`; fungsi `M()` di ProductionPage (kategori→kelompok, paving bila category=paving, selain itu cocokkan `product` dengan nama kelompok, fallback "Lainnya"). Penurunan `key` dari baris produksi terjadi di server [server?].

### 1.5 Rumus sisa
Teks UI [pasti]: `balance = stok opname + hasil produksi Grade A − barang dimuat ± cat genteng`.
- `produced` = Σ `quantity` (Grade A) jenis itu; **Grade B tidak masuk** (info), reject tidak masuk.
- `loaded` = Σ jumlah dimuat (`loadedQuantity`, default = jumlah pesanan) dengan `stockKey` jenis itu; PO dibatalkan tak dihitung (panel Barang keluar klien membuangnya; untuk stok [tebakan]).
- `painted` = + untuk `toKey` (warna), − untuk `fromKey` (natural).
- `opname` = opname TERAKHIR jenis itu `{quantity,countedAt}`; "dihitung ulang mulai dari angka ini" ⇒ `produced/loaded/painted` hanya kejadian setelah `countedAt` [tebakan kuat; **[server?]** pembanding tanggal produksi (disimpan jam 12:00) vs `countedAt` datetime]. Belum opname: dasar 0 dan banner "Stok belum dimulai".
- Minus wajar (muatan dicatat sebelum produksi); tak ada pemblokiran stok negatif kecuali konfirmasi di Cat genteng.
Input angka klien: format Indonesia (`1.234,5`), titik dibuang, koma→titik, ≥ 0.

### 1.6 Prosedur
| Prosedur | Input | Output (kunci terlihat) |
|---|---|---|
| `stock.summary` (query) | – | `{ started, rows:[{key,line,label,unit,opname:{quantity,countedAt}\|null,produced,painted,loaded,gradeB,balance}], unassigned:[{poNumber,productName,…}], paintings:[{id,fromKey,toKey,quantity,movedAt,movedByName,note}] }` |
| `stock.options` (query) | – | `[{key,line,label,unit}]` |
| `stock.saveCount` | `{ countedAt, note?, items:[{key,quantity≥0}] }` | `{ saved:number }` |
| `stock.paint` | `{ type, color:"Hitam"\|"Merah", quantity>0, movedAt, note? }` | `{ label }` |
| `stock.paintings` | `{ from, to }` | array seperti `paintings` (+`createdBy`) |
| `stock.removePaint` | `{ id }` | – |

### 1.7 Dugaan skema D1 [tebakan]
- `stockCounts` (id, stockKey, quantity, countedAt, note, countedBy→users, createdAt) — atau header+item; tersimpan "per jenis".
- `stockPaintings` (id, fromKey, toKey, quantity, movedAt, note, movedBy→users, createdAt).
- `orderItems` + `stockKey` TEXT, `loadedQuantity` REAL; order/delivery + `loadNote`, `loadedAt`, `loadedBy`.
- `productionOutputs` + kolom bab 3.7.
### 1.8 Tidak bisa diketahui dari klien [server?]
Daftar 22 jenis & urutan; penurunan `key` dari baris produksi; batas `> countedAt`; definisi `started`; cakupan status PO di `unassigned`; peran persis tiap prosedur; validasi `saveCount` (key tak dikenal); apakah `summary.rows` memuat jenis tanpa pergerakan.

---------------------------------------------------------------------------------------------------
## 2. CAT GENTENG (PaintGentengDialog + alur "Sudah dimuat")

### 2.1 Layar & alur (dialog di `/stok` dan `/produksi`)
Judul "Cat genteng". Deskripsi: "Genteng natural yang dicat mengurangi stok **natural** dan menambah stok warna (hitam / merah) untuk tipe yang sama."
1. "Tipe genteng": chip tipe unik dari options `line=genteng`; bila dipilih tampil "Stok natural saat ini: **{balance} buah**".
2. "Dicat warna": "Hitam" (default) / "Merah".
3. "Jumlah (buah)" (desimal) dan "Waktu" (datetime-local, default sekarang).
4. "Catatan (opsional)". Tombol "Simpan" / "Menyimpan...".
Validasi: "Pilih tipe genteng"; "Isi jumlah yang dicat" (angka > 0); bila jumlah > stok natural → confirm "Stok {tipe} natural di aplikasi hanya {n} buah. Tetap simpan?". Sukses toast "Tersimpan: {label}". Panggilan `stock.paint({type,color,quantity,movedAt,note})`.

### 2.2 Aturan konversi [pasti dari teks + parser kunci]
`fromKey = genteng|{tipe} · Natural|` → `toKey = genteng|{tipe} · {Hitam|Merah}|`, satuan buah, rasio 1:1. Dampak: `painted` negatif di natural, positif di warna; tidak menambah "produksi". Form produksi menolak produk "Lainnya" yang memuat kata `cat`: "Pengecatan genteng bukan hasil produksi baru — catat lewat menu Stok Barang → "Cat genteng" (stok natural pindah ke hitam / merah)."
### 2.3 Tampilan lain
- Stok: subbaris "+/− dicat n" + kartu "Riwayat cat genteng".
- Hasil Produksi: kartu "Cat genteng beton (N buah)" + "Genteng natural yang dicat — mengurangi stok natural, menambah stok warna"; ringkasan per `toKey` ("Genteng Beton · dicat", "{tipe} → {warna}", "Dicat {tgl}"); baris + "Hapus". Cetak produksi punya seksi "Cat genteng beton (natural → warna)": Tanggal | Tipe | Dari | Menjadi | Jumlah | Petugas | Catatan.
### 2.4 Muatan: dialog baru yang menyuplai kolom `loaded` (CompleteOrderButton)
Mode `confirm` (judul "Konfirmasi muat", tombol "Simpan — sudah dimuat"; pemicu "Sudah dimuat") dan `edit` (judul "Ubah jumlah muat", tombol "Simpan perubahan"; pemicu "Ubah jumlah muat").
Deskripsi: "{poNumber} · {customerName} — isi jumlah yang benar-benar naik ke truk. Angka ini tercatat sebagai **stok keluar**."
Per item PO: "{productName} · {spec}", "Pesanan: {qty} {unit}", input "Dimuat" (default `loadedQuantity ?? quantity`), select "Diambil dari stok" (optgroup per `line`, placeholder "— Pilih jenis stok —", opsi akhir "Bukan dari stok produksi"=`none`; kosong ditandai amber, pra-isi bab 1.4); selisih "Kurang {n} {unit} dari pesanan" / "Lebih {n} {unit} dari pesanan". "Catatan muatan (opsional)" placeholder "Mis. kurang 20 pcs, susulan besok".
Validasi: "Isi jumlah dimuat untuk setiap barang (angka, 0 bila tidak dimuat)"; "Pilih jenis stok yang diambil untuk setiap barang"; ada selisih tapi catatan kosong → confirm "Jumlah dimuat berbeda dari pesanan tapi catatan masih kosong. Tetap simpan?".
| Prosedur | Input | Output |
|---|---|---|
| `monitor.loadItems` (query) | `{orderId}` | `{ poNumber, customerName, loadNote, items:[{id,productName,spec,quantity,unit,loadedQuantity,stockKey}] }` |
| `monitor.stockOptions` (query) | – | `[{key,line,label,unit}]` |
| `monitor.markLoaded` (**input berubah**; lama `{orderId}`) | `{ orderId, items:[{orderItemId,quantity,stockKey}], note? }` | `{ poNumber, … }` |
| `monitor.updateLoad` (baru) | sama dgn markLoaded | `{ poNumber }` |
| `monitor.stockOut` (query) | `{ from, to }` | `[{orderId,poNumber,customerName,productName,spec,unit,ordered,loaded,loadedAt,loadedByName,loadNote,status}]` |
MonitorPage panel baru "Barang keluar (muatan)": "Stok keluar = jumlah yang dikonfirmasi dimuat mandor / satpam saat "Sudah dimuat"."; default bulan berjalan; agregasi klien per `"{productName}|{spec}|{unit}"` (PO `cancelled` dibuang): `loaded = Σ(loaded ?? ordered)`, jumlah PO; kartu "{n} PO · pesanan X (selisih Y)" bila beda; Excel `Barang-Keluar-Muatan-{from}-sd-{to}.xlsx` sheet "Per produk" (No, Barang, Satuan, Jumlah dimuat (keluar), Jumlah pesanan, Selisih, Rit / PO) dan "Detail" (No, Tanggal muat, No. PO, Pelanggan, Barang, Ukuran / tipe, Pesanan, Dimuat, Satuan, Dikonfirmasi, Catatan).
[server?] apakah `markLoaded` tetap mensyaratkan petugas jaga & notifikasi sopir (di sumber lama ya); apakah `updateLoad` mengirim ulang notifikasi.

---------------------------------------------------------------------------------------------------
## 3. PERUBAHAN HASIL PRODUKSI (`/produksi`, ProductionPage)

### 3.1 Beda ringkas vs sumber lama
Lama: tanggal, kategori, produk, spec, qty, unit, papan, **reject**, leader, target, semen (sak), kode batch otomatis, foto, kendala, catatan; produk precast dari `PRECAST_PRODUCTS`.
Baru:
1. Mutu: **Grade A (jadi)** = `quantity`, **Grade B** (`gradeB`, "Reject yang masih bisa dijual"), **Reject** (tidak bisa dijual). Hanya Grade A masuk stok.
2. Pilihan produk = 10 tombol kelompok (bab 1.2) + **metode Buis Beton** Tumbuk / Cor / Tulangan (`method`).
3. Spesifikasi terkelola (`production.specs`): chip ukuran/tipe aktif per kelompok + berat per buah + total perkiraan.
4. **"Input adukan cor"**: satu adukan semen untuk beberapa produk (batch).
5. Semen curah (`cementKg`) untuk paving; rasio sak/buah & kg/satuan.
6. Ketidaksesuaian produksi + TTD bertingkat Manager in charge → Pimpinan + dokumen cetak.
7. Paving otomatis dari catatan Mix Desain QC (lapisan badan) termasuk Grade B & belahan Hexagon.
8. Rekap per produk 3 kotak, rekap kendala, Excel 4 sheet, kartu Cat genteng.

### 3.2 Form "Input hasil produksi" — label PERSIS
Judul "Input hasil produksi"/"Ubah hasil produksi"; deskripsi "Paving diinput QC (bisa diisi cepat dari catatan mix desain)." atau "Produk precast diinput mandor."
- "Kategori": tombol kelompok yang diizinkan. Produk "Lainnya": input "Nama produk".
- "Metode Buis Beton": Tumbuk / Cor / Tulangan; Tulangan memaksa ukuran `80×100` ("Buis bertulang hanya ukuran 80×100 (Ø 80 cm, tinggi 100 cm).").
- "Tanggal produksi".
- Paving: "Jenis paving" (picker Model/Ukuran/Warna, "Terpilih: **…**"); tombol "Isi dari catatan mix desain tanggal ini" → `production.pavingFromMixLogs({from,to})` hari itu: `spec` ← nama produk, `quantity` ← Σ m², `boards` ← Σ papan, `rejects` ← Σ reject; toast "Diisi dari catatan mix desain — periksa lagi angkanya"; kosong: "Belum ada catatan mix desain (lapisan badan) pada tanggal ini".
- Non-paving: "Ukuran / tipe" (datalist + chip spesifikasi aktif, penanda "★ Spesial" bila `specs.Varian==="Spesial"`, berat); info "Berat {x} / buah · ≈ total {y}" dan "Nama: nilai · …". Total berat = `weightKg × quantity` (tidak untuk satuan `m`).
- "Jumlah jadi" (placeholder "0 bila berhenti") + satuan (paving `m²`; precast `buah`/`m`); "Papan" (paving); "Grade B" (placeholder "masih bisa dijual"); "Reject" (placeholder "tidak bisa dijual").
- Precast: "Semen terpakai (sak) *" + "≈ x sak/buah" (rumus `sak ÷ jumlah jadi`, 3 desimal) atau tip "Bila Buis cor / tulangan, U-Ditch & Kanstin dicor dari satu adukan, pakai tombol **Input adukan cor**."
- Blok "Form F-IB-02 · laporan target & realisasi (opsional)": "Leader" (datalist), "Target ({satuan})", paving: "Semen curah (kg)" (placeholder "Otomatis dari mix desain"), "Kode batch" (placeholder "Otomatis"; "Kode batch dibuat otomatis (mis. PB-261005-01) dan dipakai di form mix desain, uji mutu, dan NCR.").
- "Foto hasil produksi (opsional)" (1 foto, PhotoField).
- "Kendala produksi (opsional)": 7 chip: Mesin trouble, Listrik padam, Bahan baku kurang, Cetakan rusak, Hujan / cuaca, Kurang tenaga kerja, Lainnya. "Bila produksi berhenti total, isi jumlah jadi 0 dan pilih kendalanya."
- "Keterangan PIC (QC|mandor)". Tombol "Simpan".
Aturan klien berurutan: nama ≥2 huruf ("Tulis nama produk"); "Lainnya" dilarang bila memuat `cat` atau nama kelompok lain (genteng/nok, u-ditch, buis, kanstin/kastin, greffel/gravel, gras) → pesan "termasuk kategori X — pilih tombol kategori X…"; paving wajib spec ("Pilih jenis paving: model, ukuran & warna"); Buis tulangan wajib `80×100`; Buis wajib metode ("Pilih metode Buis Beton: Tumbuk, Cor, atau Tulangan"); jumlah ≥0 (0 hanya bila ada kendala); precast jumlah>0 wajib sak ("Isi semen terpakai (sak)"); kendala tanpa catatan → confirm "Ada kendala tapi keterangan masih kosong. Tetap simpan?". Sukses baru: "Hasil produksi tersimpan · kode batch {batchCode}".
Payload `production.create`/`update` (rekonstruksi): `{ [id], productionDate (T12:00 lokal), category, product, spec?, quantity, unit, boards?, gradeB?, rejects?, issues:string[], notes?, photo?, leader?, target?, cementBags? (non-paving), cementKg? (paving), batchCode?, method? (hanya Buis Beton: "tumbuk"|"cor"|"tulangan") }`; `create` → `{ batchCode, … }`.

### 3.3 "Input adukan cor"
Judul "Input adukan cor"/"Ubah adukan cor"; "Satu adukan semen untuk beberapa produk sekaligus (Buis Beton cor / tulangan, U-Ditch, Kanstin). Semen dicatat sekali untuk adukan ini."
Header: "Tanggal", "Semen terpakai (sak) *". Item default 3 baris: Buis Beton cor (vibrasi), U-Ditch, Kanstin. Jenis pilihan (6): `buis-cor` "Buis Beton cor (vibrasi)" (Buis Beton/cor), `buis-tulangan` "Buis Beton tulangan" (Buis Beton/tulangan), `uditch` "U-Ditch", `tutup-uditch` "Tutup U-Ditch", `kanstin` "Kanstin", `tutup-buis` "Tutup Buis Beton". Per item: chip spesifikasi aktif (line & varian), "Ukuran / tipe", "Target" (placeholder buah), "Jadi (buah)", "Grade B", "Reject"; "Hapus produk" bila item >1; "Tambah produk" (default Kanstin).
Ringkasan: "Target X buah · realisasi Y buah (Z%)"; "Total Y buah dari S sak semen (≈ r sak / buah rata-rata)".
"Grup / leader" (datalist; "Grup Sumitra" + leader pernah dipakai), "Catatan". "Simpan adukan"; mode edit: "Hapus adukan" (confirm "Hapus adukan ini beserta semua hasil produksinya?").
Validasi: "Isi semen terpakai (sak) untuk adukan ini"; "Isi jumlah jadi minimal satu produk"; item hanya dikirim bila ada `quantity` atau `target`. Sukses "Adukan cor tersimpan".
Payload: `{ [id], productionDate, cementBags, leader?, notes?, items:[{ id?, product, method?, spec?, quantity, unit:"buah", gradeB?, rejects?, target? }] }`. Satu baris `productionOutputs` per item bertanda `batchId`; `batchCement` = total sak adukan (tabel: "Adukan #{batchId} · {n} sak · ubah"), `cementBags` per baris kosong agar rasio tak ganda. Ringkasan periode: "**Adukan cor bersama:** N adukan · S sak semen · Q buah (Buis cor / tulangan, U-Ditch, Kanstin) · ≈ r sak / buah".

### 3.4 Ketidaksesuaian produksi
Kartu "Ketidaksesuaian produksi (N)" muncul bila ada baris `gradeB>0` atau `rejects>0`. Per baris: "Reject n unit · Grade B n unit · notes" + lencana "✓ Manager in charge: {nama}" / "Pimpinan: belum".
- "TTD Manager in charge (n)" (`canApproveQc`) → confirm "Tandatangani n ketidaksesuaian sebagai Manager in charge?" → `production.ackRejectManager({ids})`.
- "TTD Pimpinan (n)" (`canSignAsLeader`) → confirm "Setujui n ketidaksesuaian sebagai Pimpinan?" → `production.ackRejectLeader({ids})`. Toast "{count} ketidaksesuaian ditandatangani".
- "Dokumen ketidaksesuaian": "Laporan Ketidaksesuaian Produksi" kolom Tanggal | Produk | Kode batch | Diproduksi (= A+B+Reject) | Grade B (masih dijual) | Reject (tidak dijual) | % Reject (= Reject ÷ diproduksi) | Kendala / penyebab | PIC | Diperiksa | Disetujui; catatan "Grade B = reject yang masih bisa dijual · Reject = tidak bisa dijual. Ketidaksesuaian dicatat juga di form F-IB-15 (NCR) bila perlu tindakan korektif."; TTD "Diperiksa, Manager in charge" & "Disetujui, Pimpinan" dengan nama+waktu+gambar (`rejectManagerSignature/rejectLeaderSignature`) HANYA bila SEMUA baris sudah ditandatangani (diambil dari TTD terbaru).
- UI: "Reject juga muncul sebagai saran di form ISO F-IB-15 (NCR) untuk dicatat tindakan korektifnya." (via `iso.suggestions`).
**"Otomatis dari mix desain"**: baris paving berpenanda `mixLogId` dibuat server dari catatan Mix Desain QC lapisan *badan* (m² Grade A → `quantity`; plus `gradeB`, `rejects`, `boards`). UI: label "Dari mix desain" (tooltip "Ubah lewat menu Mix desain harian"), kartu "otomatis dari mix desain". Di QcPage form Mix Desain kini: "Papan", "m² Grade A (siap jual)", "Grade B (reject, masih bisa dijual)", "Reject (tidak bisa dijual)" (disembunyikan untuk lapisan `kepalaan`: "Hasil produksi (papan, Grade A/B, reject) cukup diisi di lapisan badan — sudah termasuk kepalaan."); untuk Hexagon utuh badan: "Belahan setengah (trapesium) — buah, dari cetakan yang sama" (`halfPieces`) → "Masuk Hasil Produksi & Stok sebagai {Hexagon Setengah (trapesium) · warna}"; "Hasil lapisan badan otomatis masuk ke Laporan produksi (paving): Grade A sebagai jumlah jadi, plus Grade B & reject." `qc.createMixLog/updateMixLog` kini membawa `gradeB`, `halfPieces`. Rekap QC menambah "Grade B" dan "Grade A m² (badan)". [server?] mekanisme upsert saat log diubah/dihapus; apakah status mix log `tidak_sesuai` otomatis jadi ketidaksesuaian (di UI QC hanya dihitung "Tidak sesuai / perlu perbaikan").

### 3.5 Tampilan daftar & rekap
Header kicker "Hasil produksi", judul "Pendapatan produksi harian"; tombol "Input adukan cor", "Cat genteng", "Input hasil {produk|paving|precast}". Preset "7 hari", "Bulan ini", "Tahun ini" + rentang tanggal; chip kelompok (Semua + 10 kelompok).
Kartu per produk: kelompok(·metode), nama, "{Σ} Grade A", 3 kotak Grade A/Grade B/Reject, "Produksi {tgl…} · n papan · otomatis dari mix desain", semen ("Semen curah x kg · ≈ kg/satuan" atau "Semen x sak · ≈ sak/satuan"), "n hari ada kendala". Kartu "Kendala produksi periode ini". Tabel: Tanggal | Produk | Grade A (jadi) (+target & %) | Papan | Grade B | Reject | Semen | Foto | PIC | aksi; PIC = `dutyOfficerName (createdByName)`.
Cetak "Laporan Hasil Produksi" (seksi Rekap per produk: Kategori, Produk, Hari, Grade A (jadi), Grade B, Reject, Satuan, Papan, % Reject; Detail produksi; Cat genteng; TTD Mandor / QC, Manager in charge, Pimpinan). Excel `Hasil-Produksi_{from}_sd_{to}.xlsx` sheet "Per produk", "Per hari", "Kendala", "Detail" (Detail: No, Tanggal, Kategori, Produk, Metode, Ukuran / tipe, Kode batch, Leader, Target, Jumlah, Satuan, Papan, Grade B, Reject, Adukan bersama, Semen curah (kg), Semen (sak), Semen per satuan, Kendala, Keterangan PIC, PIC, Foto).

### 3.6 Spesifikasi Produk (tab "Spesifikasi produk" di `/qc`; ProductSpecsTab)
"Berat dan spesifikasi tiap ukuran (data awal dari flyer Buis Beton, U-Ditch, dan Genteng Beton). Pilihan ini muncul saat mandor / QC menginput hasil produksi, beserta perkiraan berat total." Per kelompok tabel Ukuran / tipe | Berat | Spesifikasi. Form "Tambah/Ubah spesifikasi": Kategori, Ukuran / tipe (contoh "40×40×120 (cm)"), Metode (khusus buis) atau "Varian (opsional)" (contoh "HD, warna"), "Berat per buah (kg)", "Spesifikasi lain" (pasangan nama–nilai, mis. Mutu, Tebal), Catatan, "Aktif (tampil sebagai pilihan saat input produksi)". Cetak "Spesifikasi & Berat Produk" (catatan "Ukuran U-Ditch & cover dalam centimeter. Dimensi dapat disesuaikan permintaan."); Excel `Spesifikasi-Produk.xlsx`. Tombol edit hanya `canEdit` (QcPage, perkiraan admin/qc).
| Prosedur | Input | Output |
|---|---|---|
| `production.specs` | – | `[{id,line,name,variant\|null,weightKg\|null,specs:Record<string,string>,notes,isActive}]` |
| `production.saveSpec` | `{ id?, line, name, variant, weightKg?, specs, notes, isActive }` | – |
| `production.removeSpec` | `{ id }` | – |

### 3.7 Dugaan skema D1 [tebakan]
`productionOutputs` + `method` TEXT, `gradeB` REAL, `cementKg` REAL, `batchId` INTEGER→`productionBatches`, `mixLogId` INTEGER→mixLogs, `rejectManagerName/AckAt/Signature/By`, `rejectLeaderName/AckAt/Signature/By`.
`productionBatches` (id, productionDate, cementBags, leader, notes, createdBy, createdAt, updatedAt).
`productSpecs` (id, line, name, variant, weightKg, specs JSON, notes, isActive, createdAt, updatedAt).
`mixLogs` + `gradeB`, `halfPieces`.
### 3.8 Tidak diketahui dari klien [server?]
Pola `batchCode` (hanya contoh PB-261005-01); penegakan jendela edit 7 hari di server; pembuatan baris otomatis dari Mix Desain termasuk belahan Hexagon; apakah TTD direset saat baris diubah; kolom/nama tabel persis; apakah `ackReject*` hanya menandai baris dengan gradeB/rejects > 0.

---------------------------------------------------------------------------------------------------
## 4. PETA PROSEDUR tRPC (142 terpakai klien)

Metode: regex `x.<router>.<proc>.(useQuery|useMutation|invalidate|fetch|refetch|…)` pada seluruh chunk. Keterbatasan: klien vanilla tak terdeteksi; 5 prosedur lama tak tampak dipakai: `monitor.markLoadingNotificationsRead`, `security.backupManifest`, `security.backupRows`, `security.backupPhotoKeys`, `backup.record` (kemungkinan lewat `lib/backup.ts` vanilla, atau mati).

### 4.1 Prosedur BARU (33; tidak ada di `worker/routers.ts` lama)
| Prosedur | Dipakai di chunk | Input (kunci) | Baru? |
|---|---|---|---|
| `stock.summary` | StockPage, PaintGentengDialog | – | BARU |
| `stock.options` | StockPage, PaintGentengDialog | – | BARU |
| `stock.saveCount` | StockPage | countedAt, note?, items[{key,quantity}] | BARU |
| `stock.paint` | PaintGentengDialog | type, color, quantity, movedAt, note? | BARU |
| `stock.paintings` | ProductionPage | from, to | BARU |
| `stock.removePaint` | StockPage, ProductionPage | id | BARU |
| `monitor.loadItems` | CompleteOrderButton | orderId | BARU |
| `monitor.stockOptions` | CompleteOrderButton | – | BARU |
| `monitor.updateLoad` | CompleteOrderButton | orderId, items[{orderItemId,quantity,stockKey}], note? | BARU |
| `monitor.stockOut` | MonitorPage | from, to | BARU |
| `operations.revertDelivery` | CompleteOrderButton | deliveryId, reason (≥5 huruf) → `{status}` | BARU |
| `production.specs` | ProductionPage, ProductSpecsTab | – | BARU |
| `production.saveSpec` | ProductSpecsTab | id?, line, name, variant, weightKg?, specs, notes, isActive | BARU |
| `production.removeSpec` | ProductSpecsTab | id | BARU |
| `production.createBatch` | ProductionPage | productionDate, cementBags, leader?, notes?, items[…] | BARU |
| `production.updateBatch` | ProductionPage | id + sama dgn createBatch | BARU |
| `production.removeBatch` | ProductionPage | id | BARU |
| `production.ackRejectManager` | ProductionPage | ids[] → `{count}` | BARU |
| `production.ackRejectLeader` | ProductionPage | ids[] → `{count}` | BARU |
| `sand.ackSecretary` | SandTestPage | ids[] | BARU |
| `sand.ackManager` | SandTestPage | ids[] | BARU |
| `sand.ackLeader` | SandTestPage | ids[] | BARU |
| `sand.editResult` | SandTestPage | id, readingUnit, sandHeightCm, siltHeightCm, decision, photo?, reason, (bila bukan dari penerimaan: sandType, supplier, quarry:null, testedAt, notes) → `{siltPercent, ackReset}` | BARU |
| `sand.skipTest` | SandTestPage | receiptId, level("tidak"\|"sedikit"\|"sedang"\|null=batal), reason? | BARU |
| `sand.skipped` | SandTestPage | {from,to} | BARU |
| `calendar.signAttendance` | CalendarPage | eventId | BARU |
| `iso.arrivals` | IsoRecapPage | rentang (seperti `iso.overview`: from,to) | BARU |
| `iso.correctArrival` | IsoRecapPage | deliveryId, arrivedAt (Date\|null=batal), reason (≥10 huruf) | BARU |
| `customers.leads` | CustomersPage | from, to | BARU |
| `customers.saveLead` | CustomersPage | id?, contactDate, source, name, phone, address, product, status, saleValue, priceNett, priceOffer, reasons, notes | BARU |
| `customers.rateLead` | CustomersPage | id, ratingService, ratingQuality, ratingSpeed, ratingNote, feedback, complaintDate?, complaintNote?, getbackDate?, getbackNote?, getbackResult? | BARU |
| `customers.importLeads` | CustomersPage | leads[] (≤300 per panggilan) → `{added, skipped}` | BARU |
| `customers.removeLead` | CustomersPage | id | BARU |
Router baru: `stock`, `customers`.
Prosedur LAMA dengan bentuk berubah (indikasi dari klien): `monitor.markLoaded` (+items, note), `production.create/update/list/pavingFromMixLogs` (+gradeB, method, cementKg, batch*, reject*, `mixLogId`), `qc.createMixLog/updateMixLog/mixLogs` (+gradeB, halfPieces), `sand.list/mine` (baris punya `*AckName`, riwayat edit), `receipts.list` (+`testSkipLevel/testSkipReason`), `calendar.recap` (hasil: `attendees[{userId,present,signed,signedAt}]`, `decisions[{values:{status}}]`), `iso.overview` (indikator F-IB-16 otomatis).

### 4.2 Prosedur lama (tetap & terpakai)
| Router | Prosedur → chunk |
|---|---|
| auth | me (index,useAuth,DashboardLayout); setupStatus, setup, login (index); logout, changePassword (useAuth); mySignature (DashboardLayout,QcPendingBanner); setSignature (DashboardLayout) |
| users | list (UsersPage,SecurityPage); create, update, resetPassword (UsersPage) |
| operations | Home: dashboard, liveLocations, notifications, markNotificationsRead, createDriver, createVehicle, createOrder, invoiceStatus, createFromInvoice, updateOrder, cancelOrder, deleteOrder, assignDelivery, updateDeliveryStatus, createTrackingLink, uploadDeliveryProof; CompleteOrderButton: completeDelivery |
| reports | deliveries (Home) |
| qc | QcPage: mixDesigns, createMixDesign, reviewMixDesign, setMixDesignActive, markMixDesignFailed, mixLogs, createMixLog, updateMixLog, deleteMixLog, approveMixLogs, requestMixLogRevision, strengthTests, createStrengthTest, updateStrengthTest, deleteStrengthTest, approveStrengthTest, requestStrengthRevision, signStrengthAsLeader; pending (DashboardLayout,QcPage,QcPendingBanner) |
| sand | SandTestPage: start, complete, deleteDraft, drafts, receiptsForTesting, list, mine |
| receipts | create, list, remove, sources (ReceiptsPage/SandRecordsPage); evaluateQuality (SandRecordsPage); evaluateDelivery, evaluatePrice (ReceiptRatings) |
| production | ProductionPage: list, create, update, remove, pavingFromMixLogs |
| monitor | jobs, dutyShifts (MonitorPage); loadingNotifications (CompleteOrderButton,Home); markLoaded (CompleteOrderButton) |
| duty | status, start, end (DashboardLayout); officerNames, resetPin, setOfficers (UsersPage) |
| calendar | events, people, myToday (CalendarPage,DashboardLayout), create, update, remove, recap, saveResult (CalendarPage) |
| summary | get (SummaryPage) |
| security | activity (SecurityPage); backupHistory (DashboardLayout,SecurityPage) |
| iso | overview, rows, suggestions, save, supplement, remove, objectiveMonth, setObjective (IsoRecapPage) |
| push | publicKey, subscribe, unsubscribe, test (push) |
| driver | tasks, pushPublicKey, testPush, subscribePush, recordLocation, updateStatus, uploadProof (DriverPage) |
| tracking | public (TrackPage) |

---------------------------------------------------------------------------------------------------
## 5. FITUR KECIL / LAIN YANG BARU (diff literal bundel vs sumber lama)

Tak berubah (nol string baru): DriverPage (TIDAK ada antrean offline), SummaryPage, ReceiptRatings, UsersPage (reset password sudah ada: `users.resetPassword`; hanya contoh nama petugas jaga), SecurityPage (format backup SQL saja), QcPendingBanner (tautan "Buka QC, Produksi & Uji Mutu").
1. **Rekap Pelanggan** (`/rekap-pelanggan`, router `customers`): konsumen dari rekap Google Ads. Form/kolom: Tanggal, Sumber (Google Ads, WhatsApp, Instagram / Facebook, Datang langsung, Telepon, Referensi, Pelanggan lama, Lainnya), Nama pelanggan, No. WA, Alamat, "Produk yang ditanyakan / dibeli" (contoh "PV BATA 6CM ABU 120M2"), Status (Membeli / Follow up / Tidak membeli), "Nilai penjualan (Rp)", harga nett, harga tawar, alasan tidak membeli (Harga mahal; Min order — "Tidak masuk SOP kiriman pabrik (min 15 m² area Purwakarta & 1 truk luar Purwakarta)"; Luar provinsi — "Konsumen berdomisili di luar Jawa Barat"; Tidak ada info; Tidak tersedia), keterangan. Dialog "Penilaian pembeli": bintang Layanan / Kualitas / Kecepatan (Sangat buruk…Sangat baik), "Keterangan pembeli" Puas / Komplain; komplain: tanggal & isi, "Get back (hubungi kembali pembeli)": tanggal, tindakan, hasil ("Puas setelah get back" / "Tetap tidak puas"); badge "PUAS"/"BELUM PUAS" dihitung klien (dasar teks ISO: puas = bintang ≥ 80 atau keterangan Puas; komplain dianggap puas hanya bila get back ≤ 1 hari setelah tanggal komplain). Impor Excel (chunk xlsx hilang; dikirim per 300), Excel ekspor, preset "Bulan ini / Bulan lalu / Tahun ini / Semua", daftar maks 500 baris. Tabel dugaan [tebakan]: `customerLeads`(contactDate, source, name, phone, address, product, status, saleValue, priceNett, priceOffer, reasons JSON, notes, rating*, feedback, complaint*, getback*, createdBy). Dedup impor di server ("sudah ada (dilewati)") [server?].
2. **Sasaran Mutu F-IB-16** (IsoRecapPage): "Form sasaran mutu (F-IB-16)" No. Dokumen F-IB-16 Rev. 00 terbit 15 Oktober 2026; TTD "Dibuat oleh (Quality Control)", "Diperiksa oleh (Manajer Perusahaan)", "Disetujui oleh (Pimpinan)"; indikator otomatis dari Rekap Pelanggan (chat masuk, sudah diberi harga, kepuasan, komplain, get back ≤1 hari), pengiriman tepat waktu (`iso.arrivals`), NCR "Keluhan Pelanggan" closed ≤7 hari kerja (Jumat libur); sisanya "Isian manual" ("Isi jumlah tercapai (angka)"). Cetak mencantumkan "Dasar perhitungan", "Standar acuan perhitungan otomatis".
3. **Pengiriman tepat waktu + koreksi jam tiba**: dialog "Pengiriman tepat waktu" (filter Terlambat / Dikoreksi / Semua) dari `iso.arrivals`; kantor (`canCompleteOrders`) isi "Jam tiba sebenarnya" + "Alasan & bukti" (≥10 huruf), "Simpan koreksi"/"Batalkan koreksi"; label "Tombol Sampai:", "Sudah dikoreksi", "Diminta tiba"; tepat waktu = tiba ≤ tanggal kirim diminta. Dugaan: `deliveries.arrivalCorrectedAt/By/Reason` (jam asli tetap tersimpan).
4. **Batalkan status Selesai/Sampai** (`operations.revertDelivery`): tombol "Batalkan status Selesai" / "Batalkan status Sampai", alasan wajib (`*`, ≥5 huruf); status kembali ke "Sudah tiba" (dari Selesai) atau "Dalam perjalanan" (dari Sampai), toast `kembali ke status "…"` (juga "Siap jalan"). Nama & alasan dicatat di riwayat.
5. **Uji lumpur** (SandTestPage): TTD bertingkat Sekretaris (`ackSecretary`) → Manager (`ackManager`) → Pimpinan (`ackLeader`) massal (`ids`); "Ubah hasil" (`editResult`, nilai lama tersimpan di riwayat, TTD direset: toast "… tanda tangan perlu diulang"); "Skip uji lumpur" (Tidak berlumpur / Lumpur sedikit / Lumpur sedang + alasan, daftar "Uji lumpur dilewati (3 hari terakhir)" dengan "Batalkan"; di Barang Masuk "Tanpa uji lumpur — …"); "Cetak label". Konstanta (`sand-*.js`): material Pasir, Pasir badan, Pasir kepalaan, Abu batu, Screening, Split, Lainnya; skor 1–4 (Bagus / Banyak brangkal / Banyak lumpur / Brangkal & lumpur); lumpur ≤5% bagus, ≤10% cukup (Masih diterima 5–10%), >10% lewat; sumber kiriman quarry / ekspedisi / sendiri.
6. **Kalender**: notulen/laporan training dengan "Daftar hadir" (Hadir / Hadir (tamu) / Tidak hadir), "TTD hadir" per peserta (`calendar.signAttendance({eventId})`, toast "Kehadiran ditandatangani", tombol "Tanda tangani kehadiran", "✓ Anda sudah TTD hadir"), "Cetak notulen"/"Cetak laporan" (isi: "Isi rapat / pembahasan", "Evaluasi / efektivitas training", "Keputusan & tindak lanjut (F-IB-14)"), hapus acara berulang ("OK = hapus SELURUH jadwal berulang ini · Batal = hapus tanggal ini saja"), "Pengingat: …". Dugaan: `calendarAttendees(… signedAt)`.
7. **Home (Ringkasan)**: "Laporan pengiriman" (Ringkasan pengiriman, Jumlah PO per status, Per sopir, Per barang, Riwayat status pengiriman, Titik GPS perjalanan; Excel "N PO berhasil diunduh", GPS dipotong bila `gpsTruncated`); teks bagikan pelanggan "Halo {nama}, berikut detail pengiriman pesanan Anda dari PT. Istana Block Purwakarta: Muatan/Tujuan/Sopir/Kendaraan"; validasi alamat berisi nama orang; parser Zahir (xml/ods) di bundel.
8. **TrackPage**: "Posisi kendaraan {plat}", pesan tautan dibuat PT. Istana Block Purwakarta, refresh 30 detik.
9. **SandRecordsPage/Receipts**: tier list supplier/quarry (cetak "TIER LIST KUALITAS SUPPLIER / QUARRY (PENILAIAN QC)"), "Armada Istana Block (ambil sendiri)", "Lewat batas 10%" — sebagian string baru hanya kata cetak (migrasi tier lama 0006–0008 sudah ada).
10. **QcPage**: tab "Spesifikasi produk"; urutan tab Mix desain harian | Uji kuat tekan | Uji mutu | Spesifikasi produk | Template | Rekap.
11. **MonitorPage**: panel "Barang keluar (muatan)" (bab 2.4).
12. **Tidak ditemukan**: antrean offline sopir, reset password baru, flag izin baru.

---------------------------------------------------------------------------------------------------
## 6. Celah terbesar
1. Daftar 22 jenis stok & aturan server penurun `key` dari produksi (hanya respons live `stock.options` / `stock.summary` yang memastikan).
2. Rumus pasti server: batas waktu opname terhadap produksi/muatan/cat, definisi `started`, `unassigned`.
3. Skema D1 persis (semua tebakan); butuh `SELECT sql FROM sqlite_master` dari D1 live atau daftar migrasi baru (0021+).
4. Pola `batchCode`, upsert otomatis dari Mix Desain (termasuk Hexagon Setengah), TTD reject.
5. Chunk `xlsx-Bv_pSZNU.js` belum diunduh; peran persis router `customers`/`stock` di server; kunci enum yang hanya tampil sebagai label (`getbackResult`, `feedback`, `status` leads, `decision` uji lumpur).
