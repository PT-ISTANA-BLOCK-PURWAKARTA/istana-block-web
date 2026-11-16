import Link from "next/link";
import { formatQty, tgl } from "@/lib/erp/util";
import { PAVING_COLORS, PAVING_MODELS, parsePaving } from "@/lib/ops/shared/paving";

export type PavingSummaryItem = {
  id: string;
  name: string;
  unit: string;
  qty: number;
  pending: number;
  opname: { counted: number; date: string } | null;
};

const COLOR_HEX: Record<string, string> = {
  "Abu natural": "#94a3b8",
  Merah: "#dc2626",
  Hitam: "#0f172a",
};

type CellData = {
  items: PavingSummaryItem[];
  qty: number;
  pending: number;
  hasActivity: boolean;
  tooltip: string;
};

/**
 * Matriks ringkasan stok paving per model & ukuran × warna.
 * Menggunakan kelas UI panel (`admin-card`, `num`, `tabular`, `text-bahaya`).
 */
export function PavingStockSummary({ items }: { items: PavingSummaryItem[] }) {
  if (!items.length) return null;

  const kinds = PAVING_MODELS.flatMap((model) =>
    model.sizes.map((size) => ({
      key: `${model.key}|${size}`,
      label: `${model.label} ${size}`,
      model: model.key,
      size,
    })),
  );

  const matchedIds = new Set<string>();
  const getCell = (model: string, size: string, color: string): CellData | null => {
    const matched = items.filter((item) => {
      const choice = parsePaving(item.name);
      return choice.model === model && choice.size === size && choice.color === color;
    });
    if (!matched.length) return null;
    for (const m of matched) matchedIds.add(m.id);
    const qty = matched.reduce((sum, m) => sum + m.qty, 0);
    const pending = matched.reduce((sum, m) => sum + m.pending, 0);
    const hasActivity = matched.some((m) => m.qty !== 0 || m.pending !== 0 || m.opname !== null);
    const tooltip = matched
      .map(
        (m) =>
          `${m.name}: stok ${formatQty(m.qty)} ${m.unit}` +
          (m.pending ? `, dijadwalkan ${formatQty(m.pending)}` : "") +
          (m.opname ? `, opname ${formatQty(m.opname.counted)} (${tgl(m.opname.date)})` : ""),
      )
      .join(" | ");
    return { items: matched, qty, pending, hasActivity, tooltip };
  };

  const rows = kinds
    .map((kind) => ({
      ...kind,
      cells: PAVING_COLORS.map((color) => getCell(kind.model, kind.size, color)),
    }))
    .filter((kind) => kind.cells.some((c) => c && c.hasActivity));

  const otherPaving = items.filter((item) => !matchedIds.has(item.id) && (item.qty !== 0 || item.pending !== 0 || item.opname !== null));
  const anyStarted = items.some((item) => item.opname !== null);
  const unit = items[0]?.unit ?? "m²";

  const sumCells = (list: (CellData | null)[]) => list.reduce((sum, cell) => sum + (cell?.qty ?? 0), 0);
  const colorTotals = PAVING_COLORS.map((_, idx) => sumCells(rows.map((r) => r.cells[idx])));
  const matrixTotal = colorTotals.reduce((sum, v) => sum + v, 0);
  const allTotal = rows.length ? matrixTotal : items.reduce((sum, i) => sum + i.qty, 0);

  const toneStyle = (value: number): React.CSSProperties =>
    value < 0 ? { color: "var(--bahaya)" } : value === 0 ? { color: "#b6becd" } : { color: "var(--biru-tua)" };

  return (
    <section className="admin-card" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, margin: 0, color: "var(--biru-tua)" }}>Matriks Stok Paving</h2>
          <p className="small muted" style={{ margin: "2px 0 0" }}>
            Sisa stok per jenis &amp; warna ({unit}).{" "}
            {anyStarted
              ? "Dihitung dari mutasi stok tercatat (opname, produksi, pengiriman)."
              : "Belum ada stok opname — angka minus berarti pengiriman melebihi produksi yang tercatat."}
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <span className="small muted" style={{ textTransform: "uppercase", letterSpacing: ".04em" }}>Total Paving</span>
          <div style={{ fontSize: 22, fontWeight: 700, ...toneStyle(allTotal) }} className="tabular">
            {formatQty(allTotal)} <span className="small muted" style={{ fontWeight: 500 }}>{unit}</span>
          </div>
        </div>
      </div>

      {rows.length > 0 ? (
        <div style={{ overflowX: "auto" }}>
          <table className="compact" style={{ width: "100%", minWidth: 500 }}>
            <thead>
              <tr>
                <th>Jenis</th>
                {PAVING_COLORS.map((color) => (
                  <th key={color} className="num">
                    <span
                      aria-hidden="true"
                      style={{
                        display: "inline-block",
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: COLOR_HEX[color] ?? "#64748b",
                        marginRight: 6,
                        verticalAlign: "middle",
                      }}
                    />
                    {color}
                  </th>
                ))}
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const rowSum = sumCells(row.cells);
                return (
                  <tr key={row.key}>
                    <td style={{ fontWeight: 600 }}>{row.label}</td>
                    {row.cells.map((cell, idx) => (
                      <td
                        key={PAVING_COLORS[idx]}
                        className="num tabular"
                        style={{ fontWeight: 600, ...toneStyle(cell?.qty ?? 0) }}
                        title={cell?.tooltip}
                      >
                        {cell ? (
                          cell.items.length === 1 ? (
                            <Link href={`/operasional/stok/${cell.items[0].id}`} style={{ color: "inherit", textDecoration: "none" }}>
                              {formatQty(cell.qty)}
                            </Link>
                          ) : (
                            formatQty(cell.qty)
                          )
                        ) : (
                          "—"
                        )}
                      </td>
                    ))}
                    <td className="num tabular" style={{ fontWeight: 700, ...toneStyle(rowSum) }}>
                      {formatQty(rowSum)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th style={{ textAlign: "left" }}>Total</th>
                {colorTotals.map((val, idx) => (
                  <th key={PAVING_COLORS[idx]} className="num tabular" style={toneStyle(val)}>
                    {formatQty(val)}
                  </th>
                ))}
                <th className="num tabular" style={toneStyle(matrixTotal)}>
                  {formatQty(matrixTotal)}
                </th>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="small muted" style={{ margin: "4px 0 0" }}>
          Belum ada item paving dengan rincian ukuran &amp; warna baku (contoh: &ldquo;Bata 8 cm · Abu natural&rdquo;).
        </p>
      )}

      {otherPaving.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--p-line)", display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
          <span className="small muted">Varian paving lainnya:</span>
          {otherPaving.map((item) => (
            <Link key={item.id} href={`/operasional/stok/${item.id}`} className="small" style={{ fontWeight: 600 }}>
              {item.name}: <span className="tabular" style={toneStyle(item.qty)}>{formatQty(item.qty)} {item.unit}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
