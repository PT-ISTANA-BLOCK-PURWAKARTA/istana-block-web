"use client";

import { useState } from "react";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { saveDelivery } from "@/app/operasional/actions/deliveries";
import { formatQty, parseQty } from "@/lib/erp/util";

export type DeliveryLineInput = { orderLineId: string; name: string; unit: string; ordered: number; /** sisa yang masih bisa dijadwalkan di surat jalan ini */ left: number; qty: number };

/** Formulir jadwal surat jalan: pilih armada, sopir, dan qty yang dikirim dari sisa pesanan. */
export function DeliveryForm({
  id,
  orderId,
  date,
  vehicleId,
  driverId,
  note,
  lines,
  vehicles,
  drivers,
}: {
  id?: string;
  orderId: string;
  date: string;
  vehicleId?: string | null;
  driverId?: string | null;
  note?: string;
  lines: DeliveryLineInput[];
  vehicles: { id: string; plate: string; name: string }[];
  drivers: { id: string; name: string }[];
}) {
  const [qty, setQty] = useState<Record<string, string>>(Object.fromEntries(lines.map((l) => [l.orderLineId, l.qty ? formatQty(l.qty) : ""])));
  const json = JSON.stringify(lines.map((l) => ({ orderLineId: l.orderLineId, qty: parseQty(qty[l.orderLineId]) })));
  return (
    <ActionForm action={saveDelivery} className="stack" style={{ gap: 20 }}>
      {id && <input type="hidden" name="id" value={id} />}
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="lines" value={json} />
      <section className="form-section">
        <div className="form-grid cols-4">
          <div className="field"><label htmlFor="sj-date">Tanggal kirim</label><input id="sj-date" name="date" type="date" defaultValue={date} required /></div>
          <div className="field">
            <label htmlFor="sj-vehicle">Kendaraan</label>
            <select id="sj-vehicle" name="vehicleId" defaultValue={vehicleId ?? ""}>
              <option value="">— belum ditentukan —</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate}{v.name ? ` · ${v.name}` : ""}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="sj-driver">Sopir</label>
            <select id="sj-driver" name="driverId" defaultValue={driverId ?? ""}>
              <option value="">— belum ditentukan —</option>
              {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="field"><label htmlFor="sj-note">Catatan <span className="help">opsional</span></label><input id="sj-note" name="note" defaultValue={note} placeholder="mis. bongkar sisi kiri gerbang" /></div>
        </div>
      </section>
      <section className="admin-table">
        <table>
          <caption>Barang yang dikirim</caption>
          <thead><tr><th>Barang</th><th className="num">Dipesan</th><th className="num">Sisa bisa dikirim</th><th className="num">Kirim sekarang</th></tr></thead>
          <tbody>
            {lines.map((l) => {
              const v = parseQty(qty[l.orderLineId]);
              const over = v > l.left + 1e-9;
              return (
                <tr key={l.orderLineId}>
                  <td><b>{l.name}</b></td>
                  <td className="num">{formatQty(l.ordered)} {l.unit}</td>
                  <td className="num">{formatQty(l.left)} {l.unit}</td>
                  <td className="num">
                    <div className="inline-form" style={{ justifyContent: "flex-end" }}>
                      <input aria-label={`Qty kirim ${l.name}`} className="num alloc-input" inputMode="decimal" value={qty[l.orderLineId] ?? ""} placeholder="0" aria-invalid={over || undefined} onChange={(e) => setQty((s) => ({ ...s, [l.orderLineId]: e.target.value }))} />
                      <span className="small muted">{l.unit}</span>
                    </div>
                    {over && <div className="small text-bahaya">melebihi sisa</div>}
                  </td>
                </tr>
              );
            })}
            {lines.length === 0 && <tr><td colSpan={4} className="muted">Semua barang pesanan ini sudah dijadwalkan.</td></tr>}
          </tbody>
        </table>
      </section>
      <div className="form-actions"><SubmitButton>{id ? "Simpan perubahan" : "Jadwalkan pengiriman"}</SubmitButton></div>
    </ActionForm>
  );
}
