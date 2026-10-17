"use client";

import { useState } from "react";
import { formatAmount, parseRupiah } from "@/lib/erp/util";
import type { PickAccount } from "./LinesEditor";

export type CRow = { accountId: string; memo: string; amount: string };

/** Rincian kas masuk/keluar per akun lawan. Mengirim "lines" (JSON). */
export function CashEditor({ accounts, initial, kind }: { accounts: PickAccount[]; initial: CRow[]; kind: "masuk" | "keluar" }) {
  const blank = (): CRow => ({ accountId: "", memo: "", amount: "" });
  const [rows, setRows] = useState<CRow[]>(initial.length ? initial : [blank()]);
  const total = rows.reduce((a, r) => a + parseRupiah(r.amount), 0);
  const update = (i: number, patch: Partial<CRow>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const json = JSON.stringify(rows.map((r) => ({ accountId: r.accountId, memo: r.memo.trim(), amount: parseRupiah(r.amount) })));
  return (
    <div className="lines">
      <input type="hidden" name="lines" value={json} />
      <div className="lines-table clines" role="table" aria-label="Rincian">
        <div className="lines-head" role="row">
          <span role="columnheader">{kind === "keluar" ? "Untuk akun (biaya/hutang/aset)" : "Dari akun (pendapatan/modal/piutang)"}</span>
          <span role="columnheader">Keterangan</span>
          <span role="columnheader" className="num">Jumlah</span>
          <span role="columnheader" aria-label="Hapus" />
        </div>
        {rows.map((r, i) => (
          <div className="lines-row" role="row" key={i}>
            <select aria-label={`Akun baris ${i + 1}`} value={r.accountId} onChange={(e) => update(i, { accountId: e.target.value })} required>
              <option value="">— pilih akun —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
              ))}
            </select>
            <input aria-label={`Keterangan baris ${i + 1}`} value={r.memo} onChange={(e) => update(i, { memo: e.target.value })} />
            <input aria-label={`Jumlah baris ${i + 1}`} className="num" inputMode="numeric" value={r.amount} onChange={(e) => update(i, { amount: e.target.value })} />
            <button type="button" className="icon-btn" aria-label={`Hapus baris ${i + 1}`} onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : [blank()]))}>×</button>
          </div>
        ))}
      </div>
      <div className="lines-foot">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRows((rs) => [...rs, blank()])}>+ Tambah baris</button>
        <dl className="totals">
          <dt className="grand">Total</dt>
          <dd className="grand tabular">Rp{formatAmount(total)}</dd>
        </dl>
      </div>
    </div>
  );
}
