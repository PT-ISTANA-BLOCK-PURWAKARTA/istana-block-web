"""Pick take 3, tighten long pauses (cut only inside silence), speed up 5% without pitch change."""
import numpy as np, soundfile as sf, subprocess, json, sys
SRC = sys.argv[1]; OUT = str(__import__("pathlib").Path(__file__).with_name("out") / "vo")
TAKE = {1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3}
FR = 0.02
res = {}
for n, k in TAKE.items():
    x, sr = sf.read(f"{SRC}/takes/vo-{n}-take{k}.wav", dtype="float32")
    fr = int(sr * FR); m = len(x) // fr
    rms = np.sqrt((x[: m * fr].reshape(m, fr) ** 2).mean(1) + 1e-12)
    loud = 20 * np.log10(rms / rms.max()) > -38
    idx = np.where(loud)[0]; a, b = idx[0], idx[-1]
    # trim to speech with 60 ms margins
    x = x[max(0, a * fr - int(0.06 * sr)) : min(len(x), (b + 1) * fr + int(0.06 * sr))]
    off = max(0, a * fr - int(0.06 * sr))
    # find internal gaps
    gaps = []; run = 0
    for i in range(a, b + 1):
        if not loud[i]:
            run += 1
        else:
            if run * FR >= 0.3: gaps.append((i - run, run))
            run = 0
    pieces = []; cur = 0; xf = int(0.012 * sr)
    for g0, glen in gaps:
        dur = glen * FR
        target = 0.45 if dur >= 0.8 else 0.32
        if dur <= target: continue
        cut = int((dur - target) * sr)
        mid = g0 * fr - off + (glen * fr) // 2
        s0, s1 = mid - cut // 2, mid + cut - cut // 2
        pieces.append(x[cur:s0]); cur = s1
    pieces.append(x[cur:])
    y = pieces[0]
    for p in pieces[1:]:  # short crossfade inside silence
        if len(y) > xf and len(p) > xf:
            w = np.linspace(0, 1, xf, dtype=np.float32)
            y = np.concatenate([y[:-xf], y[-xf:] * (1 - w) + p[:xf] * w, p[xf:]])
        else:
            y = np.concatenate([y, p])
    tmp = f"{OUT}/vo-{n}.tight.wav"; sf.write(tmp, y, sr, subtype="FLOAT")
    out = f"{OUT}/vo-{n}.wav"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp, "-af", "atempo=1.05", "-ar", "48000", "-ac", "1", "-c:a", "pcm_f32le", out], check=True)
    d = sf.info(out).duration
    res[n] = round(d, 2)
    print(f"vo-{n}: take{k} {len(x)/sr:.2f}s -> tightened {len(y)/sr:.2f}s -> tempo {d:.2f}s  (gaps {[round(g[1]*FR,2) for g in gaps]})")
json.dump(res, open(f"{OUT}/durations.json", "w"))
