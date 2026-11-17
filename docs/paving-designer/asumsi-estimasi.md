# Asumsi dan Formula Estimasi Material Paving Designer

**Versi:** 1.0.0 (Fase F2)  
**Dokumen Pendamping:** `rencana-implementasi-paving-designer-agent.md` dan `langkah-eksekusi-paving-designer-agent.md`

Dokumen ini mendokumentasikan asumsi matematis, formula perhitungan material, dan toleransi yang diterapkan pada Core Engine Paving Designer.

---

## 1. Formula Perhitungan Unit Paving

Pada lahan berbatas nyata (non-persegi panjang), estimasi kebutuhan paving dihitung langsung dari geometri clipping poligon per keping:

$$\text{baseUnits} = \text{fullUnits} + \text{estimatedStockUnitsForCuts}$$

$$\text{reserveUnits} = \lceil \text{baseUnits} \times \frac{\text{reservePercent}}{100} \rceil$$

$$\text{recommendedPurchaseUnits} = \text{baseUnits} + \text{reserveUnits}$$

### Definisi Variabel
- **`fullUnits`**: Jumlah keping paving utuh yang berada sepenuhnya (100%) di dalam batas lahan tanpa terpotong.
- **`cutInstalledPieces`**: Jumlah potongan keping terpasang di sepanjang garis batas atau lubang.
- **`estimatedStockUnitsForCuts`**: Jumlah keping bahan paving utuh yang harus disediakan untuk menghasilkan potongan-potongan tersebut.
- **`reservePercent`**: Persentase cadangan (pilihan: 0%, 3%, 5%, 10%). Pola lurus disarankan 5%; pola miring 45° dan hexagon disarankan 10%.
- **`recommendedPurchaseUnits`**: Rekomendasi total keping paving yang dipesan oleh pelanggan.

---

## 2. Aturan Pemotongan (Cut Rule)

- **Standar Konservatif Lapangan (Provisional):**  
  Setiap 1 keping terpasang yang terpotong diasumsikan membutuhkan 1 keping paving utuh sebagai bahan potong di lapangan:
  $$\text{estimatedStockUnitsForCuts} = \text{cutInstalledPieces}$$
- **Alasan:** Pada praktek pemotongan paving manual menggunakan *paving block cutter* mekanis (guillotine) atau gerinda potong di lapangan, sisa potongan seringkali tidak simetris atau retak sehingga tidak dapat digunakan kembali untuk sisi lain.
- **Ambang Toleransi Potongan Penuh (`FULL_TOLERANCE_M2`):**  
  Jika luas potongan keping $\ge \text{luas blok} - 0{,}0005\text{ m}^2$ (selisih $\le 5\text{ cm}^2$), keping tersebut diklasifikasikan sebagai **utuh (`full`)**.
- **Ambang Sliver (`SLIVER_THRESHOLD_M2`):**  
  Potongan fragmen mikro dengan luas $< 0{,}0001\text{ m}^2$ ($< 1\text{ cm}^2$) diabaikan dari tata letak untuk kerapihan dan stabilitas numerik.

---

## 3. Estimasi Material Pendukung

- **Abu Batu (Lapis Alas Perata / Sand Bed):**
  - Ketebalan rata: **5 cm** ($0{,}05\text{ m}$) padat.
  - Formula: $\text{Volume (m}^3\text{)} = \text{Luas Lahan (m}^2\text{)} \times 0{,}05$.
- **Base Course (Lapis Pondasi / Aggregate Base):**
  - Ketebalan rata: **20 cm** ($0{,}20\text{ m}$) padat (disarankan untuk area lalu lintas kendaraan).
  - Formula: $\text{Volume (m}^3\text{)} = \text{Luas Lahan (m}^2\text{)} \times 0{,}20$.
- **Kanstin (Pembatas Tepi / Kerb):**
  - Pilihan panjang keping: **40 cm** atau **60 cm**.
  - Formula: $\text{Keping} = \lceil (\text{Panjang Pembatas (m)} \times 100) / \text{Panjang Kanstin (cm)} \rceil$.

---

## 4. Konvensi Sumbu dan Geometri

- **Satuan:** Meter (m) untuk koordinat bidang lokal, meter persegi ($\text{m}^2$) untuk luas.
- **Arah Putaran Ring (Winding):**
  - Batas Luar (Exterior Ring): Berlawanan arah jarum jam (*Counter-Clockwise* / CCW).
  - Lubang (Interior Hole Rings): Searah jarum jam (*Clockwise* / CW).
- **Pemetaan ke Ruang Tiga Dimensi (Three.js):**
  - Sumbu Planar $X \to \text{World } X$.
  - Sumbu Planar $Y \to \text{World } Z$.
  - Ketinggian Tebal $\to \text{World } Y$.
- **Determinisme:**  
  Setiap kombinasi geometri dan konfigurasi menghasilkan `inputHash` unik dan tata letak deterministik 100% konsisten pada setiap eksekusi.
