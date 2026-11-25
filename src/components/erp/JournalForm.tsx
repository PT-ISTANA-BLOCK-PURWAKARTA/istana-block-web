"use client";

import { ActionForm } from "@/components/admin/ActionForm";
import { saveJournal } from "@/app/akuntansi/actions/ledger";
import { JournalEditor, type JRow } from "./JournalEditor";
import type { PickAccount } from "./LinesEditor";
import { DateField } from "@/components/ui";
import { ZahirWindow } from "./ZahirWindow";

export function JournalForm({ head, lines, accounts }: { head: { id?: string; number?: string; date: string; memo?: string }; lines: JRow[]; accounts: PickAccount[] }) {
  return (
    <ActionForm action={saveJournal}>
      <ZahirWindow
        title="Jurnal Umum"
        icon="book"
        number={head.number}
        newHref="/akuntansi/jurnal/baru"
        closeHref={head.id ? `/akuntansi/jurnal/${head.id}` : "/akuntansi/jurnal"}
        printHref={head.id ? `/akuntansi/jurnal/${head.id}` : null}
        status="Total debit harus sama dengan total kredit. Untuk saldo awal pakai rekening lawan “Ekuitas Saldo Awal”."
      >
      {head.id && <input type="hidden" name="id" value={head.id} />}
      <section className="zw-head">
        <div className="zw-fields">
          <div className="field"><label htmlFor="jr-date">Tanggal</label><DateField id="jr-date" name="date" defaultValue={head.date} required /></div>
          <div className="field span-3"><label htmlFor="jr-memo">Keterangan</label><input id="jr-memo" name="memo" defaultValue={head.memo} required placeholder="mis. Saldo awal per 1 Januari 2026 / penyusutan mesin Oktober" /></div>
        </div>
      </section>
      <section className="zw-grid">
        <JournalEditor accounts={accounts} initial={lines} />
      </section>
      </ZahirWindow>
    </ActionForm>
  );
}
