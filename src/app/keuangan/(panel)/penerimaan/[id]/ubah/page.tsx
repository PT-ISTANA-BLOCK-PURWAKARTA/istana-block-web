import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { SettleForm } from "@/components/erp/SettleForm";
import { BackLink, PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { settleData } from "@/lib/erp/server";

export const metadata = { title: "Ubah penerimaan" };

export default async function Ubah({ params }: { params: Promise<{ id: string }> }) {
  await requireModule("keuangan");
  const { id } = await params;
  const db = await getDb();
  const r = await db.query.receipts.findFirst({ where: eq(schema.receipts.id, id) });
  if (!r) notFound();
  const contact = await db.query.contacts.findFirst({ where: eq(schema.contacts.id, r.contactId) });
  const data = await settleData(db, "receipt", r.contactId, r.id);
  return (
    <>
      <BackLink href={`/keuangan/penerimaan/${id}`}>{r.number}</BackLink>
      <PageHead title={`Ubah ${r.number}`} />
      <SettleForm
        kind="receipt"
        id={r.id}
        contactId={r.contactId}
        contactName={contact?.name ?? ""}
        date={r.date}
        accounts={data.accounts}
        depositAccountId={data.depositAccountId}
        depositBalance={data.depositBalance}
        initialAccountId={r.accountId}
        initialAmount={r.amount}
        memo={r.memo}
        docs={data.docs}
      />
    </>
  );
}
