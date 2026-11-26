"use client";

import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Select } from "@/components/ui";
import { refundDeposit } from "@/app/akuntansi/actions/returnsGiro";

type Opt = { value: string; label: string };

export function RefundForm({ kind, contacts, cash, date }: { kind: "penjualan" | "pembelian"; contacts: Opt[]; cash: Opt[]; date: string }) {
  return (
    <ActionForm action={refundDeposit} className="form-grid">
      <input type="hidden" name="kind" value={kind} />
      <div className="field"><label htmlFor="rf-c">{kind === "penjualan" ? "Pelanggan" : "Pemasok"}</label><Select id="rf-c" name="contactId" options={contacts} searchable required /></div>
      <div className="field"><label htmlFor="rf-a">{kind === "penjualan" ? "Dibayar dari" : "Diterima di"}</label><Select id="rf-a" name="accountId" options={cash} required /></div>
      <div className="field"><label htmlFor="rf-d">Tanggal</label><input id="rf-d" type="date" name="date" defaultValue={date} required /></div>
      <div className="field"><label htmlFor="rf-n">Jumlah (Rp)</label><input id="rf-n" name="amount" inputMode="numeric" required /></div>
      <div className="field full"><label htmlFor="rf-m">Keterangan</label><input id="rf-m" name="memo" /></div>
      <div className="form-actions"><SubmitButton>{kind === "penjualan" ? "Kembalikan uang muka" : "Catat penerimaan kembalian"}</SubmitButton></div>
    </ActionForm>
  );
}
