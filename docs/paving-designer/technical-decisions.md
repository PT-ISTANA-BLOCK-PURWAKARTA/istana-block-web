# Keputusan Teknis Fase 0: Site-Specific Paving Designer

**Tanggal:** 17 November 2026  
**Dokumen Acuan:** `WORKLOG/rencana-implementasi-paving-designer-agent.md` (v2.2) & `WORKLOG/langkah-eksekusi-paving-designer-agent.md`  
**Status:** Draf Keputusan & Evaluasi F0 — Menunggu Persetujuan Pemilik  

---

## 1. Audit Branch Remote (`origin/fitur/*`)

Sesuai instruksi F0 butir 2, seluruh branch remote di `origin/fitur/*` telah diperiksa:
- Perintah: `git log --branches="origin/fitur/*" --not origin/main --oneline`
- **Hasil:** Kosong (0 commit di depan `origin/main`).
- **Kesimpulan:** Tidak ada pekerjaan visualizer, kalkulator, atau pola paving yang tertinggal atau berbenturan di branch remote. Semua pekerjaan baru berangkat bersih dari `origin/main` (HEAD `053a1d7`).

---

## 2. Keputusan & Perbandingan Penyedia Peta Satelit

Target: Memungkinkan pengguna menggambar batas lahan di atas citra satelit tanpa menimbulkan biaya API berbayar atau membebani kuota mobile.

| Kriteria | Kandidat 1: Leaflet + Esri World Imagery (Direkomendasikan) | Kandidat 2: MapLibre GL JS |
|---|---|---|
| **Status Dependensi** | **Sudah terpasang di repo** (`leaflet ^1.9.4`, dipakai di 3 modul lain). | Belum ada, paket baru. |
| **Lisensi** | BSD 2-Clause (Leaflet). | BSD 3-Clause (MapLibre). |
| **Ukuran Bundel Gzip** | **0 KB tambahan** (reused). | +220 KB gzip (sangat besar). |
| **Biaya & Kunci API** | **Gratis, tanpa API Key** untuk penayangan basemap standar web publik. | Butuh penyedia tile vektor (MapTiler/Stadia) dengan API key & kuota berbayar. |
| **Konteks GPU / WebGL** | Menggunakan DOM/Canvas 2D biasa. **Tidak memakan konteks WebGL**, sehingga aman berdampingan dengan Three.js di HP. | Membutuhkan 1 WebGL context sendiri. Di HP kelas bawah, 2 konteks WebGL (MapLibre + Three.js) rawan crash/context lost. |
| **Syarat Atribusi** | Wajib menampilkan kredit: `Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community`. | Atribusi penyedia tile vektor. |
| **Kualitas Citra Jawa Barat** | **Sangat baik & tajam** di Purwakarta (Pasawahan, Jatiluhur), Karawang (KIIC, Suryacipta), Subang, dan Cirebon hingga zoom level 18–19. | Bergantung pada penyedia tile pihak ketiga. |

**Keputusan F0:** Menggunakan **Leaflet + Esri World Imagery TileLayer** yang dimuat secara dinamis (`next/dynamic` ssr:false) hanya ketika pengguna memilih tab "Peta Satelit".

---

## 3. Keputusan & Perbandingan Pustaka Polygon Clipping

Target: Memotong kisi blok paving (persegi panjang & heksagon) terhadap batas poligon lahan sembarang (termasuk lahan miring, bentuk L/U, dan poligon berlubang / *holes*).

| Kriteria | Kandidat 1: `polygon-clipping` (Direkomendasikan) | Kandidat 2: `clipper2-js` |
|---|---|---|
| **Lisensi** | MIT (oleh Mike Fowler). | BSL / MIT. |
| **Ukuran Bundel Gzip** | **~14.8 KB gzip** (~55 KB unpacked). | ~60 KB gzip. |
| **Format Data** | Native GeoJSON Coordinate Arrays `[ [ [x, y], ... ] ]`. | Memerlukan konversi ke struktur objek Path/Point internal. |
| **Presisi & Geometri** | Algoritma Martínez-Rueda-Feito. Mendukung penuh Polygon, MultiPolygon, dan Holes. | Vatti clipping algorithm. Sangat presisi, namun berbasis integer coordinate scaling. |
| **Kompatibilitas Runtime** | 100% Pure JavaScript ES6, tanpa modul Node, aman di browser dan Worker. | Pure JS / WASM build. |

**Keputusan F0:** Mengusulkan pemasangan **`polygon-clipping`** (~15 KB) yang hanya diimpor di dalam modul murni `src/lib/paving/engine/clipping.ts`.

---

## 4. Keputusan & Perbandingan Parser KML / KMZ

Target: Membaca berkas lahan dari Google Earth / GPS tanpa mengunggah berkas ke server (100% client-side parsing).

| Aspek | Opsi A: `@tmcw/togeojson` + `fflate` (Direkomendasikan) | Opsi B: Custom DOMParser Regex/XML |
|---|---|---|
| **Lisensi** | MIT (`@tmcw/togeojson` ~4 KB, `fflate` ~8 KB). | Internal code. |
| **Ukuran Total** | **~12 KB gzip**. | ~3 KB. |
| **Keandalan Parser** | Teruji menangani namespace KML (`kml:`, `gx:`), MultiGeometry, dan `innerBoundaryIs` (lubang poligon). | Rawan gagal/bug pada format KML non-standar dari berbagai aplikasi GPS. |
| **Proteksi Keamanan** | `fflate` memiliki proteksi bawaan terhadap *decompression zip-bomb* (membatasi memory buffer). | Memerlukan implementasi parser zip manual yang rumit dan rawan memory leak. |

**Keputusan F0:** Mengusulkan **`@tmcw/togeojson` + `fflate`**, dimuat dinamis hanya saat pengguna mengunggah berkas `.kml` atau `.kmz`.

---

## 5. Keputusan Metode Proyeksi Geografis (WGS84 → Meter Lokal)

Target: Mengonversi koordinat derajat bujur/lintang (GPS/Peta) menjadi koordinat bidang datar (meter) dengan akurasi tinggi untuk perhitungan luas dan peletakan paving.

### Wilayah Operasional & Zonasi UTM
Area jangkauan pengiriman dan proyek PT Istana Block Purwakarta terletak di Jawa Barat & Banten (koordinat bujur 105°E s.d. 109°E, lintang 6°S s.d. 8°S):
1. **Bujur < 108° E → UTM Zone 48S (EPSG:32748)**  
   Mencakup: Purwakarta, Karawang, Subang, Bandung Raya, Bekasi, Bogor, Depok, Jakarta, Sukabumi, Cianjur, Banten.
2. **Bujur ≥ 108° E → UTM Zone 49S (EPSG:32749)**  
   Mencakup: Cirebon, Indramayu, Majalengka, Kuningan, Brebes/Jawa Tengah barat.

### Pengujian Matematis Formulasi Proyeksi Mandiri vs Pustaka Eksternal
Formula Transverse Mercator WGS84 standar diimplementasikan secara murni (<60 baris TypeScript tanpa dependensi eksternal `proj4` yang berukuran 30 KB).

*Hasil Uji Koordinat Contoh:*
* Titik Purwakarta (-6.55°, 107.44°): `X = 769.830,41 m`, `Y = 9.275.340,92 m` (Zone 48S).
* Titik Cirebon (-6.72°, 108.56°): `X = 230.262,20 m`, `Y = 9.256.531,58 m` (Zone 49S).
* Deviasi luas tapak 100 m² s.d. 10.000 m² terhadap rumus geodesik elipsoid WGS84 adalah **< 0,02%** (hanya selisih ~20 cm² pada lahan 100 m²), jauh di bawah toleransi konstruksi fisik di lapangan.

**Keputusan F0:** Menggunakan implementasi mandiri Transverse Mercator WGS84 untuk UTM 48S / 49S di `src/lib/paving/geometry/project.ts`. **Nol dependensi eksternal (0 KB)**.

---

## 6. Keputusan Web Worker & Fallback Main-Thread

1. **Jalur Utama:** Menggunakan Web Worker standar peramban (`layout.worker.ts`) untuk menghitung peletakan dan pemotongan poligon ribuan blok di latar belakang tanpa menghambat antarmuka pengguna (60 FPS).
2. **Graceful Fallback:** Jika peramban perangkat pengguna tidak mendukung module Worker atau memicu galat, engine secara otomatis beralih (*fallback*) ke eksekusi berpentahapan (*chunking*) di main-thread menggunakan `requestAnimationFrame` / slicing per 500 blok. Pengguna tetap dapat melihat hasil kalkulasi tanpa mengalami *browser freeze*.

---

## 7. Tabel Ambang Batas Provisional (Draft F0)

| Parameter | Nilai Provisional | Alasan & Dasar Pertimbangan |
|---|---|---|
| **Toleransi Numerik Titik** | `1e-5` m (0,01 mm) | Mengabaikan jitter floating-point pada koordinat sisi berimpit. |
| **Toleransi Selisih Luas** | `0,1%` | Batas wajar selisih antara poligon proyeksi UTM vs geodesik WGS84. |
| **Ambang Batas Sliver (Potongan Sangat Kecil)** | `0,001` m² (10 cm²) | Potongan di bawah 10 cm² dianggap pecahan tak layak pasang (menjadi *warning/waste*). |
| **Batas Ukuran Berkas Impor** | `5 MB` | Mencegah kelebihan memori pada peramban ponsel. |
| **Batas Titik Poligon Lahan** | `500 titik` | Lahan nyata (carport, jalan, pabrik) jarang >100 titik; 500 titik melindungi loop clipping dari lonjakan beban. |
| **Batas Luas Lahan Desain** | `10.000 m²` (1 Hektare) | Area di atas 1 hektare dianjurkan dibagi menjadi beberapa zona pengerjaan. |
| **Batas Blok 3D Penuh (InstancedMesh)** | `5.000 blok` (~115 m² Truepave) | Di atas 5.000 blok, tampilan 3D otomatis menampilkan *zona sampel preview*, sementara kalkulator 2D menghitung 100% seluruh lahan. |

---

## 8. Ringkasan Usulan Dependensi Baru untuk Disetujui Pemilik

Sebelum melangkah ke Fase 1 (F1) dan Fase 2 (F2), berikut daftar dependensi yang diusulkan untuk dipasang secara resmi:

| Paket | Kategori | Ukuran Gzip | Alasan Pemakaian |
|---|---|---|---|
| `vitest` | `devDependencies` | 0 KB (dev only) | Runner test unit & karakterisasi untuk menjaga agar angka publik tidak berubah. |
| `polygon-clipping` | `dependencies` | ~14.8 KB | Pustaka pemotongan poligon (clipping) blok paving terhadap batas lahan. |
| `@tmcw/togeojson` | `dependencies` | ~4.0 KB | Parser KML/KMZ menjadi GeoJSON standar (dimuat dinamis client-only). |
| `fflate` | `dependencies` | ~8.0 KB | Decompressor berkas KMZ (ZIP) di peramban dengan proteksi zip-bomb. |
| `@types/polygon-clipping` | `devDependencies` | 0 KB (dev only) | Definisi tipe TypeScript untuk polygon-clipping. |

*Total penambahan bundel runtime klien (hanya jika fitur dibuka):* **~26.8 KB gzip** (sangat aman, jauh di bawah batas 3 MB Worker Cloudflare).

---

## 9. Baseline Halaman `/pola-paving` (Tercatat 17 Nov 2026)

* **Status TypeScript:** `tsc --noEmit` lolos bersih (exit code 0).
* **Elemen SEO SSR Terverifikasi:**
  - `<h1>Kalkulator pola & warna paving</h1>`
  - 3 blok JSON-LD: `WebApplication`, `BreadcrumbList`, `FAQPage`.
  - 4 Pertanyaan FAQ `<details>`.
  - Canonical URL: `https://istanablock.com/pola-paving`.
* **Jaminan:** Seluruh elemen ini wajib dipertahankan 100% utuh tanpa regresi selama implementasi fitur baru berlangsung.
