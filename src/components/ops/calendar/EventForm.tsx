"use client";

import { useMemo, useState } from "react";
import { saveEvent } from "@/app/operasional/actions/calendar";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { DateField } from "@/components/ui";
import { REMINDER_OPTIONS, TYPE_LABEL, wibKey, wibTime, type CalType, type EventView, type Person } from "./common";

const TYPES: CalType[] = ["rapat", "training", "lainnya"];

/** Form acara. Baru: boleh berulang. Ubah: hanya satu acara ini. */
export function EventForm({ people, event, date: initialDate }: { people: Person[]; event?: EventView; date: string }) {
  const [date, setDate] = useState(event ? wibKey(event.startAt) : initialDate);
  const [endDate, setEndDate] = useState(event?.endAt ? wibKey(event.endAt) : initialDate);
  const [ids, setIds] = useState<number[]>(() => (event ? event.participants.map((p) => p.userId) : people.filter((p) => p.role === "Pemilik" || p.role === "Operasional").map((p) => p.id)));
  const [reminders, setReminders] = useState<number[]>(event ? event.reminderMinutes : [1440, 60]);
  const [repeat, setRepeat] = useState<"none" | "weekly" | "monthly">("none");
  const [until, setUntil] = useState("");
  const roles = useMemo(() => [...new Set(people.map((p) => p.role))], [people]);

  const toggle = (id: number) => setIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  const groupIds = (role?: string) => people.filter((p) => !role || p.role === role).map((p) => p.id);
  const groupOn = (role?: string) => { const g = groupIds(role); return g.length > 0 && g.every((id) => ids.includes(id)); };
  const toggleGroup = (role?: string) => {
    const g = groupIds(role);
    setIds((list) => (groupOn(role) ? list.filter((id) => !g.includes(id)) : [...new Set([...list, ...g])]));
  };

  return (
    <ActionForm action={saveEvent} className="stack" style={{ gap: 16 }}>
      {event && <input type="hidden" name="id" value={event.id} />}
      <div className="form-section">
        <h2>{event ? "Ubah acara" : "Tambah acara"}</h2>
        <div className="form-grid">
          <div className="field span-2"><label htmlFor="ev-title">Judul</label><input id="ev-title" name="title" required minLength={2} maxLength={120} defaultValue={event?.title} placeholder="Contoh: Rapat evaluasi produksi mingguan" /></div>
          <div className="field span-2">
            <span className="label">Jenis</span>
            <div className="cal-seg" role="radiogroup" aria-label="Jenis acara">
              {TYPES.map((t) => <label key={t}><input type="radio" name="type" value={t} defaultChecked={(event?.type ?? "rapat") === t} />{TYPE_LABEL[t]}</label>)}
            </div>
          </div>
          <div className="field"><label htmlFor="ev-date">Tanggal mulai</label><DateField id="ev-date" name="date" required value={date} onChange={(v) => { setDate(v); if (!endDate || endDate < v) setEndDate(v); }} /></div>
          <div className="field"><label htmlFor="ev-start">Jam mulai (WIB)</label><input id="ev-start" name="startTime" type="time" required defaultValue={event ? wibTime(event.startAt) : "09:00"} /></div>
          <div className="field"><label htmlFor="ev-edate">Tanggal selesai</label><DateField id="ev-edate" name="endDate" min={date} value={endDate} onChange={setEndDate} /></div>
          <div className="field"><label htmlFor="ev-end">Jam selesai (WIB) <span className="help">kosongkan bila tak ditentukan</span></label><input id="ev-end" name="endTime" type="time" defaultValue={event?.endAt ? wibTime(event.endAt) : event ? "" : "10:00"} /></div>
          <div className="field span-2"><label htmlFor="ev-loc">Tempat</label><input id="ev-loc" name="location" maxLength={120} defaultValue={event?.location} placeholder="Contoh: Ruang rapat kantor / Pabrik / Online (Zoom)" /></div>
          <div className="field span-2"><label htmlFor="ev-desc">Agenda / keterangan</label><textarea id="ev-desc" name="description" maxLength={2000} defaultValue={event?.description} placeholder="Materi, yang perlu dibawa, pemateri training, dll." /></div>
        </div>
      </div>

      <div className="form-section">
        <h2>Peserta ({ids.length})</h2>
        <p className="small muted">Peserta mendapat pengingat di HP/komputer yang sudah mengaktifkan notifikasi.{ids.length === 0 ? " Belum ada peserta: tidak ada yang akan diingatkan." : ""}</p>
        <div className="cal-pills" role="group" aria-label="Pilih peserta per kelompok">
          <button type="button" className="cal-pill" style={groupOn() ? { borderColor: "var(--biru)", background: "var(--info-bg)" } : undefined} onClick={() => toggleGroup()}>{groupOn() ? "✓ " : "+ "}Semua</button>
          {roles.map((r) => <button key={r} type="button" className="cal-pill" style={groupOn(r) ? { borderColor: "var(--biru)", background: "var(--info-bg)" } : undefined} onClick={() => toggleGroup(r)}>{groupOn(r) ? "✓ " : "+ "}{r}</button>)}
          <button type="button" className="cal-pill" onClick={() => setIds([])}>Kosongkan</button>
        </div>
        <div className="cal-people">
          {people.map((p) => (
            <label key={p.id}><input type="checkbox" name="participant" value={p.id} checked={ids.includes(p.id)} onChange={() => toggle(p.id)} />{p.name}<span className="role">{p.role}</span></label>
          ))}
          {people.length === 0 && <span className="muted small">Belum ada akun dengan izin kalender.</span>}
        </div>
      </div>

      <div className="form-section">
        <h2>Pengingat</h2>
        <div className="cal-pills">
          {REMINDER_OPTIONS.map(([minutes, label]) => (
            <label key={minutes} className="cal-pill"><input type="checkbox" name="reminder" value={minutes} checked={reminders.includes(minutes)} onChange={() => setReminders((l) => (l.includes(minutes) ? l.filter((m) => m !== minutes) : [...l, minutes]))} />{label}</label>
          ))}
        </div>
        {!event && (
          <>
            <h2>Ulangi</h2>
            <div className="cal-seg" role="radiogroup" aria-label="Pengulangan">
              {([["none", "Tidak"], ["weekly", "Tiap minggu"], ["monthly", "Tiap bulan"]] as const).map(([v, label]) => (
                <label key={v}><input type="radio" name="repeat" value={v} checked={repeat === v} onChange={() => setRepeat(v)} />{label}</label>
              ))}
            </div>
            {repeat !== "none" && (
              <div className="field" style={{ maxWidth: 260 }}>
                <label htmlFor="ev-until">Sampai tanggal <span className="help">maks. 52 kali</span></label>
                <DateField id="ev-until" name="until" required min={date} value={until} onChange={setUntil} />
              </div>
            )}
          </>
        )}
        {event?.seriesId && <p className="small muted">Acara ini bagian dari jadwal berulang. Perubahan hanya berlaku untuk tanggal ini.</p>}
      </div>

      <div className="form-actions">
        <SubmitButton>Simpan acara</SubmitButton>
      </div>
    </ActionForm>
  );
}
