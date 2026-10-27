"use client";

import { useState } from "react";
import { importLeadsAction } from "@/app/operasional/actions/customer-leads";
import { loadXlsx } from "@/lib/ops/excel";
import { LEAD_STATUS_LABEL, LEAD_STATUS_ORDER, monthName, parseCustomerWorkbook, type ParsedWorkbook } from "@/lib/ops/customer-leads-core";

/** Impor file "TABEL PENILAIAN KONSUMEN GOOGLE ADS" (satu sheet per bulan). Anti-dobel lewat import_key di server. */
export function ImportDialog({ onDone }: { onDone: (msg: string) => void }) {
  const [file, setFile] = useState<string>("");
  const [parsed, setParsed] = useState<ParsedWorkbook | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pick(f: File | undefined) {
    setError(null);
    setParsed(null);
    if (!f) return;
    setFile(f.name);
    setBusy(true);
    try {
      const XLSX = await loadXlsx();
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
      const sheets = wb.SheetNames.map((name) => ({ name, rows: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, blankrows: false, defval: "" }) }));
      const out = parseCustomerWorkbook(sheets);
      if (!out.leads.length) setError("Tidak ada data konsumen yang terbaca");
      setParsed(out);
    } catch {
      setError("File tidak bisa dibaca");
    } finally {
      setBusy(false);
    }
  }

  async function run() {
    if (!parsed?.leads.length) return;
    setBusy(true);
    setError(null);
    let added = 0, skipped = 0;
    try {
      for (let i = 0; i < parsed.leads.length; i += 300) {
        const r = await importLeadsAction(parsed.leads.slice(i, i + 300));
        if ("error" in r) throw new Error(r.error);
        added += r.added;
        skipped += r.skipped;
      }
      onDone(`${added} konsumen ditambahkan${skipped ? ` · ${skipped} sudah ada (dilewati)` : ""}`);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Gagal impor");
      setBusy(false);
    }
  }

  const counts = parsed ? LEAD_STATUS_ORDER.map((s) => `${LEAD_STATUS_LABEL[s]} ${parsed.leads.filter((l) => l.status === s).length}`).join(" · ") : "";

  return (
    <div className="stack" style={{ gap: 12 }}>
      <label className="btn btn-ghost" style={{ cursor: "pointer", alignSelf: "flex-start" }}>
        Pilih file Excel
        <input type="file" accept=".xlsx,.xls" hidden onChange={(e) => pick(e.target.files?.[0])} />
      </label>
      {busy && !parsed && <p className="small muted">Membaca file…</p>}
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {parsed && parsed.leads.length > 0 && (
        <div className="small stack" style={{ gap: 4 }}>
          <b>{file}: {parsed.leads.length} konsumen dari {parsed.months.length} bulan ({parsed.months.map(monthName).join(", ")})</b>
          <span>{counts}</span>
        </div>
      )}
      {parsed && parsed.skipped.length > 0 && <p className="small muted">Sheet dilewati: {parsed.skipped.join("; ")}</p>}
      {parsed && parsed.leads.length > 0 && (
        <div className="form-actions">
          <button type="button" className="btn btn-blue" disabled={busy} onClick={run}>{busy ? "Mengimpor…" : `Impor ${parsed.leads.length} konsumen`}</button>
        </div>
      )}
    </div>
  );
}
