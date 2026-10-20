import { fmt } from "@/lib/ops/shared/format";
import type { Period } from "@/lib/ops/shared/period";
import type { QtyItem } from "@/lib/ops/summary";

export const PREVIOUS_LABEL: Record<Period, string> = { harian: "kemarin", mingguan: "minggu lalu", bulanan: "bulan lalu" };

/** Selisih dengan periode sebelumnya (teks netral, bukan warna status). */
export function Delta({ now, before, period }: { now: number; before: number; period: Period }) {
  const diff = now - before;
  return (
    <span className="lp-delta">
      {diff === 0 ? `sama dengan ${PREVIOUS_LABEL[period]}` : `${diff > 0 ? "▲ +" : "▼ "}${fmt(diff)} vs ${PREVIOUS_LABEL[period]} (${fmt(before)})`}
    </span>
  );
}

export const share = (part: number, total: number) => (total ? `${Math.round((part / total) * 100)}%` : "-");

/** Daftar "nama · jumlah satuan · n×" sebagai tabel kecil. */
export function QtyTable({ title, items, empty }: { title: string; items: QtyItem[]; empty: string }) {
  return (
    <div className="lp-qty">
      <h3>{title}</h3>
      {items.length ? (
        <table className="compact">
          <tbody>
            {items.map((item) => (
              <tr key={`${item.name}|${item.unit}`}>
                <td>{item.name}</td>
                <td className="num"><b>{fmt(item.quantity)}</b> {item.unit}</td>
                <td className="num muted small">{item.count}×</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted small">{empty}</p>
      )}
    </div>
  );
}
