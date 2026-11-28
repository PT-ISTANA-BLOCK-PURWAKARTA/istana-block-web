"use client";

// Tombol "Filter" + jendela "Filter Data" seperti Zahir: Tanggal Dari → Hingga, pilihan cepat, Batal / OK.
// Dipakai daftar Kas (jenis) dan Buku Besar (action + hidden akun).
import { useRef, useState } from "react";
import { DateField } from "@/components/ui";

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const wib = () => new Date(Date.now() + 7 * 3600 * 1000);

function presets() {
  const n = wib();
  const y = n.getUTCFullYear(), m = n.getUTCMonth();
  const day = (yy: number, mm: number, dd: number) => iso(new Date(Date.UTC(yy, mm, dd)));
  return [
    { label: "Hari ini", from: iso(n), to: iso(n) },
    { label: "7 hari", from: iso(new Date(n.getTime() - 6 * 86400000)), to: iso(n) },
    { label: "Bulan ini", from: day(y, m, 1), to: iso(n) },
    { label: "Bulan lalu", from: day(y, m - 1, 1), to: day(y, m, 0) },
    { label: "Tahun ini", from: day(y, 0, 1), to: iso(n) },
  ];
}

export function CashFilter({ jenis, q, from, to, action = "/akuntansi/kas", hidden = {} }: { jenis?: string; q: string; from: string; to: string; action?: string; hidden?: Record<string, string> }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const [range, setRange] = useState({ from, to, v: 0 });
  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => dlg.current?.showModal()} title="Menampilkan filter dialog">Filter</button>
      <dialog ref={dlg} className="zf-dialog" aria-labelledby="zf-title">
        <form method="get" action={action}>
          <h2 id="zf-title">Filter Data</h2>
          {jenis && <input type="hidden" name="jenis" value={jenis} />}
          {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          {q && <input type="hidden" name="q" value={q} />}
          <div className="zf-row">
            <span className="zf-label">Tanggal :</span>
            <div className="field"><label htmlFor="zf-from">Dari :</label><DateField key={`f${range.v}`} id="zf-from" name="from" defaultValue={range.from} /></div>
            <span aria-hidden className="zf-arrow">›</span>
            <div className="field"><label htmlFor="zf-to">Hingga :</label><DateField key={`t${range.v}`} id="zf-to" name="to" defaultValue={range.to} /></div>
          </div>
          <div className="zf-presets">
            {presets().map((p) => (
              <button key={p.label} type="button" className="chip" onClick={() => setRange((r) => ({ from: p.from, to: p.to, v: r.v + 1 }))}>{p.label}</button>
            ))}
          </div>
          <div className="zf-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => dlg.current?.close()}>Batal</button>
            <button type="submit" className="btn btn-blue btn-sm">OK</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
