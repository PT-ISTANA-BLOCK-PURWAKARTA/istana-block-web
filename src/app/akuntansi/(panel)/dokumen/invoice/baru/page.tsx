// Invoice baru / ubah (?id=) / dari surat penawaran (?penawaran=).
import { eq, sql } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { SalesInvoiceForm } from "@/components/erp/SalesInvoiceForm";
import { BackLink, PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { BANK_ACCOUNTS } from "@/lib/erp/quotation";
import { INVOICE_ISSUERS, invoiceNumber, LAST_MANUAL_INVOICE_SEQ, wibDay, type InvoiceFormValue, type InvoiceLine } from "@/lib/erp/salesInvoice";
import { documentSigners, productNames } from "@/lib/erp/signers";
import { today } from "@/lib/erp/util";

export const metadata = { title: "Invoice Penjualan" };
export const dynamic = "force-dynamic";

type QItem = { name: string; size?: string | null; unit: string; price: number; quantity?: number | null };

export default async function InvoiceBaru({ searchParams }: { searchParams: Promise<{ id?: string; penawaran?: string }> }) {
  await requireModule("keuangan");
  const sp = await searchParams;
  const db = await getDb();
  const inv = sp.id ? await db.query.salesInvoices.findFirst({ where: eq(schema.salesInvoices.id, sp.id) }) : undefined;
  if (sp.id && !inv) notFound();
  if (inv?.issuer === "ibn") redirect(`/anak-usaha/invoice-uditch/baru?id=${inv.id}`);
  const q = !inv && sp.penawaran ? await db.query.quotations.findFirst({ where: eq(schema.quotations.id, sp.penawaran) }) : undefined;
  const [signers, products, seqs] = await Promise.all([documentSigners(db), productNames(db), db.all<{ issuer: string; s: number }>(sql`select issuer, max(seq) s from ops_sales_invoices group by issuer`)]);
  // Keuangan menerbitkan invoice PT. Istana Block; invoice angkutan (Ekspedisi IB) dibuat di Anak Perusahaan.
  const issuers = INVOICE_ISSUERS.filter((i) => i.key === "ib" || i.key === inv?.issuer).map((i) => ({ key: i.key, label: i.label }));
  const nextNumber = Object.fromEntries(INVOICE_ISSUERS.map((i) => [i.key, invoiceNumber(Math.max(i.key === "ib" ? LAST_MANUAL_INVOICE_SEQ : 0, Number(seqs.find((s) => s.issuer === i.key)?.s ?? 0)) + 1, i.key)]));
  const initial: InvoiceFormValue = inv
    ? {
        id: inv.id, number: inv.number, issuer: inv.issuer, invoiceDate: wibDay(inv.invoiceDate), quotationId: inv.quotationId ?? "", customerName: inv.customerName, customerAddress: inv.customerAddress ?? "", customerPhone: inv.customerPhone ?? "", poNumber: inv.poNumber ?? "",
        items: (inv.items as unknown as InvoiceLine[]).map((i) => ({ name: i.name, unit: i.unit, quantity: String(i.quantity ?? ""), price: String(i.price ?? "") })),
        ppnPercent: inv.ppnPercent ? String(inv.ppnPercent) : "", dpMode: inv.downPaymentAmount ? "nominal" : inv.downPaymentPercent ? "persen" : "none",
        downPaymentPercent: inv.downPaymentPercent ? String(inv.downPaymentPercent) : "", downPaymentAmount: inv.downPaymentAmount ? String(inv.downPaymentAmount) : "",
        note: inv.note ?? "", bankName: inv.bankName ?? "", bankAccount: inv.bankAccount ?? "", signerId: inv.signerId ? String(inv.signerId) : "", signerName: inv.signerName ?? "",
      }
    : {
        number: "", issuer: "ib", invoiceDate: today(), quotationId: q?.id ?? "", customerName: q?.customerName ?? "", customerAddress: q?.customerAddress ?? "", customerPhone: q?.attnPhone || q?.customerPhone || "", poNumber: "",
        items: q ? (q.items as unknown as QItem[]).map((i) => ({ name: [i.name, i.size].filter(Boolean).join(" "), unit: i.unit, quantity: i.quantity ? String(i.quantity) : "", price: String(i.price ?? "") })) : [{ name: "", unit: "pcs", quantity: "", price: "" }],
        ppnPercent: "", dpMode: "none", downPaymentPercent: "", downPaymentAmount: "", note: "",
        bankName: q?.bankName ?? BANK_ACCOUNTS[0].name, bankAccount: q?.bankAccount ?? BANK_ACCOUNTS[0].account, signerId: q?.signerId ? String(q.signerId) : "", signerName: q?.signerName ?? "",
      };
  return (
    <>
      <BackLink href={inv ? `/akuntansi/dokumen/invoice/${inv.id}` : "/akuntansi/dokumen/invoice"}>Invoice Penjualan</BackLink>
      <PageHead title={inv ? `Ubah ${inv.number}` : q ? `Invoice dari ${q.number}` : "Invoice baru"} />
      <SalesInvoiceForm initial={initial} signers={signers} products={products} nextNumber={nextNumber} issuers={issuers} />
    </>
  );
}
