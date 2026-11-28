// Pendapatan U-Ditch → saldo Lina (keputusan pemilik 28/11: "jika revenue U-Ditch bertambah, saldo Lina ikut bertambah").
// Pembayaran Invoice U-Ditch (PT. Istana Block · U-Ditch, issuer "ud") otomatis tercatat di Operational U-Ditch sebagai
// uang masuk M03 (Penjualan U-Ditch & Produk) di TF Lina, atau Cash Lina bila dibayar tunai. Satu baris per invoice
// (source_key "invoice:<id>"), diperbarui saat pembayaran diubah, dihapus bila pembayaran dihapus / invoice dibatalkan /
// invoice dihapus. U-Ditch terpisah dari keuangan IB: tidak ada jurnal di buku besar IB. Padanan syncUditchIncome app lama.
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { invoiceTotals, wibDay, type InvoiceLine } from "@/lib/erp/salesInvoice";

type Db = Awaited<ReturnType<typeof getDb>>;

export const UDITCH_AUTO_BY = "Otomatis (invoice)";
/** Tunai → Cash Lina; selain itu (transfer, lainnya) → TF Lina. */
export const isCashPayment = (method: string | null | undefined) => /tunai|cash/i.test(method ?? "");

export async function syncUditchIncome(db: Db, invoiceId: string) {
  const key = `invoice:${invoiceId}`;
  const [inv, existing] = await Promise.all([
    db.query.salesInvoices.findFirst({ where: eq(schema.salesInvoices.id, invoiceId) }),
    db.query.uditchEntries.findFirst({ where: eq(schema.uditchEntries.sourceKey, key) }),
  ]);
  const paid = inv && inv.issuer === "ud" && inv.status !== "batal" ? Math.round(inv.paidAmount ?? 0) : 0;
  if (!inv || paid <= 0 || !inv.paidAt) {
    if (existing) await db.delete(schema.uditchEntries).where(eq(schema.uditchEntries.id, existing.id));
    return;
  }
  const items = inv.items as unknown as InvoiceLine[];
  const { grandTotal } = invoiceTotals(items, inv.ppnPercent, inv.downPaymentPercent, inv.downPaymentAmount);
  const cash = isCashPayment(inv.paymentMethod);
  const what = items.map((i) => `${i.name} ${Number(i.quantity).toLocaleString("id-ID")} ${i.unit}`).join(", ");
  const values = {
    entryDate: wibDay(inv.paidAt),
    account: cash ? "cash_lina" : "tf_lina",
    direction: "masuk",
    item: `${paid >= grandTotal ? "Pelunasan" : "DP"} invoice ${inv.number} — ${what}`.slice(0, 300),
    party: inv.customerName,
    total: paid,
    category: "M03",
    note: [`Otomatis dari pembayaran invoice ${inv.number}`, inv.paymentMethod].filter(Boolean).join(" · "),
    pic: cash ? null : "Lina",
    updatedByName: UDITCH_AUTO_BY,
  };
  if (existing) await db.update(schema.uditchEntries).set(values).where(eq(schema.uditchEntries.id, existing.id));
  else await db.insert(schema.uditchEntries).values({ ...values, sourceKey: key, createdByName: UDITCH_AUTO_BY });
}
