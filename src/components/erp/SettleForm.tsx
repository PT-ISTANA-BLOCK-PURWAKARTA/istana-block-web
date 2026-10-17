"use client";

import { useState } from "react";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { savePayment } from "@/app/akuntansi/actions/purchases";
import { saveReceipt } from "@/app/akuntansi/actions/sales";
import { formatAmount, parseRupiah, tgl } from "@/lib/erp/util";

export type OpenDoc = { id: string; number: string; date: string; dueDate: string; total: number; /** sisa yang masih bisa dialokasikan (termasuk alokasi dokumen ini sendiri saat diubah) */ left: number; alloc: number };

/** Penerimaan dari pelanggan (kind="receipt") atau pembayaran ke pemasok (kind="payment") dengan alokasi ke faktur. */
export function SettleForm({
  kind,
  id,
  contactId,
  contactName,
  date,
  accounts,
  depositAccountId,
  depositBalance,
  initialAccountId,
  initialAmount,
  memo,
  docs,
}: {
  kind: "receipt" | "payment";
  id?: string;
  contactId: string;
  contactName: string;
  date: string;
  accounts: { id: string; code: string; name: string }[];
  depositAccountId: string;
  depositBalance: number;
  initialAccountId?: string;
  initialAmount?: number;
  memo?: string;
  docs: OpenDoc[];
}) {
  const [allocs, setAllocs] = useState<Record<string, string>>(Object.fromEntries(docs.filter((d) => d.alloc > 0).map((d) => [d.id, String(d.alloc)])));
  const [amount, setAmount] = useState(initialAmount ? String(initialAmount) : "");
  const [accountId, setAccountId] = useState(initialAccountId ?? accounts[0]?.id ?? "");
  const useDeposit = accountId === depositAccountId;
  const allocTotal = docs.reduce((a, d) => a + parseRupiah(allocs[d.id]), 0);
  const amt = parseRupiah(amount);
  const rest = amt - allocTotal;
  const receipt = kind === "receipt";

  const autoFill = () => {
    let left = amt || docs.reduce((a, d) => a + d.left, 0);
    const next: Record<string, string> = {};
    for (const d of [...docs].sort((a, b) => a.dueDate.localeCompare(b.dueDate))) {
      const take = Math.min(left, d.left);
      if (take > 0) next[d.id] = String(take);
      left -= take;
    }
    setAllocs(next);
    if (!amt) setAmount(String(Object.values(next).reduce((a, v) => a + parseRupiah(v), 0)));
  };

  return (
    <ActionForm action={receipt ? saveReceipt : savePayment} className="stack" style={{ gap: 20 }}>
      {id && <input type="hidden" name="id" value={id} />}
      <input type="hidden" name="contactId" value={contactId} />
      <input type="hidden" name="allocs" value={JSON.stringify(docs.map((d) => ({ docId: d.id, amount: parseRupiah(allocs[d.id]) })).filter((a) => a.amount > 0))} />
      <section className="form-section">
        <div className="form-grid cols-4">
          <div className="field span-2"><span className="label">{receipt ? "Pelanggan" : "Pemasok"}</span><p style={{ margin: "10px 0", fontWeight: 700 }}>{contactName}</p></div>
          <div className="field"><label htmlFor="st-date">Tanggal</label><input id="st-date" name="date" type="date" defaultValue={date} required /></div>
          <div className="field">
            <label htmlFor="st-acc">{receipt ? "Masuk ke" : "Dibayar dari"}</label>
            <select id="st-acc" name="accountId" value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
              {(depositBalance > 0 || initialAccountId === depositAccountId) && (
                <option value={depositAccountId}>{receipt ? "Pakai uang muka pelanggan" : "Pakai uang muka ke pemasok"} (saldo {formatAmount(depositBalance)})</option>
              )}
            </select>
          </div>
          <div className="field">
            <label htmlFor="st-amount">Jumlah {receipt ? "diterima" : "dibayar"}</label>
            <input id="st-amount" name="amount" className="num" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div className="field span-3"><label htmlFor="st-memo">Keterangan</label><input id="st-memo" name="memo" defaultValue={memo} placeholder={receipt ? "mis. transfer BCA / DP pesanan" : "mis. transfer ke rekening pemasok"} /></div>
        </div>
      </section>
      <section className="form-section">
        <div className="card-head">
          <h2>Alokasi ke faktur</h2>
          {docs.length > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={autoFill}>Bagi otomatis (jatuh tempo terlama dulu)</button>}
        </div>
        {docs.length ? (
          <div className="admin-table">
            <table className="compact">
              <thead><tr><th>Faktur</th><th>Tanggal</th><th>Jatuh tempo</th><th className="num">Total</th><th className="num">Sisa</th><th className="num">Dialokasikan</th></tr></thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id}>
                    <td><b>{d.number}</b></td>
                    <td>{tgl(d.date)}</td>
                    <td>{tgl(d.dueDate)}</td>
                    <td className="num">{formatAmount(d.total)}</td>
                    <td className="num">{formatAmount(d.left)}</td>
                    <td className="num">
                      <input aria-label={`Alokasi ke ${d.number}`} className="num alloc-input" inputMode="numeric" value={allocs[d.id] ?? ""} placeholder="0" onChange={(e) => setAllocs((s) => ({ ...s, [d.id]: e.target.value }))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">Tidak ada faktur terbuka. Jumlah ini akan dicatat sebagai uang muka{receipt ? " pelanggan" : " ke pemasok"}.</p>
        )}
        <dl className="totals" style={{ marginLeft: "auto" }}>
          <dt>Dialokasikan</dt><dd className="tabular">{formatAmount(allocTotal)}</dd>
          <dt className="grand">{rest >= 0 ? "Sisa jadi uang muka" : "Kurang"}</dt>
          <dd className={`grand tabular ${rest < 0 ? "text-bahaya" : ""}`}>{formatAmount(rest)}</dd>
        </dl>
        {useDeposit && rest !== 0 && <p className="small text-bahaya">Saat memakai uang muka, jumlah harus sama dengan total alokasi.</p>}
      </section>
      <div className="form-actions"><SubmitButton>{id ? "Simpan perubahan" : receipt ? "Simpan penerimaan" : "Simpan pembayaran"}</SubmitButton></div>
    </ActionForm>
  );
}
