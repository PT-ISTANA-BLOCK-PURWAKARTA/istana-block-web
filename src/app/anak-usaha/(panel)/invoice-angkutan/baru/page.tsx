// Invoice angkutan baru / ubah (?id=): Ekspedisi Istana Block, per baris mobil / sopir / barang dibawa.
import { eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { SalesInvoiceForm } from "@/components/erp/SalesInvoiceForm";
import { BackLink, PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { EIB_BANK, invoiceNumber, wibDay, type InvoiceFormValue, type InvoiceLine } from "@/lib/erp/salesInvoice";
import { documentSigners } from "@/lib/erp/signers";
import { today } from "@/lib/erp/util";
import { can } from "@/lib/roles";

export const metadata = { title: "Invoice Angkutan" };
export const dynamic = "force-dynamic";

export default async function InvoiceAngkutanBaru({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const user = await requireModule("anak");
  if (!can(user.roles, "keuangan") && !can(user.roles, "ekspedisi")) notFound();
  const sp = await searchParams;
  const db = await getDb();
  const inv = sp.id ? await db.query.salesInvoices.findFirst({ where: eq(schema.salesInvoices.id, sp.id) }) : undefined;
  if (sp.id && (!inv || inv.issuer !== "eib")) notFound();
  const [signers, pic, m] = await Promise.all([
    documentSigners(db),
    db.get<{ id: number; name: string; signature_key: string | null }>(sql`select id, name, signature_key from users where roles like '%"ekspedisi"%' order by id limit 1`),
    db.get<{ s: number }>(sql`select coalesce(max(seq), 0) s from ops_sales_invoices where issuer = 'eib'`),
  ]);
  const allSigners = pic && !signers.some((s) => s.id === pic.id) ? [{ id: pic.id, name: pic.name, title: "PIC Kendaraan", hasSignature: Boolean(pic.signature_key) }, ...signers] : signers;
  const initial: InvoiceFormValue = inv
    ? {
        id: inv.id, number: inv.number, issuer: "eib", invoiceDate: wibDay(inv.invoiceDate), quotationId: "", customerName: inv.customerName, customerAddress: inv.customerAddress ?? "", customerPhone: inv.customerPhone ?? "", poNumber: inv.poNumber ?? "",
        items: (inv.items as unknown as InvoiceLine[]).map((i) => ({ name: i.name, unit: i.unit, quantity: String(i.quantity ?? ""), price: String(i.price ?? ""), plateNumber: i.plateNumber ?? "", driverName: i.driverName ?? "", cargo: i.cargo ?? "" })),
        ppnPercent: inv.ppnPercent ? String(inv.ppnPercent) : "", dpMode: inv.downPaymentAmount ? "nominal" : inv.downPaymentPercent ? "persen" : "none",
        downPaymentPercent: inv.downPaymentPercent ? String(inv.downPaymentPercent) : "", downPaymentAmount: inv.downPaymentAmount ? String(inv.downPaymentAmount) : "",
        note: inv.note ?? "", bankName: EIB_BANK.name, bankAccount: EIB_BANK.account, signerId: inv.signerId ? String(inv.signerId) : "", signerName: inv.signerName ?? "", route: inv.route ?? "", shipDate: inv.shipDate ?? "",
      }
    : {
        number: "", issuer: "eib", invoiceDate: today(), quotationId: "", customerName: "", customerAddress: "", customerPhone: "", poNumber: "",
        items: [{ name: "Ongkos kirim", unit: "rit", quantity: "1", price: "", plateNumber: "", driverName: "", cargo: "" }],
        ppnPercent: "", dpMode: "none", downPaymentPercent: "", downPaymentAmount: "", note: "", bankName: EIB_BANK.name, bankAccount: EIB_BANK.account,
        signerId: pic ? String(pic.id) : "", signerName: pic?.name ?? "", route: "", shipDate: today(),
      };
  return (
    <>
      <BackLink href={inv ? `/anak-usaha/invoice-angkutan/${inv.id}` : "/anak-usaha/invoice-angkutan"}>Invoice Angkutan</BackLink>
      <PageHead title={inv ? `Ubah ${inv.number}` : "Invoice angkutan baru"} sub="Ekspedisi Istana Block" />
      <SalesInvoiceForm initial={initial} signers={allSigners} products={["Ongkos kirim", "Jasa angkut", "Sewa truk", "Sewa crane", "Jasa bongkar"]} nextNumber={{ eib: invoiceNumber(Number(m?.s ?? 0) + 1, "eib") }} issuers={[{ key: "eib", label: "Ekspedisi Istana Block" }]} />
    </>
  );
}
