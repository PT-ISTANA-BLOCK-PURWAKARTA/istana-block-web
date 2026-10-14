#!/usr/bin/env python3
"""
Generate voice-over (VO) untuk video fitur Istana Block (durasi 22 detik).

Hasil (di folder --out, default "vo-output"):
  vo-1.wav … vo-6.wav   satu file per kalimat, WAV 48 kHz mono 16-bit,
                        hening di awal/akhir dipotong lalu diberi jeda 0,2 dtk
  vo-guide.wav          keenam kalimat ditempatkan di detik yang sesuai video
                        (dengarkan untuk mengecek sinkron)
  timing.json           durasi tiap kalimat vs jendela waktunya
  takes/                variasi take (kalau --takes > 1)
  raw/                  file mentah dari mesin TTS

Pasang dependensi (Windows: ganti "python" dengan "py"):
  python -m pip install numpy soundfile scipy
  python -m pip install edge-tts          # hanya untuk --engine edge

Contoh pemakaian:
  # 1) Gratis, cepat, cocok untuk draf & cek timing (suara Microsoft Edge)
  python generate_vo.py --engine edge --voice id-ID-GadisNeural
  python generate_vo.py --engine edge --voice id-ID-ArdiNeural --takes 3
  python generate_vo.py --engine edge --list-voices

  # 2) Azure Speech (suara sama dengan Edge, resmi & boleh komersial; free tier tersedia)
  set AZURE_SPEECH_KEY=xxxx            (PowerShell: $env:AZURE_SPEECH_KEY="xxxx")
  python generate_vo.py --engine azure --voice id-ID-GadisNeural --region southeastasia

  # 3) ElevenLabs (paling natural; pilih voice berbahasa Indonesia di Voice Library)
  set ELEVENLABS_API_KEY=xxxx
  python generate_vo.py --engine elevenlabs --voice <VOICE_ID> --takes 3

  # 4) Mesin TTS lokal apa pun lewat command line (Piper, Coqui, dsb.)
  #    {out} = file WAV keluaran, {text_file} = file teks UTF-8; teks juga dikirim lewat stdin
  python generate_vo.py --engine cmd --cmd "piper --model MODEL_INDONESIA.onnx --output_file {out}"

Opsi berguna:
  --only 3,5        buat ulang kalimat tertentu saja
  --rate +5         percepat semua kalimat 5% (edge/azure); --speed 1.05 untuk ElevenLabs
  --respell         pakai ejaan bantu (WhatsApp → "Wotsap", dst.) bila pelafalan TTS salah

Catatan lisensi: untuk video promosi usaha, pakai Azure Speech atau ElevenLabs paket berbayar.
Mode "edge" memakai layanan baca-nyaring Microsoft Edge dan sebaiknya hanya untuk draf.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from math import gcd
from pathlib import Path
from xml.sax.saxutils import escape

import numpy as np
import soundfile as sf

try:
    from scipy.signal import resample_poly
except ImportError:  # scipy opsional; tanpa scipy file disimpan di sample rate aslinya
    resample_poly = None

try:
    sys.stdout.reconfigure(encoding="utf-8")  # agar tanda — dan × tampil di konsol Windows
except Exception:
    pass

TARGET_SR = 48_000
TIMELINE = 22.0  # durasi video (detik)
PAD = 0.2        # jeda hening di awal & akhir tiap file

# ---------------------------------------------------------------------------
# NASKAH — ubah teks di sini bila perlu. start/end = jendela waktu di video.
# rate/pitch hanya dipakai mesin edge & azure; ElevenLabs mengikuti tanda baca.
# ---------------------------------------------------------------------------
LINES = [
    dict(id=1, start=0.2, end=3.2, rate="+0%", pitch="+0Hz",
         text="Halaman dua belas kali delapan meter. Butuh berapa paving?",
         arah="Pertanyaan yang bikin penasaran; nada naik di 'berapa paving?'."),
    dict(id=2, start=3.4, end=6.6, rate="+3%", pitch="+0Hz",
         text="Di situs Istana Block, cukup isi panjang dan lebarnya.",
         arah="Santai menjelaskan; tekan sedikit kata 'cukup'."),
    dict(id=3, start=6.9, end=9.6, rate="-2%", pitch="+0Hz",
         text="Langsung ketahuan: dua ribu tujuh ratus dua puluh dua blok.",
         arah="Jeda kecil setelah 'ketahuan', angka diucapkan jelas, sedikit bangga."),
    dict(id=4, start=10.2, end=13.6, rate="+5%", pitch="+0Hz",
         text="Klik sekali, hasilnya terkirim ke admin lewat WhatsApp.",
         arah="Ringan dan cepat; tekan kata 'sekali'."),
    dict(id=5, start=14.3, end=17.8, rate="+0%", pitch="+0Hz",
         text="Harga tiap ukuran juga terbuka, tanpa perlu tanya dulu.",
         arah="Menenangkan; tekan kata 'terbuka'."),
    dict(id=6, start=18.8, end=22.0, rate="-6%", pitch="-2Hz",
         text="Istana Block Purwakarta. Hitung, cek harga, pesan — dari satu situs.",
         arah="Sedikit melambat; nama brand jelas, penutup hangat."),
]

# Ejaan bantu (hanya dipakai dengan --respell). Dengarkan dulu hasil tanpa respell.
RESPELL = {
    "WhatsApp": "Wotsap",
    "Istana Block": "Istana Blok",
    "paving": "peving",
}

# Variasi tempo untuk --takes di mesin yang hasilnya selalu sama (edge/azure/cmd)
RATE_VARIANTS = [0, -4, 4, -8, 8]


# ---------------------------------------------------------------------------
# Mesin TTS
# ---------------------------------------------------------------------------
def shift_rate(rate: str, delta: int) -> str:
    v = int(rate.replace("%", "")) + delta
    return f"{v:+d}%"


def synth_edge(text: str, out: Path, voice: str, rate: str, pitch: str) -> Path:
    import edge_tts

    async def run():
        await edge_tts.Communicate(text, voice, rate=rate, pitch=pitch).save(str(out))

    asyncio.run(run())
    return out


def list_edge_voices():
    import edge_tts

    async def run():
        return await edge_tts.list_voices()

    for v in asyncio.run(run()):
        if v.get("Locale", "").startswith("id-"):
            print(f"{v['ShortName']:28s} {v.get('Gender', '')}")


def synth_azure(text: str, out: Path, voice: str, rate: str, pitch: str, key: str, region: str) -> Path:
    ssml = (
        '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="id-ID">'
        f'<voice name="{escape(voice)}"><prosody rate="{rate}" pitch="{pitch}">{escape(text)}</prosody></voice></speak>'
    )
    req = urllib.request.Request(
        f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1",
        data=ssml.encode("utf-8"),
        headers={
            "Ocp-Apim-Subscription-Key": key,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": "riff-48khz-16bit-mono-pcm",
            "User-Agent": "istana-block-vo",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        out.write_bytes(r.read())
    return out


def synth_elevenlabs(text: str, out: Path, voice_id: str, key: str, model: str, prev: str | None,
                     nxt: str | None, seed: int | None, settings: dict) -> Path:
    body: dict = {"text": text, "model_id": model, "voice_settings": settings}
    if not model.startswith("eleven_v3"):  # kontinuitas intonasi antar-kalimat
        if prev:
            body["previous_text"] = prev
        if nxt:
            body["next_text"] = nxt
    if seed is not None:
        body["seed"] = seed
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_128",
        data=json.dumps(body).encode("utf-8"),
        headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg"},
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            out.write_bytes(r.read())
    except urllib.error.HTTPError as e:
        raise SystemExit(f"ElevenLabs error {e.code}: {e.read().decode('utf-8', 'replace')}")
    return out


def synth_cmd(text: str, out: Path, template: str) -> Path:
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8") as f:
        f.write(text)
        tf = f.name
    cmd = (template.replace("{out}", f'"{out}"')
                   .replace("{text_file}", f'"{tf}"')
                   .replace("{text}", text.replace('"', "'")))
    try:
        subprocess.run(cmd, shell=True, input=text.encode("utf-8"), check=True)
    finally:
        os.unlink(tf)
    if not out.exists():
        raise SystemExit(f"Perintah TTS tidak menghasilkan {out}. Pastikan template memakai {{out}}.")
    return out


# ---------------------------------------------------------------------------
# Olah audio
# ---------------------------------------------------------------------------
def load_mono(path: Path) -> tuple[np.ndarray, int]:
    try:
        x, sr = sf.read(str(path), dtype="float32", always_2d=True)
    except Exception:
        # libsndfile lama tidak bisa membaca MP3; coba lewat ffmpeg bila terpasang
        if not shutil.which("ffmpeg"):
            raise SystemExit(f"Tidak bisa membaca {path.name}. Perbarui soundfile (pip install -U soundfile) atau pasang ffmpeg.")
        wav = path.with_suffix(".decoded.wav")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(path), str(wav)], check=True)
        x, sr = sf.read(str(wav), dtype="float32", always_2d=True)
    return x.mean(axis=1), sr


def to_target_sr(x: np.ndarray, sr: int) -> tuple[np.ndarray, int]:
    if sr == TARGET_SR or resample_poly is None:
        return x, sr
    g = gcd(sr, TARGET_SR)
    return resample_poly(x, TARGET_SR // g, sr // g).astype(np.float32), TARGET_SR


def trim_silence(x: np.ndarray, sr: int, thresh_db: float = -40.0, margin: float = 0.03) -> np.ndarray:
    frame = max(1, int(sr * 0.01))
    n = len(x) // frame
    if n == 0:
        return x
    rms = np.sqrt(np.mean(x[: n * frame].reshape(n, frame) ** 2, axis=1) + 1e-12)
    db = 20 * np.log10(rms / (rms.max() + 1e-12))
    loud = np.where(db > thresh_db)[0]
    if len(loud) == 0:
        return x
    a = max(0, loud[0] * frame - int(margin * sr))
    b = min(len(x), (loud[-1] + 1) * frame + int(margin * sr))
    return x[a:b]


def finish(x: np.ndarray, sr: int) -> np.ndarray:
    # fade 5 ms supaya potongan tidak "klik", lalu jeda, lalu normalisasi puncak ke -3 dBFS
    f = min(len(x) // 2, int(0.005 * sr))
    if f > 0:
        x = x.copy()
        x[:f] *= np.linspace(0, 1, f)
        x[-f:] *= np.linspace(1, 0, f)
    pad = np.zeros(int(PAD * sr), dtype=np.float32)
    y = np.concatenate([pad, x, pad])
    peak = float(np.abs(y).max())
    if peak > 0:
        y = y / peak * 10 ** (-3 / 20)
    return y.astype(np.float32)


def process(raw: Path, dest: Path) -> tuple[float, int, np.ndarray]:
    x, sr = load_mono(raw)
    x, sr = to_target_sr(x, sr)
    speech = trim_silence(x, sr)
    y = finish(speech, sr)
    sf.write(str(dest), y, sr, subtype="PCM_16")
    return len(speech) / sr, sr, y


# ---------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="Generate VO untuk video fitur Istana Block.")
    ap.add_argument("--engine", choices=["edge", "azure", "elevenlabs", "cmd"], default="edge")
    ap.add_argument("--voice", help="edge/azure: mis. id-ID-GadisNeural | elevenlabs: voice ID")
    ap.add_argument("--out", default="vo-output")
    ap.add_argument("--only", help="nomor kalimat dipisah koma, mis. 3,5")
    ap.add_argument("--takes", type=int, default=1, help="jumlah variasi per kalimat (maks 5)")
    ap.add_argument("--rate", type=int, default=0, help="edge/azure: ubah tempo semua kalimat dalam persen, mis. 5 atau -5")
    ap.add_argument("--respell", action="store_true", help="pakai ejaan bantu dari RESPELL")
    ap.add_argument("--list-voices", action="store_true", help="tampilkan suara Indonesia (edge)")
    # azure
    ap.add_argument("--region", default=os.environ.get("AZURE_SPEECH_REGION", "southeastasia"))
    # elevenlabs
    ap.add_argument("--model", default="eleven_multilingual_v2")
    ap.add_argument("--stability", type=float, default=0.45)
    ap.add_argument("--similarity", type=float, default=0.75)
    ap.add_argument("--style", type=float, default=0.2)
    ap.add_argument("--speed", type=float, default=1.0)
    # cmd
    ap.add_argument("--cmd", help='template perintah, mis. "piper --model X.onnx --output_file {out}"')
    args = ap.parse_args()

    if args.list_voices:
        list_edge_voices()
        return

    if args.engine in ("edge", "azure") and not args.voice:
        args.voice = "id-ID-GadisNeural"
    if args.engine == "elevenlabs" and not args.voice:
        raise SystemExit("--voice <VOICE_ID> wajib untuk ElevenLabs.")
    if args.engine == "cmd" and not args.cmd:
        raise SystemExit('--cmd wajib untuk engine cmd, mis. --cmd "piper --model X.onnx --output_file {out}"')
    azure_key = os.environ.get("AZURE_SPEECH_KEY")
    eleven_key = os.environ.get("ELEVENLABS_API_KEY")
    if args.engine == "azure" and not azure_key:
        raise SystemExit("Isi variabel lingkungan AZURE_SPEECH_KEY dulu.")
    if args.engine == "elevenlabs" and not eleven_key:
        raise SystemExit("Isi variabel lingkungan ELEVENLABS_API_KEY dulu.")

    takes = max(1, min(5, args.takes))
    only = {int(s) for s in args.only.split(",")} if args.only else None
    out = Path(args.out)
    (out / "raw").mkdir(parents=True, exist_ok=True)
    if takes > 1:
        (out / "takes").mkdir(exist_ok=True)

    def say(text: str) -> str:
        if args.respell:
            for k, v in RESPELL.items():
                text = text.replace(k, v)
        return text

    texts = [say(l["text"]) for l in LINES]
    results = {}
    timing_path = out / "timing.json"
    if timing_path.exists():
        results = {int(k): v for k, v in json.loads(timing_path.read_text(encoding="utf-8")).items()}

    for i, line in enumerate(LINES):
        n = line["id"]
        if only and n not in only:
            continue
        text = texts[i]
        print(f"[{n}/6] {text}")
        for k in range(takes):
            ext = ".wav" if args.engine in ("azure", "cmd") else ".mp3"
            raw = out / "raw" / f"vo-{n}-take{k + 1}{ext}"
            rate = shift_rate(line["rate"], args.rate + (RATE_VARIANTS[k] if args.engine != "elevenlabs" else 0))
            if args.engine == "edge":
                try:
                    synth_edge(text, raw, args.voice, rate, line["pitch"])
                except Exception as e:
                    raise SystemExit(f"Gagal menghubungi layanan Edge TTS ({type(e).__name__}: {e}). Cek koneksi internet.")
            elif args.engine == "azure":
                synth_azure(text, raw, args.voice, rate, line["pitch"], azure_key, args.region)
            elif args.engine == "elevenlabs":
                settings = {"stability": args.stability, "similarity_boost": args.similarity,
                            "style": args.style, "use_speaker_boost": True, "speed": args.speed}
                synth_elevenlabs(text, raw, args.voice, eleven_key, args.model,
                                 texts[i - 1] if i > 0 else None,
                                 texts[i + 1] if i + 1 < len(texts) else None,
                                 seed=1000 + k * 17 + n, settings=settings)
            else:
                synth_cmd(text, raw, args.cmd)

            dest = out / (f"vo-{n}.wav" if k == 0 else f"takes/vo-{n}-take{k + 1}.wav")
            dur, sr, _ = process(raw, dest)
            if takes > 1 and k == 0:
                shutil.copy(dest, out / "takes" / f"vo-{n}-take1.wav")
            label = "" if takes == 1 else f" take {k + 1} (tempo {rate})" if args.engine != "elevenlabs" else f" take {k + 1}"
            print(f"      {dur:4.2f} dtk{label}")
            if k == 0:
                results[n] = {"durasi": round(dur, 2), "mulai": line["start"], "jendela": round(line["end"] - line["start"], 2),
                              "teks": line["text"], "sample_rate": sr}

    timing_path.write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")

    # --- file panduan 22 detik + laporan timing ---
    guide_sr = None
    clips = []
    for line in LINES:
        f = out / f"vo-{line['id']}.wav"
        if f.exists():
            y, sr = sf.read(str(f), dtype="float32")
            guide_sr = guide_sr or sr
            clips.append((line, y, sr))
    if clips and guide_sr:
        total = max(TIMELINE, max(l["start"] + len(y) / sr for l, y, sr in clips))
        guide = np.zeros(int(total * guide_sr) + 1, dtype=np.float32)
        for l, y, sr in clips:
            if sr != guide_sr:
                continue
            a = max(0, int((l["start"] - PAD) * guide_sr))
            guide[a : a + len(y)] += y[: len(guide) - a]
        peak = float(np.abs(guide).max()) or 1.0
        sf.write(str(out / "vo-guide.wav"), guide / max(1.0, peak), guide_sr, subtype="PCM_16")

    print("\nTiming (durasi bicara vs jendela di video):")
    for line in LINES:
        r = results.get(line["id"])
        if not r:
            continue
        over = r["durasi"] - r["jendela"]
        mark = "OK " if over <= 0 else ("~  " if over <= 0.5 else "!! ")
        note = "" if over <= 0 else f"  lebih {over:.1f} dtk"
        print(f"  {mark} vo-{line['id']}: {r['durasi']:.2f} / {r['jendela']:.2f} dtk{note}")
    print("\n'~' masih aman (scene akan saya sesuaikan). '!!' coba --rate 6 / --speed 1.06, atau kirim saja apa adanya.")
    print(f"Selesai. Kirim file vo-1.wav … vo-6.wav dari folder: {out.resolve()}")


if __name__ == "__main__":
    main()
