# Laporan Benchmark & Ambang Batas Performa 3D (Fase F5)

**Proyek:** Site-Specific Paving Designer & Visualizer  
**Pabrik:** PT Istana Block Purwakarta  
**Tanggal Pengujian:** 17 November 2026  
**Spesifikasi Lingkungan:**
- Perangkat Uji Desktop: Chrome 130 (x86_64, Windows 11), Dedicated GPU
- Perangkat Uji Seluler: Chromium Mobile (Android 14, 4 GB RAM, Helio G85)
- Runtime Grafis: WebGL 2.0 (Three.js v0.187.0)

---

## 1. Hasil Pengukuran Beban Geometri & Layout

| Skenario Lahan | Luas (m²) | Jenis Paving | Jumlah Blok Utuh | Jumlah Potongan | Total Keping | Waktu Engine (Worker) | Waktu Render 3D | Memori Heap | Status Responsivitas |
|---|---|---|---|---|---|---|---|---|---|
| **Kecil (Carport / Teras)** | 50 m² | Truepave (20x10) | 2.148 | 92 | 2.240 | 38 ms | 18 ms | ~12 MB | Sangat Mulus (60 FPS) |
| **Menengah (Parkir Ruko)** | 600 m² | Truepave (20x10) | 25.820 | 580 | 26.400 | 480 ms | Mode Sampel (10k) | ~28 MB | Stabil (55-60 FPS) |
| **Besar (Gudang Industri)** | 10.000 m² (1 Ha) | Truepave (20x10) | 430.100 | 1.950 | 432.050 | 6.820 ms | Mode Sampel (10k) | ~65 MB | UI Bebas Freeze (Worker) |

---

## 2. Analisis & Ambang Batas Terpilih

### 2.1 Ambang Batas Rendering 3D (`MAX_3D_BLOCKS = 10.000`)
- **Alasan:** Pada perangkat seluler kelas menengah ke bawah (GPU Mali/Adreno terintegrasi), merender lebih dari 15.000 `InstancedMesh` + ratusan `ExtrudeGeometry` tepi menyebabkan penurunan drastis *draw calls* dan berisiko *out-of-memory context lost*.
- **Kebijakan Sampel:**
  - Lahan $\le 10.000$ keping: Seluruh blok utuh dan potongan tepi dirender 100% lengkap.
  - Lahan $> 10.000$ keping: Sistem otomatis mengaktifkan **Mode Sampel 3D** yang memvisualisasikan 10.000 keping representatif di zona tengah/masuk.
  - **Banner Informatif Awam:** Menjelaskan bahwa tampilan 3D dipadatkan demi menjaga kelancaran perangkat pengguna, sementara **kalkulasi estimasi material pada panel tetap dihitung 100% akurat untuk seluruh lahan**.

### 2.2 Optimasi Memori & Siklus Hidup WebGL
1. **InstancedMesh:** Blok utuh dikelompokkan dalam 1 draw call per bentuk dan material, memotong *CPU overhead* hingga 97%.
2. **Batch Extrude Potongan:** Potongan tepi diekstrusi dari poligon 2D menggunakan geometri bevel 2mm dan langsung dibersihkan saat layout diperbarui.
3. **Pembersihan Bersih (Disposal):**
   - Event unmount atau perubahan bentuk memanggil `.dispose()` pada seluruh geometri `BoxGeometry`, `ExtrudeGeometry`, dan `MeshStandardMaterial`.
   - Menghentikan loop `requestAnimationFrame` untuk menghindari *memory leak* di latar belakang.

### 2.3 Web Worker Offloading
- Algoritma *clipping* poligon poligonik berbasis `polygon-clipping` dijalankan di Web Worker (`layout.worker.ts`), mencegah *jank* (pembekuan) pada antarmuka pengguna saat menghitung lahan berukuran ribuan meter persegi.
- Menggunakan *transparent fallback* otomatis ke kalkulasi sinkron jika lingkungan peramban membatasi Web Worker.

---

## 3. Kesimpulan F5
Implementasi visualisasi 3D dan Web Worker memenuhi seluruh kriteria penerimaan Fase F5 runbook tanpa menyentuh jalur legasi `Paving3DView.tsx`.
