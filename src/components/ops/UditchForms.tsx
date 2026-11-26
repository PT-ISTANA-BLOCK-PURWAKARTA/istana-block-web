"use client";

// Form transaksi buku kas U-Ditch (total otomatis = jumlah × harga sampai diubah sendiri) dan form kontrabon IB.
import { useState } from "react";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Select } from "@/components/ui";
import { saveKontrabon, saveUditchEntry } from "@/app/anak-usaha/(panel)/uditch/actions";

type Opt = { value: string; label: string; group?: string };
export type UditchEntryValue = { id?: string; entryDate: string; account: string; direction: string; item: string; qty: number | null; party: string | null; price: number | null; total: number | null; category: string | null; note: string | null; remark: string | null; pic: string | null };

const n = (s: string) => { const v = Number(s.replace(/\./g, "").replace(",", ".")); return s.trim() && Number.isFinite(v) ? v : null; };

export function UditchEntryForm({ value, accounts, categoriesIn, categoriesOut, pics }: { value: UditchEntryValue; accounts: Opt[]; categoriesIn: Opt[]; categoriesOut: Opt[]; pics: string[] }) {
  const [direction, setDirection] = useState(value.direction || "keluar");
  const [qty, setQty] = useState(value.qty?.toString() ?? "1");
  const [price, setPrice] = useState(value.price?.toString() ?? "");
  const [total, setTotal] = useState(value.total?.toString() ?? "");
  const [manual, setManual] = useState(Boolean(value.id));
  const auto = n(qty) != null && n(price) != null ? n(qty)! * n(price)! : n(price);
  const shown = manual ? total : auto != null ? String(Math.round(auto)) : "";
  return (
    <ActionForm action={saveUditchEntry} className="form-section">
      {value.id && <input type="hidden" name="id" value={value.id} />}
      <div className="form-grid">
        <div className="field"><label htmlFor="ud-date">Tanggal</label><input id="ud-date" type="date" name="entryDate" defaultValue={value.entryDate} required /></div>
        <div className="field"><label htmlFor="ud-acc">Sumber dana</label><Select id="ud-acc" name="account" defaultValue={value.account} options={accounts} /></div>
        <div className="field"><label>Arah</label>
          <div className="seg">{(["keluar", "masuk"] as const).map((d) => <label key={d} className={`seg-btn${direction === d ? " is-on" : ""}`}><input type="radio" name="direction" value={d} checked={direction === d} onChange={() => setDirection(d)} /> {d === "keluar" ? "Uang keluar" : "Uang masuk"}</label>)}</div>
        </div>
        <div className="field"><label htmlFor="ud-cat">Kategori</label><Select key={direction} id="ud-cat" name="category" defaultValue={value.category ?? ""} searchable menuWidth={360} options={[{ value: "", label: "Belum dikategorikan" }, ...(direction === "masuk" ? categoriesIn : categoriesOut)]} /></div>
        <div className="field full"><label htmlFor="ud-item">{direction === "masuk" ? "Keterangan uang masuk" : "Nama barang / keperluan"}</label><input id="ud-item" name="item" defaultValue={value.item} required /></div>
        <div className="field"><label htmlFor="ud-qty">Jumlah</label><input id="ud-qty" name="qty" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
        <div className="field"><label htmlFor="ud-price">Harga (Rp)</label><input id="ud-price" name="price" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
        <div className="field"><label htmlFor="ud-total">Total (Rp) {!manual && <span className="help">otomatis</span>}</label><input id="ud-total" name="total" inputMode="numeric" value={shown} onChange={(e) => { setManual(true); setTotal(e.target.value); }} required /></div>
        <div className="field"><label htmlFor="ud-party">Nama (toko / penerima / pemberi)</label><input id="ud-party" name="party" defaultValue={value.party ?? ""} /></div>
        <div className="field"><label htmlFor="ud-pic">PIC transfer</label><Select id="ud-pic" name="pic" defaultValue={value.pic ?? ""} options={[{ value: "", label: "-" }, ...pics.map((p) => ({ value: p, label: p }))]} /></div>
        <div className="field"><label htmlFor="ud-note">Keterangan</label><input id="ud-note" name="note" defaultValue={value.note ?? ""} /></div>
        <div className="field full"><label htmlFor="ud-remark">Catatan</label><input id="ud-remark" name="remark" defaultValue={value.remark ?? ""} /></div>
      </div>
      <div className="form-actions"><SubmitButton>{value.id ? "Simpan perubahan" : "Simpan transaksi"}</SubmitButton></div>
    </ActionForm>
  );
}

export function KontrabonForm({ value }: { value?: { id: string; label: string; amount: number; note: string | null } }) {
  return (
    <ActionForm action={saveKontrabon} className="form-section">
      {value && <input type="hidden" name="id" value={value.id} />}
      <div className="form-grid">
        <div className="field full"><label htmlFor="kb-l">Keterangan</label><input id="kb-l" name="label" defaultValue={value?.label} required placeholder="mis. Ka Hamad deposit talang uang pajak" /></div>
        <div className="field"><label htmlFor="kb-a">Jumlah (Rp)</label><input id="kb-a" name="amount" inputMode="numeric" defaultValue={value?.amount ?? ""} required /></div>
        <div className="field"><label htmlFor="kb-n">Catatan</label><input id="kb-n" name="note" defaultValue={value?.note ?? ""} /></div>
      </div>
      <div className="form-actions"><SubmitButton>{value ? "Simpan perubahan" : "Tambah kontrabon"}</SubmitButton></div>
    </ActionForm>
  );
}
