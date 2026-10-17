import { asc } from "drizzle-orm";
import { InvoiceForm } from "@/components/erp/InvoiceForm";
import { BackLink, PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { EXPENSE_GROUPS } from "@/lib/erp/accounting";
import { contactsOfKind, getFinSettings, pickLists } from "@/lib/erp/server";
import { today } from "@/lib/erp/util";

export const metadata = { title: "Pembelian baru" };

export default async function PembelianBaru({ searchParams }: { searchParams: Promise<{ kontak?: string }> }) {
  await requireModule("keuangan");
  const sp = await searchParams;
  const db = await getDb();
  const [fin, lists, contacts] = await Promise.all([
    getFinSettings(db),
    pickLists(db),
    db.select({ id: schema.contacts.id, name: schema.contacts.name, company: schema.contacts.company }).from(schema.contacts).where(contactsOfKind("pemasok")).orderBy(asc(schema.contacts.name)),
  ]);
  return (
    <>
      <BackLink href="/keuangan/pembelian">Faktur pembelian</BackLink>
      <PageHead title="Faktur pembelian baru" sub="Bahan baku yang dilacak stoknya menambah persediaan; baris akun biaya langsung dibebankan." />
      <InvoiceForm
        kind="purchase"
        head={{ contactId: sp.kontak, date: today() }}
        lines={[]}
        contacts={contacts}
        items={lists.items}
        accounts={lists.pick((a) => EXPENSE_GROUPS.includes(a.group) && !a.systemKey?.startsWith("persediaan"))}
        taxRate={fin.ppnRate}
      />
    </>
  );
}
