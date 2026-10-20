"use client";

import { useContext, useRef, useState } from "react";
import { saveResult } from "@/app/operasional/actions/calendar";
import { ActionForm, PendingContext } from "@/components/admin/ActionForm";
import { DateField } from "@/components/ui";
import { LISTS } from "@/lib/ops/shared/isoForms";
import type { CalendarAttendee, CalendarFile } from "@/db/erp";
import { whenText, type EventView } from "./common";

export type ResultData = {
  leader: string; category: string; summary: string; attendees: CalendarAttendee[]; guests: string; durationHours: number | null; evaluation: string; notes: string; files: CalendarFile[];
} | null;
type Decision = { id?: string; topik: string; keputusan: string; pj: string; target: string; status: "Open" | "Closed"; selesai: string };

const TRAINING_KINDS = ["Internal", "Eksternal"];
const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx";
const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};
const sizeText = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const guestCount = (g: string) => g.split(/[,\n;]+/).map((n) => n.trim()).filter(Boolean).length;

/** Unggah satu lampiran (maks 10 MB) lewat route handler; batas body server action hanya 6 MB. */
async function upload(file: File): Promise<CalendarFile> {
  const type = file.type || MIME_BY_EXT[file.name.split(".").pop()?.toLowerCase() ?? ""] || "";
  const body = new FormData();
  body.append("file", new File([file], file.name, { type }));
  const res = await fetch("/operasional/kalender/berkas", { method: "POST", body, credentials: "same-origin" });
  const data = (await res.json().catch(() => ({}))) as Partial<CalendarFile> & { ok?: boolean; error?: string };
  if (!res.ok || !data.key) throw new Error(data.error ?? `Gagal mengunggah ${file.name}.`);
  return { key: data.key, name: data.name ?? file.name, contentType: data.contentType ?? type, size: data.size ?? file.size };
}

/** Tombol simpan: tertahan selama berkas masih diunggah supaya tidak ada lampiran yang tertinggal. */
function SaveButton({ uploading }: { uploading: boolean }) {
  const pending = useContext(PendingContext);
  return <button type="submit" className="btn btn-blue" disabled={pending || uploading} aria-busy={pending}>{pending ? "Menyimpan\u2026" : uploading ? "Menunggu unggahan\u2026" : "Simpan hasil"}</button>;
}

export function ResultForm({ event, result, decisions: saved, names }: { event: EventView; result: ResultData; decisions: { id: string; values: Record<string, string | number | null> }[]; names: string[] }) {
  const rapat = event.type === "rapat";
  const hours = event.endAt ? Math.round(((new Date(event.endAt).getTime() - new Date(event.startAt).getTime()) / 3600_000) * 10) / 10 : null;
  const [category, setCategory] = useState(result?.category || (rapat ? "Mingguan" : "Internal"));
  const [guests, setGuests] = useState(result?.guests ?? "");
  const [attendees, setAttendees] = useState<CalendarAttendee[]>(() => {
    const prior = result?.attendees ?? [];
    const fromInvite = event.participants.map((p) => prior.find((a) => a.userId === p.userId) ?? { userId: p.userId, name: p.name, present: !result, score: null, note: null });
    return [...fromInvite, ...prior.filter((a) => a.userId === null || !event.participants.some((p) => p.userId === a.userId))];
  });
  const [decisions, setDecisions] = useState<Decision[]>(() =>
    saved.length
      ? saved.map((d) => ({ id: d.id, topik: String(d.values.topik ?? ""), keputusan: String(d.values.keputusan ?? ""), pj: String(d.values.pj ?? ""), target: String(d.values.target ?? ""), status: d.values.status === "Closed" ? "Closed" : "Open", selesai: String(d.values.selesai ?? "") }))
      : rapat ? [{ topik: "", keputusan: "", pj: "", target: "", status: "Open", selesai: "" }] : [],
  );
  const [files, setFiles] = useState<CalendarFile[]>(result?.files ?? []);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const setAtt = (i: number, patch: Partial<CalendarAttendee>) => setAttendees((l) => l.map((a, x) => (x === i ? { ...a, ...patch } : a)));
  const setDec = (i: number, patch: Partial<Decision>) => setDecisions((l) => l.map((d, x) => (x === i ? { ...d, ...patch } : d)));
  const present = attendees.filter((a) => a.present).length + guestCount(guests);

  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    setUploadError(null);
    if (files.length + list.length > 10) return setUploadError("Maksimal 10 lampiran.");
    setUploading(true);
    try {
      for (const f of Array.from(list)) {
        const uploaded = await upload(f);
        setFiles((cur) => [...cur, uploaded]);
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Gagal mengunggah.");
    } finally {
      setUploading(false);
      if (picker.current) picker.current.value = "";
    }
  }

  const rowCls = rapat ? "rapat" : "training";
  return (
    <ActionForm action={saveResult} className="stack" style={{ gap: 16 }}>
      <input type="hidden" name="eventId" value={event.id} />
      <input type="hidden" name="attendees" value={JSON.stringify(attendees.map((a) => ({ ...a, score: a.score?.trim() || null, note: a.note?.trim() || null })))} />
      <input type="hidden" name="files" value={JSON.stringify(files)} />
      <input type="hidden" name="decisions" value={JSON.stringify(decisions.filter((d) => d.keputusan.trim()))} />

      <div className="form-section">
        <h2>{rapat ? "Rapat" : "Training"}: {event.title}</h2>
        <p className="small muted">{whenText(event)}{event.location ? ` · ${event.location}` : ""}</p>
        <datalist id="res-people">{names.map((n) => <option key={n} value={n} />)}</datalist>
        <div className="form-grid">
          <div className="field">
            <span className="label">{rapat ? "Jenis rapat" : "Jenis training"}</span>
            <div className="cal-seg" role="radiogroup" aria-label="Jenis">
              {(rapat ? LISTS.jenisRapat : TRAINING_KINDS).map((k) => <label key={k}><input type="radio" name="category" value={k} checked={category === k} onChange={() => setCategory(k)} />{k}</label>)}
            </div>
          </div>
          <div className="field"><label htmlFor="rs-leader">{rapat ? "Pimpinan rapat" : "Pemateri / trainer"}</label><input id="rs-leader" name="leader" list="res-people" maxLength={120} defaultValue={result?.leader} placeholder={rapat ? "Contoh: Hamad Salim" : "Nama pemateri / lembaga"} /></div>
          {!rapat && <div className="field"><label htmlFor="rs-dur">Durasi (jam)</label><input id="rs-dur" name="durationHours" inputMode="decimal" defaultValue={result?.durationHours ?? (hours ?? "")} /></div>}
        </div>
      </div>

      <div className="form-section">
        <h2>Kehadiran ({present} hadir)</h2>
        <div className="cal-actions" style={{ marginTop: 0 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAttendees((l) => l.map((a) => ({ ...a, present: true })))}>Semua hadir</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAttendees((l) => [...l, { userId: null, name: "", present: true, score: null, note: null }])}>+ Peserta</button>
        </div>
        {attendees.length ? (
          <div className="cal-att">
            {attendees.map((a, i) => (
              <div key={`${a.userId ?? "x"}-${i}`} className={`cal-att-row ${rowCls}`}>
                <input type="checkbox" aria-label={`Hadir: ${a.name || "peserta"}`} checked={a.present} onChange={(e) => setAtt(i, { present: e.target.checked })} />
                {a.userId ? <span>{a.name}</span> : <input type="text" value={a.name} maxLength={120} onChange={(e) => setAtt(i, { name: e.target.value })} placeholder="Nama peserta" aria-label="Nama peserta" />}
                {!rapat && <input type="text" className="full" value={a.score ?? ""} maxLength={40} onChange={(e) => setAtt(i, { score: e.target.value })} placeholder="Nilai / Lulus" aria-label="Nilai" />}
                <input type="text" className="full" value={a.note ?? ""} maxLength={200} onChange={(e) => setAtt(i, { note: e.target.value })} placeholder={a.present ? "Catatan" : "Alasan tidak hadir"} aria-label="Catatan" />
                {a.userId ? <span /> : <button type="button" className="icon-btn" aria-label="Hapus peserta" onClick={() => setAttendees((l) => l.filter((_, x) => x !== i))}>&times;</button>}
              </div>
            ))}
          </div>
        ) : <p className="muted small">Belum ada peserta di undangan kalender.</p>}
        <div className="field"><label htmlFor="rs-guests">Peserta lain (operator, tamu) <span className="help">pisahkan dengan koma</span></label><input id="rs-guests" name="guests" maxLength={500} value={guests} onChange={(e) => setGuests(e.target.value)} placeholder="Contoh: Oki, Dedi, Asep" /></div>
      </div>

      <div className="form-section">
        <div className="field"><label htmlFor="rs-sum">{rapat ? "Ringkasan pembahasan" : "Materi training"}</label><textarea id="rs-sum" name="summary" rows={4} maxLength={4000} defaultValue={result?.summary || event.description} placeholder={rapat ? "Pokok bahasan dan hasil diskusi" : "Materi yang disampaikan"} /></div>
        {!rapat && <div className="field"><label htmlFor="rs-eval">Evaluasi / hasil training</label><textarea id="rs-eval" name="evaluation" rows={3} maxLength={2000} defaultValue={result?.evaluation} placeholder="Contoh: peserta paham cara uji lumpur; 2 orang perlu pendampingan ulang" /></div>}
        <div className="field"><label htmlFor="rs-notes">Catatan</label><textarea id="rs-notes" name="notes" rows={2} maxLength={2000} defaultValue={result?.notes} /></div>
      </div>

      {rapat && (
        <div className="form-section">
          <h2>Keputusan &amp; tindak lanjut</h2>
          <p className="small muted">Setiap keputusan otomatis masuk form <b>F-IB-14 Log Rapat &amp; Tindak Lanjut</b> di Rekap ISO. Baris tanpa isi &quot;Hasil / keputusan&quot; diabaikan.</p>
          {decisions.map((d, i) => (
            <div key={d.id ?? `new-${i}`} className="cal-dec">
              <input type="text" className="c4" value={d.topik} maxLength={500} onChange={(e) => setDec(i, { topik: e.target.value })} placeholder="Topik (opsional)" aria-label="Topik" />
              <input type="text" className="c8" value={d.keputusan} maxLength={500} onChange={(e) => setDec(i, { keputusan: e.target.value })} placeholder="Hasil / keputusan" aria-label="Hasil atau keputusan" />
              <input type="text" className="c3" list="res-people" value={d.pj} maxLength={500} onChange={(e) => setDec(i, { pj: e.target.value })} placeholder="Penanggung jawab" aria-label="Penanggung jawab" />
              <div className="field c3"><label>Target</label><DateField value={d.target} onChange={(v) => setDec(i, { target: v })} aria-label="Target waktu" /></div>
              <div className="field c3">
                <span className="label">Status</span>
                <div className="cal-seg" role="radiogroup" aria-label="Status">
                  {(["Open", "Closed"] as const).map((s) => <label key={s}><input type="radio" name={`dec-status-${i}`} checked={d.status === s} onChange={() => setDec(i, { status: s })} />{s}</label>)}
                </div>
              </div>
              <div className="field c2"><label>Tgl selesai</label><DateField value={d.selesai} disabled={d.status !== "Closed"} onChange={(v) => setDec(i, { selesai: v })} aria-label="Tanggal selesai" /></div>
              <div className="c1" style={{ display: "flex", alignItems: "flex-end", justifyContent: "flex-end" }}>
                <button type="button" className="icon-btn" aria-label="Hapus keputusan" onClick={() => setDecisions((l) => l.filter((_, x) => x !== i))}>&times;</button>
              </div>
            </div>
          ))}
          <div><button type="button" className="btn btn-ghost btn-sm" onClick={() => setDecisions((l) => [...l, { topik: "", keputusan: "", pj: "", target: "", status: "Open", selesai: "" }])}>+ Keputusan</button></div>
        </div>
      )}

      <div className="form-section">
        <h2>Lampiran ({files.length}/10)</h2>
        <p className="small muted">Materi, daftar hadir bertanda tangan, foto kegiatan, sertifikat. PDF, foto, Word, Excel, atau PowerPoint, maks. 10 MB per berkas.</p>
        <div className="ui-file">
          <input ref={picker} id="rs-files" type="file" multiple accept={ACCEPT} onChange={(e) => void addFiles(e.target.files)} />
          <label htmlFor="rs-files" className="ui-file-btn" aria-disabled={uploading || files.length >= 10}>{uploading ? "Mengunggah…" : "Tambah berkas"}</label>
        </div>
        {uploadError && <p className="alert alert-error" role="alert">{uploadError}</p>}
        <div className="cal-files">
          {files.map((f) => (
            <div key={f.key} className="cal-file">
              <a href={`/operasional/berkas/${f.key}`} target="_blank" rel="noreferrer">{f.name}</a>
              <span className="small">{sizeText(f.size)}</span>
              <button type="button" className="icon-btn" aria-label={`Hapus ${f.name}`} onClick={() => setFiles((l) => l.filter((x) => x.key !== f.key))}>&times;</button>
            </div>
          ))}
        </div>
      </div>

      <div className="form-actions"><SaveButton uploading={uploading} /></div>
    </ActionForm>
  );
}
