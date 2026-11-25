"use client";

import { ActionForm } from "@/components/admin/ActionForm";
import { saveInvoice } from "@/app/akuntansi/actions/sales";
import { saveBill } from "@/app/akuntansi/actions/purchases";
import { LinesEditor, type EditorLine, type PickAccount, type PickItem } from "./LinesEditor";
import { DateField, Select } from "@/components/ui";
import { ZahirWindow } from "./ZahirWindow";

type Head = { id?: string; number?: string; contactId?: string; date: string; dueDate?: string; note?: string; orderId?: string | null; supplierRef?: string; discount?: number; ongkir?: number; taxable?: boolean };

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
    <ActionForm action={sales ? saveInvoice : saveBill}>
      <ZahirWindow
        title={sales ? "Faktur Penjualan" : "Faktur Pembelian"}
        icon={sales ? "invoice" : "cart"}
        number={head.number}
        newHref={sales ? "/akuntansi/penjualan/baru" : "/akuntansi/pembelian/baru"}
        closeHref={head.id ? `/akuntansi/${sales ? "penjualan" : "pembelian"}/${head.id}` : `/akuntansi/${sales ? "penjualan" : "pembelian"}`}
        printHref={head.id ? `/akuntansi/${sales ? "penjualan" : "pembelian"}/${head.id}` : null}
        status={head.id ? (sales ? "Jurnal faktur ini dibuat ulang saat disimpan." : "Jurnal dan stok masuk dari faktur ini dibuat ulang saat disimpan.") : sales ? "Nomor faktur dibuat otomatis saat disimpan." : "Bahan baku yang dilacak stoknya menambah persediaan; baris rekening biaya langsung dibebankan."}
      >
      {head.id && <input type="hidden" name="id" value={head.id} />}
      {head.orderId && <input type="hidden" name="orderId" value={head.orderId} />}
      <section className="zw-head">
        <div className="zw-fields">
          <div className="field span-2">
            <label htmlFor="iv-contact">{sales ? "Pelanggan" : "Pemasok"}</label>
            <Select id="iv-contact" name="contactId" defaultValue={head.contactId ?? ""} required searchable placeholder={sales ? "Pilih pelanggan…" : "Pilih pemasok…"} options={contacts.map((c) => ({ value: c.id, label: c.name, hint: c.company && c.company !== c.name ? c.company : undefined }))} />
          </div>
          <div className="field"><label htmlFor="iv-date">Tanggal</label><DateField id="iv-date" name="date" defaultValue={head.date} required /></div>
          <div className="field"><label htmlFor="iv-due">Jatuh Tempo</label><DateField id="iv-due" name="dueDate" defaultValue={head.dueDate} /></div>
          {!sales && <div className="field span-2"><label htmlFor="iv-ref">No. Faktur Pemasok</label><input id="iv-ref" name="supplierRef" defaultValue={head.supplierRef} /></div>}
          {orderLabel && <div className="field span-2"><span className="label">No. Pesanan</span><p className="tabular" style={{ margin: "10px 0" }}>{orderLabel}</p></div>}
        </div>
      </section>
      <section className="zw-grid">
        <LinesEditor
          mode={sales ? "sales" : "purchase"}
          items={items}
          accounts={accounts}
          initial={lines}
          initialDiscount={head.discount}
          initialOngkir={head.ongkir}
          initialTaxable={head.taxable}
          taxRate={taxRate}
          zahir
        />
        <div className="field"><label htmlFor="iv-note">Keterangan {sales && <span className="help">dicetak di faktur</span>}</label><textarea id="iv-note" name="note" rows={2} defaultValue={head.note} style={{ minHeight: 64 }} /></div>
      </section>
      </ZahirWindow>
    </ActionForm>
  );
}
