import "./delivery.css";
import { FLOW_STEPS } from "./status";

const SHORT: Record<string, string> = { dijadwalkan: "Dijadwalkan", dimuat: "Dimuat", berangkat: "Berangkat", tiba: "Tiba", terkirim: "Terkirim" };

/** Progres lima langkah: dijadwalkan → dimuat → berangkat → tiba → terkirim. `status` di luar urutan (batal) tidak ada yang menyala. */
export function Steps({ status, className = "" }: { status: string; className?: string }) {
  const at = (FLOW_STEPS as readonly string[]).indexOf(status);
  return (
    <ol className={`dl-steps ${className}`} aria-label="Progres pengiriman">
      {FLOW_STEPS.map((s, i) => (
        <li key={s} className={i < at || (i === at && s === "terkirim") ? "is-done" : i === at ? "is-now" : ""} aria-current={i === at ? "step" : undefined}>
          <span className="dl-dot" aria-hidden="true">{i < at || (i === at && s === "terkirim") ? "✓" : i + 1}</span>
          <span className="dl-lbl">{SHORT[s]}</span>
        </li>
      ))}
    </ol>
  );
}
