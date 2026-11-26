import { asc, eq } from "drizzle-orm";
import { InvoiceForm } from "@/components/erp/InvoiceForm";
import { BackLink, PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { EXPENSE_GROUPS } from "@/lib/erp/accounting";
import { contactsOfKind, getFinSettings, pickLists } from "@/lib/erp/server";
import { today } from "@/lib/erp/util";

export const metadata = { title: "Pembelian baru" };

export default async function PembelianBaru({ searchParams }: { searchParams: Promise<{ kontak?: string; po?: string }> }) {
  await requireModule("keuangan");
  const sp = await searchParams;
  const db = await getDb();
  const [fin, lists, contacts] = await Promise.all([
    getFinSettings(db),
    pickLists(db),
    db.select({ id: schema.contacts.id, name: schema.contacts.name, company: schema.contacts.company }).from(schema.contacts).where(contactsOfKind("pemasok")).orderBy(asc(schema.contacts.name)),
  ]);
  // Dari Pesanan Pembelian: baris barang ikut terisi.
  const poLines = sp.po ? await db.select().from(schema.purchaseOrderLines).where(eq(schema.purchaseOrderLines.orderId, sp.po)).orderBy(schema.purchaseOrderLines.sort) : [];
  return (
    <>
      <BackLink href="/akuntansi/pembelian">Faktur pembelian</BackLink>
      <PageHead title="Faktur pembelian baru" sub="Bahan baku yang dilacak stoknya menambah persediaan; baris akun biaya langsung dibebankan." />
      <InvoiceForm
        kind="purchase"
        head={{ contactId: sp.kontak, date: today() }}
        lines={poLines.map((l) => ({ ref: l.itemId ? `item:${l.itemId}` : "", description: l.description, qty: String(l.qty).replace(".", ","), unit: l.unit, price: String(l.price) }))}
        contacts={contacts}
        items={lists.items}
        accounts={lists.pick((a) => EXPENSE_GROUPS.includes(a.group) && !a.systemKey?.startsWith("persediaan"))}
        taxRate={fin.ppnRate}
      />
    </>
  );
}
