"use client";

// Form Surat Penawaran (sama seperti app lama): barang/pekerjaan + ukuran + volume opsional, harga manual,
// catatan bebas dengan contoh Material / U-Ditch / Proyek, rekening, penanda tangan (TTD otomatis), U.p. PIC.
import { useState } from "react";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { saveQuotation } from "@/app/akuntansi/actions/documents";

import { BANK_ACCOUNTS, emptyItem, TERM_TEMPLATES, type QItem, type QTerm, type QuotationValue, type Signer } from "@/lib/erp/quotation";

const num = (s: string) => { const t = s.replace(/\./g, "").replace(",", ".").trim(); const n = Number(t); return t && Number.isFinite(n) ? n : null; };
const rp = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;

export function BankPicker({ name, account, onChange }: { name: string; account: string; onChange: (name: string, account: string) => void }) {
  const preset = BANK_ACCOUNTS.findIndex((b) => b.account === account.trim());
  const [custom, setCustom] = useState(preset < 0 && Boolean(account.trim()));
  return (
    <div className="field full">
      <label>Rekening</label>
      <div className="seg" style={{ flexWrap: "wrap" }}>
        {BANK_ACCOUNTS.map((b, i) => (
          <button key={b.account} type="button" className={`seg-btn${!custom && preset === i ? " is-on" : ""}`} onClick={() => { setCustom(false); onChange(b.name, b.account); }}>
            <b>{b.name.replace(/^BCA A\/N /, "")}</b> · BCA {b.account}
          </button>
        ))}
        <button type="button" className={`seg-btn${custom ? " is-on" : ""}`} onClick={() => { setCustom(true); onChange("", ""); }}>Lainnya (ketik sendiri)</button>
      </div>
      {custom && (
        <div className="form-grid" style={{ marginTop: 6 }}>
          <input value={name} onChange={(e) => onChange(e.target.value, account)} placeholder="Nama bank, mis. BCA A/N …" aria-label="Nama bank" />
          <input value={account} onChange={(e) => onChange(name, e.target.value)} placeholder="No. rekening" aria-label="No. rekening" />
        </div>
      )}
    </div>
  );
}

export function QuotationForm({ initial, signers, products, nextNumber }: { initial: QuotationValue; signers: Signer[]; products: string[]; nextNumber?: string }) {
  const [f, setF] = useState(initial);
  const [attn, setAttn] = useState(Boolean(initial.attnName));
  const set = (patch: Partial<QuotationValue>) => setF((x) => ({ ...x, ...patch }));
  const setItem = (i: number, patch: Partial<QItem>) => set({ items: f.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  const setTerm = (i: number, patch: Partial<QTerm>) => set({ terms: f.terms.map((t, j) => (j === i ? { ...t, ...patch } : t)) });
  const pickSigner = (v: string) => { const p = signers.find((s) => String(s.id) === v); set({ signerId: v, signerName: p?.name ?? f.signerName, signerTitle: p ? p.title : f.signerTitle }); };
  const total = f.items.reduce((s, it) => s + (num(it.quantity) ?? 0) * (num(it.price) ?? 0), 0);
  const field = (label: string, key: keyof QuotationValue, placeholder?: string, full?: boolean) => (
    <div className={`field${full ? " full" : ""}`}><label htmlFor={`q-${key}`}>{label}</label><input id={`q-${key}`} value={String(f[key] ?? "")} onChange={(e) => set({ [key]: e.target.value } as Partial<QuotationValue>)} placeholder={placeholder} /></div>
  );
  return (
    <ActionForm action={saveQuotation} className="form-section">
      {f.id && <input type="hidden" name="id" value={f.id} />}
      {(["quoteDate", "projectName", "projectCity", "customerName", "customerAddress", "customerPhone", "work", "location", "bankName", "bankAccount", "signerId", "signerName", "signerTitle", "customerSignTitle"] as const).map((k) => <input key={k} type="hidden" name={k} value={String(f[k] ?? "")} />)}
      <input type="hidden" name="attnName" value={attn ? f.attnName : ""} />
      <input type="hidden" name="attnPhone" value={attn ? f.attnPhone : ""} />
      <input type="hidden" name="items" value={JSON.stringify(f.items)} />
      <input type="hidden" name="terms" value={JSON.stringify(f.terms)} />

      <p className="muted small">{f.number ? <>No. surat <b>{f.number}</b> (nomor urut tetap; bulan/tahun mengikuti tanggal surat)</> : <>Nomor otomatis: <b>{nextNumber}</b></>}</p>
      <div className="form-grid">
        <div className="field"><label htmlFor="q-date">Tanggal surat</label><input id="q-date" type="date" value={f.quoteDate} onChange={(e) => set({ quoteDate: e.target.value })} required /></div>
        {field("Nama proyek", "projectName", "Mis. PERUMAHAN …")}
        {field("Alamat / kota proyek", "projectCity", "Mis. PURWAKARTA")}
        {field("Kepada (nama pelanggan / PT)", "customerName", "Mis. PT. …")}
        {field("Alamat pelanggan", "customerAddress")}
        {field("No. HP", "customerPhone")}
        <div className="field full"><label className="check"><input type="checkbox" checked={attn} onChange={(e) => setAttn(e.target.checked)} /> Penerima / PIC berbeda (U.p.) — surat atas nama PT, diterima Bapak/Ibu …</label></div>
        {attn && field("U.p. (nama PIC)", "attnName", "Mis. Bapak Andi")}
        {attn && field("No. HP PIC", "attnPhone")}
        {field("Pekerjaan", "work", "Mis. PENGADAAN PAVING BLOCK")}
        {field("Lokasi", "location")}
      </div>

      <h3 className="form-sub">Barang / pekerjaan</h3>
      <datalist id="q-products">{products.map((p) => <option key={p} value={p} />)}</datalist>
      <div className="admin-table">
        <table>
          <thead><tr><th style={{ width: 28 }}>No</th><th>Jenis barang / pekerjaan</th><th>Ukuran</th><th>Keterangan</th><th style={{ width: 90 }}>Volume</th><th style={{ width: 80 }}>Satuan</th><th style={{ width: 130 }}>Harga (Rp)</th><th className="num">Jumlah</th><th /></tr></thead>
          <tbody>
            {f.items.map((it, i) => {
              const q = num(it.quantity), p = num(it.price);
              return (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td><input list="q-products" value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} aria-label="Nama barang" style={{ minWidth: 200 }} /></td>
                  <td><input value={it.size} onChange={(e) => setItem(i, { size: e.target.value })} aria-label="Ukuran" placeholder="20x10x6" /></td>
                  <td><input value={it.note} onChange={(e) => setItem(i, { note: e.target.value })} aria-label="Keterangan" /></td>
                  <td><input inputMode="decimal" value={it.quantity} onChange={(e) => setItem(i, { quantity: e.target.value })} aria-label="Volume" placeholder="opsional" /></td>
                  <td><input value={it.unit} onChange={(e) => setItem(i, { unit: e.target.value })} aria-label="Satuan" /></td>
                  <td><input inputMode="numeric" value={it.price} onChange={(e) => setItem(i, { price: e.target.value })} aria-label="Harga" /></td>
                  <td className="num">{q && p != null ? rp(q * p) : "-"}</td>
                  <td><button type="button" className="link-btn" aria-label="Hapus baris" onClick={() => set({ items: f.items.filter((_, j) => j !== i) })} disabled={f.items.length < 2}>×</button></td>
                </tr>
              );
            })}
          </tbody>
          {total > 0 && <tfoot><tr><td colSpan={7} className="num"><b>TOTAL</b></td><td className="num"><b>{rp(total)}</b></td><td /></tr></tfoot>}
        </table>
      </div>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ items: [...f.items, emptyItem()] })}>+ Tambah barang</button>
      <p className="help">Volume boleh dikosongkan — surat hanya menampilkan harga satuan. Bila ada volume, kolom VOLUME & JUMLAH serta TOTAL ikut tercetak.</p>

      <h3 className="form-sub">Catatan / keterangan <span className="help">(bebas per surat)</span></h3>
      <p className="small">Isi dari contoh: {TERM_TEMPLATES.map((t) => <button key={t.key} type="button" className="btn btn-ghost btn-sm" onClick={() => set({ terms: t.terms.map((x) => ({ ...x })) })}>{t.label}</button>)}</p>
      {f.terms.map((t, i) => (
        <div key={i} className="form-grid" style={{ gridTemplateColumns: "minmax(160px,0.8fr) 2fr auto", alignItems: "start", marginBottom: 6 }}>
          <input value={t.label} onChange={(e) => setTerm(i, { label: e.target.value.toUpperCase() })} placeholder="Judul, mis. PEMBAYARAN" aria-label="Judul keterangan" style={{ fontWeight: 600 }} />
          <textarea rows={Math.max(1, t.lines.split("\n").length)} value={t.lines} onChange={(e) => setTerm(i, { lines: e.target.value })} placeholder="Isi (satu baris per poin)" aria-label="Isi keterangan" />
          <button type="button" className="link-btn" aria-label="Hapus keterangan" onClick={() => set({ terms: f.terms.filter((_, j) => j !== i) })}>×</button>
        </div>
      ))}
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ terms: [...f.terms, { label: "", lines: "" }] })}>+ Tambah keterangan</button>

      <h3 className="form-sub">Rekening & tanda tangan</h3>
      <div className="form-grid">
        <BankPicker name={f.bankName} account={f.bankAccount} onChange={(bankName, bankAccount) => set({ bankName, bankAccount })} />
        <div className="field"><label htmlFor="q-signer">Ditandatangani oleh</label>
          <select id="q-signer" value={f.signerId} onChange={(e) => pickSigner(e.target.value)}>
            <option value="">— Pilih akun (TTD otomatis) —</option>
            {signers.map((s) => <option key={s.id} value={s.id}>{s.name}{s.hasSignature ? "" : " (belum ada gambar TTD)"}</option>)}
          </select>
        </div>
        {field("Nama di surat", "signerName", "Mis. MUHAMMAD ABDULLAH")}
        {field("Jabatan penanda tangan", "signerTitle", "Mis. Vendor Project")}
        {field("Jabatan pihak pelanggan", "customerSignTitle")}
      </div>
      <div className="form-actions"><SubmitButton>{f.id ? "Simpan perubahan" : "Simpan surat"}</SubmitButton></div>
    </ActionForm>
  );
}
