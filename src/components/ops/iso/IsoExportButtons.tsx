"use client";

import { useState } from "react";
import { monthsInRange, type DayRange } from "@/lib/ops/shared/isoRecap";
import { FORM_BY_CODE, type IsoCode } from "@/lib/ops/shared/isoForms";
import { fetchAllRows, fetchOverview } from "./isoApi";
import { downloadAllForms, downloadFormFile } from "./isoExcel";

/** Tombol unduh Excel format form F-IB (data diambil bertahap dari server, Excel dibuat di browser). */
export function ExportAllButton({ range, codes, printedBy }: { range: DayRange; codes: IsoCode[]; printedBy: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  async function run() {
    setBusy(true);
    try {
      setMessage({ text: "Mengambil ringkasan…" });
      const overview = await fetchOverview(range);
      const rows: { code: IsoCode; rows: { number: string | null; values: Record<string, string | number | null> }[] }[] = [];
      for (const code of codes) {
        setMessage({ text: `Mengambil ${code} ${FORM_BY_CODE[code].short}…` });
        const list = await fetchAllRows(code, range);
        rows.push({ code, rows: list.map((r) => ({ number: r.number, values: r.values })) });
      }
      const months = monthsInRange(range);
      const monthly: { label: string; overview: Awaited<ReturnType<typeof fetchOverview>> }[] = [];
      if (months.length > 1 && months.length <= 12) {
        for (const month of months) {
          setMessage({ text: `Mengambil rekap ${month.label}…` });
          monthly.push({ label: month.label, overview: await fetchOverview(month) });
        }
      }
      setMessage({ text: "Membuat berkas Excel…" });
      await downloadAllForms({ overview, monthly, forms: rows, meta: { ...range, printedBy, printedAt: new Date() } });
      setMessage({ text: "Excel siap diunduh." });
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "Gagal membuat Excel.", error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="iso-export">
      <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={run}>{busy ? "Menyiapkan…" : "Excel semua form"}</button>
      {message && <span className={`small ${message.error ? "text-bahaya" : "muted"}`} role={message.error ? "alert" : "status"}>{message.text}</span>}
    </span>
  );
}

/** Unduh satu form dalam nama file & sheet yang sama dengan file form asli. */
export function ExportFormButton({ code, range, printedBy }: { code: IsoCode; range: DayRange; printedBy: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const rows = await fetchAllRows(code, range);
      await downloadFormFile(FORM_BY_CODE[code], rows.map((r) => ({ number: r.number, values: r.values })), { ...range, printedBy, printedAt: new Date() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat Excel.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="iso-export">
      <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={run}>{busy ? "Menyiapkan…" : `Unduh ${code}.xlsx`}</button>
      {error && <span className="small text-bahaya" role="alert">{error}</span>}
    </span>
  );
}
