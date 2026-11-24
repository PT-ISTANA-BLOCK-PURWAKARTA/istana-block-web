"use client";

// Tombol "Selesaikan": F-IB-06 (kalibrasi / maintenance selesai -> Tgl Terakhir baru, jadwal berikutnya terhitung ulang,
// riwayat lama tersimpan) dan F-IB-14 (tindak lanjut rapat Closed dengan tanggal & keterangan).
import Link from "next/link";
import { useState } from "react";
import { completeIsoRecordAction } from "@/app/operasional/actions/iso";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { DateField } from "@/components/ui";
import { addDays } from "@/lib/ops/shared/isoForms";

const dmy = (d: string) => d.split("-").reverse().join("/");

export function CompleteIsoForm({ code, recordId, values, today, back }: { code: "F-IB-06" | "F-IB-14"; recordId: string; values: Record<string, unknown>; today: string; back: string }) {
  const meeting = code === "F-IB-14";
  const [date, setDate] = useState(today);
  const frekuensi = Number(values.frekuensi ?? 0);
  const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  return (
    <ActionForm action={completeIsoRecordAction} className="form-section">
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="id" value={recordId} />
      <input type="hidden" name="back" value={back} />
      <div>
        <h2>Selesaikan {meeting ? "tindak lanjut rapat" : s(values.jenis || "jadwal").toLowerCase()}</h2>
        <p className="small muted">
          {meeting
            ? `${s(values.topik)} · ${s(values.keputusan)}${values.target ? ` · target ${dmy(s(values.target))}` : ""}`
            : `${s(values.nama)}${values.pekerjaan ? ` · ${s(values.pekerjaan)}` : ""}. Tgl terakhir sebelumnya ${values.terakhir ? dmy(s(values.terakhir)) : "-"}.`}
        </p>
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="cs-date">Selesai tanggal</label>
          <DateField id="cs-date" name="date" value={date} onChange={setDate} max={today} required />
        </div>
        {!meeting && (
          <>
            <div className="field">
              <label htmlFor="cs-pel">Pelaksana</label>
              <select id="cs-pel" name="pelaksana" defaultValue={s(values.pelaksana) === "Vendor" ? "Vendor" : "Internal"}>
                <option value="Internal">Internal</option>
                <option value="Vendor">Vendor</option>
              </select>
            </div>
            <div className="field"><label htmlFor="cs-ser">No. sertifikat / bukti</label><input id="cs-ser" name="sertifikat" maxLength={200} placeholder="opsional" /></div>
          </>
        )}
      </div>
      {!meeting && frekuensi > 0 && date && <p className="flag flag-info small">Jadwal berikutnya: <b>{dmy(addDays(date, Math.round(frekuensi)))}</b> (setiap {frekuensi} hari)</p>}
      <div className="field">
        <label htmlFor="cs-ket">Keterangan</label>
        <input id="cs-ket" name="keterangan" maxLength={300} placeholder={meeting ? "mis. sudah dikerjakan, hasilnya ..." : "mis. ganti oli, kalibrasi timbangan"} />
      </div>
      <div className="form-actions">
        <SubmitButton>Selesaikan</SubmitButton>
        <Link href={back} className="btn btn-ghost">Batal</Link>
      </div>
    </ActionForm>
  );
}
