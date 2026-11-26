"use client";

// Form retur penjualan/pembelian (gaya Zahir): pilih kontak & faktur asal, baris barang yang diretur, PPN, dan cara penyelesaian.
import { useMemo, useState } from "react";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Select } from "@/components/ui";
import { saveReturn } from "@/app/akuntansi/actions/returnsGiro";

type Opt = { value: string; label: string };
type Doc = { id: string; number: string; date: string; contactId: string; total: number; left: number };
type Line = { description: string; qty: string; unit: string; price: string; accountId: string };
export type ReturnValue = {
  id?: string; date: string; contactId?: string; docId?: string | null; settlement?: string; cashAccountId?: string | null; memo?: string; ppn?: boolean; costBack?: number;
  lines?: { description: string; qty: number; unit: string; price: number; accountId: string | null }[];
};

const fmt = (n: number) => Math.round(n).toLocaleString("id-ID");
const num = (s: string) => Number(String(s).replace(/\./g, "").replace(",", ".")) || 0;

export function ReturnForm({ kind, value, contacts, docs, cash, lineAccounts, defaultLineAccount, ppnRate }: {
  kind: "penjualan" | "pembelian"; value: ReturnValue; contacts: Opt[]; docs: Doc[]; cash: Opt[]; lineAccounts: Opt[]; defaultLineAccount: string; ppnRate: number;
}) {
  const [contactId, setContactId] = useState(value.contactId ?? "");
  const [docId, setDocId] = useState(value.docId ?? "");
  const [settlement, setSettlement] = useState(value.settlement ?? "potong_tagihan");
  const [ppn, setPpn] = useState(value.ppn ?? false);
  const [lines, setLines] = useState<Line[]>(
    value.lines?.length
      ? value.lines.map((l) => ({ description: l.description, qty: String(l.qty), unit: l.unit, price: String(l.price), accountId: l.accountId ?? defaultLineAccount }))
      : [{ description: "", qty: "1", unit: "", price: "", accountId: defaultLineAccount }],
  );
  const myDocs = useMemo(() => docs.filter((d) => d.contactId === contactId), [docs, contactId]);
  const doc = myDocs.find((d) => d.id === docId);
  const subtotal = lines.reduce((s, l) => s + Math.round(num(l.qty) * num(l.price)), 0);
  const tax = ppn ? Math.round((subtotal * ppnRate) / 100) : 0;
  const total = subtotal + tax;
  const set = (i: number, k: keyof Line, v: string) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const who = kind === "penjualan" ? "Pelanggan" : "Pemasok";
  return (
    <ActionForm action={saveReturn} className="stack" style={{ gap: 18 }}>
      {value.id && <input type="hidden" name="id" value={value.id} />}
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
      <section className="form-section">
        <div className="form-grid">
          <div className="field"><label htmlFor="rt-c">{who}</label><Select id="rt-c" name="contactId" defaultValue={contactId} options={contacts} searchable required onChange={(v) => { setContactId(v); setDocId(""); }} /></div>
          <div className="field"><label htmlFor="rt-d">Tanggal</label><input id="rt-d" type="date" name="date" defaultValue={value.date} required /></div>
          <div className="field full">
            <label htmlFor="rt-doc">Faktur asal {kind === "penjualan" ? "penjualan" : "pembelian"} <span className="help">opsional, wajib bila memotong tagihan</span></label>
            <Select id="rt-doc" name="docId" value={docId} onChange={setDocId} searchable options={[{ value: "", label: contactId ? "(tanpa faktur)" : `Pilih ${who.toLowerCase()} dulu` }, ...myDocs.map((d) => ({ value: d.id, label: `${d.number} · ${d.date} · total ${fmt(d.total)} · sisa ${fmt(d.left)}` }))]} />
          </div>
        </div>
      </section>
      <section className="form-section">
        <h2 className="form-h">Barang yang diretur</h2>
        <div className="admin-table"><table className="compact">
          <thead><tr><th>Nama barang / keterangan</th><th className="num" style={{ width: 80 }}>Jumlah</th><th style={{ width: 80 }}>Satuan</th><th className="num" style={{ width: 130 }}>Harga</th>{kind === "pembelian" && <th style={{ width: 230 }}>Rekening dikredit</th>}<th className="num" style={{ width: 120 }}>Nilai</th><th /></tr></thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <td><input value={l.description} onChange={(e) => set(i, "description", e.target.value)} aria-label={`Barang baris ${i + 1}`} style={{ width: "100%" }} /></td>
                <td><input value={l.qty} onChange={(e) => set(i, "qty", e.target.value)} inputMode="decimal" aria-label={`Jumlah baris ${i + 1}`} style={{ width: 70, textAlign: "right" }} /></td>
                <td><input value={l.unit} onChange={(e) => set(i, "unit", e.target.value)} aria-label={`Satuan baris ${i + 1}`} style={{ width: 70 }} /></td>
                <td><input value={l.price} onChange={(e) => set(i, "price", e.target.value)} inputMode="numeric" aria-label={`Harga baris ${i + 1}`} style={{ width: 120, textAlign: "right" }} /></td>
                {kind === "pembelian" && <td><Select value={l.accountId} onChange={(v) => set(i, "accountId", v)} options={lineAccounts} searchable aria-label={`Rekening baris ${i + 1}`} menuWidth={320} /></td>}
                <td className="num">{fmt(Math.round(num(l.qty) * num(l.price)))}</td>
                <td><button type="button" className="link-btn" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : ls))} aria-label={`Hapus baris ${i + 1}`}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table></div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLines((ls) => [...ls, { description: "", qty: "1", unit: "", price: "", accountId: defaultLineAccount }])}>+ Tambah baris</button>
        <dl className="totals" style={{ maxWidth: 360, marginLeft: "auto" }}>
          <dt>Subtotal</dt><dd>{fmt(subtotal)}</dd>
          <dt><label className="check"><input type="checkbox" name="ppn" checked={ppn} onChange={(e) => setPpn(e.target.checked)} /> PPN {ppnRate}%</label></dt><dd>{fmt(tax)}</dd>
          <dt className="grand">Total retur</dt><dd className="grand">{fmt(total)}</dd>
        </dl>
      </section>
      <section className="form-section">
        <h2 className="form-h">Penyelesaian</h2>
        <div className="stack" style={{ gap: 6 }}>
          <label className="check"><input type="radio" name="settlement" value="potong_tagihan" checked={settlement === "potong_tagihan"} onChange={() => setSettlement("potong_tagihan")} /> Potong tagihan faktur asal {doc ? `(sisa ${fmt(doc.left)})` : ""}</label>
          <label className="check"><input type="radio" name="settlement" value="uang_muka" checked={settlement === "uang_muka"} onChange={() => setSettlement("uang_muka")} /> Jadi saldo uang muka {kind === "penjualan" ? "pelanggan (dipakai untuk faktur berikutnya)" : "ke pemasok"}</label>
          <label className="check"><input type="radio" name="settlement" value="tunai" checked={settlement === "tunai"} onChange={() => setSettlement("tunai")} /> {kind === "penjualan" ? "Uang dikembalikan ke pelanggan" : "Uang dikembalikan pemasok"} lewat kas/bank</label>
        </div>
        <div className="form-grid" style={{ marginTop: 10 }}>
          {settlement === "tunai" && <div className="field"><label htmlFor="rt-cash">Rekening kas/bank</label><Select id="rt-cash" name="cashAccountId" defaultValue={value.cashAccountId ?? ""} options={cash} required /></div>}
          {kind === "penjualan" && <div className="field"><label htmlFor="rt-cb">Nilai pokok barang yang kembali ke gudang (Rp) <span className="help">opsional</span></label><input id="rt-cb" name="costBack" inputMode="numeric" defaultValue={value.costBack || ""} /></div>}
          <div className="field full"><label htmlFor="rt-m">Keterangan</label><input id="rt-m" name="memo" defaultValue={value.memo} placeholder="mis. paving pecah 20 m² saat bongkar" /></div>
        </div>
      </section>
      <div className="form-actions"><SubmitButton>{value.id ? "Simpan perubahan" : "Simpan retur"}</SubmitButton></div>
    </ActionForm>
  );
}
