"use client";

import { useState } from "react";
import { downloadWorkbook } from "@/lib/ops/excel";

export type SpecExportRow = { line: string; name: string; variant: string; weightKg: number | null; specs: string; notes: string; active: boolean; item: string };

/** Unduh Spesifikasi-Produk.xlsx (satu sheet, urut kategori). */
export function SpecsExcel({ rows }: { rows: SpecExportRow[] }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function run() {
    setBusy(true);
    setErr(null);
    try {
      await downloadWorkbook("Spesifikasi-Produk.xlsx", [
        {
          name: "Spesifikasi",
          title: "SPESIFIKASI & BERAT PRODUK",
          columns: [
            { key: "no", header: "No", width: 5 },
            { key: "line", header: "Kategori", width: 20 },
            { key: "name", header: "Ukuran / tipe", width: 30 },
            { key: "variant", header: "Varian / metode", width: 16 },
            { key: "weight", header: "Berat per buah (kg)", width: 18 },
            { key: "specs", header: "Spesifikasi", width: 44 },
            { key: "item", header: "Barang di stok", width: 30 },
            { key: "active", header: "Aktif", width: 8 },
            { key: "notes", header: "Catatan", width: 40 },
          ],
          rows: rows.map((r, i) => ({ no: i + 1, line: r.line, name: r.name, variant: r.variant, weight: r.weightKg ?? "", specs: r.specs, item: r.item, active: r.active ? "Ya" : "Tidak", notes: r.notes })),
        },
      ]);
    } catch {
      setErr("Gagal membuat berkas Excel. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className="inline-form" style={{ gap: 8 }}>
      <button type="button" className="btn btn-ghost btn-sm" disabled={busy || !rows.length} onClick={run}>{busy ? "Menyiapkan…" : "Unduh Excel"}</button>
      {err && <span className="small text-bahaya" role="alert">{err}</span>}
    </span>
  );
}
