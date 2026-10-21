"use client";

import { useState } from "react";
import { rateQuality } from "@/app/operasional/actions/receipts";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { DialogForm, Modal } from "@/components/ops/receipts/Modal";
import { whenFull } from "@/components/ops/receipts/util";
import { fmt } from "@/lib/ops/shared/format";
import { DECISION_LABELS, SAND_TIERS, SILT_LEVEL_LABELS, TIER_LABELS, sourceLabel, suggestTier, type SandTier } from "@/lib/ops/shared/sand";
import { levelOf, type SupplierRow } from "./summaries";

const LEVEL_CLASS = { bagus: "ok", cukup: "warn", lewat: "bad" } as const;

/** Ringkasan temuan sebelum QC memberi tier: hasil uji lumpur dan catatan satpam. */
function RowHeader({ row }: { row: SupplierRow }) {
  const level = levelOf(row);
  return (
    <div className="sup-rowhead">
      {row.siltPercent !== null && level ? (
        <>
          <b className={`silt-${LEVEL_CLASS[level]}`}>{fmt(row.siltPercent)}%</b> <b className={`silt-${LEVEL_CLASS[level]}`}>{SILT_LEVEL_LABELS[level]}</b>
        </>
      ) : (
        <b className="muted">{row.test?.status === "draft" ? "Uji lumpur sedang mengendap" : "Belum diuji lumpur"}</b>
      )}
      <p className="small muted">
        Satpam: {row.hasBrangkal ? "banyak brangkal" : "tidak ada catatan brangkal"} · {row.status === "ditolak" ? "ditolak" : "diterima"}
        {row.test?.decision ? ` · keputusan uji ${DECISION_LABELS[row.test.decision].toLowerCase()}` : ""}
        {row.notes ? ` · ${row.notes}` : ""}
      </p>
    </div>
  );
}

/** QC (nilai_mutu): pilih Tier 1–4 + keterangan material/supplier. Tier awal = penilaian QC, atau saran dari hasil uji. */
export function QualityDialog({ row, onClose }: { row: SupplierRow; onClose: () => void }) {
  const suggested = row.siltPercent === null ? null : suggestTier(row.siltPercent, row.hasBrangkal);
  const [tier, setTier] = useState<SandTier | null>(row.tierConfirmed ? row.tier : suggested);
  const [note, setNote] = useState(row.qualityNote ?? "");
  const [brangkal, setBrangkal] = useState(Boolean(row.hasBrangkal));
  return (
    <Modal
      title="Nilai kualitas (QC)"
      sub={`${row.itemName} · ${sourceLabel(row)} · ${whenFull(row.receivedAt)}${row.quantity ? ` · ${fmt(row.quantity)} ${row.unit}` : ""}`}
      onClose={onClose}
    >
      <RowHeader row={row} />
      <DialogForm action={rateQuality} onSaved={onClose}>
        <input type="hidden" name="id" value={row.id} />
        <input type="hidden" name="tier" value={tier ?? ""} />
        <input type="hidden" name="hasBrangkal" value={brangkal ? "ya" : "tidak"} />
        <div className="field">
          <span className="label">Tier {suggested && <span className="help">(saran dari hasil uji: Tier {suggested})</span>}</span>
          <div className="sup-tierpick">
            {SAND_TIERS.map((value) => (
              <button key={value} type="button" aria-pressed={tier === value} className={`sup-tierpick-btn tier-${value}${tier === value ? " on" : ""}`} onClick={() => setTier(value)}>
                Tier {value} · {TIER_LABELS[value]}
              </button>
            ))}
          </div>
        </div>
        <label className="check">
          <input type="checkbox" checked={brangkal} onChange={(e) => setBrangkal(e.target.checked)} /> Banyak brangkal (batu / kerikil besar)
        </label>
        <div className="field">
          <label htmlFor="qd-note">Keterangan material / supplier</label>
          <textarea id="qd-note" name="qualityNote" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Contoh: butiran halus, pasir basah, banyak batu besar, warna gelap." />
        </div>
        <div><SubmitButton className="btn btn-primary">Simpan tier</SubmitButton></div>
      </DialogForm>
    </Modal>
  );
}
