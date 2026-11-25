"use client";

// Surat pesanan barang ke pemasok (eksternal) dari baris F-IB-10. Draft = belum bernomor resmi; Simpan = nomor resmi.
import Link from "next/link";
import { useState } from "react";
import { savePurchaseLetter } from "@/app/operasional/actions/purchaseLetters";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { DateField } from "@/components/ui";

export type ItemRow = { name: string; quantity: string; unit: string; price: string; total: string; note: string };
export type PurchaseLetterInitial = {
  id?: string; draft?: boolean; number?: string; letterDate: string; supplierName: string; contactName: string; contactPhone: string; supplierAddress: string;
  items: ItemRow[]; showPrices: boolean; deliveryTo: string; neededBy: string; receiverName: string; receiverPhone: string; payment: string; paymentDays: string; note: string;
  isoKeys: string[]; signerId: string; signerTitle: string;
};
type Contact = { supplierName: string; contactName: string | null; contactPhone: string | null; supplierAddress: string | null };

const emptyItem = (): ItemRow => ({ name: "", quantity: "", unit: "", price: "", total: "", note: "" });
const amount = (v: string) => {
  const clean = v.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  return clean && Number.isFinite(Number(clean)) ? Number(clean) : null;
};
const lineTotal = (i: ItemRow) => amount(i.total) ?? (amount(i.quantity) !== null && amount(i.price) !== null ? amount(i.quantity)! * amount(i.price)! : null);
const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;

export function PurchaseLetterForm({ initial, contacts, signers, back }: { initial: PurchaseLetterInitial; contacts: Contact[]; signers: { id: number; name: string }[]; back: string }) {
  const [f, setF] = useState(initial);
  const set = (patch: Partial<PurchaseLetterInitial>) => setF((c) => ({ ...c, ...patch }));
  const setItem = (i: number, patch: Partial<ItemRow>) => set({ items: f.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  const total = f.items.reduce((s, it) => s + (lineTotal(it) ?? 0), 0);
  const pickSupplier = (name: string) => {
    const c = contacts.find((x) => x.supplierName.toLowerCase() === name.trim().toLowerCase());
    set({ supplierName: name, ...(c && !f.contactName ? { contactName: c.contactName ?? "", contactPhone: c.contactPhone ?? "", supplierAddress: c.supplierAddress ?? "" } : {}) });
  };
  return (
    <ActionForm action={savePurchaseLetter} className="form-section">
      {f.id && <input type="hidden" name="id" value={f.id} />}
      <input type="hidden" name="items" value={JSON.stringify(f.items)} />
      <input type="hidden" name="isoKeys" value={JSON.stringify(f.isoKeys)} />
      <h2>{f.id ? (f.draft ? "Lanjutkan draft surat pesanan" : `Ubah surat ${f.number}`) : "Surat pesanan barang (eksternal)"}</h2>
      <p className="small muted">Versi resmi untuk pemasok dari permintaan internal F-IB-10. Nomor otomatis (001/SP-IBP/bulan/tahun) saat disimpan; draft belum bernomor.</p>
      <div className="form-grid">
        <div className="field"><label htmlFor="pl-date">Tanggal surat</label><DateField id="pl-date" name="letterDate" defaultValue={f.letterDate} required /></div>
        <div className="field">
          <label htmlFor="pl-sup">Kepada (toko / pemasok)</label>
          <input id="pl-sup" name="supplierName" list="pl-sups" value={f.supplierName} onChange={(e) => pickSupplier(e.target.value)} maxLength={200} />
          <datalist id="pl-sups">{contacts.map((c) => <option key={c.supplierName} value={c.supplierName} />)}</datalist>
        </div>
        <div className="field"><label htmlFor="pl-cn">U.p. (nama kontak)</label><input id="pl-cn" name="contactName" value={f.contactName} onChange={(e) => set({ contactName: e.target.value })} maxLength={120} /></div>
        <div className="field"><label htmlFor="pl-cp">Telp / WA pemasok</label><input id="pl-cp" name="contactPhone" value={f.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} maxLength={40} /></div>
      </div>
      <div className="field"><label htmlFor="pl-addr">Alamat pemasok</label><input id="pl-addr" name="supplierAddress" value={f.supplierAddress} onChange={(e) => set({ supplierAddress: e.target.value })} maxLength={300} /></div>

      <div className="field">
        <span className="label">Barang / alat</span>
        <div className="admin-table">
          <table className="compact">
            <thead><tr><th>Nama barang / alat</th><th>Jumlah</th><th>Satuan</th>{f.showPrices && <><th>Harga satuan</th><th>Total</th></>}<th>Keterangan</th><th /></tr></thead>
            <tbody>
              {f.items.map((it, i) => (
                <tr key={i}>
                  <td><input aria-label={`Barang ${i + 1}`} value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} /></td>
                  <td><input aria-label={`Jumlah ${i + 1}`} className="num" inputMode="decimal" value={it.quantity} onChange={(e) => setItem(i, { quantity: e.target.value })} style={{ width: 70 }} /></td>
                  <td><input aria-label={`Satuan ${i + 1}`} value={it.unit} onChange={(e) => setItem(i, { unit: e.target.value })} style={{ width: 70 }} /></td>
                  {f.showPrices && (
                    <>
                      <td><input aria-label={`Harga ${i + 1}`} className="num" inputMode="decimal" value={it.price} onChange={(e) => setItem(i, { price: e.target.value })} style={{ width: 110 }} /></td>
                      <td className="num">{lineTotal(it) !== null ? rupiah(lineTotal(it)!) : "-"}</td>
                    </>
                  )}
                  <td><input aria-label={`Keterangan ${i + 1}`} value={it.note} onChange={(e) => setItem(i, { note: e.target.value })} /></td>
                  <td><button type="button" className="link-btn" aria-label={`Hapus barang ${i + 1}`} onClick={() => set({ items: f.items.length > 1 ? f.items.filter((_, j) => j !== i) : [emptyItem()] })}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="qc-row-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ items: [...f.items, emptyItem()] })}>+ Barang</button>
          <label className="check"><input type="checkbox" name="showPrices" checked={f.showPrices} onChange={(e) => set({ showPrices: e.target.checked })} /> Tampilkan harga di surat</label>
          {f.showPrices && total > 0 && <b>Total {rupiah(total)}</b>}
        </div>
      </div>

      <div className="form-grid">
        <div className="field"><label htmlFor="pl-to">Dikirim ke</label><input id="pl-to" name="deliveryTo" value={f.deliveryTo} onChange={(e) => set({ deliveryTo: e.target.value })} maxLength={300} /></div>
        <div className="field"><label htmlFor="pl-need">Dibutuhkan tanggal</label><DateField id="pl-need" name="neededBy" defaultValue={f.neededBy} /></div>
        <div className="field"><label htmlFor="pl-rn">Penerima barang</label><input id="pl-rn" name="receiverName" value={f.receiverName} onChange={(e) => set({ receiverName: e.target.value })} maxLength={120} /></div>
        <div className="field"><label htmlFor="pl-rp">Telp penerima</label><input id="pl-rp" name="receiverPhone" value={f.receiverPhone} onChange={(e) => set({ receiverPhone: e.target.value })} maxLength={40} /></div>
        <div className="field"><label htmlFor="pl-pd">Tempo bayar (hari)</label><input id="pl-pd" name="paymentDays" inputMode="numeric" value={f.paymentDays} onChange={(e) => set({ paymentDays: e.target.value.replace(/\D/g, "") })} placeholder="kosongkan bila tunai" /></div>
        <div className="field"><label htmlFor="pl-pay">Pembayaran (catatan)</label><input id="pl-pay" name="payment" value={f.payment} onChange={(e) => set({ payment: e.target.value })} maxLength={200} placeholder="mis. transfer BCA" /></div>
      </div>
      <div className="field"><label htmlFor="pl-note">Catatan <span className="help">satu baris = satu butir</span></label><textarea id="pl-note" name="note" value={f.note} onChange={(e) => set({ note: e.target.value })} maxLength={1000} /></div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="pl-sign">Penanda tangan</label>
          <select id="pl-sign" name="signerId" value={f.signerId} onChange={(e) => set({ signerId: e.target.value })}>
            <option value="">— Pilih —</option>
            {signers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor="pl-title">Jabatan</label><input id="pl-title" name="signerTitle" value={f.signerTitle} onChange={(e) => set({ signerTitle: e.target.value })} maxLength={80} placeholder="mis. Direktur" /></div>
      </div>
      <div className="form-actions">
        <SubmitButton name="intent" value="final">{f.id && !f.draft ? "Simpan perubahan" : "Simpan & beri nomor"}</SubmitButton>
        {(!f.id || f.draft) && <SubmitButton name="intent" value="draft" className="btn btn-ghost">Simpan draft</SubmitButton>}
        <Link href={back} className="btn btn-ghost">Batal</Link>
      </div>
    </ActionForm>
  );
}
