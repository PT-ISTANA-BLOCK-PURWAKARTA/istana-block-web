"use client";

import { useState } from "react";
import { formatAmount, parseRupiah } from "@/lib/erp/util";
import type { PickAccount } from "./LinesEditor";
import { Select } from "@/components/ui";

export type JRow = { accountId: string; memo: string; debit: string; credit: string };

/** Baris jurnal umum (debit/kredit) dengan indikator seimbang. Mengirim "lines" (JSON). */
export function JournalEditor({ accounts, initial }: { accounts: PickAccount[]; initial: JRow[] }) {
  const blank = (): JRow => ({ accountId: "", memo: "", debit: "", credit: "" });
  const [rows, setRows] = useState<JRow[]>(initial.length ? initial : [blank(), blank()]);
  const d = rows.reduce((a, r) => a + parseRupiah(r.debit), 0);
  const c = rows.reduce((a, r) => a + parseRupiah(r.credit), 0);
  const update = (i: number, patch: Partial<JRow>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const json = JSON.stringify(rows.map((r) => ({ accountId: r.accountId, memo: r.memo.trim(), debit: parseRupiah(r.debit), credit: parseRupiah(r.credit) })));
  const accountOptions = accounts.map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` }));
  return (
    <div className="lines">
      <input type="hidden" name="lines" value={json} />
      <div className="lines-table jlines" role="table" aria-label="Baris jurnal">
        <div className="lines-head" role="row">
          <span role="columnheader">Akun</span>
          <span role="columnheader">Keterangan</span>
          <span role="columnheader" className="num">Debit</span>
          <span role="columnheader" className="num">Kredit</span>
          <span role="columnheader" aria-label="Hapus" />
        </div>
        {rows.map((r, i) => (
          <div className="lines-row" role="row" key={i}>
            <Select aria-label={`Akun baris ${i + 1}`} value={r.accountId} onChange={(v) => update(i, { accountId: v })} required placeholder="Pilih akun…" searchable menuWidth={320} options={accountOptions} />
            <input aria-label={`Keterangan baris ${i + 1}`} value={r.memo} onChange={(e) => update(i, { memo: e.target.value })} />
            <input aria-label={`Debit baris ${i + 1}`} className="num" inputMode="numeric" value={r.debit} onChange={(e) => update(i, { debit: e.target.value, credit: e.target.value ? "" : r.credit })} />
            <input aria-label={`Kredit baris ${i + 1}`} className="num" inputMode="numeric" value={r.credit} onChange={(e) => update(i, { credit: e.target.value, debit: e.target.value ? "" : r.debit })} />
            <button type="button" className="icon-btn" aria-label={`Hapus baris ${i + 1}`} onClick={() => setRows((rs) => (rs.length > 2 ? rs.filter((_, j) => j !== i) : rs))}>×</button>
          </div>
        ))}
      </div>
      <div className="lines-foot">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRows((rs) => [...rs, blank()])}>+ Tambah baris</button>
        <dl className="totals">
          <dt>Total debit</dt><dd className="tabular">{formatAmount(d)}</dd>
          <dt>Total kredit</dt><dd className="tabular">{formatAmount(c)}</dd>
          <dt className="grand">Selisih</dt>
          <dd className={`grand tabular ${d === c && d > 0 ? "text-sukses" : "text-bahaya"}`}>{d === c && d > 0 ? "Seimbang" : formatAmount(d - c)}</dd>
        </dl>
      </div>
    </div>
  );
}
