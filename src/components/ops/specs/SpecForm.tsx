"use client";

import { useState } from "react";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { saveSpec } from "@/app/operasional/actions/product-specs";
import { Select } from "@/components/ui";
import type { ProductLine, ProductionMethod } from "@/db/erp";
import { LINE_LABEL, METHOD_LABEL, SPEC_LINES } from "@/lib/ops/production-lines";

export type SpecInitial = { id?: string; line: ProductLine; name: string; variant: string; weightKg: string; specs: { k: string; v: string }[]; notes: string; active: boolean; itemId: string };
export type SpecItemOpt = { id: string; name: string; code: string };

/** Tambah / ubah spesifikasi & berat satu ukuran atau tipe produk. */
export function SpecForm({ initial, items }: { initial: SpecInitial; items: SpecItemOpt[] }) {
  const [line, setLine] = useState<ProductLine>(initial.line);
  const [variant, setVariant] = useState(initial.variant);
  const [itemId, setItemId] = useState(initial.itemId);
  const [rows, setRows] = useState(initial.specs.length ? initial.specs : [{ k: "", v: "" }]);
  const setRow = (i: number, p: Partial<{ k: string; v: string }>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));

  return (
    <ActionForm action={saveSpec} className="stack" style={{ gap: 16 }}>
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="line" value={line} />
      <input type="hidden" name="variant" value={variant} />
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="specs" value={JSON.stringify(rows)} />
      <section className="form-section">
        <div className="field">
          <label id="sp-line-l">Kategori</label>
          <div className="prd-choices" role="group" aria-labelledby="sp-line-l">
            {SPEC_LINES.map((l) => (
              <button key={l} type="button" className="prd-choice" aria-pressed={line === l} onClick={() => { setLine(l); if (l !== "buis") setVariant((v) => (["tumbuk", "cor", "tulangan"].includes(v) ? "" : v)); }}>{LINE_LABEL[l]}</button>
            ))}
          </div>
        </div>
        <div className="form-grid cols-4">
          <div className="field span-2"><label htmlFor="sp-name">Ukuran / tipe</label><input id="sp-name" name="name" defaultValue={initial.name} required maxLength={80} placeholder="mis. 40×40×120 (cm)" /></div>
          <div className="field">
            {line === "buis" ? (
              <>
                <label htmlFor="sp-method">Metode</label>
                <Select id="sp-method" value={variant} onChange={setVariant} options={[{ value: "", label: "— Semua metode —" }, ...(Object.keys(METHOD_LABEL) as ProductionMethod[]).map((m) => ({ value: m, label: METHOD_LABEL[m] }))]} />
              </>
            ) : (
              <>
                <label htmlFor="sp-variant">Varian <span className="help">opsional, mis. HD, warna</span></label>
                <input id="sp-variant" value={variant} onChange={(e) => setVariant(e.target.value)} maxLength={60} />
              </>
            )}
          </div>
          <div className="field"><label htmlFor="sp-weight">Berat per buah <span className="help">kg</span></label><input id="sp-weight" name="weightKg" className="num" inputMode="decimal" defaultValue={initial.weightKg} /></div>
        </div>
        <div className="field">
          <label htmlFor="sp-item">Barang di stok <span className="help">opsional: dipakai form produksi untuk perkiraan berat</span></label>
          <Select id="sp-item" value={itemId} onChange={setItemId} searchable placeholder="— Tidak ditautkan —" options={[{ value: "", label: "— Tidak ditautkan —" }, ...items.map((i) => ({ value: i.id, label: i.name, hint: i.code }))]} />
        </div>
      </section>

      <section className="form-section">
        <div className="card-head" style={{ marginBottom: 0 }}><h2>Spesifikasi lain</h2><span className="small muted">pasangan nama–nilai bebas, mis. Mutu → K-350, Tebal → 70 mm</span></div>
        {rows.map((r, i) => (
          <div className="lines-row" key={i}>
            <input aria-label={`Nama spesifikasi ${i + 1}`} value={r.k} onChange={(e) => setRow(i, { k: e.target.value })} placeholder="Nama (mis. Mutu)" maxLength={30} />
            <input aria-label={`Nilai spesifikasi ${i + 1}`} value={r.v} onChange={(e) => setRow(i, { v: e.target.value })} placeholder="Nilai (mis. K-350)" maxLength={60} />
            <button type="button" className="icon-btn" aria-label={`Hapus baris ${i + 1}`} onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : [{ k: "", v: "" }]))}>×</button>
          </div>
        ))}
        <div><button type="button" className="btn btn-ghost btn-sm" onClick={() => setRows((rs) => [...rs, { k: "", v: "" }])}>+ Tambah baris</button></div>
      </section>

      <section className="form-section">
        <div className="field"><label htmlFor="sp-notes">Catatan</label><textarea id="sp-notes" name="notes" rows={2} defaultValue={initial.notes} maxLength={500} /></div>
        <label className="check"><input type="checkbox" name="active" defaultChecked={initial.active} /> Aktif <span className="help">tampil sebagai acuan saat input produksi</span></label>
      </section>
      <div className="form-actions"><SubmitButton>{initial.id ? "Simpan perubahan" : "Simpan spesifikasi"}</SubmitButton></div>
    </ActionForm>
  );
}
