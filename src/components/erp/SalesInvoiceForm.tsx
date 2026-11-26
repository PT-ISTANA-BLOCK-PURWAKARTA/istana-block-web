"use client";

// Form invoice penjualan (sama seperti app lama): nomor otomatis per penerbit (boleh diisi sendiri, mis. sama dengan faktur Zahir),
// barang × harga, PPN %, uang muka persen / nominal, rekening, penanda tangan. Bisa diisi dari surat penawaran.
import { useState } from "react";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { BankPicker } from "@/components/erp/QuotationForm";
import { recordSalesInvoicePayment, saveSalesInvoice } from "@/app/akuntansi/actions/documents";
import type { Signer } from "@/lib/erp/quotation";
import { invoiceTotals, PAYMENT_METHODS, type InvoiceFormValue } from "@/lib/erp/salesInvoice";

const num = (s: string) => { const t = s.replace(/\./g, "").replace(",", ".").trim(); const n = Number(t); return t && Number.isFinite(n) ? n : null; };
const rp = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;

export function SalesInvoiceForm({ initial, signers, products, nextNumber, issuers }: { initial: InvoiceFormValue; signers: Signer[]; products: string[]; nextNumber: Record<string, string>; issuers: { key: string; label: string }[] }) {
  const [f, setF] = useState(initial);
  const set = (patch: Partial<InvoiceFormValue>) => setF((x) => ({ ...x, ...patch }));
  const setItem = (i: number, patch: Partial<InvoiceFormValue["items"][number]>) => set({ items: f.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  const t = invoiceTotals(f.items.map((i) => ({ name: i.name, unit: i.unit, quantity: num(i.quantity) ?? 0, price: num(i.price) ?? 0 })), num(f.ppnPercent) ?? 0, f.dpMode === "persen" ? num(f.downPaymentPercent) : null, f.dpMode === "nominal" ? num(f.downPaymentAmount) : null);
  const field = (label: string, key: keyof InvoiceFormValue, placeholder?: string) => (
    <div className="field"><label htmlFor={`i-${key}`}>{label}</label><input id={`i-${key}`} value={String(f[key] ?? "")} onChange={(e) => set({ [key]: e.target.value } as Partial<InvoiceFormValue>)} placeholder={placeholder} /></div>
  );
  return (
    <ActionForm action={saveSalesInvoice} className="form-section">
      {f.id && <input type="hidden" name="id" value={f.id} />}
      {(["number", "issuer", "invoiceDate", "quotationId", "customerName", "customerAddress", "customerPhone", "poNumber", "ppnPercent", "dpMode", "downPaymentPercent", "downPaymentAmount", "note", "bankName", "bankAccount", "signerId", "signerName"] as const).map((k) => <input key={k} type="hidden" name={k} value={String(f[k] ?? "")} />)}
      <input type="hidden" name="items" value={JSON.stringify(f.items)} />
      <div className="form-grid">
        <div className="field"><label htmlFor="i-iss">Penerbit</label>
          <select id="i-iss" value={f.issuer} disabled={Boolean(f.id)} onChange={(e) => set({ issuer: e.target.value })}>{issuers.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}</select>
        </div>
        <div className="field"><label htmlFor="i-number">No. invoice</label><input id="i-number" value={f.number} onChange={(e) => set({ number: e.target.value })} placeholder={nextNumber[f.issuer] ? `Otomatis: ${nextNumber[f.issuer]}` : "Otomatis"} /><span className="help">Kosongkan untuk nomor otomatis; isi bila ingin sama dengan faktur Zahir.</span></div>
        <div className="field"><label htmlFor="i-date">Tanggal</label><input id="i-date" type="date" value={f.invoiceDate} onChange={(e) => set({ invoiceDate: e.target.value })} required /></div>
        {field("Kepada (nama pelanggan)", "customerName")}
        <div className="field"><label htmlFor="i-addr">Alamat</label><textarea id="i-addr" rows={2} value={f.customerAddress} onChange={(e) => set({ customerAddress: e.target.value })} /></div>
        {field("No. telp", "customerPhone")}
        {field("No. PO pelanggan", "poNumber")}
      </div>

      <h3 className="form-sub">Barang</h3>
      <datalist id="i-products">{products.map((p) => <option key={p} value={p} />)}</datalist>
      <div className="admin-table">
        <table>
          <thead><tr><th style={{ width: 28 }}>No</th><th>Nama barang</th><th style={{ width: 100 }}>Banyaknya</th><th style={{ width: 80 }}>Satuan</th><th style={{ width: 140 }}>Harga satuan (Rp)</th><th className="num">Jumlah</th><th /></tr></thead>
          <tbody>
            {f.items.map((it, i) => {
              const q = num(it.quantity), p = num(it.price);
              return (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td><input list="i-products" value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} aria-label="Nama barang" style={{ minWidth: 220 }} /></td>
                  <td><input inputMode="decimal" value={it.quantity} onChange={(e) => setItem(i, { quantity: e.target.value })} aria-label="Banyaknya" /></td>
                  <td><input value={it.unit} onChange={(e) => setItem(i, { unit: e.target.value })} aria-label="Satuan" /></td>
                  <td><input inputMode="numeric" value={it.price} onChange={(e) => setItem(i, { price: e.target.value })} aria-label="Harga" /></td>
                  <td className="num">{q != null && p != null ? rp(q * p) : "-"}</td>
                  <td><button type="button" className="link-btn" aria-label="Hapus baris" disabled={f.items.length < 2} onClick={() => set({ items: f.items.filter((_, j) => j !== i) })}>×</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ items: [...f.items, { name: "", unit: "pcs", quantity: "", price: "" }] })}>+ Tambah barang</button>

      <div className="form-grid" style={{ marginTop: 12 }}>
        <div className="field"><label htmlFor="i-ppn">PPN (%)</label><input id="i-ppn" inputMode="decimal" value={f.ppnPercent} onChange={(e) => set({ ppnPercent: e.target.value })} placeholder="0 = tanpa PPN" /></div>
        <div className="field"><label>Uang muka</label>
          <div className="seg">{([["none", "Tidak ada"], ["persen", "Persen"], ["nominal", "Nominal"]] as const).map(([k, l]) => <label key={k} className={`seg-btn${f.dpMode === k ? " is-on" : ""}`}><input type="radio" checked={f.dpMode === k} onChange={() => set({ dpMode: k })} /> {l}</label>)}</div>
        </div>
        {f.dpMode === "persen" && field("Uang muka (%)", "downPaymentPercent", "mis. 30")}
        {f.dpMode === "nominal" && field("Uang muka (Rp)", "downPaymentAmount")}
        <dl className="kv field">
          <dt>Total</dt><dd className="num">{rp(t.total)}</dd>
          {t.ppn > 0 && <><dt>PPN</dt><dd className="num">{rp(t.ppn)}</dd></>}
          <dt><b>Grand total</b></dt><dd className="num"><b>{rp(t.grandTotal)}</b></dd>
          {t.downPayment !== null && <><dt>Uang muka</dt><dd className="num">{rp(t.downPayment)}</dd><dt><b>Sisa</b></dt><dd className="num"><b>{rp(t.remaining ?? 0)}</b></dd></>}
        </dl>
        <div className="field full"><label htmlFor="i-note">Catatan</label><textarea id="i-note" rows={2} value={f.note} onChange={(e) => set({ note: e.target.value })} /></div>
        {f.issuer !== "eib" && <BankPicker name={f.bankName} account={f.bankAccount} onChange={(bankName, bankAccount) => set({ bankName, bankAccount })} />}
        <div className="field"><label htmlFor="i-signer">Ditandatangani oleh</label>
          <select id="i-signer" value={f.signerId} onChange={(e) => { const p = signers.find((s) => String(s.id) === e.target.value); set({ signerId: e.target.value, signerName: p?.name ?? f.signerName }); }}>
            <option value="">— Pilih akun (TTD otomatis) —</option>
            {signers.map((s) => <option key={s.id} value={s.id}>{s.name}{s.hasSignature ? "" : " (belum ada gambar TTD)"}</option>)}
          </select>
        </div>
        {field("Nama di invoice", "signerName")}
      </div>
      <div className="form-actions"><SubmitButton>{f.id ? "Simpan perubahan" : "Simpan invoice"}</SubmitButton></div>
    </ActionForm>
  );
}

export function SalesInvoicePaymentForm({ id, grandTotal, value }: { id: string; grandTotal: number; value: { amount: number | null; paidAt: string; method: string | null; note: string | null } }) {
  const [amount, setAmount] = useState(value.amount ? String(value.amount) : "");
  return (
    <ActionForm action={recordSalesInvoicePayment} className="form-section">
      <input type="hidden" name="id" value={id} />
      <div className="form-grid">
        <div className="field"><label htmlFor="p-amt">Sudah dibayar (Rp)</label><input id="p-amt" name="amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <span className="help"><button type="button" className="link-btn" onClick={() => setAmount(String(grandTotal))}>Isi lunas ({rp(grandTotal)})</button> · kosongkan / 0 untuk menghapus catatan bayar</span></div>
        <div className="field"><label htmlFor="p-date">Tanggal bayar</label><input id="p-date" type="date" name="paidAt" defaultValue={value.paidAt} /></div>
        <div className="field"><label htmlFor="p-m">Cara bayar</label><select id="p-m" name="method" defaultValue={value.method ?? PAYMENT_METHODS[0]}>{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</select></div>
        <div className="field"><label htmlFor="p-n">Catatan</label><input id="p-n" name="note" defaultValue={value.note ?? ""} /></div>
      </div>
      <div className="form-actions"><SubmitButton>Simpan pembayaran</SubmitButton></div>
    </ActionForm>
  );
}
