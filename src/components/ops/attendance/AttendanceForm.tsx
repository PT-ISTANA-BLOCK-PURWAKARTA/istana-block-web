"use client";

import Link from "next/link";
import { useState } from "react";
import { saveAttendance } from "@/app/operasional/actions/attendance";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { DateField } from "@/components/ui";

export type AttendanceInitial = {
  id?: string; workDate: string; workerName: string; task: string; payType: "harian" | "jam" | "borongan"; status: "hadir" | "izin" | "sakit" | "alfa";
  startTime: string; endTime: string; hours: string; overtimeHours: string; output: string; outputUnit: string; note: string;
};
export type KnownWorker = { workerName: string; task: string | null; payType: "harian" | "jam" | "borongan" };

const PAY = [{ key: "harian", label: "Harian" }, { key: "jam", label: "Per jam" }, { key: "borongan", label: "Borongan" }] as const;
const STATUS = [{ key: "hadir", label: "Hadir" }, { key: "izin", label: "Izin" }, { key: "sakit", label: "Sakit" }, { key: "alfa", label: "Alfa" }] as const;

const hoursBetween = (start: string, end: string) => {
  if (!start || !end) return null;
  const [h1, m1] = start.split(":").map(Number);
  const [h2, m2] = end.split(":").map(Number);
  let minutes = h2 * 60 + m2 - (h1 * 60 + m1);
  if (minutes < 0) minutes += 24 * 60;
  return Math.round(minutes / 6) / 10;
};

/** Isi / ubah absensi satu pekerja. Nama yang pernah diisi melengkapi tugas & jenis upah otomatis. */
export function AttendanceForm({ initial, names, back }: { initial: AttendanceInitial; names: KnownWorker[]; back: string }) {
  const [f, setF] = useState(initial);
  const set = (patch: Partial<AttendanceInitial>) => setF((cur) => ({ ...cur, ...patch }));
  const present = f.status === "hadir";
  const auto = hoursBetween(f.startTime, f.endTime);
  const pickName = (value: string) => {
    const known = names.find((n) => n.workerName.toUpperCase() === value.trim().toUpperCase());
    set({ workerName: value, ...(known && !f.task ? { task: known.task ?? "", payType: known.payType } : {}) });
  };
  return (
    <ActionForm action={saveAttendance} className="form-section">
      {f.id && <input type="hidden" name="id" value={f.id} />}
      <input type="hidden" name="status" value={f.status} />
      <input type="hidden" name="payType" value={f.payType} />
      <h2>{f.id ? "Ubah absensi" : "Absensi pekerja"}</h2>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="wa-name">Nama pekerja</label>
          <input id="wa-name" name="workerName" list="wa-names" value={f.workerName} onChange={(e) => pickName(e.target.value)} placeholder="Ketik nama" required minLength={2} maxLength={120} />
          <datalist id="wa-names">{names.map((n) => <option key={n.workerName} value={n.workerName} />)}</datalist>
        </div>
        <div className="field"><label htmlFor="wa-date">Tanggal</label><DateField id="wa-date" name="workDate" defaultValue={f.workDate} required /></div>
      </div>
      <div className="field"><label htmlFor="wa-task">Tugas</label><input id="wa-task" name="task" value={f.task} onChange={(e) => set({ task: e.target.value })} maxLength={200} placeholder="Mis. cetak paving, bongkar pasir, kebersihan" /></div>
      <div className="field">
        <span className="label">Kehadiran</span>
        <div className="seg" role="group" aria-label="Kehadiran">
          {STATUS.map((s) => <button key={s.key} type="button" className={`seg-opt${f.status === s.key ? " on" : ""}`} aria-pressed={f.status === s.key} onClick={() => set({ status: s.key })}>{s.label}</button>)}
        </div>
      </div>
      {present && (
        <>
          <div className="field">
            <span className="label">Jenis upah</span>
            <div className="seg" role="group" aria-label="Jenis upah">
              {PAY.map((p) => <button key={p.key} type="button" className={`seg-opt${f.payType === p.key ? " on" : ""}`} aria-pressed={f.payType === p.key} onClick={() => set({ payType: p.key })}>{p.label}</button>)}
            </div>
          </div>
          <div className="form-grid cols-4">
            <div className="field"><label htmlFor="wa-in">Jam masuk</label><input id="wa-in" name="startTime" type="time" value={f.startTime} onChange={(e) => set({ startTime: e.target.value })} /></div>
            <div className="field"><label htmlFor="wa-out">Jam pulang</label><input id="wa-out" name="endTime" type="time" value={f.endTime} onChange={(e) => set({ endTime: e.target.value })} /></div>
            <div className="field"><label htmlFor="wa-h">Jam kerja</label><input id="wa-h" name="hours" inputMode="decimal" value={f.hours} onChange={(e) => set({ hours: e.target.value })} placeholder={auto !== null ? String(auto).replace(".", ",") : "-"} /></div>
            <div className="field"><label htmlFor="wa-ot">Lembur (jam)</label><input id="wa-ot" name="overtimeHours" inputMode="decimal" value={f.overtimeHours} onChange={(e) => set({ overtimeHours: e.target.value })} placeholder="Opsional" /></div>
          </div>
          {f.payType === "borongan" && (
            <div className="form-grid">
              <div className="field"><label htmlFor="wa-out-q">Hasil borongan</label><input id="wa-out-q" name="output" inputMode="decimal" value={f.output} onChange={(e) => set({ output: e.target.value })} placeholder="Jumlah" /></div>
              <div className="field"><label htmlFor="wa-out-u">Satuan</label><input id="wa-out-u" name="outputUnit" value={f.outputUnit} onChange={(e) => set({ outputUnit: e.target.value })} maxLength={30} placeholder="m², pcs, rit" /></div>
            </div>
          )}
          <p className="small muted">Jam kerja otomatis dari jam masuk–pulang{auto !== null ? ` (${String(auto).replace(".", ",")} jam)` : ""}; boleh diisi sendiri (mis. dikurangi istirahat).</p>
        </>
      )}
      <div className="field"><label htmlFor="wa-note">Keterangan (opsional)</label><input id="wa-note" name="note" value={f.note} onChange={(e) => set({ note: e.target.value })} maxLength={300} placeholder={present ? "Mis. pulang cepat" : "Mis. sakit demam, izin keluarga"} /></div>
      <div className="form-actions">
        <SubmitButton>Simpan</SubmitButton>
        <Link href={back} className="btn btn-ghost">Batal</Link>
      </div>
    </ActionForm>
  );
}
