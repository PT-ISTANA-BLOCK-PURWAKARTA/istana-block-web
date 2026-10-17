"use client";

import { useState } from "react";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { saveOrder } from "@/app/operasional/actions/orders";
import { LinesEditor, type EditorLine, type PickItem } from "@/components/erp/LinesEditor";
import type { Order } from "@/db/erp";
import { tgl } from "@/lib/erp/util";
import { DateField, Select } from "@/components/ui";

type Head = Partial<Pick<Order, "id" | "contactId" | "customerRef" | "project" | "address" | "mapsUrl" | "siteContact" | "requestedDate" | "ongkir" | "discount" | "taxable" | "note" | "status">> & { date: string };

/** Formulir pesanan (PO) pelanggan. */
export function OrderForm({
  head,
  lines,
  contacts,
  items,
  taxRate,
  overdue = {},
}: {
  head: Head;
  lines: EditorLine[];
  contacts: { id: string; name: string; company: string; address: string }[];
  items: PickItem[];
  taxRate: number;
  /** Pelanggan dengan faktur lewat jatuh tempo: jumlah faktur & tanggal tertua (tanpa nominal). */
  overdue?: Record<string, { n: number; oldest: string }>;
}) {
  const isNew = !head.id;
  const [contactId, setContactId] = useState(head.contactId ?? "");
  const late = overdue[contactId];
  return (
    <ActionForm action={saveOrder} className="stack" style={{ gap: 20 }}>
      {head.id && <input type="hidden" name="id" value={head.id} />}
      <section className="form-section">
        <h2>Pelanggan &amp; tujuan</h2>
        <div className="form-grid cols-4">
          <div className="field span-2">
            <label htmlFor="po-contact">Pelanggan <a href="/operasional/pelanggan/baru" target="_blank" className="help">+ pelanggan baru ↗</a></label>
            <Select id="po-contact" name="contactId" value={contactId} onChange={setContactId} required searchable placeholder="Pilih pelanggan…" options={contacts.map((c) => ({ value: c.id, label: c.name, hint: c.company && c.company !== c.name ? c.company : undefined }))} />
            {late && <span className="flag flag-warn small" style={{ marginTop: 6 }}>Ada {late.n} faktur lewat jatuh tempo (tertua {tgl(late.oldest)}). Konfirmasi ke keuangan sebelum mengirim.</span>}
          </div>
          <div className="field"><label htmlFor="po-date">Tanggal pesanan</label><DateField id="po-date" name="date" defaultValue={head.date} required /></div>
          <div className="field"><label htmlFor="po-req">Minta dikirim <span className="help">opsional</span></label><DateField id="po-req" name="requestedDate" defaultValue={head.requestedDate ?? ""} /></div>
          <div className="field span-2"><label htmlFor="po-ref">No. PO pelanggan <span className="help">bila ada</span></label><input id="po-ref" name="customerRef" defaultValue={head.customerRef} /></div>
          <div className="field span-2"><label htmlFor="po-project">Proyek <span className="help">opsional</span></label><input id="po-project" name="project" defaultValue={head.project} placeholder="mis. Perumahan Griya Asri blok C" /></div>
          <div className="field span-2"><label htmlFor="po-address">Alamat kirim</label><textarea id="po-address" name="address" rows={2} defaultValue={head.address} style={{ minHeight: 72 }} placeholder="Kosongkan bila diambil sendiri" /></div>
          <div className="field span-2">
            <label htmlFor="po-site">Kontak di lokasi <span className="help">nama &amp; telepon</span></label>
            <input id="po-site" name="siteContact" defaultValue={head.siteContact} />
            <label htmlFor="po-maps" style={{ marginTop: 8 }}>Tautan Google Maps <span className="help">opsional</span></label>
            <input id="po-maps" name="mapsUrl" type="url" defaultValue={head.mapsUrl} placeholder="https://maps.app.goo.gl/…" />
          </div>
        </div>
      </section>
      <section className="form-section">
        <h2>Barang dipesan</h2>
        <LinesEditor mode="order" items={items} initial={lines} initialDiscount={head.discount} initialOngkir={head.ongkir} initialTaxable={head.taxable} taxRate={taxRate} />
        <div className="field"><label htmlFor="po-note">Catatan <span className="help">dicetak di surat jalan</span></label><textarea id="po-note" name="note" rows={2} defaultValue={head.note} style={{ minHeight: 64 }} /></div>
      </section>
      <div className="form-actions">
        {isNew || head.status === "draft" ? (
          <>
            <SubmitButton name="intent" value="konfirmasi">Simpan &amp; konfirmasi</SubmitButton>
            <SubmitButton name="intent" value="draft" className="btn btn-ghost">Simpan sebagai draf</SubmitButton>
          </>
        ) : (
          <SubmitButton>Simpan perubahan</SubmitButton>
        )}
      </div>
    </ActionForm>
  );
}
