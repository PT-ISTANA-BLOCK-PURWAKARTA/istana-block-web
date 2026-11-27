import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { CashForm } from "@/components/erp/CashForm";
import { ZahirCashForm } from "@/components/erp/ZahirCashForm";
import { BackLink, PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { cashPickers } from "@/lib/erp/cashList";
import { nextCashNumber, pickLists } from "@/lib/erp/server";
import { today } from "@/lib/erp/util";

export const metadata = { title: "Transaksi kas" };

export default async function KasBaru({ searchParams }: { searchParams: Promise<{ jenis?: string; ok?: string; last?: string }> }) {
  await requireModule("keuangan");
  const sp = await searchParams;
  const kind = sp.jenis === "masuk" || sp.jenis === "transfer" ? sp.jenis : "keluar";
  const db = await getDb();
  const lists = await pickLists(db);
  const cashAccounts = lists.pick((a) => a.group === "kas_bank");
  const otherAccounts = lists.pick((a) => a.group !== "kas_bank");
  const saved = sp.ok ? (
    <p className="alert alert-ok" role="status" style={{ marginBottom: 12 }}>
      Terekam: <b>{sp.ok}</b>{sp.last && <> · <Link href={`/akuntansi/kas/${sp.last}`}>lihat</Link></>}
    </p>
  ) : null;

  if (kind === "transfer") {
    const contacts = await db.select({ id: schema.contacts.id, name: schema.contacts.name }).from(schema.contacts).where(eq(schema.contacts.active, true)).orderBy(asc(schema.contacts.name));
    return (
      <>
        <BackLink href="/akuntansi/kas?jenis=transfer">Daftar Transfer Kas</BackLink>
        <PageHead title="Transfer antar kas/bank" />
        {saved}
        <CashForm kind="transfer" head={{ date: today() }} lines={[]} cashAccounts={cashAccounts} otherAccounts={otherAccounts} contacts={contacts} />
      </>
    );
  }
  const [pickers, number] = await Promise.all([cashPickers(db), nextCashNumber(db, kind)]);
  return (
    <>
      {saved}
      <ZahirCashForm
        key={sp.last ?? "baru"}
        kind={kind}
        head={{ date: today() }}
        lines={[]}
        cashAccounts={cashAccounts}
        accounts={otherAccounts}
        contacts={pickers.contacts}
        projects={pickers.projects}
        nextNumber={number}
      />
    </>
  );
}
