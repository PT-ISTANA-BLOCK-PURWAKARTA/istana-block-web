"""Generate 22.0s D-major (100 BPM) music + SFX soundtrack using numpy + stdlib wave."""
from pathlib import Path
import wave
import numpy as np

SR = 48000
DUR = 22.0
N = int(SR * DUR)
rng = np.random.default_rng(7)
t_all = np.arange(N) / SR


def note(name: str) -> float:
    names = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}
    p, o = name[:-1], int(name[-1])
    midi = 12 * (o + 1) + names[p]
    return 440.0 * 2 ** ((midi - 69) / 12)


def _fft_filter(x: np.ndarray, gain_fn) -> np.ndarray:
    n = len(x)
    n_fft = 1 << (n - 1).bit_length()
    freqs = np.fft.rfftfreq(n_fft, d=1.0 / SR)
    spec = np.fft.rfft(x, n=n_fft)
    h = gain_fn(freqs)
    return np.fft.irfft(spec * h, n=n_fft)[:n]


def lp(x: np.ndarray, f: float, order: int = 2) -> np.ndarray:
    return _fft_filter(x, lambda fr: 1.0 / np.sqrt(1.0 + (fr / f) ** (2 * order)))


def hp(x: np.ndarray, f: float, order: int = 2) -> np.ndarray:
    def g(fr):
        safe = np.maximum(fr, 1e-6)
        out = 1.0 / np.sqrt(1.0 + (f / safe) ** (2 * order))
        out[0] = 0.0
        return out
    return _fft_filter(x, g)


def bp(x: np.ndarray, lo: float, hi: float, order: int = 2) -> np.ndarray:
    def g(fr):
        safe = np.maximum(fr, 1e-6)
        h_hp = 1.0 / np.sqrt(1.0 + (lo / safe) ** (2 * order))
        h_hp[0] = 0.0
        h_lp = 1.0 / np.sqrt(1.0 + (fr / hi) ** (2 * order))
        return h_hp * h_lp
    return _fft_filter(x, g)


def fft_convolve(x: np.ndarray, ir: np.ndarray) -> np.ndarray:
    n_fft = 1 << (len(x) + len(ir) - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, n_fft) * np.fft.rfft(ir, n_fft), n_fft)[: len(x)]


def place(bus: np.ndarray, sig: np.ndarray, at: float, gain: float = 1.0, pan: float = 0.0) -> None:
    i = int(at * SR)
    if i >= N:
        return
    sig = sig[: N - i]
    l_gain = np.cos((pan + 1) * np.pi / 4)
    r_gain = np.sin((pan + 1) * np.pi / 4)
    bus[0, i : i + len(sig)] += sig * gain * l_gain
    bus[1, i : i + len(sig)] += sig * gain * r_gain


def marimba(f: float, dur: float = 0.9, bright: float = 1.0) -> np.ndarray:
    t = np.arange(int(SR * dur)) / SR
    env = np.exp(-t * 7.5)
    s = (
        np.sin(2 * np.pi * f * t)
        + 0.35 * bright * np.sin(2 * np.pi * f * 4 * t) * np.exp(-t * 30)
        + 0.12 * np.sin(2 * np.pi * f * 10 * t) * np.exp(-t * 60)
    )
    att = np.minimum(1.0, t / 0.003)
    return s * env * att


def pad(freqs, dur: float, attack: float = 0.5, release: float = 0.8) -> np.ndarray:
    t = np.arange(int(SR * dur)) / SR
    s = np.zeros_like(t)
    for f in freqs:
        for det in (-0.12, 0.12):
            ff = f * 2 ** (det / 12)
            for h in range(1, 6):
                s += np.sin(2 * np.pi * ff * h * t + rng.uniform(0, 6.28)) / (h ** 1.6)
    env = np.minimum(1.0, t / attack) * np.minimum(1.0, (dur - t) / release)
    env = np.clip(env, 0.0, 1.0)
    s = lp(s, 1800.0) * env
    return s / (len(freqs) * 4)


def bass(f: float, dur: float = 0.55) -> np.ndarray:
    t = np.arange(int(SR * dur)) / SR
    env = np.exp(-t * 4.5) * np.minimum(1.0, t / 0.006)
    s = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t)
    return np.tanh(1.4 * s) * env


def kick() -> np.ndarray:
    t = np.arange(int(SR * 0.3)) / SR
    f = 48 + 70 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 11) * np.minimum(1.0, t / 0.002)


def hat() -> np.ndarray:
    t = np.arange(int(SR * 0.06)) / SR
    return hp(rng.standard_normal(len(t)), 7000.0) * np.exp(-t * 70)


def click(pitch: float) -> np.ndarray:
    t = np.arange(int(SR * 0.08)) / SR
    n = bp(rng.standard_normal(len(t)), 1800.0, 5200.0) * np.exp(-t * 160)
    s = 0.6 * np.sin(2 * np.pi * pitch * t) * np.exp(-t * 55)
    return n * 0.5 + s


def key_tap(pitch: float) -> np.ndarray:
    t = np.arange(int(SR * 0.05)) / SR
    n = bp(rng.standard_normal(len(t)), 2500.0, 7000.0) * np.exp(-t * 220)
    return n * 0.45 + 0.35 * np.sin(2 * np.pi * pitch * t) * np.exp(-t * 90)


def whoosh(dur: float, lo: float = 300.0, hi: float = 3000.0) -> np.ndarray:
    t = np.arange(int(SR * dur)) / SR
    env = np.sin(np.pi * t / dur) ** 2
    n = rng.standard_normal(len(t))
    a, b = bp(n, lo, lo * 3), bp(n, hi / 3, hi)
    mix = t / dur
    return (a * (1 - mix) + b * mix) * env


def reverb(x: np.ndarray, seconds: float = 1.7, mix: float = 0.22) -> np.ndarray:
    t = np.arange(int(SR * seconds)) / SR
    ir = np.stack([rng.standard_normal(len(t)), rng.standard_normal(len(t))]) * np.exp(-t * 4.2)
    ir[:, : int(0.012 * SR)] = 0
    ir = np.stack([lp(ir[0], 6000.0), lp(ir[1], 6000.0)])
    wet = np.stack([fft_convolve(x[0], ir[0]), fft_convolve(x[1], ir[1])])
    wet /= np.max(np.abs(wet)) + 1e-9
    dry_peak = np.max(np.abs(x)) + 1e-9
    return x + wet * dry_peak * mix


def main() -> None:
    music = np.zeros((2, N))
    sfx = np.zeros((2, N))

    BEAT = 0.6
    BAR = 4 * BEAT
    CHORDS = [
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

    for b, root, tones in CHORDS:
        start = b * BAR
        dur = min(BAR + 0.6, DUR - start) if b < 8 else DUR - start
        place(music, pad([note(x) for x in tones], dur, attack=0.6 if b else 1.0, release=0.9 if b < 8 else 2.0), start, 0.55)
        if 1 <= b <= 7:
            for beat in (0, 2):
                place(music, bass(note(root)), start + beat * BEAT, 0.33)
            arp = [note(x[:-1] + str(int(x[-1]) + 1)) for x in tones]
            order = [0, 1, 2, 3, 2, 1, 2, 3]
            for k in range(8):
                vel = 0.16 if k % 2 == 0 else 0.11
                place(music, marimba(arp[order[k]], 0.7, bright=0.8), start + k * BEAT / 2, vel, pan=(-0.3 if k % 2 else 0.3))
        if 2 <= b <= 7 and start >= 2.79 or b == 1:
            for beat in range(4):
                tt = start + beat * BEAT
                if tt >= 2.8:
                    place(music, kick(), tt, 0.32 if beat % 2 == 0 else 0.0)
        if 2 <= b <= 7:
            for k in range(8):
                if k % 2 == 1:
                    place(music, hat(), start + k * BEAT / 2, 0.035, pan=0.4)

    # Hook: tiles rising arpeggio
    for k, n_ in enumerate(["D5", "E5", "F#5", "A5", "B5", "D6", "E6", "F#6", "A6"]):
        place(music, marimba(note(n_), 0.8), 0.15 + k * 0.16, 0.13 - k * 0.005, pan=-0.5 + k * 0.12)

    # Outro: resolve chime
    for n_, d in (("D6", 0.0), ("A6", 0.09), ("F#6", 0.18)):
        place(music, marimba(note(n_), 1.6), 18.6 + d, 0.16)

    # UI SFX synced to our 22s HyperFrames scenes:
    # Scene 2 entry (3.0s) -> calculator clicks & typing (4.4 - 6.6) -> result chime (6.8) -> WA bubble (10.3) -> Scene 4 U-Ditch (13.8) -> row highlight (15.8) -> Outro (18.4)
    place(sfx, whoosh(0.5, 250, 2500), 2.8, 0.07)
    for at in (4.4, 5.0, 5.9):
        place(sfx, click(note("D6")), at, 0.16, pan=0.2)
    for at, p in ((5.15, "A5"), (5.3, "D6"), (6.05, "F#6")):
        place(sfx, key_tap(note(p)), at, 0.14, pan=0.25)
    for n_, d in (("A5", 0.0), ("D6", 0.07)):
        place(sfx, marimba(note(n_), 0.9), 6.8 + d, 0.15, pan=0.15)
    place(sfx, click(note("A5")), 10.2, 0.17, pan=0.2)
    for n_, d in (("F#5", 0.0), ("A5", 0.06)):
        place(sfx, marimba(note(n_), 0.5, bright=1.2), 10.4 + d, 0.14, pan=0.3)
    place(sfx, whoosh(0.5, 300, 3000), 13.7, 0.06)
    for n_, d in (("D6", 0.0), ("F#6", 0.07)):
        place(sfx, marimba(note(n_), 0.9), 15.8 + d, 0.13, pan=0.15)
    place(sfx, whoosh(0.5, 250, 2500), 18.3, 0.06)

    bus = music * 1.0 + sfx * 0.85
    bus = np.stack([hp(bus[0], 35.0), hp(bus[1], 35.0)])
    bus = reverb(bus)
    fade = np.clip((DUR - t_all) / 0.6, 0.0, 1.0)
    bus *= fade
    bus = np.tanh(bus / (np.max(np.abs(bus)) + 1e-9) * 1.1) / np.tanh(1.1)
    bus *= 10 ** (-1.5 / 20)

    out_path = Path(__file__).parent / "assets" / "audio-22s.wav"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    pcm = np.clip(bus.T * 32767.0, -32768, 32767).astype("<i2")
    with wave.open(str(out_path), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes(pcm.tobytes())
    print("wrote", out_path, pcm.shape, "rms:", float(np.sqrt(np.mean(bus ** 2))))


if __name__ == "__main__":
    main()
