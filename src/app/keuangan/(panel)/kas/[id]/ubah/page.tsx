import { notFound } from "next/navigation";
import { asc, eq, or } from "drizzle-orm";
import { CashForm } from "@/components/erp/CashForm";
import { BackLink, PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { pickLists } from "@/lib/erp/server";

export const metadata = { title: "Ubah transaksi kas" };

export default async function UbahKas({ params }: { params: Promise<{ id: string }> }) {
  await requireModule("keuangan");
  const { id } = await params;
  const db = await getDb();
  const c = await db.query.cashTxns.findFirst({ where: eq(schema.cashTxns.id, id) });
  if (!c) notFound();
  const lines = await db.select().from(schema.cashLines).where(eq(schema.cashLines.cashId, id)).orderBy(asc(schema.cashLines.sort));
  const [lists, contacts] = await Promise.all([
    pickLists(db, [c.accountId, c.toAccountId, ...lines.map((l) => l.accountId)]),
    db.select({ id: schema.contacts.id, name: schema.contacts.name }).from(schema.contacts).where(c.contactId ? or(eq(schema.contacts.active, true), eq(schema.contacts.id, c.contactId)) : eq(schema.contacts.active, true)).orderBy(asc(schema.contacts.name)),
  ]);
  return (
    <>
      <BackLink href={`/keuangan/kas/${id}`}>{c.number}</BackLink>
      <PageHead title={`Ubah ${c.number}`} />
      <CashForm
        kind={c.kind}
        head={{ id: c.id, date: c.date, accountId: c.accountId, toAccountId: c.toAccountId, contactId: c.contactId, amount: c.amount, memo: c.memo }}
        lines={lines.map((l) => ({ accountId: l.accountId, memo: l.memo, amount: String(l.amount) }))}
        cashAccounts={lists.pick((a) => a.group === "kas_bank")}
        otherAccounts={lists.pick((a) => a.group !== "kas_bank")}
        contacts={contacts}
      />
    </>
  );
}
