"use client";

import { useState } from "react";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { saveProduction } from "@/app/operasional/actions/stock";
import { parseQty } from "@/lib/erp/util";

type Opt = { id: string; code: string; name: string; unit: string; kind: string };
type Row = { itemId: string; qty: string };

function Rows({ title, help, rows, setRows, options }: { title: string; help: string; rows: Row[]; setRows: (f: (r: Row[]) => Row[]) => void; options: Opt[] }) {
  const unit = (id: string) => options.find((o) => o.id === id)?.unit ?? "";
  return (
    <section className="form-section">
      <div className="card-head" style={{ marginBottom: 0 }}><h2>{title}</h2><span className="small muted">{help}</span></div>
      <div className="lines-table plines">
        {rows.map((r, i) => (
          <div className="lines-row" key={i}>
            <select aria-label={`${title} baris ${i + 1}`} value={r.itemId} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, itemId: e.target.value } : x)))}>
              <option value="">— pilih barang —</option>
              {options.map((o) => <option key={o.id} value={o.id}>{o.code} · {o.name}</option>)}
            </select>
            <div className="inline-form">
              <input aria-label={`Qty ${title} baris ${i + 1}`} className="num" inputMode="decimal" value={r.qty} placeholder="0" onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} />
              <span className="small muted" style={{ minWidth: 32 }}>{unit(r.itemId)}</span>
            </div>
            <button type="button" className="icon-btn" aria-label={`Hapus baris ${i + 1}`} onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : [{ itemId: "", qty: "" }]))}>×</button>
          </div>
        ))}
      </div>
      <div><button type="button" className="btn btn-ghost btn-sm" onClick={() => setRows((rs) => [...rs, { itemId: "", qty: "" }])}>+ Tambah baris</button></div>
    </section>
  );
}

/** Catat hasil produksi: barang jadi masuk, bahan baku keluar, biaya produksi diserap ke nilai persediaan. */
export function ProductionForm({ id, date, note, laborCost, hasil, bahan, items }: { id?: string; date: string; note?: string; laborCost?: number; hasil: Row[]; bahan: Row[]; items: Opt[] }) {
  const [out, setOut] = useState<Row[]>(hasil.length ? hasil : [{ itemId: "", qty: "" }]);
  const [used, setUsed] = useState<Row[]>(bahan.length ? bahan : [{ itemId: "", qty: "" }]);
  const ser = (rs: Row[]) => JSON.stringify(rs.map((r) => ({ itemId: r.itemId, qty: parseQty(r.qty) })).filter((r) => r.itemId || r.qty));
  const finished = items.filter((i) => i.kind === "barang_jadi");
  const raw = items.filter((i) => i.kind === "bahan_baku");
  return (
    <ActionForm action={saveProduction} className="stack" style={{ gap: 20 }}>
      {id && <input type="hidden" name="id" value={id} />}
      <input type="hidden" name="hasil" value={ser(out)} />
      <input type="hidden" name="bahan" value={ser(used)} />
      <section className="form-section">
        <div className="form-grid cols-4">
          <div className="field"><label htmlFor="pr-date">Tanggal</label><input id="pr-date" name="date" type="date" defaultValue={date} required /></div>
          <div className="field">
            <label htmlFor="pr-labor">Biaya produksi (Rp) <span className="help">upah, listrik, dll.</span></label>
            <input id="pr-labor" name="laborCost" className="num" inputMode="numeric" defaultValue={laborCost != null ? String(laborCost) : ""} placeholder="otomatis" />
          </div>
          <div className="field span-2"><label htmlFor="pr-note">Catatan <span className="help">mis. shift, mesin, nomor batch</span></label><input id="pr-note" name="note" defaultValue={note} /></div>
        </div>
        <p className="small muted">
          Nilai hasil = nilai bahan (harga pokok rata-rata) + biaya produksi. Bila biaya produksi dikosongkan, sistem mengisinya supaya nilai hasil sama dengan harga pokok standar barang (diatur di data barang).
        </p>
      </section>
      <Rows title="Hasil produksi" help="barang jadi yang masuk gudang" rows={out} setRows={setOut} options={finished.length ? finished : items} />
      <Rows title="Bahan terpakai" help="opsional; mengurangi stok bahan baku" rows={used} setRows={setUsed} options={raw.length ? raw : items} />
      <div className="form-actions"><SubmitButton>{id ? "Simpan perubahan" : "Simpan hasil produksi"}</SubmitButton></div>
    </ActionForm>
  );
}

