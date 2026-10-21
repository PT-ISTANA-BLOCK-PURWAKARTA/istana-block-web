"use client";

import { useState } from "react";
import { downloadWorkbook, type SheetColumn } from "@/lib/ops/excel";
import "./qc.css";

export type QcSheet = {
  name: string;
  title?: string;
  columns: SheetColumn[];
  rows: Record<string, unknown>[];
};

/** "YYYY-MM-DD" -> tanggal lokal (tengah malam) supaya sel Excel jatuh di hari yang sama. */
const localDate = (s: unknown) => {
  const m = typeof s === "string" ? s.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

/** Tombol "Excel": data disusun di server, berkasnya dibuat di browser (pustaka xlsx dimuat saat ditekan). */
export function QcExcelButton({ fileName, sheets, dateKeys = [], dateNF = "dd/mm/yyyy", label = "Excel", empty = "Tidak ada data pada periode ini." }: { fileName: string; sheets: QcSheet[]; dateKeys?: string[]; dateNF?: string; label?: string; empty?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setErr(null);
    const usable = sheets.filter((s) => s.rows.length);
    if (!usable.length) return setErr(empty);
    setBusy(true);
    try {
      await downloadWorkbook(
        fileName,
        usable.map((s) => ({ ...s, rows: s.rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, dateKeys.includes(k) ? localDate(v) ?? v : v]))) })),
        { dateNF },
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal membuat berkas Excel.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="qc-act">
      <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={run}>{busy ? "Menyiapkan…" : label}</button>
      {err && <span className="small text-bahaya" role="alert">{err}</span>}
    </span>
  );
}
