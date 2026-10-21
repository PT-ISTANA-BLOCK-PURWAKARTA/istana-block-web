"use client";

import Link from "next/link";
import { useState } from "react";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { createMixDesign } from "@/app/operasional/actions/qc";
import type { MixLayer } from "@/db/erp";
import { DEFAULT_MATERIALS, fromRows, LAYERS, LAYER_LABELS, toRows } from "./labels";
import { MaterialEditor } from "./MaterialEditor";
import "./qc.css";

/** Buat (kantor) atau ajukan (QC) template komposisi mix desain. */
export function MixDesignForm({ canApprove, back }: { canApprove: boolean; back: string }) {
  const [layer, setLayer] = useState<MixLayer>("badan");
  const [mats, setMats] = useState(() => toRows(DEFAULT_MATERIALS.badan));
  return (
    <ActionForm action={createMixDesign} className="stack" style={{ gap: 20 }}>
      <input type="hidden" name="materials" value={JSON.stringify(fromRows(mats))} />
      <section className="form-section">
        <div className="field">
          <label htmlFor="md-name">Nama template</label>
          <input id="md-name" name="name" required minLength={2} maxLength={100} placeholder="Contoh: Badan K-300 standar" />
        </div>
        <div className="field">
          <span className="label">Lapisan</span>
          <div className="seg" role="radiogroup" aria-label="Lapisan">
            {LAYERS.map((l) => (
              <label key={l} className={`seg-opt${layer === l ? " on" : ""}`}>
                <input
                  type="radio"
                  name="layer"
                  value={l}
                  checked={layer === l}
                  onChange={() => {
                    setLayer(l);
                    setMats(toRows(DEFAULT_MATERIALS[l]));
                  }}
                />
                {LAYER_LABELS[l]}
              </label>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="md-product">Item pekerjaan / produk</label>
          <input id="md-product" name="product" required minLength={2} maxLength={100} placeholder="Contoh: Paving bata 6 cm" />
        </div>
        <div className="field">
          <span className="label">Komposisi <span className="help">per satu kali mixing</span></span>
          <MaterialEditor items={mats} onChange={setMats} />
        </div>
        <div className="field">
          <label htmlFor="md-notes">Catatan</label>
          <textarea id="md-notes" name="notes" maxLength={1000} />
        </div>
      </section>
      <div className="form-actions">
        <SubmitButton>{canApprove ? "Simpan template" : "Ajukan"}</SubmitButton>
        <Link href={back} className="btn btn-ghost">Batal</Link>
      </div>
    </ActionForm>
  );
}
