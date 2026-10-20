"use client";

import { useState } from "react";
import { DateField } from "@/components/ui";
import { downloadWorkbook } from "@/lib/ops/excel";
import { STATUS_LABEL } from "./status";

type Row = {
  number: string; date: string; status: string; orderNumber: string; contactName: string; project: string; address: string; plate: string; driver: string; items: string;
  loadedAt: number | null; departedAt: number | null; arrivedAt: number | null; deliveredAt: number | null; delayReason: string; receivedBy: string; completedBy: string;
  gpsPoints: number; gpsKm: number; photoCount: number;
};
type Hist = { number: string; at: number; fromStatus: string; toStatus: string; who: string; note: string };
type Payload = { from: string; to: string; rows: Row[]; history: Hist[]; gpsTruncated: boolean };

const when = (t: number | null) => (t ? new Date(t * 1000) : null);
const label = (s: string) => (s ? STATUS_LABEL[s as keyof typeof STATUS_LABEL] ?? s : "");

/** Unduh laporan pengiriman .xlsx (sheet Pengiriman + Riwayat status). Data dari /operasional/pengiriman/ekspor; xlsx dimuat di browser. */
export function ExportButton({ defaultFrom, defaultTo }: { defaultFrom: string; defaultTo: string }) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/operasional/pengiriman/ekspor?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cache: "no-store" });
      if (!r.ok) throw new Error(r.status === 403 ? "Akun Anda tidak boleh mengekspor." : `Gagal memuat data (${r.status}).`);
      const d = (await r.json()) as Payload;
      await downloadWorkbook(`laporan-pengiriman_${d.from}_${d.to}.xlsx`, [
        {
          name: "Pengiriman",
          title: `Laporan pengiriman ${d.from} s.d. ${d.to}${d.gpsTruncated ? " (jarak GPS dipotong: titik terlalu banyak)" : ""}`,
          columns: [
            { key: "number", header: "Surat jalan", width: 18 },
            { key: "date", header: "Tanggal", width: 12 },
            { key: "orderNumber", header: "Pesanan", width: 18 },
            { key: "contactName", header: "Pelanggan", width: 26 },
            { key: "tujuan", header: "Tujuan", width: 34 },
            { key: "items", header: "Muatan", width: 40 },
            { key: "plate", header: "Kendaraan", width: 14 },
            { key: "driver", header: "Sopir", width: 18 },
            { key: "status", header: "Status", width: 16 },
            { key: "loadedAt", header: "Dimuat", width: 17 },
            { key: "departedAt", header: "Berangkat", width: 17 },
            { key: "arrivedAt", header: "Tiba", width: 17 },
            { key: "deliveredAt", header: "Terkirim", width: 17 },
            { key: "delayReason", header: "Alasan tertunda", width: 28 },
            { key: "receivedBy", header: "Diterima oleh", width: 20 },
            { key: "completedBy", header: "Diselesaikan oleh", width: 22 },
            { key: "gpsKm", header: "Jarak GPS (km)", width: 14 },
            { key: "gpsPoints", header: "Titik GPS", width: 11 },
            { key: "photoCount", header: "Foto bukti", width: 11 },
          ],
          rows: d.rows.map((x) => ({
            ...x,
            tujuan: x.project || x.address.split("\n")[0] || "",
            status: label(x.status),
            loadedAt: when(x.loadedAt),
            departedAt: when(x.departedAt),
            arrivedAt: when(x.arrivedAt),
            deliveredAt: when(x.deliveredAt),
          })),
        },
        {
          name: "Riwayat status",
          columns: [
            { key: "number", header: "Surat jalan", width: 18 },
            { key: "at", header: "Waktu", width: 17 },
            { key: "fromStatus", header: "Dari", width: 16 },
            { key: "toStatus", header: "Menjadi", width: 16 },
            { key: "who", header: "Oleh", width: 26 },
            { key: "note", header: "Catatan", width: 50 },
          ],
          rows: d.history.map((h) => ({ ...h, at: when(h.at), fromStatus: label(h.fromStatus), toStatus: label(h.toStatus) })),
        },
      ]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal membuat berkas.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="filter-bar" style={{ alignItems: "flex-end" }}>
      <div className="field"><label htmlFor="ex-from">Ekspor dari</label><DateField id="ex-from" value={from} onChange={(v) => setFrom(v || defaultFrom)} /></div>
      <div className="field"><label htmlFor="ex-to">Sampai</label><DateField id="ex-to" value={to} onChange={(v) => setTo(v || defaultTo)} /></div>
      <button type="button" className="btn btn-ghost btn-sm" onClick={run} disabled={busy}>{busy ? "Menyiapkan…" : "Ekspor Excel"}</button>
      {err && <span className="small text-bahaya" role="alert">{err}</span>}
    </div>
  );
}
