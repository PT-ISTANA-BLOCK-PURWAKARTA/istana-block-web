"use client";

import { useState } from "react";
import { downloadWorkbook } from "@/lib/ops/excel";
import type { RecapItem } from "@/lib/ops/calendar";
import { wibKey, wibTime } from "./common";

const dmy = (day: string | null | undefined) => (day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}` : "");
const names = (g: string) => g.split(/[,\n;]+/).map((n) => n.trim()).filter(Boolean);
const clock = (i: RecapItem) => `${wibTime(i.startAt)}${i.endAt ? `–${wibTime(i.endAt)}` : ""}`;

function presentNames(i: RecapItem) {
  return [...(i.result?.attendees ?? []).filter((a) => a.present).map((a) => a.name), ...names(i.result?.guests ?? "")];
}

/** Unduh Excel rekap rapat & training (4 sheet) di browser. */
export function RecapExport({ items, from, to }: { items: RecapItem[]; from: string; to: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const origin = window.location.origin;
      const links = (i: RecapItem) => (i.result?.files ?? []).map((f) => `${f.name}: ${origin}/operasional/berkas/${f.key}`).join("\n");
      const rapat = items.filter((i) => i.type === "rapat");
      const training = items.filter((i) => i.type === "training");
      await downloadWorkbook(`Rekap-Rapat-Training_${from}_sd_${to}.xlsx`, [
        {
          name: "Rapat", title: `REKAP RAPAT ${dmy(from)} s/d ${dmy(to)}`,
          columns: ["No", "Tanggal", "Jam", "Judul / topik", "Jenis rapat", "Tempat", "Pimpinan rapat", "Diundang", "Hadir", "Nama hadir", "Ringkasan pembahasan", "Keputusan", "Keputusan masih Open", "Lampiran", "Status rekap", "Diisi oleh"].map((h) => ({ key: h, header: h })),
          rows: rapat.map((i, n) => ({
            "No": n + 1, "Tanggal": dmy(wibKey(i.startAt)), "Jam": clock(i), "Judul / topik": i.title, "Jenis rapat": i.result?.category ?? "", "Tempat": i.location, "Pimpinan rapat": i.result?.leader ?? "",
            "Diundang": i.participants.length, "Hadir": i.result ? presentNames(i).length : "", "Nama hadir": i.result ? presentNames(i).join(", ") : "", "Ringkasan pembahasan": i.result?.summary ?? "",
            "Keputusan": i.decisions.length, "Keputusan masih Open": i.decisions.filter((d) => d.values.status === "Open").length, "Lampiran": links(i),
            "Status rekap": i.result ? "Sudah diisi" : "Belum diisi", "Diisi oleh": i.result?.filledByName ?? "",
          })),
        },
        {
          name: "Tindak lanjut (F-IB-14)", title: "KEPUTUSAN & TINDAK LANJUT RAPAT (F-IB-14)",
          columns: ["No", "Tanggal Rapat", "Jenis Rapat", "Pimpinan Rapat", "Jml Peserta", "Topik Pembahasan", "Hasil / Keputusan", "Penanggung Jawab", "Target Waktu", "Status", "Tgl Selesai", "Ketepatan"].map((h) => ({ key: h, header: h })),
          rows: rapat.flatMap((i) => i.decisions).map((d, n) => ({
            "No": n + 1, "Tanggal Rapat": dmy(String(d.values.tanggal ?? "")), "Jenis Rapat": d.values.jenis ?? "", "Pimpinan Rapat": d.values.pimpinan ?? "", "Jml Peserta": d.values.peserta ?? "",
            "Topik Pembahasan": d.values.topik ?? "", "Hasil / Keputusan": d.values.keputusan ?? "", "Penanggung Jawab": d.values.pj ?? "", "Target Waktu": dmy(String(d.values.target ?? "")),
            "Status": d.values.status ?? "", "Tgl Selesai": dmy(String(d.values.selesai ?? "")), "Ketepatan": d.values.ketepatan ?? "",
          })),
        },
        {
          name: "Training", title: `REKAP TRAINING ${dmy(from)} s/d ${dmy(to)}`,
          columns: ["No", "Tanggal", "Jam", "Judul training", "Jenis", "Pemateri / trainer", "Tempat", "Durasi (jam)", "Diundang", "Hadir", "Materi", "Evaluasi / hasil", "Catatan", "Lampiran", "Status rekap", "Diisi oleh"].map((h) => ({ key: h, header: h })),
          rows: training.map((i, n) => ({
            "No": n + 1, "Tanggal": dmy(wibKey(i.startAt)), "Jam": clock(i), "Judul training": i.title, "Jenis": i.result?.category ?? "", "Pemateri / trainer": i.result?.leader ?? "", "Tempat": i.location,
            "Durasi (jam)": i.result?.durationHours ?? "", "Diundang": i.participants.length, "Hadir": i.result ? presentNames(i).length : "", "Materi": i.result?.summary ?? "",
            "Evaluasi / hasil": i.result?.evaluation ?? "", "Catatan": i.result?.notes ?? "", "Lampiran": links(i), "Status rekap": i.result ? "Sudah diisi" : "Belum diisi", "Diisi oleh": i.result?.filledByName ?? "",
          })),
        },
        {
          name: "Peserta training", title: "PESERTA TRAINING",
          columns: ["No", "Tanggal", "Training", "Pemateri", "Nama peserta", "Hadir", "Nilai / hasil", "Catatan"].map((h) => ({ key: h, header: h })),
          rows: training
            .flatMap((i) => [
              ...(i.result?.attendees ?? []).map((a) => ({ i, name: a.name, present: a.present, score: a.score, note: a.note })),
              ...names(i.result?.guests ?? "").map((name) => ({ i, name, present: true, score: null as string | null, note: "peserta lain" as string | null })),
            ])
            .map((e, n) => ({ "No": n + 1, "Tanggal": dmy(wibKey(e.i.startAt)), "Training": e.i.title, "Pemateri": e.i.result?.leader ?? "", "Nama peserta": e.name, "Hadir": e.present ? "Ya" : "Tidak", "Nilai / hasil": e.score ?? "", "Catatan": e.note ?? "" })),
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat Excel.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <button type="button" className="btn btn-ghost btn-sm" disabled={busy || !items.length} onClick={run}>{busy ? "Menyiapkan…" : "Unduh Excel"}</button>
      {error && <span className="small text-bahaya" role="alert">{error}</span>}
    </span>
  );
}
