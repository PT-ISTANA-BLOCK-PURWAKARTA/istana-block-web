"use client";

import { useState } from "react";

type Col = { key: string; label: string; type?: "text" | "number" | "textarea"; width?: string; placeholder?: string };

/** Daftar baris yang bisa ditambah/hapus; hasilnya dikirim sebagai JSON di input tersembunyi. */
export function Repeater({
  name,
  columns,
  initial,
  addLabel,
  format = (rows) => JSON.stringify(rows),
  className,
}: {
  name: string;
  columns: Col[];
  initial: Record<string, unknown>[];
  addLabel: string;
  /** Cara menyimpan baris ke input tersembunyi (bawaan: JSON). */
  format?: (rows: Record<string, unknown>[]) => string;
  className?: string;
}) {
  const empty = () => Object.fromEntries(columns.map((c) => [c.key, ""]));
  const [rows, setRows] = useState<Record<string, unknown>[]>(initial.length ? initial : []);
  const grid = columns.map((c) => c.width ?? "1fr").join(" ") + " 42px";
  const update = (i: number, k: string, v: string) => setRows((r) => r.map((row, j) => (j === i ? { ...row, [k]: v } : row)));
  const move = (i: number, d: number) =>
    setRows((r) => {
      const n = [...r];
      const t = i + d;
      if (t < 0 || t >= n.length) return r;
      [n[i], n[t]] = [n[t], n[i]];
      return n;
    });

  return (
    <div className={`repeater${className ? ` ${className}` : ""}`}>
      <input type="hidden" name={name} value={format(rows)} />
      {rows.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: grid, gap: 8, padding: "0 10px" }} className="small muted" aria-hidden="true">
          {columns.map((c) => (
            <span key={c.key}>{c.label}</span>
          ))}
        </div>
      )}
      {rows.map((row, i) => (
        <div className="repeater-row" key={i} style={{ gridTemplateColumns: grid }}>
          {columns.map((c) =>
            c.type === "textarea" ? (
              <textarea key={c.key} aria-label={`${c.label} baris ${i + 1}`} value={String(row[c.key] ?? "")} placeholder={c.placeholder} rows={2} onChange={(e) => update(i, c.key, e.target.value)} />
            ) : (
              <input
                key={c.key}
                aria-label={`${c.label} baris ${i + 1}`}
                type={c.type === "number" ? "number" : "text"}
                inputMode={c.type === "number" ? "numeric" : undefined}
                value={String(row[c.key] ?? "")}
                placeholder={c.placeholder}
                onChange={(e) => update(i, c.key, e.target.value)}
                onKeyDown={(e) => {
                  if (e.altKey && e.key === "ArrowUp") move(i, -1);
                  if (e.altKey && e.key === "ArrowDown") move(i, 1);
                }}
              />
            ),
          )}
          <button type="button" className="icon-btn" aria-label={`Hapus baris ${i + 1}`} onClick={() => setRows((r) => r.filter((_, j) => j !== i))}>
            ×
          </button>
        </div>
      ))}
      <div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRows((r) => [...r, empty()])}>
          + {addLabel}
        </button>
      </div>
    </div>
  );
}
