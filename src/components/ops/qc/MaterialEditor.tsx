"use client";

import type { MatRow } from "./labels";
import "./qc.css";

/**
 * Baris bahan: nama, jumlah, satuan. `fixedNames` = nama & satuan mengikuti template (hanya jumlah yang diisi).
 * Jumlah berupa teks supaya koma desimal tidak hilang saat mengetik.
 */
export function MaterialEditor({ items, onChange, fixedNames = false, label = "Bahan" }: { items: MatRow[]; onChange: (items: MatRow[]) => void; fixedNames?: boolean; label?: string }) {
  const update = (i: number, patch: Partial<MatRow>) => onChange(items.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  return (
    <div className="qc-mats">
      {items.map((m, i) => (
        <div className="qc-mat" key={i}>
          <input aria-label={`${label} ${i + 1}: nama`} value={m.name} disabled={fixedNames} onChange={(e) => update(i, { name: e.target.value })} placeholder="Bahan" maxLength={60} />
          <input aria-label={`${label} ${i + 1}: jumlah`} className="num" inputMode="decimal" value={m.qty} onChange={(e) => update(i, { qty: e.target.value })} placeholder="0" />
          <input aria-label={`${label} ${i + 1}: satuan`} value={m.unit} disabled={fixedNames} onChange={(e) => update(i, { unit: e.target.value })} placeholder="kg" maxLength={20} />
          {fixedNames ? <span /> : <button type="button" className="icon-btn" aria-label={`Hapus ${label.toLowerCase()} ${i + 1}`} onClick={() => onChange(items.filter((_, j) => j !== i))}>×</button>}
        </div>
      ))}
      {!fixedNames && items.length < 20 && (
        <div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange([...items, { name: "", qty: "", unit: "kg" }])}>+ Tambah bahan</button>
        </div>
      )}
    </div>
  );
}
