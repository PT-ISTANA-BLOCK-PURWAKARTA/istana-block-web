import { notFound } from "next/navigation";
import { asc, eq, or } from "drizzle-orm";
import { CashForm } from "@/components/erp/CashForm";
import { ZahirCashForm } from "@/components/erp/ZahirCashForm";
import { cashPickers } from "@/lib/erp/cashList";
import { BackLink, PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { pickLists } from "@/lib/erp/server";
import { loadTags } from "@/lib/erp/tags";

export const metadata = { title: "Ubah transaksi kas" };

export default async function UbahKas({ params }: { params: Promise<{ id: string }> }) {
  await requireModule("keuangan");
  const { id } = await params;
  const db = await getDb();
  const c = await db.query.cashTxns.findFirst({ where: eq(schema.cashTxns.id, id) });
  if (!c) notFound();
  const lines = await db.select().from(schema.cashLines).where(eq(schema.cashLines.cashId, id)).orderBy(asc(schema.cashLines.sort));
  if (c.kind !== "transfer") {
    const [lists, pickers] = await Promise.all([pickLists(db, [c.accountId, ...lines.map((l) => l.accountId)]), cashPickers(db, c.contactId)]);
    return (
      <>
        <BackLink href={`/akuntansi/kas/${id}`}>{c.number}</BackLink>
        <ZahirCashForm
          kind={c.kind}
          head={{ id: c.id, number: c.number, date: c.date, accountId: c.accountId, contactId: c.contactId, projectId: c.projectId, memo: c.memo, status: c.status }}
          lines={lines.map((l) => ({ accountId: l.accountId, amount: l.amount.toLocaleString("id-ID"), projectId: l.projectId ?? "", memo: l.memo }))}
          cashAccounts={lists.pick((a) => a.group === "kas_bank")}
          accounts={lists.pick((a) => a.group !== "kas_bank")}
          contacts={pickers.contacts}
          projects={pickers.projects}
          nextNumber={c.number}
        />
      </>
    );
  }
  const [lists, tags, contacts] = await Promise.all([
    pickLists(db, [c.accountId, c.toAccountId, ...lines.map((l) => l.accountId)]),
    loadTags(db, { source: "kas", sourceId: id }),
    db.select({ id: schema.contacts.id, name: schema.contacts.name }).from(schema.contacts).where(c.contactId ? or(eq(schema.contacts.active, true), eq(schema.contacts.id, c.contactId)) : eq(schema.contacts.active, true)).orderBy(asc(schema.contacts.name)),
  ]);
  return (
    <>
      <BackLink href={`/akuntansi/kas/${id}`}>{c.number}</BackLink>
      <PageHead title={`Ubah ${c.number}`} />
      <CashForm
        kind={c.kind}
        head={{ id: c.id, number: c.number, date: c.date, accountId: c.accountId, toAccountId: c.toAccountId, contactId: c.contactId, amount: c.amount, memo: c.memo }}
        lines={lines.map((l) => ({ accountId: l.accountId, memo: l.memo, amount: String(l.amount) }))}
        cashAccounts={lists.pick((a) => a.group === "kas_bank")}
        otherAccounts={lists.pick((a) => a.group !== "kas_bank")}
        contacts={contacts}
        tags={tags}
      />
    </>
  );
}
