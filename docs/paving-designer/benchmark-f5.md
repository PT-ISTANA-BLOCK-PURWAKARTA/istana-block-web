# Benchmark Performa Engine Layout Paving Designer (F5, dikoreksi T3)

**Proyek:** Site-Specific Paving Designer & Visualizer
**Pabrik:** PT Istana Block Purwakarta
**Koreksi:** 19 November 2026 (tahap T3). Versi sebelumnya memuat angka yang tidak pernah diukur
(perangkat uji Windows 11 dan Android Helio G85, FPS, memori heap, waktu render 3D) dan klaim
"seluruh kriteria lulus". Semua klaim itu dicabut. Dokumen ini hanya memuat angka yang terukur.

---

## 1. Hasil terukur (tahap T1, optimasi engine)

Pengukuran waktu engine layout (`generateLayout`) untuk lahan persegi, paving Truepave motif `bata`,
sebelum dan sesudah jalur cepat keping utuh serta pemindahan layout ke Web Worker.

| Skenario lahan | Engine sebelum T1 | Engine sesudah T1 |
|---|---|---|
| 600 m² | 734 ms | 71 ms |
| 5.000 m² | 4,9 detik | 1,25 detik |

Kebenaran hasil: jumlah keping (utuh dan potongan) identik antara jalur cepat dan clipping penuh
pada 240 kasus fuzz (`src/lib/paving/__tests__/fastpath.test.ts`).

## 2. Yang TIDAK diukur

- Waktu render 3D, FPS, dan pemakaian memori di perangkat nyata (desktop maupun seluler).
  Tampilan 3D mati bawaan sejak T1; ambang `MAX_3D_BLOCKS` adalah pilihan desain, bukan hasil benchmark.
- Lahan 10.000 m² (1 Ha).
- Perilaku di Web Worker pada peramban nyata (angka di atas adalah waktu engine murni).

## 3. Metode

- Skrip: `scripts/bench-paving.ts`. Jalankan `npx tsx scripts/bench-paving.ts` di Node 22.
- Tiap skenario: satu pemanasan, lima ulangan, dilaporkan median dan rentang.
- Yang diukur hanya `generateLayout` (tanpa worker, tanpa render, tanpa estimasi material).
- Angka tabel bagian 1 berasal dari pengukuran T1 pada mesin yang sama untuk kedua versi.
  Waktu mutlak bergantung perangkat dan beban mesin; yang bermakna adalah rasio sebelum/sesudah.
- Catatan T3: ukur ulang dengan skrip di atas saat mesin dev sedang dipakai agen lain
  (load average 20) menghasilkan angka yang tidak valid (600 m² median 2,1 detik) sehingga tidak
  dipakai. Ulangi pada mesin tenang sebelum mengutip angka baru.
