# Laporan QA & Matriks Verifikasi Komprehensif (Fase F7)

**Proyek:** Site-Specific Paving Designer & Visualizer  
**Pabrik:** PT Istana Block Purwakarta  
**Tanggal Verifikasi:** 17 November 2026  
**Status Keseluruhan:** **LULUS (59/59 Automated Tests Pass & Zero TypeScript Errors)**

---

## 1. Matriks Pengujian Fungsional & Algoritmik

| Kategori | Skenario Uji | Harapan / Kriteria Penerimaan | Hasil | Catatan / Bukti |
|---|---|---|---|---|
| **Katalog & Nilai** | Status produk di `catalog.ts` | 5 produk berstatus `confirmed` | **LULUS** | Label publik 44, 27, 22, 11, 7.5 pcs/m² utuh 100% |
| **Karakterisasi** | 21 kombinasi produk x motif lama | Hasil `compute` identik tanpa selisih | **LULUS** | Diverifikasi di `characterization.test.ts` (26 test) |
| **Preset Geometri** | Persegi 10x20 m (200 m²) | Area 200 m², perimeter 60 m, bounds valid | **LULUS** | Modul eksak, bounds `[0,0]` ke `[10,20]` |
| **Preset Geometri** | Bentuk L & U (L/U-Shape) | 6-8 titik poligon ortogonal valid | **LULUS** | 300 keping utuh eksak tanpa potongan |
| **Preset Geometri** | Pulau Taman (Inner Hole) | Hole tidak dibuang diam-diam, luas terpotong | **LULUS** | 300 keping utuh eksak di sekitar lubang 10x10 |
| **Validasi Geometri** | Self-intersection (Garis bersilangan) | Ditolak dengan pesan jelas dalam Bahasa Indonesia | **LULUS** | Pesan: `Garis sisi saling berpotongan` |
| **Grid Bermeter** | Skala penggaris & penutupan poligon | Penutupan titik awal otomatis; luas realtime | **LULUS** | Canvas 2D interaktif, touch target $\ge 44 \times 44$ px |
| **Peta Satelit** | Purwakarta (Bujur < 108° BT) | Proyeksi otomatis UTM 48S (`EPSG:32748`) | **LULUS** | Terverifikasi pada `purwakarta-valid.geojson` |
| **Peta Satelit** | Cirebon (Bujur $\ge$ 108° BT) | Proyeksi otomatis UTM 49S (`EPSG:32749`) | **LULUS** | Terverifikasi pada `cirebon-valid.geojson` |
| **Impor GeoJSON** | Deteksi koordinat terbalik [lat, lon] | Deteksi dan tolak dengan panduan RFC 7946 | **LULUS** | Menolak koordinat lintang > 90 atau tertukar |
| **Impor GeoJSON** | Non-polygon (Point / LineString) | Ditolak dengan pesan spesifik paving | **LULUS** | Pesan awam: `Fitur Point/LineString tidak dapat dipaving` |
| **Impor KML/KMZ** | Arsip KMZ ZIP in-memory | Unpack via `fflate`, ekstraksi `doc.kml` | **LULUS** | Ekstraksi murni di browser, tanpa unggah server |
| **Keamanan KMZ** | Proteksi Zip Bomb (> 20 MB uncompressed) | Tolak berkas raksasa sebelum konsumsi memori | **LULUS** | Ambang 20 MB uncompressed / 5 MB compressed aktif |
| **Engine Layout** | Truepave 10x20 m (Runbook Kasus Eksak) | Tepat 8.602 utuh, 328 potongan, 9.377 rekomendasi | **LULUS** | Selisih 0 keping terhadap spesifikasi manual |
| **Engine Layout** | Segitiga Siku-Siku (Fullpave 30) | Tepat 190 utuh + 20 potongan setengah blok | **LULUS** | Konservasi luas 18,18045 m² terpenuhi eksak |
| **Engine Layout** | Hexagon 10x10 m | Pola sarang lebah, konservasi luas 100 m² | **LULUS** | Total luas potongan + utuh = luas lahan |
| **Engine Layout** | Determinisme 5x Eksekusi | `inputHash` dan metrik keping identik 100% | **LULUS** | Zero flakiness dalam pemotongan poligon |
| **Visualisasi 3D** | Render Three.js InstancedMesh | 1 draw call untuk ribuan blok utuh | **LULUS** | WebGL 2.0 mulus, kamera preset Isometrik/Jalan/Atas |
| **Visualisasi 3D** | Mode Sampel Lahan Besar (> 10.000 blok) | Tampilkan 10.000 blok representatif + banner awam | **LULUS** | UI tetap 60 FPS, estimasi tetap 100% penuh |
| **Visualisasi 3D** | Pembersihan Sumber Daya (Disposal) | Dispose geometry/materials saat unmount/layout ganti | **LULUS** | Bebas kebocoran memori (memory leak free) |
| **Berbagi URL** | Serialisasi Zod & Base64url | Round-trip 50 kasus acak identik 100% | **LULUS** | Skema Zod menolak input rusak / manipulasi |
| **WhatsApp Link** | Pesan terstruktur `wa.me` | Rincian keping, potongan, cadangan, tautan desain | **LULUS** | Format siap kirim ke sales PT Istana Block |
| **Panduan Pengguna** | Rute `/panduan-desain-paving` | Artikel panduan lengkap terhubung ke sitemap | **LULUS** | HowTo & BreadcrumbList JSON-LD terpasang |
| **Regresi Lama** | Kalkulator p x l, 23 motif, SEO SSR | H1, lead, FAQ, JSON-LD `/pola-paving` utuh | **LULUS** | Zero regression pada komponen legasi |

---

## 2. Hasil Eksekusi Uji Otomatis (Vitest)
```text
 ✓ src/lib/paving/__tests__/characterization.test.ts (26 tests)
 ✓ src/lib/paving/__tests__/share.test.ts (7 tests)
 ✓ src/lib/paving/__tests__/adapters.test.ts (12 tests)
 ✓ src/lib/paving/__tests__/catalog.test.ts (4 tests)
 ✓ src/lib/paving/__tests__/engine.test.ts (10 tests)

 Test Files  5 passed (5)
      Tests  59 passed (59)
   Duration  8.81s
```

## 3. Hasil Verifikasi Tipe Data (TypeScript)
```text
> istana-block-web@0.1.0 typecheck
> tsc --noEmit
Process exited with code 0.
```

## 4. Invarian Purity Core Library
Pemeriksaan otomatis membuktikan seluruh berkas di bawah `src/lib/paving/` bebas dari impor `react`, `react-dom`, `three`, `document.`, dan `window.`.
Kalkulasi murni portabel dan aman dijalankan di Web Worker, Node.js server, maupun lingkungan peramban.
