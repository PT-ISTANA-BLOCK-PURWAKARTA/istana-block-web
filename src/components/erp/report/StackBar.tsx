import { formatAmount } from "@/lib/erp/util";

export type Segment = { label: string; value: number; color: string };

/** Satu batang 100% terbagi per komposisi, dengan legenda bernilai & persen di bawahnya. */
export function StackBar({ title, segments, label }: { title: string; segments: Segment[]; label: string }) {
  const parts = segments.filter((s) => s.value > 0);
  const total = parts.reduce((a, s) => a + s.value, 0);
  return (
    <figure className="stackbar">
      <figcaption>
        <span>{title}</span>
        <b className="tabular">{formatAmount(total)}</b>
      </figcaption>
      <div className="sb-track" role="img" aria-label={`${label}: ${parts.map((s) => `${s.label} ${Math.round((s.value / (total || 1)) * 100)}%`).join(", ")}`}>
        {parts.map((s) => (
          <span key={s.label} className="sb-seg" style={{ flexGrow: s.value, background: s.color }} title={`${s.label}: ${formatAmount(s.value)} (${Math.round((s.value / (total || 1)) * 100)}%)`}>
            {s.value / (total || 1) >= 0.12 && <em>{Math.round((s.value / total) * 100)}%</em>}
          </span>
        ))}
      </div>
      <ul className="sb-legend">
        {parts.map((s) => (
          <li key={s.label}>
            <i style={{ background: s.color }} aria-hidden="true" />
            <span>{s.label}</span>
            <b className="tabular">{formatAmount(s.value)}</b>
            <small>{Math.round((s.value / (total || 1)) * 100)}%</small>
          </li>
        ))}
      </ul>
    </figure>
  );
}
