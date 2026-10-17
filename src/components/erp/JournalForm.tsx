"use client";

import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { saveJournal } from "@/app/akuntansi/actions/ledger";
import { JournalEditor, type JRow } from "./JournalEditor";
import type { PickAccount } from "./LinesEditor";

export function JournalForm({ head, lines, accounts }: { head: { id?: string; date: string; memo?: string }; lines: JRow[]; accounts: PickAccount[] }) {
  return (
    <ActionForm action={saveJournal} className="stack" style={{ gap: 20 }}>
      {head.id && <input type="hidden" name="id" value={head.id} />}
      <section className="form-section">
        <div className="form-grid cols-4">
          <div className="field"><label htmlFor="jr-date">Tanggal</label><input id="jr-date" name="date" type="date" defaultValue={head.date} required /></div>
          <div className="field span-3"><label htmlFor="jr-memo">Keterangan</label><input id="jr-memo" name="memo" defaultValue={head.memo} required placeholder="mis. Saldo awal per 1 Januari 2026 / penyusutan mesin Oktober" /></div>
        </div>
      </section>
      <section className="form-section">
        <JournalEditor accounts={accounts} initial={lines} />
      </section>
      <div className="form-actions"><SubmitButton>{head.id ? "Simpan perubahan" : "Simpan jurnal"}</SubmitButton></div>
    </ActionForm>
  );
}
