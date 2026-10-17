"use client";

import { useState } from "react";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { saveAdjustment } from "@/app/operasional/actions/stock";
import { formatAmount, formatQty } from "@/lib/erp/util";
import { DateField, Select } from "@/components/ui";

type Opt = { id: string; code: string; name: string; unit: string; onHand: number; avgCost: number };

/** Penyesuaian stok (stok opname, rusak, hilang) atau saldo awal stok. */
export function AdjustmentForm({
  id,
  date,
  itemId,
  qty,
  unitCost,
  reason,
  opening: initialOpening,
  items,
  showCost,
}: {
  id?: string;
  date: string;
  itemId?: string;
  qty?: number;
  unitCost?: number;
  reason?: string;
  opening?: boolean;
  items: Opt[];
  showCost: boolean;
}) {
  const [item, setItem] = useState(itemId ?? "");
  const [dir, setDir] = useState<"tambah" | "kurang">(qty != null && qty < 0 ? "kurang" : "tambah");
  const [opening, setOpening] = useState(!!initialOpening);
  const sel = items.find((i) => i.id === item);
  return (
    <ActionForm action={saveAdjustment} className="form-section">
      {id && <input type="hidden" name="id" value={id} />}
      <div className="form-grid cols-4">
        <div className="field"><label htmlFor="adj-date">Tanggal</label><DateField id="adj-date" name="date" defaultValue={date} required /></div>
        <div className="field span-3">
          <label htmlFor="adj-item">Barang</label>
          <Select id="adj-item" name="itemId" value={item} onChange={setItem} required searchable placeholder="Pilih barang…" options={items.map((i) => ({ value: i.id, label: i.name, hint: `${i.code} · stok ${formatQty(i.onHand)} ${i.unit}` }))} />
          {sel && <span className="help">Stok sekarang {formatQty(sel.onHand)} {sel.unit}{showCost && <> · harga pokok rata-rata Rp{formatAmount(Math.round(sel.avgCost))}</>}</span>}
        </div>
        <div className="field">
          <span className="label">Jenis</span>
          <div className="seg" role="radiogroup" aria-label="Arah penyesuaian">
            <label className={`seg-opt${dir === "tambah" ? " on" : ""}`}><input type="radio" name="direction" value="tambah" checked={dir === "tambah"} onChange={() => setDir("tambah")} /> Tambah</label>
            <label className={`seg-opt${dir === "kurang" ? " on" : ""}`}><input type="radio" name="direction" value="kurang" checked={dir === "kurang"} onChange={() => { setDir("kurang"); setOpening(false); }} /> Kurang</label>
          </div>
        </div>
        <div className="field"><label htmlFor="adj-qty">Qty {sel?.unit}</label><input id="adj-qty" name="qty" className="num" inputMode="decimal" defaultValue={qty != null ? formatQty(Math.abs(qty)) : ""} required /></div>
        {dir === "tambah" && showCost && (
          <div className="field"><label htmlFor="adj-cost">Nilai per satuan (Rp) <span className="help">kosong = rata-rata</span></label><input id="adj-cost" name="unitCost" className="num" inputMode="numeric" defaultValue={unitCost ? String(unitCost) : ""} /></div>
        )}
        <div className="field" style={{ justifyContent: "flex-end" }}>
          {dir === "tambah" && <label className="check"><input type="checkbox" name="opening" checked={opening} onChange={(e) => setOpening(e.target.checked)} /> Saldo awal stok</label>}
        </div>
        <div className="field span-4"><label htmlFor="adj-reason">Alasan {opening && <span className="help">opsional</span>}</label><input id="adj-reason" name="reason" defaultValue={reason} placeholder={opening ? "Saldo awal" : "mis. hasil stok opname 30 Sep, 40 pcs pecah saat bongkar"} required={!opening} /></div>
      </div>
      <p className="small muted">
        {opening ? "Saldo awal: stok masuk dengan lawan akun Saldo awal (modal)." : dir === "tambah" ? "Stok bertambah dengan lawan akun Selisih persediaan." : "Stok berkurang senilai harga pokok rata-rata, dibebankan ke Selisih persediaan."}
      </p>
      <div><SubmitButton>{id ? "Simpan perubahan" : "Simpan penyesuaian"}</SubmitButton></div>
    </ActionForm>
  );
}
