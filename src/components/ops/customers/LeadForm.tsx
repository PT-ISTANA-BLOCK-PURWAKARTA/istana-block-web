"use client";

import { useState } from "react";
import { saveLeadAction } from "@/app/operasional/actions/customer-leads";
import { ActionForm } from "@/components/admin/ActionForm";
import type { FormState } from "@/components/admin/FormMessage";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { DateField, Select } from "@/components/ui";
import { LEAD_SOURCES, LEAD_STATUS_LABEL, LEAD_STATUS_ORDER, REASON_META, type LeadRow } from "@/lib/ops/customer-leads-core";
import type { LeadReason, LeadStatus } from "@/db/erp";

/** Dialog Tambah / Ubah konsumen. */
export function LeadForm({ lead, today, onDone }: { lead?: LeadRow; today: string; onDone: (msg: string) => void }) {
  const [date, setDate] = useState(lead?.contactDate ?? today);
  const [status, setStatus] = useState<LeadStatus>(lead?.status ?? "follow_up");
  const [reasons, setReasons] = useState<LeadReason[]>(lead?.reasons ?? []);
  const source = lead?.source ?? "Google Ads";
  const sources = (LEAD_SOURCES as readonly string[]).includes(source) ? [...LEAD_SOURCES] : [...LEAD_SOURCES, source];

  const act = async (prev: FormState, fd: FormData) => {
    const r = await saveLeadAction(prev, fd);
    if (r?.ok) onDone(r.ok);
    return r;
  };

  return (
    <ActionForm action={act} className="stack" style={{ gap: 14 }}>
      <input type="hidden" name="id" value={lead?.id ?? ""} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="reasons" value={JSON.stringify(reasons)} />
      <div className="form-grid">
        <div className="field">
          <label htmlFor="ld-tgl">Tanggal</label>
          <DateField id="ld-tgl" name="contactDate" value={date} onChange={setDate} required />
        </div>
        <div className="field">
          <label htmlFor="ld-src">Sumber</label>
          <Select id="ld-src" name="source" defaultValue={source} options={sources.map((s) => ({ value: s, label: s }))} />
        </div>
        <div className="field">
          <label htmlFor="ld-nama">Nama pelanggan</label>
          <input id="ld-nama" name="name" defaultValue={lead?.name ?? ""} maxLength={120} required />
        </div>
        <div className="field">
          <label htmlFor="ld-wa">No. WA</label>
          <input id="ld-wa" name="phone" inputMode="tel" defaultValue={lead?.phone ?? ""} maxLength={30} />
        </div>
        <div className="field span-2">
          <label htmlFor="ld-alamat">Alamat</label>
          <input id="ld-alamat" name="address" defaultValue={lead?.address ?? ""} maxLength={300} />
        </div>
        <div className="field span-2">
          <label htmlFor="ld-produk">Produk yang ditanyakan / dibeli</label>
          <input id="ld-produk" name="product" defaultValue={lead?.product ?? ""} maxLength={200} placeholder="Contoh: PV BATA 6CM ABU 120M2" />
        </div>
        <div className="field span-2">
          <label>Status</label>
          <div className="rp-opts" role="radiogroup" aria-label="Status">
            {LEAD_STATUS_ORDER.map((s) => (
              <button key={s} type="button" role="radio" aria-checked={status === s} className={`seg-opt${status === s ? " on" : ""}`} onClick={() => setStatus(s)}>
                {LEAD_STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="ld-nilai">Nilai penjualan (Rp)</label>
          <input id="ld-nilai" name="saleValue" inputMode="numeric" defaultValue={lead?.saleValue?.toString() ?? ""} disabled={status !== "membeli"} />
        </div>
        <div className="field">
          <label htmlFor="ld-nett">Harga nett (Rp)</label>
          <input id="ld-nett" name="priceNett" inputMode="numeric" defaultValue={lead?.priceNett?.toString() ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="ld-tawar">Harga tawar (Rp)</label>
          <input id="ld-tawar" name="priceOffer" inputMode="numeric" defaultValue={lead?.priceOffer?.toString() ?? ""} />
        </div>
        {status !== "membeli" && (
          <div className="field span-2">
            <label>Alasan tidak membeli</label>
            <div className="rp-opts">
              {REASON_META.map((m) => {
                const on = reasons.includes(m.code);
                return (
                  <button
                    key={m.code} type="button" aria-pressed={on} title={m.hint} className={`seg-opt${on ? " on" : ""}`}
                    onClick={() => setReasons(on ? reasons.filter((c) => c !== m.code) : [...reasons, m.code])}
                  >
                    {on ? "✓ " : ""}{m.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="field span-2">
          <label htmlFor="ld-ket">Keterangan</label>
          <input id="ld-ket" name="notes" defaultValue={lead?.notes ?? ""} maxLength={500} />
        </div>
      </div>
      <div className="form-actions">
        <SubmitButton>Simpan</SubmitButton>
      </div>
    </ActionForm>
  );
}
