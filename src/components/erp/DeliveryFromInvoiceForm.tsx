"use client";

// Surat jalan dari invoice (Keuangan): jumlah dikirim per barang (≤ sisa), barang stok yang keluar, alamat kirim.
// Sopir & armada ditugaskan Operasional setelah surat jalan dibuat.
import { useState } from "react";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Select } from "@/components/ui";
import { createDeliveryFromInvoice } from "@/app/akuntansi/actions/documents";

export type DeliveryRow = { index: number; name: string; unit: string; quantity: number; scheduled: number; itemId: string; fixedItem: string | null };

export function DeliveryFromInvoiceForm({ invoiceId, rows, items, unpaid, defaults }: {
  invoiceId: string; rows: DeliveryRow[]; items: { value: string; label: string }[]; unpaid: boolean;
  defaults: { date: string; address: string; mapsUrl: string; siteContact: string };
}) {
  const [lines, setLines] = useState(rows.map((r) => ({ index: r.index, qty: String(Math.max(0, r.quantity - r.scheduled)), itemId: r.itemId })));
  const set = (i: number, patch: Partial<(typeof lines)[number]>) => setLines((l) => l.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <ActionForm action={createDeliveryFromInvoice} className="form-section">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
      <div className="form-grid">
        <div className="field"><label htmlFor="sj-date">Tanggal kirim</label><input id="sj-date" type="date" name="date" defaultValue={defaults.date} required /></div>
        <div className="field full"><label htmlFor="sj-addr">Alamat kirim (untuk sopir)</label><textarea id="sj-addr" name="address" rows={2} defaultValue={defaults.address} required /></div>
        <div className="field"><label htmlFor="sj-map">Tautan peta (opsional)</label><input id="sj-map" name="mapsUrl" defaultValue={defaults.mapsUrl} placeholder="https://maps.app.goo.gl/…" /></div>
        <div className="field"><label htmlFor="sj-site">Kontak di lokasi</label><input id="sj-site" name="siteContact" defaultValue={defaults.siteContact} placeholder="Nama · No. HP" /></div>
        <div className="field full"><label htmlFor="sj-note">Catatan untuk sopir</label><input id="sj-note" name="note" placeholder="Tanpa harga — sopir tidak melihat nominal" /></div>
      </div>
      <h3 className="form-sub">Barang yang dimuat</h3>
      <div className="admin-table">
        <table>
          <thead><tr><th>Barang di invoice</th><th>Barang stok yang keluar</th><th className="num">Invoice</th><th className="num">Sudah ada surat jalan</th><th className="num">Sisa</th><th style={{ width: 120 }}>Dikirim sekarang</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.index}>
                <td>{r.name}</td>
                <td>{r.fixedItem ?? <Select name={`item-${r.index}`} defaultValue={r.itemId} searchable menuWidth={360} options={[{ value: "", label: "— Pilih barang stok —" }, ...items]} onChange={(v: string) => set(i, { itemId: v })} />}</td>
                <td className="num">{r.quantity.toLocaleString("id-ID")} {r.unit}</td>
                <td className="num">{r.scheduled.toLocaleString("id-ID")}</td>
                <td className="num">{Math.max(0, r.quantity - r.scheduled).toLocaleString("id-ID")}</td>
                <td><input inputMode="decimal" value={lines[i].qty} onChange={(e) => set(i, { qty: e.target.value })} aria-label={`Jumlah ${r.name}`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="help">Stok keluar tercatat per surat jalan ini saat truk dimuat &amp; berangkat. Isi 0 untuk barang yang tidak ikut di mobil ini (kirim bertahap).</p>
      {unpaid && <label className="check"><input type="checkbox" name="paymentConfirmed" /> Belum ada DP / pembayaran tercatat — saya setujui barang tetap dikirim</label>}
      <div className="form-actions"><SubmitButton>Buat surat jalan</SubmitButton></div>
    </ActionForm>
  );
}
