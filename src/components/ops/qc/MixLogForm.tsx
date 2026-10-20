"use client";

import Link from "next/link";
import { useState } from "react";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { createMixLog, updateMixLog } from "@/app/operasional/actions/qc";
import { DateField, Select } from "@/components/ui";
import type { CheckStatus, MaterialLine, MixLayer } from "@/db/erp";
import { CHECK_STATUSES, CHECK_STATUS_LABELS, DEFAULT_MATERIALS, fromRows, LAYERS, LAYER_LABELS, materialText, toRows } from "./labels";
import { MaterialEditor } from "./MaterialEditor";
import "./qc.css";

export type DesignOption = { id: string; layer: MixLayer; name: string; product: string; materials: MaterialLine[] };
export type MixLogInitial = {
  id?: string;
  workDate: string;
  layer: MixLayer;
  mixDesignId: string;
  product: string;
  approved: MaterialLine[];
  actual: MaterialLine[];
  mixingCount: string;
  boards: string;
  squareMeters: string;
  rejects: string;
  status: CheckStatus;
  notes: string;
};

/** Isi / ubah catatan harian penerapan mix desain (per lapisan). */
export function MixLogForm({ initial, designs, back }: { initial: MixLogInitial; designs: DesignOption[]; back: string }) {
  const [layer, setLayer] = useState<MixLayer>(initial.layer);
  const [designId, setDesignId] = useState(initial.mixDesignId);
  const [product, setProduct] = useState(initial.product);
  const [approved, setApproved] = useState(() => toRows(initial.approved));
  const [actualRaw, setActualRaw] = useState(() => toRows(initial.actual));
  const [status, setStatus] = useState<CheckStatus>(initial.status);
  const available = designs.filter((d) => d.layer === layer);

  // Isian "actual" mengikuti nama bahan pada "disetujui".
  const actual = approved.map((m) => actualRaw.find((a) => a.name === m.name) ?? { ...m, qty: "" });
  const blankActual = (items: { name: string; unit: string }[]) => items.map((m) => ({ name: m.name, unit: m.unit, qty: "" }));

  function changeLayer(next: MixLayer) {
    setLayer(next);
    setDesignId("");
    setApproved(toRows(DEFAULT_MATERIALS[next]));
    setActualRaw(blankActual(DEFAULT_MATERIALS[next]));
  }

  function pickDesign(value: string) {
    const d = designs.find((x) => x.id === value);
    if (!d) return setDesignId("");
    setDesignId(d.id);
    setProduct(d.product);
    setApproved(toRows(d.materials));
    setActualRaw(blankActual(d.materials));
  }

  return (
    <ActionForm action={initial.id ? updateMixLog : createMixLog} className="stack" style={{ gap: 20 }}>
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="mixDesignId" value={designId} />
      <input type="hidden" name="approved" value={JSON.stringify(fromRows(approved))} />
      <input type="hidden" name="actual" value={JSON.stringify(fromRows(actual))} />
      <section className="form-section">
        <div className="form-grid">
          <div className="field">
            <label htmlFor="ml-date">Hari / tanggal</label>
            <DateField id="ml-date" name="workDate" defaultValue={initial.workDate} required />
          </div>
          <div className="field">
            <span className="label">Lapisan</span>
            <div className="seg" role="radiogroup" aria-label="Lapisan">
              {LAYERS.map((l) => (
                <label key={l} className={`seg-opt${layer === l ? " on" : ""}`}>
                  <input type="radio" name="layer" value={l} checked={layer === l} onChange={() => changeLayer(l)} />
                  {LAYER_LABELS[l]}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="field">
          <label htmlFor="ml-design">Template mix desain disetujui</label>
          <Select id="ml-design" value={designId} onChange={pickDesign} searchable={false} menuWidth={320} options={[{ value: "", label: "— Tanpa template (isi manual) —" }, ...available.map((d) => ({ value: d.id, label: d.name, hint: d.product }))]} />
          {!available.length && <span className="help">Belum ada template {LAYER_LABELS[layer].toLowerCase()} yang disetujui. Ajukan di tab Template, atau isi manual.</span>}
        </div>
        <div className="field">
          <label htmlFor="ml-product">Item pekerjaan</label>
          <input id="ml-product" name="product" value={product} onChange={(e) => setProduct(e.target.value)} required minLength={2} maxLength={100} placeholder="Contoh: Paving bata 6 cm K-300" />
        </div>
      </section>

      <section className="form-section">
        <div className="form-grid">
          <div className="field">
            <span className="label">Mix desain disetujui</span>
            {designId ? <p className="qc-readonly">{materialText(fromRows(approved))}</p> : <MaterialEditor label="Disetujui" items={approved} onChange={setApproved} />}
          </div>
          <div className="field">
            <span className="label">Mix desain actual <span className="help">isi sesuai yang benar-benar dipakai</span></span>
            <MaterialEditor label="Actual" fixedNames items={actual} onChange={setActualRaw} />
          </div>
        </div>
      </section>

      <section className="form-section">
        <div className="form-grid cols-4">
          <div className="field"><label htmlFor="ml-mixing">Mixing <span className="help">jumlah adukan</span></label><input id="ml-mixing" name="mixingCount" className="num" inputMode="decimal" defaultValue={initial.mixingCount} /></div>
          <div className="field"><label htmlFor="ml-boards">Papan</label><input id="ml-boards" name="boards" className="num" inputMode="decimal" defaultValue={initial.boards} /></div>
          <div className="field"><label htmlFor="ml-m2">Meter persegi</label><input id="ml-m2" name="squareMeters" className="num" inputMode="decimal" defaultValue={initial.squareMeters} /></div>
          {layer !== "kepalaan" && <div className="field"><label htmlFor="ml-reject">Reject</label><input id="ml-reject" name="rejects" className="num" inputMode="decimal" defaultValue={initial.rejects} /></div>}
        </div>
        <div className="field">
          <span className="label">Status</span>
          <div className="seg" role="radiogroup" aria-label="Status">
            {CHECK_STATUSES.map((s) => (
              <label key={s} className={`seg-opt${status === s ? " on" : ""}`}>
                <input type="radio" name="status" value={s} checked={status === s} onChange={() => setStatus(s)} />
                {CHECK_STATUS_LABELS[s]}
              </label>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="ml-notes">Catatan</label>
          <textarea id="ml-notes" name="notes" defaultValue={initial.notes} maxLength={2000} placeholder="Temuan, kendala, revisi, kekurangan, atau informasi tambahan" />
        </div>
      </section>

      <div className="form-actions">
        <SubmitButton>{initial.id ? "Simpan perubahan" : "Simpan"}</SubmitButton>
        <Link href={back} className="btn btn-ghost">Batal</Link>
      </div>
    </ActionForm>
  );
}
