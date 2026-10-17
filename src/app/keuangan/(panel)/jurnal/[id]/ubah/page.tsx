import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { JournalForm } from "@/components/erp/JournalForm";
import { BackLink, PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { pickLists } from "@/lib/erp/server";

export const metadata = { title: "Ubah jurnal" };

export default async function UbahJurnal({ params }: { params: Promise<{ id: string }> }) {
  await requireModule("keuangan");
  const { id } = await params;
  const db = await getDb();
  const j = await db.query.journals.findFirst({ where: eq(schema.journals.id, id) });
  if (!j) notFound();
  if (j.source !== "manual") redirect(`/keuangan/jurnal/${id}`);
  const lines = await db.select().from(schema.journalLines).where(eq(schema.journalLines.journalId, id)).orderBy(asc(schema.journalLines.sort));
  const lists = await pickLists(db, lines.map((l) => l.accountId));
  return (
    <>
      <BackLink href={`/keuangan/jurnal/${id}`}>{j.number}</BackLink>
      <PageHead title={`Ubah ${j.number}`} />
      <JournalForm head={{ id: j.id, date: j.date, memo: j.memo }} lines={lines.map((l) => ({ accountId: l.accountId, memo: l.memo, debit: l.debit ? String(l.debit) : "", credit: l.credit ? String(l.credit) : "" }))} accounts={lists.pick()} />
    </>
  );
}
