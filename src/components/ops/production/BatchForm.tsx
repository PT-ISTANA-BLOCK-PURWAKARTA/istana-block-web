"use client";

import { useState } from "react";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { saveBatch } from "@/app/operasional/actions/stock";
import { DateField, Select } from "@/components/ui";
import type { ProductionMethod } from "@/db/erp";
import { formatQty, parseQty } from "@/lib/erp/util";
import { METHOD_LABEL } from "@/lib/ops/production-lines";
import type { Opt, SpecOpt } from "@/components/ops/ProductionForm";

export type BatchRow = { docId: string; itemId: string; qty: string; gradeB: string; rejects: string; target: string; method: ProductionMethod | "" };
const blankRow = (): BatchRow => ({ docId: "", itemId: "", qty: "", gradeB: "", rejects: "", target: "", method: "" });

/**
 * "Input adukan cor": satu adukan semen untuk beberapa produk precast sekaligus. Semen dicatat sekali;
 * tiap produk menjadi satu catatan hasil produksi (Grade A menambah stok, Grade B & reject hanya dicatat).
 */
export function BatchForm({ id, date: initDate, cementBags, leader, note, rows: initRows, items, leaders, specs }: { id?: string; date: string; cementBags?: string; leader?: string; note?: string; rows: BatchRow[]; items: Opt[]; leaders: string[]; specs: SpecOpt[] }) {
  const [date, setDate] = useState(initDate);
  const [bags, setBags] = useState(cementBags ?? "");
  const [rows, setRows] = useState<BatchRow[]>(initRows.length ? initRows : [blankRow(), blankRow()]);
  const patch = (i: number, p: Partial<BatchRow>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));

  const done = rows.reduce((a, r) => a + parseQty(r.qty), 0);
  const target = rows.reduce((a, r) => a + parseQty(r.target), 0);
  const sak = parseQty(bags);
  const payload = JSON.stringify(rows.filter((r) => r.itemId || r.qty || r.target).map((r) => ({ ...r, qty: parseQty(r.qty), method: r.method || items.find((x) => x.id === r.itemId)?.method || "" })));

  return (
    <ActionForm action={saveBatch} className="stack prd-form" style={{ gap: 20 }}>
      {id && <input type="hidden" name="id" value={id} />}
      <input type="hidden" name="items" value={payload} />
      <section className="form-section">
        <p className="small muted">Satu adukan semen untuk beberapa produk sekaligus (Buis Beton cor / tulangan, U-Ditch, Kanstin). Semen dicatat sekali untuk adukan ini.</p>
        <div className="form-grid cols-4">
          <div className="field"><label htmlFor="ad-date">Tanggal</label><DateField id="ad-date" name="date" value={date} onChange={setDate} required /></div>
          <div className="field"><label htmlFor="ad-sak">Semen terpakai <span className="help">sak</span></label><input id="ad-sak" name="cementBags" className="num" inputMode="decimal" value={bags} onChange={(e) => setBags(e.target.value)} required placeholder="0" /></div>
          <div className="field span-2">
            <label htmlFor="ad-leader">Grup / leader</label>
            <input id="ad-leader" name="leader" list="ad-leaders" defaultValue={leader} autoComplete="off" placeholder="Nama ketua regu" />
            <datalist id="ad-leaders">{leaders.map((l) => <option key={l} value={l} />)}</datalist>
          </div>
        </div>
      </section>

      <section className="form-section">
        <div className="card-head" style={{ marginBottom: 0 }}><h2>Produk dalam adukan</h2><span className="small muted">Jadi = Grade A (menambah stok)</span></div>
        {rows.map((r, i) => {
          const it = items.find((x) => x.id === r.itemId);
          const buis = it?.line === "buis";
          const sp = it ? specs.find((s) => s.itemId === it.id) : undefined;
          return (
            <div key={i} className="admin-card stack" style={{ gap: 10 }}>
              <div className="lines-row">
                <Select aria-label={`Produk ${i + 1}`} value={r.itemId} onChange={(v) => patch(i, { itemId: v })} placeholder="Pilih barang…" searchable menuWidth={300} options={items.map((o) => ({ value: o.id, label: o.name, hint: o.code }))} />
                <span className="small muted">{it?.unit}</span>
                <button type="button" className="icon-btn" aria-label={`Hapus produk ${i + 1}`} onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : [blankRow()]))}>×</button>
              </div>
              {buis && (
                <div className="prd-choices" role="group" aria-label="Metode Buis Beton">
                  {(Object.keys(METHOD_LABEL) as ProductionMethod[]).map((m) => (
                    <button key={m} type="button" className="prd-choice" aria-pressed={(r.method || it?.method) === m} onClick={() => patch(i, { method: m })}>{METHOD_LABEL[m]}</button>
                  ))}
                </div>
              )}
              <div className="form-grid cols-4">
                <div className="field"><label htmlFor={`ad-t-${i}`}>Target</label><input id={`ad-t-${i}`} className="num" inputMode="decimal" value={r.target} onChange={(e) => patch(i, { target: e.target.value })} placeholder="buah" /></div>
                <div className="field"><label htmlFor={`ad-q-${i}`}>Jadi</label><input id={`ad-q-${i}`} className="num" inputMode="decimal" value={r.qty} onChange={(e) => patch(i, { qty: e.target.value })} placeholder="0" /></div>
                <div className="field"><label htmlFor={`ad-b-${i}`}>Grade B</label><input id={`ad-b-${i}`} className="num" inputMode="decimal" value={r.gradeB} onChange={(e) => patch(i, { gradeB: e.target.value })} placeholder="0" /></div>
                <div className="field"><label htmlFor={`ad-r-${i}`}>Reject</label><input id={`ad-r-${i}`} className="num" inputMode="decimal" value={r.rejects} onChange={(e) => patch(i, { rejects: e.target.value })} placeholder="0" /></div>
              </div>
              {sp?.weightKg != null && parseQty(r.qty) > 0 && !/^m$/i.test(it?.unit ?? "") && <p className="small muted" style={{ margin: 0 }}>Berat {formatQty(sp.weightKg)} kg / {it?.unit} · ≈ total {formatQty(Math.round(sp.weightKg * parseQty(r.qty) * 100) / 100)} kg</p>}
            </div>
          );
        })}
        <div><button type="button" className="btn btn-ghost btn-sm" onClick={() => setRows((rs) => [...rs, blankRow()])}>+ Tambah produk</button></div>
        {(done > 0 || target > 0) && (
          <p className="alert alert-info" role="status">
            {target > 0 && <>Target {formatQty(target)} · realisasi {formatQty(done)}{target > 0 && <> ({Math.round((done / target) * 100)}%)</>}. </>}
            Total {formatQty(done)} dari {formatQty(sak)} sak semen{done > 0 && sak > 0 && <> (≈ {formatQty(Math.round((sak / done) * 1000) / 1000)} sak / buah rata-rata)</>}.
          </p>
        )}
      </section>

      <section className="form-section">
        <div className="field"><label htmlFor="ad-note">Catatan</label><textarea id="ad-note" name="note" rows={3} defaultValue={note} /></div>
      </section>
      <div className="form-actions"><SubmitButton className="btn btn-primary prd-save">{id ? "Simpan adukan" : "Simpan adukan"}</SubmitButton></div>
    </ActionForm>
  );
}
