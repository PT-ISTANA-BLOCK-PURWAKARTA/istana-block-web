"""Music + sound effects for the Istana Block reel, written as one piece (D major, 100 BPM)."""
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

SR = 48000
DUR = 22.0
N = int(SR * DUR)
rng = np.random.default_rng(7)
t_all = np.arange(N) / SR


def note(name):
    names = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}
    p, o = name[:-1], int(name[-1])
    midi = 12 * (o + 1) + names[p]
    return 440.0 * 2 ** ((midi - 69) / 12)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, "low", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def place(bus, sig, at, gain=1.0, pan=0.0):
    i = int(at * SR)
    if i >= N:
        return
    sig = sig[: N - i]
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    bus[0, i : i + len(sig)] += sig * gain * l
    bus[1, i : i + len(sig)] += sig * gain * r


def marimba(f, dur=0.9, bright=1.0):
    t = np.arange(int(SR * dur)) / SR
    env = np.exp(-t * 7.5)
    s = np.sin(2 * np.pi * f * t) + 0.35 * bright * np.sin(2 * np.pi * f * 4 * t) * np.exp(-t * 30) + 0.12 * np.sin(2 * np.pi * f * 10 * t) * np.exp(-t * 60)
    att = np.minimum(1, t / 0.003)
    return s * env * att


def pad(freqs, dur, attack=0.5, release=0.8):
    t = np.arange(int(SR * dur)) / SR
    s = np.zeros_like(t)
    for f in freqs:
        for det in (-0.12, 0.12):
            ff = f * 2 ** (det / 12)
            for h in range(1, 6):
                s += np.sin(2 * np.pi * ff * h * t + rng.uniform(0, 6.28)) / h ** 1.6
    env = np.minimum(1, t / attack) * np.minimum(1, (dur - t) / release)
    env = np.clip(env, 0, 1)
    s = lp(s, 1800) * env
    return s / (len(freqs) * 4)


def bass(f, dur=0.55):
    t = np.arange(int(SR * dur)) / SR
    env = np.exp(-t * 4.5) * np.minimum(1, t / 0.006)
    s = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t)
    return np.tanh(1.4 * s) * env


def kick():
    t = np.arange(int(SR * 0.3)) / SR
    f = 48 + 70 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 11) * np.minimum(1, t / 0.002)


def hat():
    t = np.arange(int(SR * 0.06)) / SR
    return hp(rng.standard_normal(len(t)), 7000) * np.exp(-t * 70)


def click(pitch=note("D6")):
    t = np.arange(int(SR * 0.08)) / SR
    n = bp(rng.standard_normal(len(t)), 1800, 5200) * np.exp(-t * 160)
    s = 0.6 * np.sin(2 * np.pi * pitch * t) * np.exp(-t * 55)
    return n * 0.5 + s


def key(pitch):
    t = np.arange(int(SR * 0.05)) / SR
    n = bp(rng.standard_normal(len(t)), 2500, 7000) * np.exp(-t * 220)
    return n * 0.45 + 0.35 * np.sin(2 * np.pi * pitch * t) * np.exp(-t * 90)


def whoosh(dur, lo=300, hi=3000):
    t = np.arange(int(SR * dur)) / SR
    env = np.sin(np.pi * t / dur) ** 2
    n = rng.standard_normal(len(t))
    # sweep by blending two band-passed versions
    a, b = bp(n, lo, lo * 3), bp(n, hi / 3, hi)
    mix = t / dur
    return (a * (1 - mix) + b * mix) * env


music = np.zeros((2, N))
sfx = np.zeros((2, N))

BEAT = 0.6
BAR = 4 * BEAT
CHORDS = [  # (start bar, root, chord tones)
    (0, "D2", ["D4", "F#4", "A4", "E5"]),
    (1, "D2", ["D4", "F#4", "A4", "C#5"]),
    (2, "B1", ["B3", "D4", "F#4", "A4"]),
    (3, "G1", ["G3", "B3", "D4", "F#4"]),
    (4, "A1", ["A3", "C#4", "E4", "G4"]),
    (5, "D2", ["D4", "F#4", "A4", "C#5"]),
    (6, "B1", ["B3", "D4", "F#4", "A4"]),
    (7, "G1", ["G3", "B3", "D4", "F#4"]),
    (8, "D2", ["D4", "F#4", "A4", "E5"]),
]

for i, (b, root, tones) in enumerate(CHORDS):
    start = b * BAR
    dur = min(BAR + 0.6, DUR - start) if b < 8 else DUR - start
    place(music, pad([note(x) for x in tones], dur, attack=0.6 if b else 1.0, release=0.9 if b < 8 else 2.0), start, 0.55)
    if 1 <= b <= 7:
        for beat in (0, 2):
            place(music, bass(note(root)), start + beat * BEAT, 0.33)
        # arpeggio: 8th notes up an octave
        arp = [note(x[:-1] + str(int(x[-1]) + 1)) for x in tones]
        order = [0, 1, 2, 3, 2, 1, 2, 3]
        for k in range(8):
            vel = 0.16 if k % 2 == 0 else 0.11
            place(music, marimba(arp[order[k]], 0.7, bright=0.8), start + k * BEAT / 2, vel, pan=(-0.3 if k % 2 else 0.3))
    if 2 <= b <= 7 and start >= 2.8 - 0.01 or b == 1:
        for beat in range(4):
            tt = start + beat * BEAT
            if tt >= 2.8:
                place(music, kick(), tt, 0.32 if beat % 2 == 0 else 0.0)
    if 2 <= b <= 7:
        for k in range(8):
            if k % 2 == 1:
                place(music, hat(), start + k * BEAT / 2, 0.035, pan=0.4)

# Hook: tiles being laid -> a soft rising arpeggio (D major pentatonic)
hook_notes = ["D5", "E5", "F#5", "A5", "B5", "D6", "E6", "F#6", "A6"]
for k, n_ in enumerate(hook_notes):
    place(music, marimba(note(n_), 0.8), 0.1 + k * 0.15, 0.13 - k * 0.005, pan=-0.5 + k * 0.12)

# Outro: final resolve chime on the logo
for n_, d in (("D6", 0), ("A6", 0.08), ("F#6", 0.16)):
    place(music, marimba(note(n_), 1.6), 18.95 + d, 0.16)

# ---- sound effects (in key, sitting under the music) ----
place(sfx, whoosh(0.5, 250, 2500), 2.45, 0.07)          # hook out / window in
place(sfx, whoosh(1.1, 200, 1200), 3.3, 0.035)          # scroll to calculator
for at in (4.9, 5.4, 6.4):
    place(sfx, click(note("D6")), at, 0.16, pan=0.2)
for at, p in ((5.55, "A5"), (5.7, "D6"), (5.85, "E6"), (6.55, "A5"), (6.72, "F#6")):
    place(sfx, key(note(p)), at, 0.14, pan=0.25)
for n_, d in (("A5", 0), ("D6", 0.07)):                  # result appears
    place(sfx, marimba(note(n_), 0.9), 6.9 + d, 0.14, pan=0.15)
place(sfx, click(note("A5")), 10.3, 0.17, pan=0.2)      # "Kirim ke admin"
for n_, d in (("F#5", 0), ("A5", 0.06)):                 # WhatsApp bubble pop
    place(sfx, marimba(note(n_), 0.5, bright=1.2), 10.52 + d, 0.13, pan=0.3)
place(sfx, whoosh(0.5, 300, 3000), 13.8, 0.06)          # page switch
place(sfx, whoosh(1.1, 200, 1200), 14.7, 0.03)          # scroll to price table
for n_, d in (("D6", 0), ("F#6", 0.07)):                 # row highlighted
    place(sfx, marimba(note(n_), 0.9), 16.1 + d, 0.12, pan=0.15)
place(sfx, whoosh(0.5, 250, 2500), 18.5, 0.06)          # window out

# ---- one shared space ----
def reverb(x, seconds=1.7, mix=0.22):
    t = np.arange(int(SR * seconds)) / SR
    ir = np.stack([rng.standard_normal(len(t)), rng.standard_normal(len(t))]) * np.exp(-t * 4.2)
    ir[:, : int(0.012 * SR)] = 0
    ir = np.stack([lp(ir[0], 6000), lp(ir[1], 6000)])
    wet = np.stack([fftconvolve(x[0], ir[0])[:N], fftconvolve(x[1], ir[1])[:N]])
    wet /= np.max(np.abs(wet)) + 1e-9
    dry_peak = np.max(np.abs(x)) + 1e-9
    return x + wet * dry_peak * mix

bus = music * 1.0 + sfx * 0.85
bus = np.stack([hp(bus[0], 35), hp(bus[1], 35)])
bus = reverb(bus)
# gentle fade at the end so the loop/ending is clean
fade = np.clip((DUR - t_all) / 0.6, 0, 1)
bus *= fade
bus = np.tanh(bus / (np.max(np.abs(bus)) + 1e-9) * 1.1) / np.tanh(1.1)
bus *= 10 ** (-1.5 / 20)
wavfile.write(str(__import__("pathlib").Path(__file__).with_name("out") / "audio.wav"), SR, (bus.T * 32767).astype(np.int16))
print("ok", bus.shape, float(np.sqrt(np.mean(bus ** 2))))
