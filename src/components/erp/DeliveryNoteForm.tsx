"use client";

// Form surat jalan manual (tanpa harga) — Surat Jalan IBN: barang, jumlah, satuan, keterangan; sopir & nomor polisi; diambil pelanggan.
import { useState } from "react";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { saveDeliveryNote } from "@/app/akuntansi/actions/deliveryNotes";
import type { Signer } from "@/lib/erp/quotation";

export type DeliveryNoteValue = {
  id?: string; issuer: string; number: string; noteDate: string; poNumber: string; terms: string; customerName: string; customerPhone: string; address: string; note: string;
  items: { name: string; quantity: string; unit: string; remark: string }[]; driverName: string; plate: string; pickup: boolean; isInternal: boolean; signerId: string; signerName: string;
};

export function DeliveryNoteForm({ initial, signers, products, nextNumber }: { initial: DeliveryNoteValue; signers: Signer[]; products: string[]; nextNumber: string }) {
  const [f, setF] = useState(initial);
  const set = (p: Partial<DeliveryNoteValue>) => setF((x) => ({ ...x, ...p }));
  const setItem = (i: number, p: Partial<DeliveryNoteValue["items"][number]>) => set({ items: f.items.map((it, j) => (j === i ? { ...it, ...p } : it)) });
  const field = (label: string, key: keyof DeliveryNoteValue, placeholder?: string) => (
    <div className="field"><label htmlFor={`dn-${key}`}>{label}</label><input id={`dn-${key}`} name={key} value={String(f[key] ?? "")} onChange={(e) => set({ [key]: e.target.value } as Partial<DeliveryNoteValue>)} placeholder={placeholder} /></div>
  );
  return (
    <ActionForm action={saveDeliveryNote} className="form-section">
      {f.id && <input type="hidden" name="id" value={f.id} />}
      <input type="hidden" name="issuer" value={f.issuer} />
      <input type="hidden" name="items" value={JSON.stringify(f.items)} />
      <input type="hidden" name="signerId" value={f.signerId} />
      <div className="form-grid">
        <div className="field"><label htmlFor="dn-number">No. surat jalan</label><input id="dn-number" name="number" value={f.number} onChange={(e) => set({ number: e.target.value })} placeholder={`Otomatis: ${nextNumber}`} /></div>
        <div className="field"><label htmlFor="dn-date">Tanggal</label><input id="dn-date" type="date" name="noteDate" value={f.noteDate} onChange={(e) => set({ noteDate: e.target.value })} required /></div>
        {field("No. PO", "poNumber")}
        {field("Terms", "terms", "mis. Tempo / Transfer / Lunas")}
        {field("Kepada (penerima)", "customerName")}
        {field("No. HP", "customerPhone")}
        <div className="field full"><label htmlFor="dn-addr">Alamat kirim</label><textarea id="dn-addr" name="address" rows={2} value={f.address} onChange={(e) => set({ address: e.target.value })} /></div>
        <div className="field full"><label htmlFor="dn-note">Catatan</label><input id="dn-note" name="note" value={f.note} onChange={(e) => set({ note: e.target.value })} /></div>
      </div>
      <h3 className="form-sub">Barang</h3>
      <datalist id="dn-products">{products.map((p) => <option key={p} value={p} />)}</datalist>
      <div className="admin-table">
        <table>
          <thead><tr><th style={{ width: 28 }}>No</th><th style={{ width: 100 }}>Qty</th><th style={{ width: 90 }}>Satuan</th><th>Nama barang</th><th>Keterangan</th><th /></tr></thead>
          <tbody>
            {f.items.map((it, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td><input inputMode="decimal" value={it.quantity} onChange={(e) => setItem(i, { quantity: e.target.value })} aria-label="Qty" /></td>
                <td><input value={it.unit} onChange={(e) => setItem(i, { unit: e.target.value })} aria-label="Satuan" /></td>
                <td><input list="dn-products" value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} aria-label="Nama barang" style={{ minWidth: 220 }} /></td>
                <td><input value={it.remark} onChange={(e) => setItem(i, { remark: e.target.value })} aria-label="Keterangan" /></td>
                <td><button type="button" className="link-btn" aria-label="Hapus baris" disabled={f.items.length < 2} onClick={() => set({ items: f.items.filter((_, j) => j !== i) })}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ items: [...f.items, { name: "", quantity: "", unit: "pcs", remark: "" }] })}>+ Tambah barang</button>
      <div className="form-grid" style={{ marginTop: 12 }}>
        <div className="field full"><label className="check"><input type="checkbox" name="pickup" checked={f.pickup} onChange={(e) => set({ pickup: e.target.checked })} /> Diambil pelanggan (tanpa sopir)</label></div>
        {!f.pickup && field("Nama sopir", "driverName")}
        {!f.pickup && field("Nomor polisi", "plate")}
        <div className="field"><label className="check"><input type="checkbox" name="isInternal" checked={f.isInternal} onChange={(e) => set({ isInternal: e.target.checked })} /> Internal (antar unit sendiri)</label></div>
        <div className="field"><label htmlFor="dn-signer">Ditandatangani oleh</label>
          <select id="dn-signer" value={f.signerId} onChange={(e) => { const p = signers.find((s) => String(s.id) === e.target.value); set({ signerId: e.target.value, signerName: p?.name ?? f.signerName }); }}>
            <option value="">— Pilih akun (TTD otomatis) —</option>
            {signers.map((s) => <option key={s.id} value={s.id}>{s.name}{s.hasSignature ? "" : " (belum ada gambar TTD)"}</option>)}
          </select>
        </div>
        {field("Nama di surat jalan", "signerName")}
      </div>
      <div className="form-actions"><SubmitButton>{f.id ? "Simpan perubahan" : "Simpan surat jalan"}</SubmitButton></div>
    </ActionForm>
  );
}
