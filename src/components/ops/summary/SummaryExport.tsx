"use client";

import { useState } from "react";
import { downloadWorkbook } from "@/lib/ops/excel";
import type { QtyItem, Summary } from "@/lib/ops/summary";

const qtyColumns = [
  { key: "no", header: "No", width: 6 },
  { key: "name", header: "Nama", width: 40 },
  { key: "quantity", header: "Jumlah", width: 14 },
  { key: "unit", header: "Satuan", width: 12 },
  { key: "count", header: "Kali", width: 8 },
];
const qtyRows = (items: QtyItem[]) => items.map((item, i) => ({ no: i + 1, ...item }));

/** Unduh laporan periode yang sedang dilihat sebagai .xlsx (dibuat di browser; xlsx dimuat saat tombol ditekan). */
export function SummaryExport({ summary }: { summary: Summary }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const { orders: o, production: p, receipts: r, sand: s, mix: m } = summary.current;
      const prev = summary.previous;
      const indicators: [string, number | string, number | string][] = [
        ["PO baru", o.created, prev.orders.created],
        ["Pengiriman selesai", o.delivered, prev.orders.delivered],
        ["Terlambat", o.late, prev.orders.late],
        ["PO dibatalkan", o.cancelled, prev.orders.cancelled],
        ["Input produksi", p.entries, prev.production.entries],
        ["Reject produksi", p.rejects, prev.production.rejects],
        ["Hari ada kendala", p.issueDays, prev.production.issueDays],
        ["Barang masuk (rit)", r.trips, prev.receipts.trips],
        ["Barang ditolak", r.rejected, prev.receipts.rejected],
        ["Uji lumpur", s.tests, prev.sand.tests],
        ["Lumpur rata-rata (%)", s.avgSilt ?? "", prev.sand.avgSilt ?? ""],
        ["Mix desain dicatat", m.logs, prev.mix.logs],
        ["Benda uji tekan", summary.strength.samples, ""],
        ["Benda uji memenuhi", summary.strength.passed, ""],
      ];
      await downloadWorkbook(
        `Laporan-${summary.period}_${summary.start}.xlsx`,
        [
          {
            name: "Angka utama",
            title: `LAPORAN ${summary.period.toUpperCase()} · ${summary.label}`,
            columns: [
              { key: "indicator", header: "Indikator", width: 30 },
              { key: "now", header: summary.label, width: 22 },
              { key: "before", header: "Periode sebelumnya", width: 20 },
            ],
            rows: indicators.map(([indicator, now, before]) => ({ indicator, now, before })),
          },
          { name: "Terkirim", title: "Pengiriman selesai per produk", columns: qtyColumns, rows: qtyRows(o.deliveredProducts) },
          { name: "PO baru", title: "PO baru per produk", columns: qtyColumns, rows: qtyRows(o.orderedProducts) },
          { name: "Produksi", title: "Hasil produksi", columns: qtyColumns, rows: qtyRows(p.products) },
          {
            name: "Kendala",
            title: "Kendala produksi",
            columns: [
              { key: "no", header: "No", width: 6 },
              { key: "issue", header: "Kendala", width: 30 },
              { key: "count", header: "Kali", width: 8 },
              { key: "notes", header: "Keterangan", width: 60 },
            ],
            rows: p.issues.map((item, i) => ({ no: i + 1, issue: item.issue, count: item.count, notes: item.notes.slice(0, 3).join(" | ") })),
          },
          { name: "Barang masuk", title: "Barang masuk (diterima)", columns: qtyColumns, rows: qtyRows(r.items) },
          {
            name: "Piket",
            title: "Jam piket per orang",
            columns: [
              { key: "no", header: "No", width: 6 },
              { key: "name", header: "Nama", width: 30 },
              { key: "shifts", header: "Shift", width: 8 },
              { key: "hours", header: "Jam piket", width: 10 },
            ],
            rows: summary.duty.map((d, i) => ({ no: i + 1, ...d })),
          },
        ],
        { dateNF: "dd/mm/yyyy" },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat berkas Excel.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="lp-export">
      <button type="button" className="btn btn-ghost btn-sm" onClick={run} disabled={busy}>{busy ? "Menyiapkan…" : "Excel"}</button>
      {error && <span className="small text-bahaya" role="alert"> {error}</span>}
    </span>
  );
}
