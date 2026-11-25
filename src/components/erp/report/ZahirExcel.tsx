"use client";

// Unduh laporan 12 bulan ke Excel dengan judul seperti ekspor Zahir ("PT. ISTANA BLOCK PURWAKARTA · Laba Rugi - 12 Bulan").
import { useState } from "react";
import { downloadWorkbook } from "@/lib/ops/excel";

export function ZahirExcel({ fileName, title, sheet, months, monthLabels, rows }: { fileName: string; title: string; sheet: string; months: string[]; monthLabels: string[]; rows: Record<string, string | number>[] }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await downloadWorkbook(fileName, [
            { name: sheet, title, columns: [{ key: "code", header: "Kode", width: 10 }, { key: "name", header: "Nama Rekening", width: 46 }, ...months.map((m, i) => ({ key: m, header: monthLabels[i], width: 16 }))], rows },
          ]);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Menyiapkan…" : "Unduh Excel"}
    </button>
  );
}
