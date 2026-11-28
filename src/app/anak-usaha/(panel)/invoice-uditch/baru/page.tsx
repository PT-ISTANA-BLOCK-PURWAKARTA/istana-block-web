// Invoice U-Ditch baru / ubah (?id=): PT. Istana Block · U-Ditch (IN-UD-…), terpisah dari keuangan IB.
// Penanda tangan bawaan PIC U-Ditch (Lina); rekening diisi dari invoice U-Ditch terakhir.
import { eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { SalesInvoiceForm } from "@/components/erp/SalesInvoiceForm";
import { getDb, schema } from "@/db";
import { requireAnak } from "@/lib/auth";
import { invoiceNumber, UDITCH_BANK, wibDay, type InvoiceFormValue, type InvoiceLine } from "@/lib/erp/salesInvoice";
import { documentSigners, productNames } from "@/lib/erp/signers";
import { today } from "@/lib/erp/util";
import { can } from "@/lib/roles";
import { ZahirPage } from "@/components/erp/ZahirPage";

export const metadata = { title: "Invoice U-Ditch" };
export const dynamic = "force-dynamic";

export default async function InvoiceUditchBaru({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const user = await requireAnak("uditch", "keuangan");
  if (!can(user.roles, "keuangan") && !can(user.roles, "uditch")) notFound();
  const sp = await searchParams;
  const db = await getDb();
  const inv = sp.id ? await db.query.salesInvoices.findFirst({ where: eq(schema.salesInvoices.id, sp.id) }) : undefined;
  if (sp.id && (!inv || inv.issuer !== "ud")) notFound();
  const [signers, products, pic, m, last] = await Promise.all([
    documentSigners(db),
    productNames(db),
    db.get<{ id: number; name: string; signature_key: string | null }>(sql`select id, name, signature_key from users where roles like '%"uditch"%' order by id limit 1`),
    db.get<{ s: number }>(sql`select coalesce(max(seq), 0) s from ops_sales_invoices where issuer = 'ud'`),
    db.get<{ bank_name: string | null; bank_account: string | null }>(sql`select bank_name, bank_account from ops_sales_invoices where issuer = 'ud' and coalesce(bank_account, '') <> '' order by created_at desc limit 1`),
  ]);
  const allSigners = pic && !signers.some((s) => s.id === pic.id) ? [{ id: pic.id, name: pic.name, title: "PIC U-Ditch", hasSignature: Boolean(pic.signature_key) }, ...signers] : signers;
  const initial: InvoiceFormValue = inv
    ? {
        id: inv.id, number: inv.number, issuer: "ud", invoiceDate: wibDay(inv.invoiceDate), quotationId: "", customerName: inv.customerName, customerAddress: inv.customerAddress ?? "", customerPhone: inv.customerPhone ?? "", poNumber: inv.poNumber ?? "",
        items: (inv.items as unknown as InvoiceLine[]).map((i) => ({ name: i.name, unit: i.unit, quantity: String(i.quantity ?? ""), price: String(i.price ?? "") })),
        ppnPercent: inv.ppnPercent ? String(inv.ppnPercent) : "", dpMode: inv.downPaymentAmount ? "nominal" : inv.downPaymentPercent ? "persen" : "none",
        downPaymentPercent: inv.downPaymentPercent ? String(inv.downPaymentPercent) : "", downPaymentAmount: inv.downPaymentAmount ? String(inv.downPaymentAmount) : "",
        note: inv.note ?? "", bankName: inv.bankName ?? "", bankAccount: inv.bankAccount ?? "", signerId: inv.signerId ? String(inv.signerId) : "", signerName: inv.signerName ?? "",
      }
    : {
        number: "", issuer: "ud", invoiceDate: today(), quotationId: "", customerName: "", customerAddress: "", customerPhone: "", poNumber: "",
        items: [{ name: "", unit: "pcs", quantity: "", price: "" }],
        ppnPercent: "", dpMode: "none", downPaymentPercent: "", downPaymentAmount: "", note: "",
        bankName: last?.bank_name ?? UDITCH_BANK.name, bankAccount: last?.bank_account ?? UDITCH_BANK.account, signerId: pic ? String(pic.id) : "", signerName: pic?.name ?? "",
      };
  return (
    <ZahirPage title={inv ? `Ubah ${inv.number}` : "Invoice U-Ditch baru"} sub="PT. Istana Block · Invoice U-Ditch (IN-UD-…) · terpisah dari keuangan IB · pembayaran masuk saldo Lina (Operational U-Ditch)" hub={inv ? `/anak-usaha/invoice-uditch/${inv.id}` : "/anak-usaha/invoice-uditch"}>
      <SalesInvoiceForm initial={initial} signers={allSigners} products={products} nextNumber={{ ud: invoiceNumber(Number(m?.s ?? 0) + 1, "ud") }} issuers={[{ key: "ud", label: "PT. Istana Block · U-Ditch" }]} />
    </ZahirPage>
  );
}
