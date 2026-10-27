"use client";

import { useState } from "react";
import { editSandResult } from "@/app/operasional/actions/sand";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Chips } from "@/components/ops/receipts/Chips";
import { DialogForm, Modal } from "@/components/ops/receipts/Modal";
import type { ReadingUnit, SandDecision } from "@/db/erp";
import { fmt } from "@/lib/ops/shared/format";
import { sourceLabel } from "@/lib/ops/shared/sand";
import { ReadingFields, type ReadingValue } from "./ReadingFields";
import { UNIT_LABELS } from "./util";

const UNITS = ["ml", "cm"] as const;
const num = (value: number | null) => (value === null ? "" : String(value).replace(".", ","));

export type EditableSand = {
  id: string;
  sandType: string;
  supplier: string | null;
  quarry: string | null;
  readingUnit: ReadingUnit;
  sandHeight: number | null;
  siltHeight: number | null;
  siltPercent: number | null;
  decision: SandDecision | null;
  signed: string[];
};

/** Tombol + dialog "Ubah hasil": nilai lama masuk riwayat, alasan wajib, tanda tangan direset. */
export function EditSandButton({ row }: { row: EditableSand }) {
  const [open, setOpen] = useState(false);
  const [unit, setUnit] = useState<ReadingUnit>(row.readingUnit);
  const [reading, setReading] = useState<ReadingValue>({
    sandTop: num(row.sandHeight),
    siltTop: row.readingUnit === "ml" ? num((row.sandHeight ?? 0) + (row.siltHeight ?? 0)) : num(row.siltHeight),
    decision: row.decision ?? "",
  });
  const [reason, setReason] = useState("");
  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>Ubah hasil</button>
      {open && (
        <Modal
          title="Ubah hasil uji lumpur"
          sub={`${sourceLabel(row)} · ${row.sandType} · sebelumnya ${row.siltPercent === null ? "-" : `${fmt(row.siltPercent)}%`}. Nilai lama tetap tersimpan di riwayat.`}
          onClose={() => setOpen(false)}
        >
          {row.signed.length > 0 && (
            <p className="flag flag-warn">Sudah ditandatangani ({row.signed.join(", ")}). Setelah disimpan, tanda tangan direset dan perlu diulang.</p>
          )}
          <DialogForm action={editSandResult} onSaved={() => setOpen(false)}>
            <input type="hidden" name="id" value={row.id} />
            <div className="field">
              <span className="label">Alat ukur</span>
              <Chips name="readingUnit" value={unit} options={UNITS} labels={UNIT_LABELS} onChange={setUnit} label="Alat ukur" />
            </div>
            <ReadingFields unit={unit} value={reading} onChange={setReading} />
            <div className="field">
              <label htmlFor="ed-reason">Alasan perubahan *</label>
              <input id="ed-reason" name="reason" required minLength={5} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Mis. salah baca skala, endapan belum turun sempurna" autoComplete="off" />
            </div>
            <div><SubmitButton className="btn btn-primary btn-block rcv-save" pendingText="Menyimpan…">Simpan perubahan</SubmitButton></div>
          </DialogForm>
        </Modal>
      )}
    </>
  );
}