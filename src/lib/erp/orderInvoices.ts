import "server-only";
// Invoice dokumen Keuangan (ops_sales_invoices) yang terkait PO / surat jalan — untuk menampilkan "Nilai invoice" di Operasional (lihat saja).
// Tautan: kolom order_id (invoice → surat jalan dibuat di Keuangan) atau daftar shipments {orderId, deliveryId} (termasuk data app lama).
import { and, isNotNull, like, ne, or } from "drizzle-orm";
import { schema } from "@/db";
import type { DB } from "./server";
import { INVOICE_STATUS_LABEL, invoiceTotals, type InvoiceLine } from "./salesInvoice";

export type LinkedInvoice = { id: string; number: string; issuer: string; status: string; statusLabel: string; date: Date; grandTotal: number; paid: number; remaining: number };

/** Peran yang boleh melihat nilai invoice di Operasional (bukan satpam/gudang/mandor/sopir). */
export const canSeeInvoiceValue = (perms: Set<string>) => ["keuangan", "pesanan", "pengiriman", "nilai_harga"].some((p) => perms.has(p));

/** Invoice (tanpa batal) per PO dan per surat jalan. */
export async function linkedInvoices(db: DB): Promise<{ byOrder: Map<string, LinkedInvoice[]>; byDelivery: Map<string, LinkedInvoice[]> }> {
  const t = schema.salesInvoices;
  const rows = await db
    .select({ id: t.id, number: t.number, issuer: t.issuer, status: t.status, date: t.invoiceDate, items: t.items, ppn: t.ppnPercent, dpPct: t.downPaymentPercent, dpAmt: t.downPaymentAmount, paid: t.paidAmount, orderId: t.orderId, shipments: t.shipments })
    .from(t)
    .where(and(ne(t.status, "batal"), or(isNotNull(t.orderId), like(t.shipments, "%orderId%"), like(t.shipments, "%deliveryId%"))));
  const byOrder = new Map<string, LinkedInvoice[]>();
  const byDelivery = new Map<string, LinkedInvoice[]>();
  const push = (m: Map<string, LinkedInvoice[]>, k: string, v: LinkedInvoice) => { const a = m.get(k); if (!a) m.set(k, [v]); else if (!a.includes(v)) a.push(v); };
  for (const r of rows) {
    const { grandTotal } = invoiceTotals((r.items ?? []) as unknown as InvoiceLine[], r.ppn, r.dpPct, r.dpAmt);
    const paid = r.status === "lunas" ? Math.max(grandTotal, Number(r.paid ?? 0)) : Number(r.paid ?? 0);
    const inv: LinkedInvoice = { id: r.id, number: r.number, issuer: r.issuer, status: r.status, statusLabel: INVOICE_STATUS_LABEL[r.status] ?? r.status, date: r.date, grandTotal, paid, remaining: r.status === "lunas" ? 0 : Math.max(0, grandTotal - paid) };
    if (r.orderId) push(byOrder, String(r.orderId), inv);
    for (const s of (Array.isArray(r.shipments) ? r.shipments : []) as { orderId?: string | number; deliveryId?: string | number }[]) {
      if (s?.orderId != null) push(byOrder, String(s.orderId), inv);
      if (s?.deliveryId != null) push(byDelivery, String(s.deliveryId), inv);
    }
  }
  return { byOrder, byDelivery };
}

export const sumInvoices = (a: LinkedInvoice[] | undefined) => (a ?? []).reduce((s, i) => ({ total: s.total + i.grandTotal, remaining: s.remaining + i.remaining }), { total: 0, remaining: 0 });
