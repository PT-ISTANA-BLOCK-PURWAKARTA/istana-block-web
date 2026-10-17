"use client";

import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { saveCash } from "@/app/akuntansi/actions/ledger";
import { CashEditor, type CRow } from "./CashEditor";
import type { PickAccount } from "./LinesEditor";
import { DateField, Select } from "@/components/ui";

export function CashForm({
  kind,
  head,
  lines,
  cashAccounts,
  otherAccounts,
  contacts,
}: {
  kind: "masuk" | "keluar" | "transfer";
  head: { id?: string; date: string; accountId?: string; toAccountId?: string | null; contactId?: string | null; amount?: number; memo?: string };
  lines: CRow[];
  cashAccounts: PickAccount[];
  otherAccounts: PickAccount[];
  contacts: { id: string; name: string }[];
}) {
  const cashOptions = cashAccounts.map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` }));
  return (
    <ActionForm action={saveCash} className="stack" style={{ gap: 20 }}>
      {head.id && <input type="hidden" name="id" value={head.id} />}
      <input type="hidden" name="kind" value={kind} />
      <section className="form-section">
        <div className="form-grid cols-4">
          <div className="field"><label htmlFor="cs-date">Tanggal</label><DateField id="cs-date" name="date" defaultValue={head.date} required /></div>
          <div className="field">
            <label htmlFor="cs-acc">{kind === "masuk" ? "Masuk ke" : "Dari"}</label>
            <Select id="cs-acc" name="accountId" defaultValue={head.accountId ?? cashAccounts[0]?.id} required options={cashOptions} />
          </div>
          {kind === "transfer" ? (
            <>
              <div className="field">
                <label htmlFor="cs-to">Ke</label>
                <Select id="cs-to" name="toAccountId" defaultValue={head.toAccountId ?? cashAccounts[1]?.id} required options={cashOptions} />
              </div>
              <div className="field"><label htmlFor="cs-amt">Jumlah</label><input id="cs-amt" name="amount" className="num" inputMode="numeric" defaultValue={head.amount || ""} required /></div>
            </>
          ) : (
            <div className="field span-2">
              <label htmlFor="cs-contact">{kind === "masuk" ? "Diterima dari" : "Dibayar ke"} <span className="help">opsional</span></label>
              <Select id="cs-contact" name="contactId" defaultValue={head.contactId ?? ""} searchable placeholder="Tidak ada / umum" options={[{ value: "", label: "Tidak ada / umum" }, ...contacts.map((c) => ({ value: c.id, label: c.name }))]} />
            </div>
          )}
          <div className="field span-4"><label htmlFor="cs-memo">Keterangan</label><input id="cs-memo" name="memo" defaultValue={head.memo} placeholder={kind === "keluar" ? "mis. BBM truk B 9xxx, uang jalan sopir" : kind === "masuk" ? "mis. setoran modal, bunga bank" : "mis. setor tunai ke bank"} /></div>
        </div>
      </section>
      {kind !== "transfer" && (
        <section className="form-section">
          <h2>Rincian</h2>
          <CashEditor accounts={otherAccounts} initial={lines} kind={kind} />
        </section>
      )}
      <div className="form-actions"><SubmitButton>{head.id ? "Simpan perubahan" : "Simpan transaksi"}</SubmitButton></div>
    </ActionForm>
  );
}
