"use client";

import Link from "next/link";
import { useState } from "react";
import { quickMixLog } from "@/app/operasional/actions/qc";
import { Select } from "@/components/ui";
import { QcActionButton } from "./QcActionButton";
import "./qc.css";

export type TodayLayer = {
  layer: "badan" | "kepalaan";
  label: string;
  /** Jumlah catatan hari ini pada lapisan ini. */
  done: number;
  /** Template yang sedang dipakai untuk lapisan ini. */
  designs: { id: string; name: string; product: string; text: string }[];
};

/**
 * Mix desain wajib diisi tiap produksi. Bila produksi memakai komposisi yang disetujui, cukup satu tombol
 * "Sesuai mix desain"; bila produksi mengubah komposisi, "Ada perubahan" membuka formulir untuk mengisi angka aktual.
 */
export function TodayPanel({ title, layers }: { title: string; layers: TodayLayer[] }) {
  const [picked, setPicked] = useState<Record<string, string>>({});
  return (
    <section className="admin-card qc-today">
      <div>
        <h2 style={{ fontSize: 16.5 }}>Produksi hari ini · {title}</h2>
        <p className="small muted">Setiap produksi wajib dicatat. Tekan <b>Sesuai mix desain</b> bila komposisi sama dengan yang disetujui, atau <b>Ada perubahan</b> bila produksi mengubah komposisi.</p>
      </div>
      <div className="qc-today-grid">
        {layers.map((l) => {
          const design = l.designs.find((d) => d.id === picked[l.layer]) ?? l.designs[0];
          return (
            <div className="qc-today-card" key={l.layer}>
              <div className="qc-today-head">
                <b>{l.label}</b>
                {l.done ? <span className="badge badge-on">{l.done} catatan hari ini</span> : <span className="badge badge-warn">Belum diisi</span>}
              </div>
              {l.designs.length > 1 && (
                <Select aria-label={`Template ${l.label}`} value={design?.id ?? ""} onChange={(v) => setPicked((p) => ({ ...p, [l.layer]: v }))} searchable={false} menuWidth={300} options={l.designs.map((d) => ({ value: d.id, label: d.name, hint: d.product }))} />
              )}
              {design ? <p className="small muted">{design.product}: {design.text}</p> : <p className="small" style={{ color: "var(--warn)" }}>Belum ada template {l.label.toLowerCase()} yang disetujui. Buat di tab Template.</p>}
              <div className="qc-today-actions">
                {design ? (
                  <QcActionButton className="btn btn-primary" label="Sesuai mix desain" pendingText="Mencatat…" action={() => quickMixLog(l.layer, design.id)} />
                ) : (
                  <button type="button" className="btn btn-primary" disabled>Sesuai mix desain</button>
                )}
                <Link className="btn btn-ghost" href={`/operasional/qc/harian/baru?layer=${l.layer}${design ? `&design=${design.id}` : ""}&perubahan=1`}>Ada perubahan</Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
