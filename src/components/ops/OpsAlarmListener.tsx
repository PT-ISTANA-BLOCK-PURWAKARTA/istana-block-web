"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  isAlarmMuted,
  listenForPushAlarms,
  setAlarmMuted,
  unlockAlarmAudio,
  type PushAlarmEvent,
} from "@/lib/ops/alarm";

/**
 * Listener client di layout panel operasional: membunyikan chime Web Audio,
 * getaran perangkat, serta banner toast saat SW menerima push `alarm-` / `delivery-`.
 */
export function OpsAlarmListener() {
  const [muted, setMuted] = useState(false);
  const [alert, setAlert] = useState<PushAlarmEvent | null>(null);

  useEffect(() => {
    setMuted(isAlarmMuted());

    const unlock = () => unlockAlarmAudio();
    window.addEventListener("pointerdown", unlock, { passive: true, once: true });
    window.addEventListener("keydown", unlock, { passive: true, once: true });

    const stopListening = listenForPushAlarms((ev) => {
      setAlert(ev);
    });

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      stopListening();
    };
  }, []);

  if (!alert) return null;

  const isTempo = alert.tag.startsWith("alarm-tempo-");
  const targetHref = isTempo
    ? "/anak-usaha/biaya-armada"
    : alert.kind === "delivery"
      ? "/operasional/pengiriman"
      : "/operasional";
  const label = isTempo
    ? "Tagihan tempo armada jatuh tempo hari ini"
    : alert.kind === "delivery"
      ? "Ada pembaruan kiriman armada"
      : "Ada peringatan operasional baru";

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    setAlarmMuted(next);
  }

  return (
    <div className="ops-alarm-toast" role="status" aria-live="polite">
      <div className="ops-alarm-toast-body">
        <strong>{alert.kind === "alarm" ? "Alarm Operasional" : "Info Kiriman"}</strong>
        <span>{label}</span>
      </div>
      <div className="ops-alarm-toast-actions">
        <Link href={targetHref} className="btn btn-sm btn-primary" onClick={() => setAlert(null)}>
          Buka
        </Link>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={toggleMute}
          aria-pressed={muted}
        >
          {muted ? "Bunyikan" : "Senyapkan"}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={() => setAlert(null)}
          aria-label="Tutup pemberitahuan alarm"
        >
          Tutup
        </button>
      </div>
    </div>
  );
}
