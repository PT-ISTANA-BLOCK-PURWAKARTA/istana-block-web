import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { BackLink, PageHead } from "@/components/erp/ui";
import { OrderForm } from "@/components/ops/OrderForm";
import { getDb, schema } from "@/db";
import { opsAccess } from "@/lib/erp/ops";
import { overdueByContact } from "@/lib/erp/insights";
import { contactsOfKind, getFinSettings, pickLists } from "@/lib/erp/server";
import { today } from "@/lib/erp/util";

export const metadata = { title: "Pesanan baru" };

export default async function PesananBaru({ searchParams }: { searchParams: Promise<{ kontak?: string }> }) {
  const { canOrders: canEdit } = await opsAccess();
  if (!canEdit) redirect("/operasional/pesanan");
  const sp = await searchParams;
  const db = await getDb();
  const [fin, lists, contacts, overdue] = await Promise.all([
    getFinSettings(db),
    pickLists(db),
    db
      .select({ id: schema.contacts.id, name: schema.contacts.name, company: schema.contacts.company, address: schema.contacts.address })
      .from(schema.contacts)
      .where(contactsOfKind("pelanggan"))
      .orderBy(asc(schema.contacts.name)),
    overdueByContact(db, today()),
  ]);
  const contact = sp.kontak ? contacts.find((c) => c.id === sp.kontak) : undefined;
  return (
    <>
      <BackLink href="/operasional/pesanan">Pesanan</BackLink>
      <PageHead title="Pesanan baru" sub="Harga mengikuti harga jual di data barang; ubah bila ada harga khusus." />
      <OrderForm
        head={{ date: today(), contactId: contact?.id, address: contact?.address ?? "" }}
        lines={[]}
        contacts={contacts}
        items={lists.items.filter((i) => i.kind === "barang_jadi" || i.kind === "jasa" || i.kind === "lainnya").map((i) => ({ ...i, buyPrice: 0 }))}
        taxRate={fin.ppnRate}
        overdue={Object.fromEntries(overdue)}
      />
    </>
  );
}
