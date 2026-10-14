# Brag plan — Istana Block: fitur yang berguna di situs

**What:** Situs pabrik beton Istana Block Purwakarta. Pengunjung bisa menghitung kebutuhan paving, melihat harga per ukuran, lalu memesan lewat WhatsApp dengan pesan yang sudah terisi.
**For whom:** pemilik rumah dan kontraktor di Purwakarta, Jawa Barat, dan Jabodetabek.
**What sets it apart:** dari ukuran halaman langsung jadi jumlah blok, lalu langsung jadi pesan ke admin, tanpa harus menelepon atau bertanya harga dulu.
**Hook:** pertanyaan nyata, "Halaman 12 × 8 m. Butuh berapa paving?", dijawab oleh kalkulator asli: 2.722 pcs.
**Use:** dipasang sebagai loop senyap ala GIF di beranda (16:9 untuk desktop, 9:16 untuk ponsel), juga sebagai video untuk dibagikan (dengan audio).
**Tone:** default dengan sentuhan polished: bersih, hangat, sesuai brand. Biru #254186 / #0E2A6B, oranye #FE5722, abu beton #F1F1EE, Poppins + Plus Jakarta Sans, motif paving segi enam.
**Share caption:** lihat share-copy.txt

## Real UI used
- Beranda (`/`) dimuat langsung dari app (Next.js + D1 lokal) di dalam bingkai browser (desktop 1140 px) atau ponsel (390 px, skala 2×).
- Kalkulator asli: pilih "Hexagon", ketik panjang 12, lebar 8, dan React langsung menghitung 2.722 pcs.
- Tombol asli "Kirim ke admin": teks pesan WhatsApp diambil dari href tombol tersebut.
- Halaman `/produk/u-ditch`: tabel harga asli di-scroll, baris 600 × 600 × 1200 (Rp640.000) disorot.
- Overlay tambahan hanya kursor, sorotan, dan gelembung pesan berisi teks asli dari tombol.

## Storyboard (22 s, 30 fps)
| # | Time | Scene | On-screen text |
|---|---|---|---|
| 1 | 0.0–2.8 | Hook: segi enam paving tersusun satu per satu di latar abu beton | "Halaman 12 × 8 m. Butuh berapa paving?" |
| 2 | 2.8–9.7 | Jendela browser masuk → beranda asli scroll ke kalkulator → klik motif Hexagon → ketik 12 lalu 8 → hasil 2.722 pcs disorot | "Kalkulator paving" / "Butuh berapa blok? Langsung ketahuan." / "Isi panjang dan lebar. Sudah termasuk cadangan 5%." |
| 3 | 9.7–13.7 | Klik "Kirim ke admin" → gelembung WhatsApp berisi teks prefill asli | "Kirim ke admin, sekali klik." / "Pesan WhatsApp terisi otomatis." |
| 4 | 13.7–18.5 | Pindah ke halaman U-Ditch asli → scroll ke tabel harga → sorot baris Rp640.000 | "Daftar harga" / "Harga per ukuran, terbuka." / "12 ukuran U-Ditch dan 5 cover, lengkap dengan berat." |
| 5 | 18.5–22.0 | Outro: logo, nama, ringkasan fitur, domain; sisi akhir memudar ke latar agar loop mulus | "Hitung, cek harga, pesan — dari satu situs." / istanablockpurwakarta.com |

Transisi: konten lama keluar dulu, baru konten baru masuk; pergantian halaman memudar lewat warna latar, bukan crossfade.

## Sound (versi share saja; versi web senyap)
D mayor, 100 BPM: pad lembut dan arpeggio marimba, kick halus mulai scene 2. Efek suara bernada D mayor dengan reverb yang sama: ketukan ketik kecil, klik lembut, "ding" saat hasil keluar, pop saat gelembung muncul, whoosh tipis saat pindah halaman.
