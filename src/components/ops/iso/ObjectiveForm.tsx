"use client";

import Link from "next/link";
import { useState } from "react";
import { saveObjectiveAction } from "@/app/operasional/actions/iso";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { formatNumber } from "@/lib/ops/shared/isoRecap";

type Props = {
  no: number;
  text: string;
  basis: string;
  targetLabel: string;
  target: number;
  pic: string;
  month: string;
  initial: { total: number | null; achieved: number | null; note: string | null };
  back: string;
  cancelHref: string;
  /** Parameter URL yang dipertahankan saat berganti bulan (dari, sampai, tab, isi). */
  keep: Record<string, string>;
};

const parse = (v: string) => {
  const t = v.trim().replace(",", ".");
  return t === "" ? null : Number(t);
};

/** Isi angka Sasaran Mutu manual untuk satu bulan; ganti bulan memuat ulang halaman (GET). */
export function ObjectiveForm({ no, text, basis, targetLabel, target, pic, month, initial, back, cancelHref, keep }: Props) {
  const [total, setTotal] = useState(initial.total?.toString() ?? "");
  const [achieved, setAchieved] = useState(initial.achieved?.toString() ?? "");
  const [note, setNote] = useState(initial.note ?? "");
  const t = parse(total), a = parse(achieved);
  const percent = t && a !== null && Number.isFinite(t) && Number.isFinite(a) ? a / t : null;
  const reached = percent !== null && Math.round(percent * 10_000) >= Math.round(target * 10_000);

  return (
    <div className="form-section">
      <div>
        <h2>Sasaran {no} · isi angka bulanan</h2>
        <p className="small">{text}</p>
        <p className="small muted">{basis} · target {targetLabel} · PJ {pic}</p>
      </div>
      <form method="get" className="filter-bar" style={{ marginBottom: 0 }}>
        {Object.entries(keep).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <div className="field">
          <label htmlFor="obj-bulan">Bulan</label>
          <input id="obj-bulan" type="month" name="bulan" defaultValue={month} pattern="\d{4}-\d{2}" required />
        </div>
        <button type="submit" className="btn btn-ghost btn-sm">Ganti bulan</button>
      </form>
      <ActionForm action={saveObjectiveAction} className="stack" style={{ gap: 16 }}>
        <input type="hidden" name="no" value={no} />
        <input type="hidden" name="month" value={month} />
        <input type="hidden" name="back" value={back} />
        <div className="form-grid">
          <div className="field"><label htmlFor="obj-total">Jumlah total</label><input id="obj-total" name="total" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} /></div>
          <div className="field"><label htmlFor="obj-achieved">Jumlah tercapai</label><input id="obj-achieved" name="achieved" inputMode="decimal" value={achieved} onChange={(e) => setAchieved(e.target.value)} /></div>
          <div className="field span-2"><label htmlFor="obj-note">Catatan / bukti (opsional)</label><input id="obj-note" name="note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Contoh: rekap chat WA dari HP admin" /></div>
        </div>
        {percent !== null && (
          <p className="small">
            Hasil: <b>{formatNumber(percent, "percent")}</b> → <span className={`badge ${reached ? "badge-on" : "badge-danger"}`}>{reached ? "TERCAPAI" : "BELUM TERCAPAI"}</span>
          </p>
        )}
        <div className="form-actions">
          <SubmitButton>Simpan</SubmitButton>
          <SubmitButton name="intent" value="hapus" className="btn btn-ghost">Hapus angka bulan ini</SubmitButton>
          <Link href={cancelHref} className="btn btn-ghost">Batal</Link>
        </div>
      </ActionForm>
    </div>
  );
}
