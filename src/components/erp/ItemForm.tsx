"use client";

import { useState } from "react";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { saveItem } from "@/app/keuangan/actions/master";
import type { Item } from "@/db/erp";
import { itemKinds } from "@/db/erp";
import { ITEM_KIND_LABEL } from "@/lib/erp/accounting";

export function ItemForm({ item, products, revenueAccounts }: { item?: Item; products: { id: number; name: string }[]; revenueAccounts: { id: string; code: string; name: string }[] }) {
  const [kind, setKind] = useState<Item["kind"]>(item?.kind ?? "barang_jadi");
  return (
    <ActionForm action={saveItem} className="stack" style={{ gap: 20 }}>
      {item && <input type="hidden" name="id" value={item.id} />}
      <section className="form-section">
        <div className="form-grid">
          <div className="field"><label htmlFor="it-code">Kode</label><input id="it-code" name="code" defaultValue={item?.code} required maxLength={30} placeholder="mis. PVG-0101" /></div>
          <div className="field">
            <label htmlFor="it-kind">Jenis</label>
            <select id="it-kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value as Item["kind"])}>
              {itemKinds.map((k) => <option key={k} value={k}>{ITEM_KIND_LABEL[k]}</option>)}
            </select>
          </div>
          <div className="field full"><label htmlFor="it-name">Nama</label><input id="it-name" name="name" defaultValue={item?.name} required minLength={2} placeholder="mis. Paving Hexagon 20×20 tebal 8 cm abu" /></div>
          <div className="field"><label htmlFor="it-unit">Satuan</label><input id="it-unit" name="unit" defaultValue={item?.unit ?? "pcs"} required placeholder="m², pcs, unit, m³, sak" /></div>
          <div className="field"><label htmlFor="it-sell">Harga jual <span className="help">per satuan, sebelum PPN</span></label><input id="it-sell" name="sellPrice" inputMode="numeric" defaultValue={item?.sellPrice || ""} /></div>
          <div className="field">
            <label htmlFor="it-buy">{kind === "bahan_baku" ? "Harga beli standar" : "Harga pokok standar"} <span className="help">{kind === "barang_jadi" ? "dipakai bila stok belum punya nilai produksi" : "default di faktur pembelian"}</span></label>
            <input id="it-buy" name="buyPrice" inputMode="numeric" defaultValue={item?.buyPrice || ""} />
          </div>
          {kind !== "jasa" && (
            <>
              <div className="field"><span className="label">Persediaan</span><label className="check"><input type="checkbox" name="trackStock" defaultChecked={item?.trackStock ?? true} /> Lacak stok barang ini</label></div>
              <div className="field"><label htmlFor="it-min">Stok minimum <span className="help">peringatan stok menipis</span></label><input id="it-min" name="minStock" inputMode="decimal" defaultValue={item?.minStock || ""} /></div>
            </>
          )}
          <div className="field">
            <label htmlFor="it-prod">Produk di website <span className="help">opsional</span></label>
            <select id="it-prod" name="productId" defaultValue={item?.productId ?? ""}>
              <option value="">—</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="it-rev">Akun pendapatan <span className="help">kosongkan = otomatis</span></label>
            <select id="it-rev" name="revenueAccountId" defaultValue={item?.revenueAccountId ?? ""}>
              <option value="">Otomatis ({kind === "jasa" ? "Pendapatan jasa" : "Penjualan"})</option>
              {revenueAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
            </select>
          </div>
          <div className="field"><span className="label">Status</span><label className="check"><input type="checkbox" name="active" defaultChecked={item?.active ?? true} /> Aktif (muncul di pilihan barang)</label></div>
          <div className="field full"><label htmlFor="it-note">Catatan</label><textarea id="it-note" name="note" rows={2} defaultValue={item?.note} style={{ minHeight: 64 }} /></div>
        </div>
      </section>
      <div className="form-actions"><SubmitButton>{item ? "Simpan perubahan" : "Simpan barang"}</SubmitButton></div>
    </ActionForm>
  );
}
