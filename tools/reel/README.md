# Video fitur (reel)

Video di beranda (`public/reel/`) direkam dari **UI asli** situs: kalkulator paving diisi sungguhan, tombol "Kirim ke admin" diklik, dan tabel harga U-Ditch di-scroll. Folder ini berisi semua yang dibutuhkan untuk membuatnya ulang bila tampilan situs berubah.

| File | Fungsi |
|---|---|
| `storyboard.md` | rencana scene, teks layar, dan timing |
| `reel.html` | komposisi scene; memuat `/` dan `/produk/u-ditch` asli dalam bingkai browser/ponsel, semua gerak adalah fungsi waktu |
| `render.mjs` | merender frame demi frame dengan Playwright lalu menyalurkannya ke ffmpeg |
| `audio.py` | musik + efek suara versi 22 dtk (D mayor, 100 BPM) |
| `generate_vo.py` | membuat voice-over (Edge/Azure/ElevenLabs/TTS lokal) |
| `vo_prep.py` | memilih take, merapikan jeda, tempo +5% |
| `audio_vo.py` | mix versi ber-VO 28,6 dtk: musik turun otomatis saat suara bicara, loudness -14 LUFS |

## Membuat ulang

Butuh: Node 20+, Python 3 (`numpy scipy soundfile`), ffmpeg, dan `npm i -D playwright && npx playwright install chromium`.

```bash
npm run preview                       # situs berjalan di http://localhost:8787 (data D1 lokal)
cd tools/reel && mkdir -p out
node render.mjs land video out/master-land.mkv        # loop senyap 16:9, 22 dtk
node render.mjs vert video out/master-vert.mkv        # loop senyap 9:16
node render.mjs land stills 3,7.5,11,17 out           # cek still sebelum render penuh

# versi ber-suara
python generate_vo.py --engine edge --voice id-ID-GadisNeural --takes 3 --out vo-output
python vo_prep.py vo-output
node render.mjs land video out/master-land-vo.mkv vo
node render.mjs vert video out/master-vert-vo.mkv vo
python audio_vo.py
```

Lalu encode ke `public/reel-src/` (poster & subtitle ada di `public/reel/`) (ukuran web 1280×720 / 720×1280):

```bash
ffmpeg -i out/master-land.mkv -vf scale=1280:720 -c:v libx264 -crf 25 -pix_fmt yuv420p -an -movflags +faststart ../../public/reel-src/reel-16x9.mp4
ffmpeg -i out/master-land.mkv -vf scale=1280:720 -c:v libvpx-vp9 -b:v 0 -crf 36 -row-mt 1 -an ../../public/reel-src/reel-16x9.webm
ffmpeg -i out/master-land-vo.mkv -i out/audio-vo.wav -vf scale=1280:720 -c:v libx264 -crf 25 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart ../../public/reel-src/reel-16x9-suara.mp4
# ulangi untuk vert (720:1280 → reel-9x16*.mp4/webm) dan versi -suara.webm (libopus)
```

Catatan: bagian video di beranda otomatis disembunyikan saat merekam, dan posisi scroll diukur dari elemen asli (`.calc-form`, `#harga`), jadi perubahan tata letak kecil tetap aman.
