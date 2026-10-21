"use client";

import { Chips } from "@/components/ops/receipts/Chips";
import { PhotoPicker } from "@/components/ops/receipts/PhotoPicker";
import type { ReadingUnit, SandDecision } from "@/db/erp";
import { fmt } from "@/lib/ops/shared/format";
import { DECISION_LABELS, SILT_LEVEL_LABELS } from "@/lib/ops/shared/sand";
import { DECISIONS, readingOf } from "./util";

export type ReadingValue = { sandTop: string; siltTop: string; decision: SandDecision | "" };
export const emptyReading = (): ReadingValue => ({ sandTop: "", siltTop: "", decision: "" });

/**
 * Pembacaan endapan + kadar lumpur otomatis + keputusan + foto akhir. Dipakai saat "isi hasil sekarang" maupun
 * saat menyelesaikan draft. Isian bernama sandTop / siltTop / decision / resultPhoto ikut terkirim bersama form.
 */
export function ReadingFields({ unit, value, onChange }: { unit: ReadingUnit; value: ReadingValue; onChange: (value: ReadingValue) => void }) {
  const r = readingOf(unit, value.sandTop, value.siltTop, value.decision);
  const ml = unit === "ml";
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="sd-sand">{ml ? "Skala batas atas pasir (ml)" : "Tebal endapan pasir (cm)"}</label>
          <input id="sd-sand" name="sandTop" inputMode="decimal" value={value.sandTop} onChange={(e) => onChange({ ...value, sandTop: e.target.value })} placeholder={ml ? "contoh 100" : "contoh 10"} autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="sd-silt">{ml ? "Skala batas atas lumpur (ml)" : "Tebal endapan lumpur (cm)"}</label>
          <input id="sd-silt" name="siltTop" inputMode="decimal" value={value.siltTop} onChange={(e) => onChange({ ...value, siltTop: e.target.value })} placeholder={ml ? "contoh 110" : "contoh 0,4"} autoComplete="off" />
        </div>
      </div>
      {r.invalid && <p className="alert alert-error" role="alert">Skala batas atas lumpur harus lebih besar dari batas atas pasir.</p>}
      {r.percent !== null && r.level && (
        <div className={`sand-result sand-${r.level}`} aria-live="polite">
          <span className="small">Hasil pengujian (kadar lumpur)</span>
          <b className="sand-pct">{fmt(r.percent)}%</b>
          <b className="small">{SILT_LEVEL_LABELS[r.level]}</b>
          {ml && r.silt !== undefined && <span className="small">Lumpur {fmt(r.silt)} ml ÷ total endapan {fmt((r.sand ?? 0) + r.silt)} ml</span>}
        </div>
      )}
      <div className="field">
        <span className="label">Keputusan</span>
        <Chips name="decision" value={r.decision} options={DECISIONS} labels={DECISION_LABELS} onChange={(decision) => onChange({ ...value, decision })} label="Keputusan" />
      </div>
      <div className="field">
        <span className="label">Foto gelas / botol setelah mengendap (lapisan lumpur terlihat)</span>
        <PhotoPicker name="resultPhoto" label="Foto hasil endapan" />
      </div>
    </div>
  );
}
