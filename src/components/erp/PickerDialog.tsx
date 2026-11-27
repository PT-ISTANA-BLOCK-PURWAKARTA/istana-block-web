"use client";

// Jendela pilih data gaya Zahir ("Data Nama", "Data Proyek", "Daftar Akun (Perkiraan)"):
// kotak cari di kanan atas, tabel dengan baris terpilih, tombol Batal / OK di bawah. Klik ganda / Enter = OK.
import { useEffect, useMemo, useRef, useState } from "react";

export type PickerRow = { id: string; cells: string[]; search?: string };

export function PickerDialog({
  open,
  title,
  columns,
  rows,
  selectedId,
  onPick,
  onClose,
  extra,
  clearLabel,
}: {
  open: boolean;
  title: string;
  columns: string[];
  rows: PickerRow[];
  selectedId?: string | null;
  onPick: (id: string) => void;
  onClose: () => void;
  /** Isi tambahan di kiri bawah (mis. form "Baru"). */
  extra?: React.ReactNode;
  /** Bila diisi, ada tombol untuk mengosongkan pilihan (onPick("")). */
  clearLabel?: string;
}) {
  const dlg = useRef<HTMLDialogElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(selectedId ?? null);

  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      requestAnimationFrame(() => search.current?.focus());
      setQ("");
      setSel(selectedId ?? null);
    } else if (!open && d.open) d.close();
  }, [open, selectedId]);

  const shown = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return rows.slice(0, 400);
    return rows.filter((r) => {
      const hay = (r.search ?? r.cells.join(" ")).toLowerCase();
      return words.every((w) => hay.includes(w));
    }).slice(0, 400);
  }, [q, rows]);

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(sel ?? "")}"]`)?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  const move = (d: number) => {
    if (!shown.length) return;
    const i = shown.findIndex((r) => r.id === sel);
    setSel(shown[Math.min(shown.length - 1, Math.max(0, i < 0 ? 0 : i + d))].id);
  };

  return (
    <dialog ref={dlg} className="zp-dialog" aria-labelledby="zp-title" onClose={onClose} onCancel={onClose}>
      <div className="zp-head">
        <h2 id="zp-title">{title}</h2>
        <input
          type="search"
          ref={search}
          value={q}
          onChange={(e) => { setQ(e.target.value); setSel(null); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
            else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
            else if (e.key === "Enter") { e.preventDefault(); const id = sel ?? shown[0]?.id; if (id) onPick(id); }
          }}
          placeholder="Cari…"
          aria-label={`Cari ${title}`}
        />
      </div>
      <div className="zp-table" role="grid" aria-label={title} ref={list} style={{ ["--cols" as string]: columns.length }}>
        <div className="zp-row zp-th" role="row">{columns.map((c) => <span key={c} role="columnheader">{c}</span>)}</div>
        {shown.map((r) => (
          <div
            key={r.id}
            data-id={r.id}
            role="row"
            aria-selected={r.id === sel}
            className={`zp-row${r.id === sel ? " is-sel" : ""}`}
            onClick={() => setSel(r.id)}
            onDoubleClick={() => onPick(r.id)}
          >
            {r.cells.map((c, i) => <span key={i} role="gridcell">{c}</span>)}
          </div>
        ))}
        {!shown.length && <p className="muted small" style={{ padding: 12 }}>Tidak ada data yang cocok.</p>}
      </div>
      <div className="zp-foot">
        <div className="zp-extra">{extra}</div>
        {clearLabel && <button type="button" className="btn btn-ghost btn-sm" onClick={() => onPick("")}>{clearLabel}</button>}
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Batal</button>
        <button type="button" className="btn btn-blue btn-sm" disabled={!sel} onClick={() => sel && onPick(sel)}>OK</button>
      </div>
    </dialog>
  );
}
