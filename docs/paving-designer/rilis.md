# Rencana Rilis & Prosedur Rollback — Paving Designer (Fase F7)

**Proyek:** Site-Specific Paving Designer & Visualizer  
**Pabrik:** PT Istana Block Purwakarta  
**Target Rilis:** Produksi (`istanablock.com/pola-paving`)  
**Tanggal Penyusunan:** 17 November 2026  
**Status Kesiapan:** **SIAP RILIS (Menunggu Persetujuan Eksekusi Pemilik)**

---

## 1. Ringkasan Deliverables yang Dirilis

1. **Katalog Tunggal Produk (`src/lib/paving/catalog.ts`):**
   - 5 produk utama berstatus `confirmed`: Truepave, Hexagon, Fullpave 21, Fullpave 30, Grass Block.
   - Label publik resmi tetap dipertahankan: **44, 27, 22, 11, dan 7,5 pcs/m²**.
2. **Engine Geometri Murni (`src/lib/paving/`):**
   - Pemotongan poligon lahan sembarang (`polygon-clipping`), lubang taman (*inner holes*), dan batas lahan tidak beraturan.
   - Algoritma tata letak (*lattice*) presisi tanpa *flakiness* (5x determinisme terverifikasi).
   - Invarian kemurnian: 0 impor React, Three.js, maupun DOM di dalam folder core library.
3. **5 Jalur Masukan Lahan Komprehensif:**
   - **Bentuk Siap Pakai:** Persegi panjang, L-shape, U-shape, trapesium.
   - **Grid Bermeter:** Kanvas interaktif dengan penggaris skala meter dan sentuhan ramah HP ($\ge 44 \times 44$ px).
   - **Peta Satelit Interaktif:** Leaflet + Citra Udara Esri World Imagery dengan deteksi otomatis UTM Zona 48S / 49S.
   - **Impor GeoJSON (RFC 7946):** Validasi CRS WGS84, deteksi koordinat tertukar, dan penolakan fitur non-poligon.
   - **Impor KML & KMZ:** Ekstraksi in-memory berbasis `fflate` dengan proteksi terhadap *Zip Bomb* ($> 20$ MB).
4. **Visualisasi 3D Interaktif (Three.js):**
   - Render blok utuh via `InstancedMesh` (1 draw call untuk ribuan blok).
   - Render potongan tepi via `ExtrudeGeometry` bevel 2mm.
   - Ambang proteksi perangkat: Otomatis beralih ke Mode Sampel representatif jika total blok $> 10.000$ keping.
   - Siklus hidup WebGL aman: Pelepasan memori (*resource disposal*) saat pergantian bentuk.
5. **Web Worker Threading:**
   - Komputasi tata letak berat dijalankan di `layout.worker.ts` agar antarmuka pengguna tidak membeku (*freeze*).
   - Fallback otomatis ke komputasi sinkron jika lingkungan peramban membatasi Worker.
6. **Berbagi Tautan & Integrasi WhatsApp:**
   - Serialisasi ringkas `ShareState` dengan validasi ketat skema Zod.
   - Tombol kirim otomatis ke WhatsApp Sales PT Istana Block dengan rincian material terstruktur dan tautan desain.
7. **Dokumentasi & Edukasi Pengguna:**
   - Rute publik baru: `/panduan-desain-paving` (dilengkapi JSON-LD HowTo & BreadcrumbList, terdaftar di sitemap).
   - Naskah storyboard video: `docs/paving-designer/video/storyboard-impor-dan-peta.md`.

---

## 2. Checklist Kesiapan Pra-Rilis

- [x] `npm run typecheck` (`tsc --noEmit`) lolos dengan **0 error**.
- [x] `npm test` lolos dengan **59/59 tes hijau (100% pass)**.
- [x] Invarian Purity: Tidak ada impor `react`, `react-dom`, `three`, `document.`, atau `window.` di `src/lib/paving/`.
- [x] Zero Regression: Kalkulator lama, 23 motif, kanstin, abu batu, base course, H1, FAQ, dan JSON-LD SSR tetap utuh tanpa perubahan.
- [x] Aksesibilitas HP: Touch target $\ge 44 \times 44$ px, responsif tanpa horizontal scroll pada lebar layar 360 px.
- [x] Keamanan Berkas: Ekstraksi GeoJSON/KML/KMZ berjalan 100% lokal di browser pengguna tanpa pengunggahan ke server.

---

## 3. Titik STOP: Persetujuan Deploy

> [!IMPORTANT]
> Sesuai arahan baku runbook Bagian 4:
> **Agent dilarang melakukan push ke `main`, merge PR produksi, atau menjalankan deploy produksi (`npm run deploy`) tanpa perintah eksplisit dari Pemilik Proyek.**

---

## 4. Prosedur Deploy (Bila Diperintahkan Pemilik)

1. **Merge Branch:**
   Gabungkan PR `fitur/paving-designer-f7-qa-rilis` ke branch `main`.
2. **Verifikasi Build:**
   ```bash
   cmd.exe /c "cd istana-block-web && npm run build"
   ```
   Pastikan First Load JS `/pola-paving` dan bundel Worker gzip tetap berada di bawah batas aman Cloudflare ($< 3$ MB).
3. **Eksekusi Deploy:**
   ```bash
   cmd.exe /c "cd istana-block-web && npm run deploy"
   ```
   (Atau biarkan pipeline Cloudflare Workers Builds memproses commit terbaru di `main`).

---

## 5. Prosedur Rollback Cepat (Emergency Plan)

Jika setelah rilis ditemukan kendala tak terduga pada peramban klien tertentu:

1. **Rollback Instan via Flag Komponen Dinamis (Zero-Downtime):**
   Komponen `PavingDesigner` dimuat secara dinamis (`next/dynamic` dengan `ssr: false`).
   Cukup beri komentar atau hapus pemanggilan `<PavingDesigner />` pada `src/app/(site)/pola-paving/page.tsx` baris 122:
   ```tsx
   {/* <PavingDesigner whatsapp={s.whatsapp} /> */}
   ```
   Kalkulator pola lama akan langsung berjalan seperti sedia kala tanpa sisa jejak modul baru.
2. **Rollback Versi Worker di Cloudflare Dashboard:**
   - Buka Cloudflare Dashboard &rarr; Workers & Pages &rarr; `istana-block-web`.
   - Buka tab **Deployments**.
   - Pilih versi sebelumnya (misal versi stabil terakhir sebelum rilis Paving Designer) &rarr; klik **Rollback**.
   - Peramban pengguna akan langsung dilayani oleh versi stabil sebelumnya dalam hitungan detik.
