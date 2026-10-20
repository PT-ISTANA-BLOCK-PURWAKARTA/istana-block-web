"use client";

import { useState } from "react";
import { downloadWorkbook } from "@/lib/ops/excel";
import { deviceLabel, roleText } from "./labels";

type Row = { id: number; at: number; userName: string | null; role: string | null; action: string; label: string; summary: string | null; details: string | null; success: boolean; ip: string | null; device: string | null };

/** Unduh log aktivitas (maks 2000 baris, sesuai filter yang sedang dipakai) sebagai .xlsx. `query` = query string filter halaman. */
export function LogExport({ query, from, to }: { query: string; from: string; to: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/operasional/keamanan/api/log?${query}`, { cache: "no-store" });
      if (!r.ok) throw new Error(r.status === 403 ? "Hanya pemilik yang boleh mengekspor log." : `Gagal memuat data (${r.status}).`);
      const { rows } = (await r.json()) as { rows: Row[] };
      await downloadWorkbook(`Log-Aktivitas_${from}_sd_${to}.xlsx`, [
        {
          name: "Log aktivitas",
          title: `LOG AKTIVITAS ${from} s/d ${to}`,
          columns: [
            { key: "no", header: "No", width: 6 },
            { key: "at", header: "Waktu", width: 17 },
            { key: "userName", header: "Pengguna", width: 22 },
            { key: "role", header: "Peran", width: 18 },
            { key: "label", header: "Aktivitas", width: 30 },
            { key: "summary", header: "Ringkasan", width: 40 },
            { key: "status", header: "Status", width: 16 },
            { key: "device", header: "Perangkat", width: 18 },
            { key: "ip", header: "IP", width: 16 },
            { key: "action", header: "Kode aksi", width: 22 },
            { key: "details", header: "Detail", width: 60 },
          ],
          rows: rows.map((x, i) => ({
            no: i + 1, at: new Date(x.at), userName: x.userName ?? "-", role: roleText(x.role), label: x.label, summary: x.summary ?? "",
            status: x.success ? "Berhasil" : "Gagal / ditolak", device: deviceLabel(x.device), ip: x.ip ?? "", action: x.action, details: x.details ?? "",
          })),
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat berkas Excel.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span>
      <button type="button" className="btn btn-ghost btn-sm" onClick={run} disabled={busy}>{busy ? "Menyiapkan…" : "Excel"}</button>
      {error && <span className="small text-bahaya" role="alert"> {error}</span>}
    </span>
  );
}
