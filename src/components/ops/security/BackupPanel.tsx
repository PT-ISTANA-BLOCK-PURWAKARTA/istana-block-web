"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { backupToFolder, downloadDatabase, folderPickerSupported, pickFolder, savedFolder, type DirHandle, type Progress } from "./backup";

type Result = { tone: "ok" | "error"; text: string };

/** Tombol backup di komputer kantor: pilih folder sekali, lalu "Backup sekarang" seminggu sekali. */
export function BackupPanel() {
  const router = useRouter();
  const [folder, setFolder] = useState<DirHandle | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(folderPickerSupported());
    void savedFolder().then(setFolder);
  }, []);

  async function choose() {
    setResult(null);
    try {
      setFolder(await pickFolder());
      setResult({ tone: "ok", text: "Folder tersimpan. Berikutnya cukup klik Backup sekarang." });
    } catch (e) {
      if ((e as DOMException)?.name !== "AbortError") setResult({ tone: "error", text: e instanceof Error ? e.message : "Folder tidak bisa dipilih." });
    }
  }

  async function run(job: () => Promise<string>) {
    setRunning(true);
    setResult(null);
    setProgress({ phase: "Menyiapkan", done: 0, total: 1 });
    try {
      setResult({ tone: "ok", text: await job() });
      router.refresh();
    } catch (e) {
      setResult({ tone: "error", text: e instanceof Error ? `${e.message}. Pastikan komputer terhubung ke jaringan dan folder tujuan bisa ditulis.` : "Backup gagal." });
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }

  const backupNow = () =>
    folder
      ? run(async () => {
          const r = await backupToFolder(folder, setProgress);
          return `Backup selesai: ${r.rows} baris data, ${r.newPhotos} berkas baru (total ${r.photos} berkas).`;
        })
      : choose();

  const download = () =>
    run(async () => {
      const r = await downloadDatabase(setProgress);
      return `Berkas ${r.fileName} diunduh (${r.rows} baris). Foto tidak ikut.`;
    });

  const pct = progress && progress.total ? Math.min(100, (progress.done / progress.total) * 100) : 0;

  return (
    <div className="kc-actions">
      {!supported && (
        <p className="alert alert-warn">
          Browser ini tidak bisa menulis langsung ke folder. Pakai Chrome/Edge di komputer, atau unduh berkas database lalu salin manual (foto tidak ikut).
        </p>
      )}
      <div className="kc-buttons">
        {supported && (
          <button type="button" className="btn btn-ghost" disabled={running} onClick={() => void choose()}>
            {folder ? "Ganti folder" : "Pilih folder"}
          </button>
        )}
        {supported && (
          <button type="button" className="btn btn-primary" disabled={running} onClick={() => void backupNow()}>
            {running ? "Sedang backup…" : "Backup sekarang"}
          </button>
        )}
        <button type="button" className="btn btn-ghost" disabled={running} onClick={() => void download()}>
          Unduh berkas database saja
        </button>
        {folder && <span className="small muted">Folder: <b>{folder.name}</b></span>}
      </div>
      {progress && (
        <div>
          <p className="small muted" style={{ margin: "0 0 4px" }}>{progress.phase} · {progress.done}/{progress.total}</p>
          <div className="progress" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
        </div>
      )}
      {result && <p className={`alert alert-${result.tone}`} role={result.tone === "error" ? "alert" : "status"}>{result.text}</p>}
    </div>
  );
}
