"use client";

import { useState } from "react";
import { correctDeliveryArrival } from "@/app/operasional/actions/deliveries";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";

/** Koreksi jam tiba sebenarnya (jam tombol Sampai tetap tersimpan). Kosongkan jam + simpan = batalkan koreksi. */
export function ArrivalCorrection({
  id,
  originalText,
  correctedLocal,
  correctedText,
  reason,
  byName,
  madeText,
  nowLocal,
}: {
  id: string;
  originalText: string;
  correctedLocal: string;
  correctedText: string | null;
  reason: string | null;
  byName: string | null;
  madeText: string | null;
  nowLocal: string;
}) {
  const [cancelling, setCancelling] = useState(false);
  return (
    <section className="admin-card stack" style={{ gap: 10 }}>
      <h2 style={{ fontSize: 17 }}>Jam tiba</h2>
      <p className="small">
        Tombol Sampai: <b>{originalText || "-"}</b>
        {correctedText && <> · Dikoreksi ke <b>{correctedText}</b> oleh {byName ?? "-"}{madeText ? ` (${madeText})` : ""}</>}
      </p>
      {reason && <p className="small muted">Alasan & bukti: {reason}</p>}
      <details className="form-details">
        <summary>{correctedText ? "Ubah / batalkan koreksi jam tiba" : "Koreksi jam tiba"}</summary>
        <ActionForm action={correctDeliveryArrival} className="stack" style={{ gap: 10, paddingTop: 10 }}>
          <input type="hidden" name="id" value={id} />
          <div className="form-grid">
            <div className="field">
              <label htmlFor="ac-at">Jam tiba sebenarnya</label>
              <input id="ac-at" name="arrivedAt" type="datetime-local" defaultValue={correctedLocal || nowLocal} disabled={cancelling} max={nowLocal} />
            </div>
            <div className="field">
              <label htmlFor="ac-reason">Alasan &amp; bukti *</label>
              <input id="ac-reason" name="reason" minLength={10} maxLength={500} required={!cancelling} disabled={cancelling} placeholder="mis. sopir lupa tekan Sampai; konfirmasi pelanggan via WA pukul 10.15" autoComplete="off" />
            </div>
          </div>
          {correctedText && (
            <label className="check">
              <input type="checkbox" checked={cancelling} onChange={(e) => setCancelling(e.target.checked)} /> Batalkan koreksi (kembali ke jam asli)
            </label>
          )}
          <div><SubmitButton className="btn btn-primary btn-sm" pendingText="Menyimpan…">{cancelling ? "Batalkan koreksi" : "Simpan koreksi"}</SubmitButton></div>
        </ActionForm>
      </details>
    </section>
  );
}