"use client";

import { useEffect, useState } from "react";
import { completeSandTest, deleteSandDraft } from "@/app/operasional/actions/sand";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ConfirmAction } from "@/components/erp/ConfirmAction";
import { Icon } from "@/components/panel/Icon";
import { Chips } from "@/components/ops/receipts/Chips";
import { DialogForm, Modal } from "@/components/ops/receipts/Modal";
import { berkasUrl, elapsed, whenText } from "@/components/ops/receipts/util";
import type { ReadingUnit } from "@/db/erp";
import { sourceLabel } from "@/lib/ops/shared/sand";
import { ReadingFields, emptyReading } from "./ReadingFields";
import { MIN_SETTLE_MS, UNIT_LABELS } from "./util";

/** Bagian draft yang dibutuhkan daftar ini (dilempar dari server). */
export type DraftView = {
  id: string;
  sandType: string;
  tag: string | null;
  supplier: string | null;
  quarry: string | null;
  vehiclePlate: string | null;
  testedAt: Date;
  startPhotoKey: string | null;
  readingUnit: ReadingUnit;
  notes: string;
};

const UNITS = ["ml", "cm"] as const;

function CompleteDialog({ draft, now, onClose }: { draft: DraftView; now: number; onClose: () => void }) {
  const [unit, setUnit] = useState<ReadingUnit>(draft.readingUnit);
  const [reading, setReading] = useState(emptyReading);
  const [notes, setNotes] = useState(draft.notes);
  const early = now - new Date(draft.testedAt).getTime() < MIN_SETTLE_MS;
  return (
    <Modal title="Isi hasil uji lumpur" sub={`${draft.sandType} · ${sourceLabel(draft)} · mulai ${whenText(draft.testedAt)} (sudah ${elapsed(draft.testedAt, now)})`} onClose={onClose}>
      {early && <p className="flag flag-warn">Baru {elapsed(draft.testedAt, now)} — sebaiknya tunggu minimal 1 jam agar lumpur mengendap sempurna.</p>}
      {draft.startPhotoKey && (
        <a href={berkasUrl(draft.startPhotoKey)} target="_blank" rel="noreferrer" className="sand-start-photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={berkasUrl(draft.startPhotoKey)} alt="Foto awal" />
          <span className="small muted">Foto awal (setelah dikocok)</span>
        </a>
      )}
      <DialogForm action={completeSandTest} onSaved={onClose}>
        <input type="hidden" name="id" value={draft.id} />
        <div className="field">
          <span className="label">Alat ukur</span>
          <Chips name="readingUnit" value={unit} options={UNITS} labels={UNIT_LABELS} onChange={setUnit} label="Alat ukur" />
        </div>
        <ReadingFields unit={unit} value={reading} onChange={setReading} />
        <div className="field">
          <label htmlFor="cd-notes">Catatan</label>
          <textarea id="cd-notes" name="notes" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div><SubmitButton className="btn btn-primary btn-block rcv-save" pendingText="Menyimpan…">Simpan hasil uji</SubmitButton></div>
      </DialogForm>
    </Modal>
  );
}

/** Draft milik akun ini yang sedang mengendap; siap dibaca setelah 1 jam. */
export function DraftList({ drafts, serverNow }: { drafts: DraftView[]; serverNow: number }) {
  const [completing, setCompleting] = useState<string | null>(null);
  // Awalnya pakai jam server (supaya hidrasi sama), lalu jam perangkat dan diperbarui tiap menit.
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  if (!drafts.length) return null;
  const draft = drafts.find((item) => item.id === completing);
  return (
    <section className="sand-drafts">
      <h2 className="rcv-sub">Sedang mengendap ({drafts.length})</h2>
      <div className="rcv-grid">
        {drafts.map((item) => {
          const ready = now - new Date(item.testedAt).getTime() >= MIN_SETTLE_MS;
          return (
            <article key={item.id} className={`rcv-card sand-draft${ready ? " is-ready" : ""}`}>
              <div className="sand-draft-row">
                {item.startPhotoKey ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={berkasUrl(item.startPhotoKey)} alt="Foto awal" className="sand-draft-img" loading="lazy" />
                ) : (
                  <span className="sand-draft-img sand-draft-none"><Icon name="sand" size={28} /></span>
                )}
                <div className="sand-draft-main">
                  <b>{item.sandType}{item.tag ? ` · ${item.tag}` : ""}</b>
                  <span className="small muted">{sourceLabel(item)}{item.vehiclePlate ? ` · ${item.vehiclePlate}` : ""}</span>
                  <span className={`small ${ready ? "text-sukses" : "text-warn"}`}><b>{ready ? "✓ Siap dibaca" : "⏳ Mengendap"} · {elapsed(item.testedAt, now)}</b></span>
                </div>
              </div>
              <div className="rcv-actions">
                <button type="button" className="btn btn-blue btn-sm" onClick={() => setCompleting(item.id)}>Isi hasil</button>
                <ConfirmAction action={deleteSandDraft.bind(null, item.id)} label="Hapus draft" confirmText="Hapus draft uji ini?" />
              </div>
            </article>
          );
        })}
      </div>
      {draft && <CompleteDialog key={draft.id} draft={draft} now={now} onClose={() => setCompleting(null)} />}
    </section>
  );
}
