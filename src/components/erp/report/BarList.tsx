import Link from "next/link";
import { formatAmount } from "@/lib/erp/util";

export type BarRow = { label: string; value: number; sub?: string; href?: string; color?: string };

/**
 * Daftar berperingkat dengan batang: cara paling cepat membaca "mana yang terbesar".
 * Nilai & persentase selalu tertulis, jadi warna tidak membawa makna sendirian.
 */
export function BarList({ rows, total, label, empty = "Belum ada data.", max: maxRows = 10, color = "#3d63c4" }: { rows: BarRow[]; total?: number; label: string; empty?: string; max?: number; color?: string }) {
  const shown = rows.slice(0, maxRows);
  const rest = rows.slice(maxRows);
  const restSum = rest.reduce((a, r) => a + r.value, 0);
  const list = rest.length ? [...shown, { label: `${rest.length} lainnya`, value: restSum, color: "#9aa3b5" }] : shown;
  const top = Math.max(1, ...list.map((r) => Math.abs(r.value)));
  const sum = total ?? rows.reduce((a, r) => a + r.value, 0);
  if (!rows.length) return <p className="muted small">{empty}</p>;
  return (
    <ol className="barlist" aria-label={label}>
      {list.map((r, i) => {
        const pct = sum ? (r.value / sum) * 100 : 0;
        const name = r.href ? <Link href={r.href}>{r.label}</Link> : r.label;
        return (
          <li key={i}>
            <span className="bl-name">
              {name}
              {r.sub && <small>{r.sub}</small>}
            </span>
            <span className="bl-track" aria-hidden="true">
              <span className="bl-fill" style={{ width: r.value ? `${Math.max(1.5, (Math.abs(r.value) / top) * 100)}%` : 0, background: r.color ?? color }} />
            </span>
            <span className="bl-val">
              <b>{formatAmount(r.value)}</b>
              <small>{pct.toLocaleString("id-ID", { maximumFractionDigits: pct < 10 ? 1 : 0 })}%</small>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
