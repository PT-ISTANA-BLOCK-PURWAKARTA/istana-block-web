"""VO version soundtrack: music + SFX (same key, same space) re-timed to the 28.6 s cut, VO on top, music ducked under the voice."""
import json, subprocess
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile
import soundfile as sf

SR = 48000
DUR = 28.6
N = int(SR * DUR)
W = str(__import__("pathlib").Path(__file__).with_name("out"))
rng = np.random.default_rng(7)
t_all = np.arange(N) / SR

VO_MAP = [(0, 0), (1.9, 1.9), (4.2, 2.5), (5.1, 3.4), (8.5, 6.8), (8.6, 6.9), (12.6, 9.7), (13.85, 10.95), (16.7, 14.0),
          (19.15, 16.45), (21.3, 18.6), (22.6, 19.9), (28.2, 21.6), (28.6, 22.0)]


def u_of(t):  # scene time -> output time
    for (u0, t0), (u1, t1) in zip(VO_MAP, VO_MAP[1:]):
        if t <= t1:
            return u0 + (u1 - u0) * ((t - t0) / (t1 - t0) if t1 > t0 else 0)
    return DUR


VO_AT = {1: 0.25, 2: 4.75, 3: 8.55, 4: 13.0, 5: 16.85, 6: 21.6}


def note(name):
    names = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}
    p, o = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((12 * (o + 1) + names[p] - 69) / 12)


def lp(x, f, o=2): return sosfilt(butter(o, f, "low", fs=SR, output="sos"), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, "high", fs=SR, output="sos"), x)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], "band", fs=SR, output="sos"), x)


def place(bus, sig, at, gain=1.0, pan=0.0):
    i = int(at * SR)
    if i >= N: return
    sig = sig[: N - i]
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    bus[0, i:i + len(sig)] += sig * gain * l
    bus[1, i:i + len(sig)] += sig * gain * r


def marimba(f, dur=0.9, bright=1.0):
    t = np.arange(int(SR * dur)) / SR
    s = np.sin(2 * np.pi * f * t) + 0.35 * bright * np.sin(2 * np.pi * f * 4 * t) * np.exp(-t * 30) + 0.12 * np.sin(2 * np.pi * f * 10 * t) * np.exp(-t * 60)
    return s * np.exp(-t * 7.5) * np.minimum(1, t / 0.003)


def pad(freqs, dur, attack=0.5, release=0.8):
    t = np.arange(int(SR * dur)) / SR
    s = np.zeros_like(t)
    for f in freqs:
        for det in (-0.12, 0.12):
            ff = f * 2 ** (det / 12)
            for h in range(1, 6):
                s += np.sin(2 * np.pi * ff * h * t + rng.uniform(0, 6.28)) / h ** 1.6
    env = np.clip(np.minimum(1, t / attack) * np.minimum(1, (dur - t) / release), 0, 1)
    return lp(s, 1800) * env / (len(freqs) * 4)


def bass(f, dur=0.55):
    t = np.arange(int(SR * dur)) / SR
    return np.tanh(1.4 * (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t))) * np.exp(-t * 4.5) * np.minimum(1, t / 0.006)


def kick():
    t = np.arange(int(SR * 0.3)) / SR
    ph = 2 * np.pi * np.cumsum(48 + 70 * np.exp(-t * 28)) / SR
    return np.sin(ph) * np.exp(-t * 11) * np.minimum(1, t / 0.002)


def hat():
    t = np.arange(int(SR * 0.06)) / SR
    return hp(rng.standard_normal(len(t)), 7000) * np.exp(-t * 70)


def click(pitch):
    t = np.arange(int(SR * 0.08)) / SR
    return bp(rng.standard_normal(len(t)), 1800, 5200) * np.exp(-t * 160) * 0.5 + 0.6 * np.sin(2 * np.pi * pitch * t) * np.exp(-t * 55)


def key(pitch):
    t = np.arange(int(SR * 0.05)) / SR
    return bp(rng.standard_normal(len(t)), 2500, 7000) * np.exp(-t * 220) * 0.45 + 0.35 * np.sin(2 * np.pi * pitch * t) * np.exp(-t * 90)


def whoosh(dur, lo=300, hi=3000):
    t = np.arange(int(SR * dur)) / SR
    n = rng.standard_normal(len(t))
    m = t / dur
    return (bp(n, lo, lo * 3) * (1 - m) + bp(n, hi / 3, hi) * m) * np.sin(np.pi * t / dur) ** 2


music = np.zeros((2, N)); sfx = np.zeros((2, N))
BEAT = 0.6; BAR = 2.4
CHORDS = [(0, "D2", ["D4", "F#4", "A4", "E5"]), (1, "D2", ["D4", "F#4", "A4", "C#5"]), (2, "B1", ["B3", "D4", "F#4", "A4"]),
          (3, "G1", ["G3", "B3", "D4", "F#4"]), (4, "A1", ["A3", "C#4", "E4", "G4"]), (5, "D2", ["D4", "F#4", "A4", "C#5"]),
          (6, "B1", ["B3", "D4", "F#4", "A4"]), (7, "G1", ["G3", "B3", "D4", "F#4"]), (8, "A1", ["A3", "C#4", "E4", "G4"]),
          (9, "D2", ["D4", "F#4", "A4", "E5"]), (10, "G1", ["G3", "B3", "D4", "F#4"]), (11, "D2", ["D4", "F#4", "A4", "E5"])]
DRUMS = (u_of(3.4) - 0.3, u_of(18.6))  # from window-in to outro
for b, root, tones in CHORDS:
    start = b * BAR
    if start >= DUR: break
    dur = min(BAR + 0.6, DUR - start) if b < 11 else DUR - start
    place(music, pad([note(x) for x in tones], dur, attack=1.0 if b == 0 else 0.6, release=2.0 if b >= 10 else 0.9), start, 0.55)
    arp = [note(x[:-1] + str(int(x[-1]) + 1)) for x in tones]
    if 1 <= b <= 8:
        for beat in (0, 2):
            place(music, bass(note(root)), start + beat * BEAT, 0.33)
        for k, o in enumerate([0, 1, 2, 3, 2, 1, 2, 3]):
            place(music, marimba(arp[o], 0.7, 0.8), start + k * BEAT / 2, 0.16 if k % 2 == 0 else 0.11, pan=(-0.3 if k % 2 else 0.3))
    elif b >= 9:  # outro: slower, quarter notes
        for k, o in enumerate([0, 2, 1, 3]):
            place(music, marimba(arp[o], 1.0, 0.7), start + k * BEAT, 0.10, pan=(-0.2 if k % 2 else 0.2))
    for beat in range(4):
        tt = start + beat * BEAT
        if DRUMS[0] <= tt < DRUMS[1] and beat % 2 == 0:
            place(music, kick(), tt, 0.30)
    for k in range(8):
        tt = start + k * BEAT / 2
        if DRUMS[0] + BAR <= tt < DRUMS[1] and k % 2 == 1:
            place(music, hat(), tt, 0.035, pan=0.4)

for k, n_ in enumerate(["D5", "E5", "F#5", "A5", "B5", "D6", "E6", "F#6", "A6"]):  # tiles being laid
    place(music, marimba(note(n_), 0.8), 0.1 + k * 0.15, 0.13 - k * 0.005, pan=-0.5 + k * 0.12)
for n_, d in (("D6", 0), ("A6", 0.08), ("F#6", 0.16)):  # logo
    place(music, marimba(note(n_), 1.6), u_of(18.95) + d, 0.16)

# SFX at the re-timed scene events
place(sfx, whoosh(0.5, 250, 2500), u_of(2.5) - 0.05, 0.07)
place(sfx, whoosh(1.1, 200, 1200), u_of(3.3), 0.035)
for at in (4.9, 5.4, 6.4):
    place(sfx, click(note("D6")), u_of(at), 0.16, pan=0.2)
for at, p in ((5.55, "A5"), (5.7, "D6"), (5.85, "E6"), (6.55, "A5"), (6.72, "F#6")):
    place(sfx, key(note(p)), u_of(at), 0.14, pan=0.25)
for n_, d in (("A5", 0), ("D6", 0.07)):
    place(sfx, marimba(note(n_), 0.9), u_of(6.9) + d, 0.14, pan=0.15)
place(sfx, click(note("A5")), u_of(10.3), 0.17, pan=0.2)
for n_, d in (("F#5", 0), ("A5", 0.06)):
    place(sfx, marimba(note(n_), 0.5, 1.2), u_of(10.52) + d, 0.13, pan=0.3)
place(sfx, whoosh(0.5, 300, 3000), u_of(13.8), 0.06)
place(sfx, whoosh(1.1, 200, 1200), u_of(14.7), 0.03)
for n_, d in (("D6", 0), ("F#6", 0.07)):
    place(sfx, marimba(note(n_), 0.9), u_of(16.1) + d, 0.12, pan=0.15)
place(sfx, whoosh(0.5, 250, 2500), u_of(18.5), 0.06)


def reverb(x, seconds=1.7, mix=0.22):
    t = np.arange(int(SR * seconds)) / SR
    ir = np.stack([rng.standard_normal(len(t)), rng.standard_normal(len(t))]) * np.exp(-t * 4.2)
    ir[:, : int(0.012 * SR)] = 0
    ir = np.stack([lp(ir[0], 6000), lp(ir[1], 6000)])
    wet = np.stack([fftconvolve(x[0], ir[0])[:N], fftconvolve(x[1], ir[1])[:N]])
    wet /= np.max(np.abs(wet)) + 1e-9
    return x + wet * (np.max(np.abs(x)) + 1e-9) * mix


bed = reverb(np.stack([hp(c, 35) for c in (music + sfx * 0.85)]))
bed /= np.max(np.abs(bed)) + 1e-9

# ---- VO: clean, gentle EQ + compression (ffmpeg), then place ----
vo = np.zeros(N)
for n_, at in VO_AT.items():
    src, dst = f"{W}/vo/vo-{n_}.wav", f"{W}/vo/vo-{n_}.proc.wav"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-af",
                    "highpass=f=85,equalizer=f=280:t=q:w=1.2:g=-2,equalizer=f=3600:t=q:w=1.0:g=2,"
                    "acompressor=threshold=-20dB:ratio=3:attack=6:release=90:makeup=2,alimiter=limit=0.9",
                    "-ar", str(SR), "-ac", "1", dst], check=True)
    y, _ = sf.read(dst, dtype="float64")
    y /= np.max(np.abs(y)) + 1e-9
    i = int(at * SR)
    vo[i:i + len(y)] += y[: N - i]

# ---- duck the bed under the voice ----
win = int(0.05 * SR)
env = np.sqrt(np.convolve(vo ** 2, np.ones(win) / win, mode="same"))
active = (env > 0.02).astype(float)
duck_db = -9.0
target = 1 + (10 ** (duck_db / 20) - 1) * active
gain = np.empty_like(target); g = 1.0
a_att, a_rel = np.exp(-1 / (0.06 * SR)), np.exp(-1 / (0.35 * SR))
for k in range(N):  # one-pole smoothing: fast down, slow up
    c = a_att if target[k] < g else a_rel
    g = target[k] + (g - target[k]) * c
    gain[k] = g

mix = bed * gain * 0.85 + np.stack([vo, vo]) * 0.78
mix *= np.clip((DUR - t_all) / 0.6, 0, 1)  # clean ending
mix /= np.max(np.abs(mix)) + 1e-9
mix *= 0.89
wavfile.write(f"{W}/audio-vo-premaster.wav", SR, (mix.T * 32767).astype(np.int16))
# loudness to -14 LUFS, true peak -1 dBTP
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", f"{W}/audio-vo-premaster.wav", "-af",
                "loudnorm=I=-14:TP=-1.0:LRA=9", "-ar", str(SR), f"{W}/audio-vo.wav"], check=True)
print("ok")
