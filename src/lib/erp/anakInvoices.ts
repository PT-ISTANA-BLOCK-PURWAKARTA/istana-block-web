// Daftar invoice anak perusahaan (Ekspedisi = eib, U-Ditch = ibn) untuk tampilan gaya Zahir: cari, rentang tanggal opsional.
import { and, desc, eq, gte, like, lt, or, sql } from "drizzle-orm";
import type { AnakInvoiceRow } from "@/components/erp/AnakInvoiceDaftar";
import { getDb, schema } from "@/db";
import { INVOICE_STATUS_LABEL, invoiceTotals, wibDay, type InvoiceLine } from "@/lib/erp/salesInvoice";
import { isDate } from "@/lib/erp/util";

const wibStart = (day: string) => new Date(`${day}T00:00:00+07:00`);

export async function anakInvoiceRows(issuer: "eib" | "ibn", sp: { q?: string; from?: string; to?: string }) {
  const db = await getDb();
  const q = (sp.q ?? "").trim();
  const from = isDate(sp.from) ? sp.from : "";
  const to = isDate(sp.to) ? sp.to : "";
  const t = schema.salesInvoices;
  const term = `%${q}%`;
  const list = await db
    .select()
    .from(t)
    .where(and(
      eq(t.issuer, issuer),
      q ? or(like(t.number, term), like(t.customerName, term), like(t.route, term), like(t.poNumber, term), sql`${t.items} like ${term}`) : undefined,
      from ? gte(t.invoiceDate, wibStart(from)) : undefined,
      to ? lt(t.invoiceDate, new Date(wibStart(to).getTime() + 86_400_000)) : undefined,
    ))
    .orderBy(desc(t.invoiceDate), desc(t.seq))
    .limit(1000);
  const rows: AnakInvoiceRow[] = list.map((r) => {
    const items = r.items as unknown as InvoiceLine[];
    const tot = invoiceTotals(items, r.ppnPercent, r.downPaymentPercent, r.downPaymentAmount);
    const goods = items.map((i) => `${i.name} ${Number(i.quantity).toLocaleString("id-ID")} ${i.unit}`).join(", ");
    return {
      id: r.id,
      number: r.number,
      date: wibDay(r.invoiceDate),
      customer: r.customerName,
      info: issuer === "eib" ? [r.route, items.map((i) => [i.plateNumber, i.cargo].filter(Boolean).join(" ")).filter(Boolean).join(", ")].filter(Boolean).join(" · ") || goods : goods,
      total: tot.grandTotal,
      paid: r.status === "batal" ? 0 : r.paidAmount ?? 0,
      status: r.status,
      statusLabel: INVOICE_STATUS_LABEL[r.status] ?? r.status,
    };
  });
  return { rows, q, from, to };
}
