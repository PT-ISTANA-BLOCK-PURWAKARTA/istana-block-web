"use client";

import { useState } from "react";
import { berkasUrl } from "@/components/ops/receipts/util";
import { downloadWorkbook } from "@/lib/ops/excel";
import type { SandTestRow } from "@/lib/ops/sand";
import { DECISION_LABELS, GOOD_SILT_PERCENT, SILT_LEVEL_LABELS, siltLevel } from "@/lib/ops/shared/sand";
import { testerName } from "./util";

/** Unduh Excel hasil uji lumpur pada rentang yang sedang ditampilkan. */
export function SandExcel({ rows, from, to }: { rows: SandTestRow[]; from: string; to: string }) {
  const [error, setError] = useState<string | null>(null);
  async function run() {
    setError(null);
    const origin = window.location.origin;
    try {
      await downloadWorkbook(`Uji-Lumpur_${from}_sd_${to}.xlsx`, [
        {
          name: "Uji lumpur",
          title: `UJI LUMPUR ${from} s/d ${to}`,
          columns: [
            ["no", "No"], ["mulai", "Mulai"], ["selesai", "Selesai"], ["status", "Status"], ["material", "Material"], ["tag", "Tag"], ["supplier", "Supplier"], ["quarry", "Quarry"],
            ["plat", "Plat truk"], ["jumlah", "Jumlah"], ["satuan", "Satuan"], ["satuanBaca", "Satuan baca"], ["pasir", "Endapan pasir"], ["lumpur", "Endapan lumpur"],
            ["persen", "Hasil pengujian (%)"], ["bagus", "Patokan bagus (%)"], ["maks", "Batas maks (%)"], ["hasil", "Hasil"], ["keputusan", "Keputusan"], ["catatan", "Catatan"],
            ["penguji", "Diuji oleh"], ["sekretaris", "Pembuat data (Sekretaris)"], ["manager", "Mengetahui (Manager in charge)"], ["pimpinan", "Mengetahui (Pimpinan)"], ["riwayat", "Riwayat perubahan"], ["fotoAwal", "Foto awal"], ["fotoHasil", "Foto hasil"],
          ].map(([key, header]) => ({ key, header })),
          rows: rows.map((row, index) => ({
            no: index + 1,
            mulai: new Date(row.testedAt),
            selesai: row.completedAt ? new Date(row.completedAt) : "",
            status: row.status === "draft" ? "Mengendap" : "Selesai",
            material: row.sandType,
            tag: row.tag ?? "",
            supplier: row.supplier ?? "",
            quarry: row.quarry ?? "",
            plat: row.vehiclePlate ?? "",
            jumlah: row.quantity ?? "",
            satuan: row.quantity ? row.unit ?? "" : "",
            satuanBaca: row.readingUnit,
            pasir: row.sandHeight ?? "",
            lumpur: row.siltHeight ?? "",
            persen: row.siltPercent ?? "",
            bagus: GOOD_SILT_PERCENT,
            maks: row.maxSiltPercent,
            hasil: row.siltPercent === null ? "" : SILT_LEVEL_LABELS[siltLevel(row.siltPercent, row.maxSiltPercent)],
            keputusan: row.decision ? DECISION_LABELS[row.decision] : "",
            catatan: row.notes,
            penguji: testerName(row),
            sekretaris: row.secretaryAckName ?? "",
            manager: row.managerAckName ?? "",
            pimpinan: row.leaderAckName ?? "",
            riwayat: row.editHistory.map((e) => `${new Date(e.at * 1000).toLocaleString("id-ID")} ${e.byName ?? "-"}: ${e.reason} (sebelumnya ${e.old.siltPercent ?? "-"}%)`).join(" | "),
            fotoAwal: row.startPhotoKey ? `${origin}${berkasUrl(row.startPhotoKey)}` : "",
            fotoHasil: row.photoKey ? `${origin}${berkasUrl(row.photoKey)}` : "",
          })),
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat Excel");
    }
  }
  return (
    <span className="rcv-toolbar">
      <button type="button" className="btn btn-ghost btn-sm" disabled={!rows.length} onClick={() => void run()}>Unduh Excel</button>
      {error && <span className="small text-bahaya" role="alert">{error}</span>}
    </span>
  );
}
