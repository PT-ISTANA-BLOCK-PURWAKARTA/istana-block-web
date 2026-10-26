"use client";

import { useState } from "react";
import { rateLeadAction } from "@/app/operasional/actions/customer-leads";
import { ActionForm } from "@/components/admin/ActionForm";
import type { FormState } from "@/components/admin/FormMessage";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { DateField } from "@/components/ui";
import { isSatisfied, ratingScore, STAR_WORDS, type LeadRow } from "@/lib/ops/customer-leads-core";

type Stars = number | null;

function StarRow({ label, value, onChange }: { label: string; value: Stars; onChange: (v: Stars) => void }) {
  return (
    <div className="rp-rate-row">
      <b>{label}</b>
      <span className="rp-starbtns" role="group" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n} type="button" className={`rp-starbtn${value !== null && n <= value ? " on" : ""}`}
            aria-label={`${label} ${n} bintang`} aria-pressed={value === n} onClick={() => onChange(value === n ? null : n)}
          >
            ★
          </button>
        ))}
      </span>
      <span className="small muted">{value === null ? STAR_WORDS[0] : `${value} ${STAR_WORDS[value]}`}</span>
    </div>
  );
}

/** Dialog Penilaian pembeli: bintang 3 aspek, Puas / Komplain, dan get back. */
export function RateForm({ lead, today, onDone }: { lead: LeadRow; today: string; onDone: (msg: string) => void }) {
  const [service, setService] = useState<Stars>(lead.ratingService);
  const [quality, setQuality] = useState<Stars>(lead.ratingQuality);
  const [speed, setSpeed] = useState<Stars>(lead.ratingSpeed);
  const [feedback, setFeedback] = useState<"puas" | "komplain" | null>(lead.feedback);
  const [complaintDate, setComplaintDate] = useState(lead.complaintDate ?? today);
  const [getbackDate, setGetbackDate] = useState(lead.getbackDate ?? "");
  const [result, setResult] = useState<"puas" | "tidak_puas" | null>(lead.getbackResult);

  const draft = { ...lead, ratingService: service, ratingQuality: quality, ratingSpeed: speed, feedback, getbackDate: getbackDate || null, getbackResult: getbackDate ? result : null };
  const score = ratingScore(draft);
  const sat = isSatisfied(draft);

  const act = async (prev: FormState, fd: FormData) => {
    const r = await rateLeadAction(prev, fd);
    if (r?.ok) onDone(r.ok);
    return r;
  };

  return (
    <ActionForm action={act} className="stack" style={{ gap: 12 }}>
      <input type="hidden" name="id" value={lead.id} />
      <input type="hidden" name="ratingService" value={service ?? ""} />
      <input type="hidden" name="ratingQuality" value={quality ?? ""} />
      <input type="hidden" name="ratingSpeed" value={speed ?? ""} />
      <input type="hidden" name="feedback" value={feedback ?? ""} />
      <input type="hidden" name="getbackResult" value={getbackDate ? (result ?? "") : ""} />
      <div>
        <StarRow label="Layanan" value={service} onChange={setService} />
        <StarRow label="Kualitas" value={quality} onChange={setQuality} />
        <StarRow label="Kecepatan" value={speed} onChange={setSpeed} />
      </div>
      <div className="field">
        <label htmlFor="rt-cat">Catatan dari pembeli (opsional)</label>
        <textarea id="rt-cat" name="ratingNote" rows={2} defaultValue={lead.ratingNote ?? ""} maxLength={500} placeholder="Contoh: pengiriman cepat, sopir ramah" />
      </div>
      <div className="field">
        <label>Keterangan pembeli</label>
        <div className="rp-opts">
          <button type="button" aria-pressed={feedback === "puas"} className={`seg-opt good${feedback === "puas" ? " on" : ""}`} onClick={() => setFeedback(feedback === "puas" ? null : "puas")}>Puas</button>
          <button type="button" aria-pressed={feedback === "komplain"} className={`seg-opt bad${feedback === "komplain" ? " on" : ""}`} onClick={() => setFeedback(feedback === "komplain" ? null : "komplain")}>Komplain</button>
        </div>
      </div>
      {feedback === "komplain" && (
        <div className="rp-complaint">
          <div className="field">
            <label htmlFor="rt-tglk">Tanggal komplain</label>
            <DateField id="rt-tglk" name="complaintDate" value={complaintDate} onChange={setComplaintDate} />
          </div>
          <div className="field">
            <label htmlFor="rt-isi">Isi komplain</label>
            <textarea id="rt-isi" name="complaintNote" rows={2} defaultValue={lead.complaintNote ?? ""} maxLength={500} placeholder="Contoh: paving ada yang retak 20 pcs" />
          </div>
          <b className="small">Get back (hubungi kembali pembeli)</b>
          <div className="field">
            <label htmlFor="rt-tglg">Tanggal get back</label>
            <DateField id="rt-tglg" name="getbackDate" value={getbackDate} onChange={setGetbackDate} />
          </div>
          <div className="field">
            <label htmlFor="rt-catg">Tindakan / catatan get back</label>
            <textarea id="rt-catg" name="getbackNote" rows={2} defaultValue={lead.getbackNote ?? ""} maxLength={500} placeholder="Contoh: diganti 20 pcs, dikirim ulang 12/10" />
          </div>
          <div className="field">
            <label>Hasil setelah get back</label>
            <div className="rp-opts">
              <button type="button" disabled={!getbackDate} aria-pressed={result === "puas"} className={`seg-opt good${result === "puas" && getbackDate ? " on" : ""}`} onClick={() => setResult(result === "puas" ? null : "puas")}>Puas setelah get back</button>
              <button type="button" disabled={!getbackDate} aria-pressed={result === "tidak_puas"} className={`seg-opt bad${result === "tidak_puas" && getbackDate ? " on" : ""}`} onClick={() => setResult(result === "tidak_puas" ? null : "tidak_puas")}>Tetap tidak puas</button>
            </div>
            {!getbackDate && <span className="small muted">Isi tanggal get back sebelum memilih hasilnya.</span>}
          </div>
        </div>
      )}
      {(score !== null || sat !== null) && (
        <p className="rp-preview">
          Nilai bintang: <b>{score ?? "-"} / 100</b> · Dihitung <b>{sat ? "PUAS" : "BELUM PUAS"}</b> di Sasaran Mutu
        </p>
      )}
      <div className="form-actions">
        <SubmitButton pendingText="Menyimpan…">Simpan penilaian</SubmitButton>
      </div>
    </ActionForm>
  );
}
