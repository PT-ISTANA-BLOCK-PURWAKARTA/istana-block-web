const MUTE_KEY = "ib-ops-alarm-muted";

let audioCtx: AudioContext | null = null;

export interface PushAlarmEvent {
  kind: "alarm" | "delivery";
  tag: string;
}

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (audioCtx) return audioCtx;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  audioCtx = new Ctor();
  return audioCtx;
}

export function isAlarmMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAlarmMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (muted) window.localStorage.setItem(MUTE_KEY, "1");
    else window.localStorage.removeItem(MUTE_KEY);
  } catch {
    // Abaikan jika storage terkunci.
  }
}

/** Buka/resume AudioContext saat ada interaksi pengguna agar alarm SW bisa berbunyi. */
export function unlockAlarmAudio(): void {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
}

/** Mainkan bunyi chime Web Audio + getaran perangkat (jika diizinkan & tidak di-mute). */
export function playAlarm(kind: "alarm" | "delivery" = "alarm"): void {
  if (typeof window === "undefined" || isAlarmMuted()) return;

  try {
    if (kind === "alarm") {
      navigator.vibrate?.([450, 150, 450, 150, 600]);
    } else {
      navigator.vibrate?.([220, 100, 220]);
    }
  } catch {
    // Beberapa browser memblokir vibrate sebelum gesture.
  }

  const ctx = getAudioContext();
  if (!ctx) return;

  const scheduleNotes = () => {
    const t0 = ctx.currentTime + 0.02;
    const tones =
      kind === "alarm"
        ? [
            { start: 0, freq: 880, dur: 0.14 },
            { start: 0.16, freq: 1046.5, dur: 0.18 },
            { start: 0.44, freq: 880, dur: 0.14 },
            { start: 0.6, freq: 1046.5, dur: 0.24 },
          ]
        : [
            { start: 0, freq: 659.25, dur: 0.14 },
            { start: 0.17, freq: 880, dur: 0.22 },
          ];

    for (const tone of tones) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = kind === "alarm" ? "triangle" : "sine";
      osc.frequency.setValueAtTime(tone.freq, t0 + tone.start);
      gain.gain.setValueAtTime(0.001, t0 + tone.start);
      gain.gain.exponentialRampToValueAtTime(kind === "alarm" ? 0.22 : 0.14, t0 + tone.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + tone.start + tone.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0 + tone.start);
      osc.stop(t0 + tone.start + tone.dur + 0.02);
    }
  };

  if (ctx.state === "suspended") {
    ctx.resume().then(scheduleNotes).catch(() => {});
  } else {
    scheduleNotes();
  }
}

/** Dengarkan pesan push dari Service Worker dan bunyikan alarm untuk tag `alarm-` / `delivery-`. */
export function listenForPushAlarms(onEvent?: (ev: PushAlarmEvent) => void): () => void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return () => {};

  const handleMessage = (event: MessageEvent) => {
    const data = event.data as { type?: string; tag?: string | null } | null;
    if (!data || data.type !== "push" || typeof data.tag !== "string") return;

    if (data.tag.startsWith("alarm-")) {
      playAlarm("alarm");
      onEvent?.({ kind: "alarm", tag: data.tag });
    } else if (data.tag.startsWith("delivery-")) {
      playAlarm("delivery");
      onEvent?.({ kind: "delivery", tag: data.tag });
    }
  };

  navigator.serviceWorker.addEventListener("message", handleMessage);
  return () => navigator.serviceWorker.removeEventListener("message", handleMessage);
}
