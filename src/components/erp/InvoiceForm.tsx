"use client";

import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { saveInvoice } from "@/app/akuntansi/actions/sales";
import { saveBill } from "@/app/akuntansi/actions/purchases";
import { LinesEditor, type EditorLine, type PickAccount, type PickItem } from "./LinesEditor";
import { DateField, Select } from "@/components/ui";

type Head = { id?: string; contactId?: string; date: string; dueDate?: string; note?: string; orderId?: string | null; supplierRef?: string; discount?: number; ongkir?: number; taxable?: boolean };

/** Formulir faktur penjualan (kind="sales") atau faktur pembelian (kind="purchase"). */
export function InvoiceForm({
  kind,
  head,
  lines,
  contacts,
  items,
  accounts = [],
  taxRate,
  orderLabel,
}: {
  kind: "sales" | "purchase";
  head: Head;
  lines: EditorLine[];
  contacts: { id: string; name: string; company: string }[];
  items: PickItem[];
  accounts?: PickAccount[];
  taxRate: number;
  orderLabel?: string;
}) {
  const sales = kind === "sales";
  return (
    <ActionForm action={sales ? saveInvoice : saveBill} className="stack" style={{ gap: 20 }}>
      {head.id && <input type="hidden" name="id" value={head.id} />}
      {head.orderId && <input type="hidden" name="orderId" value={head.orderId} />}
      <section className="form-section">
        <div className="form-grid cols-4">
          <div className="field span-2">
            <label htmlFor="iv-contact">{sales ? "Pelanggan" : "Pemasok"}</label>
            <Select id="iv-contact" name="contactId" defaultValue={head.contactId ?? ""} required searchable placeholder={sales ? "Pilih pelanggan…" : "Pilih pemasok…"} options={contacts.map((c) => ({ value: c.id, label: c.name, hint: c.company && c.company !== c.name ? c.company : undefined }))} />
          </div>
          <div className="field"><label htmlFor="iv-date">Tanggal</label><DateField id="iv-date" name="date" defaultValue={head.date} required /></div>
          <div className="field"><label htmlFor="iv-due">Jatuh tempo <span className="help">kosong = termin kontak</span></label><DateField id="iv-due" name="dueDate" defaultValue={head.dueDate} /></div>
          {!sales && <div className="field span-2"><label htmlFor="iv-ref">No. faktur pemasok</label><input id="iv-ref" name="supplierRef" defaultValue={head.supplierRef} /></div>}
          {orderLabel && <div className="field span-2"><span className="label">Dari pesanan</span><p className="tabular" style={{ margin: "10px 0" }}>{orderLabel}</p></div>}
        </div>
      </section>
      <section className="form-section">
        <h2>{sales ? "Barang & jasa" : "Rincian pembelian"}</h2>
        <LinesEditor
          mode={sales ? "sales" : "purchase"}
          items={items}
          accounts={accounts}
          initial={lines}
          initialDiscount={head.discount}
          initialOngkir={head.ongkir}
          initialTaxable={head.taxable}
          taxRate={taxRate}
        />
        <div className="field"><label htmlFor="iv-note">Catatan {sales && <span className="help">dicetak di faktur</span>}</label><textarea id="iv-note" name="note" rows={2} defaultValue={head.note} style={{ minHeight: 64 }} /></div>
      </section>
      <div className="form-actions"><SubmitButton>{head.id ? "Simpan perubahan" : sales ? "Simpan faktur" : "Simpan pembelian"}</SubmitButton></div>
    </ActionForm>
  );
}
