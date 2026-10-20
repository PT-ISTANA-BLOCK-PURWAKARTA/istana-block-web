"use client";

import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { endDuty, startDuty } from "@/app/operasional/actions/duty";

/** Tombol besar "Mulai piket" (nyaman di HP). */
export function StartDutyForm() {
  return (
    <ActionForm action={startDuty} className="stack">
      <SubmitButton className="btn btn-primary btn-block pk-big" pendingText="Memulai…">Mulai piket</SubmitButton>
    </ActionForm>
  );
}

/** "Selesai piket" + catatan serah terima untuk petugas berikutnya. */
export function EndDutyForm() {
  return (
    <ActionForm action={endDuty} className="stack" style={{ gap: 12 }}>
      <div className="field">
        <label htmlFor="pk-note">Catatan serah terima (opsional)</label>
        <textarea id="pk-note" name="handoverNote" rows={3} maxLength={500} placeholder="Contoh: truk pasir CV X belum dibongkar, kunci gudang ada di pos." />
        <span className="help">Dibaca petugas berikutnya saat mulai piket.</span>
      </div>
      <SubmitButton className="btn btn-primary btn-block pk-big" pendingText="Menutup…">Selesai piket</SubmitButton>
    </ActionForm>
  );
}
