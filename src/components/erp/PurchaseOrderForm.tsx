"use client";

// Form Permintaan Penawaran / Pesanan Pembelian: pemasok, tanggal diharapkan, baris barang (pilih produk atau tulis bebas), PPN.
import { useState } from "react";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Select } from "@/components/ui";
import { savePurchaseOrder } from "@/app/akuntansi/actions/purchaseOrders";

type Opt = { value: string; label: string };
type Item = { id: string; name: string; unit: string; buyPrice: number };
type Line = { itemId: string; description: string; qty: string; unit: string; price: string };
const fmt = (n: number) => Math.round(n).toLocaleString("id-ID");
const num = (s: string) => Number(String(s).replace(/\./g, "").replace(",", ".")) || 0;

export function PurchaseOrderForm({ kind, value, contacts, items, ppnRate, statuses }: {
  kind: "rfq" | "po";
  value: { id?: string; date: string; contactId?: string; expectedDate?: string | null; status?: string; memo?: string; ppn?: boolean; lines?: { itemId: string | null; description: string; qty: number; unit: string; price: number }[] };
  contacts: Opt[]; items: Item[]; ppnRate: number; statuses: Opt[];
}) {
  const [lines, setLines] = useState<Line[]>(value.lines?.length ? value.lines.map((l) => ({ itemId: l.itemId ?? "", description: l.description, qty: String(l.qty), unit: l.unit, price: String(l.price) })) : [{ itemId: "", description: "", qty: "1", unit: "", price: "" }]);
  const [ppn, setPpn] = useState(value.ppn ?? false);
  const byId = new Map(items.map((i) => [i.id, i]));
  const set = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const subtotal = lines.reduce((s, l) => s + Math.round(num(l.qty) * num(l.price)), 0);
  const tax = ppn ? Math.round((subtotal * ppnRate) / 100) : 0;
  return (
    <ActionForm action={savePurchaseOrder} className="stack" style={{ gap: 18 }}>
      {value.id && <input type="hidden" name="id" value={value.id} />}
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
      <section className="form-section">
        <div className="form-grid">
          <div className="field"><label htmlFor="po-c">Pemasok</label><Select id="po-c" name="contactId" defaultValue={value.contactId ?? ""} options={contacts} searchable required /></div>
          <div className="field"><label htmlFor="po-d">Tanggal</label><input id="po-d" type="date" name="date" defaultValue={value.date} required /></div>
          <div className="field"><label htmlFor="po-e">{kind === "rfq" ? "Penawaran ditunggu sampai" : "Barang diharapkan datang"}</label><input id="po-e" type="date" name="expectedDate" defaultValue={value.expectedDate ?? ""} /></div>
          <div className="field"><label htmlFor="po-s">Status</label><Select id="po-s" name="status" defaultValue={value.status ?? "draft"} options={statuses} /></div>
          <div className="field full"><label htmlFor="po-m">Keterangan</label><input id="po-m" name="memo" defaultValue={value.memo} placeholder="mis. semen 800 zak dikirim bertahap" /></div>
        </div>
      </section>
      <section className="form-section">
        <h2 className="form-h">Barang</h2>
        <div className="admin-table"><table className="compact">
          <thead><tr><th style={{ width: 260 }}>Produk</th><th>Keterangan</th><th className="num" style={{ width: 80 }}>Jumlah</th><th style={{ width: 80 }}>Satuan</th><th className="num" style={{ width: 130 }}>{kind === "rfq" ? "Harga perkiraan" : "Harga"}</th><th className="num" style={{ width: 120 }}>Nilai</th><th /></tr></thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <td><Select value={l.itemId} onChange={(v) => { const it = byId.get(v); set(i, { itemId: v, unit: l.unit || it?.unit || "", price: l.price || (it?.buyPrice ? String(it.buyPrice) : "") }); }} searchable menuWidth={320} aria-label={`Produk baris ${i + 1}`} options={[{ value: "", label: "(tulis bebas)" }, ...items.map((it) => ({ value: it.id, label: it.name }))]} /></td>
                <td><input value={l.description} onChange={(e) => set(i, { description: e.target.value })} aria-label={`Keterangan baris ${i + 1}`} style={{ width: "100%" }} placeholder={byId.get(l.itemId)?.name ?? ""} /></td>
                <td><input value={l.qty} onChange={(e) => set(i, { qty: e.target.value })} inputMode="decimal" aria-label={`Jumlah baris ${i + 1}`} style={{ width: 70, textAlign: "right" }} /></td>
                <td><input value={l.unit} onChange={(e) => set(i, { unit: e.target.value })} aria-label={`Satuan baris ${i + 1}`} style={{ width: 70 }} /></td>
                <td><input value={l.price} onChange={(e) => set(i, { price: e.target.value })} inputMode="numeric" aria-label={`Harga baris ${i + 1}`} style={{ width: 120, textAlign: "right" }} /></td>
                <td className="num">{fmt(Math.round(num(l.qty) * num(l.price)))}</td>
                <td><button type="button" className="link-btn" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : ls))} aria-label={`Hapus baris ${i + 1}`}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table></div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLines((ls) => [...ls, { itemId: "", description: "", qty: "1", unit: "", price: "" }])}>+ Tambah baris</button>
        <dl className="totals" style={{ maxWidth: 360, marginLeft: "auto" }}>
          <dt>Subtotal</dt><dd>{fmt(subtotal)}</dd>
          <dt><label className="check"><input type="checkbox" name="ppn" checked={ppn} onChange={(e) => setPpn(e.target.checked)} /> PPN {ppnRate}%</label></dt><dd>{fmt(tax)}</dd>
          <dt className="grand">Total</dt><dd className="grand">{fmt(subtotal + tax)}</dd>
        </dl>
      </section>
      <div className="form-actions"><SubmitButton>{value.id ? "Simpan perubahan" : kind === "rfq" ? "Simpan permintaan penawaran" : "Simpan pesanan pembelian"}</SubmitButton></div>
    </ActionForm>
  );
}
