import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { CashForm } from "@/components/erp/CashForm";
import { BackLink, PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { pickLists } from "@/lib/erp/server";
import { today } from "@/lib/erp/util";

export const metadata = { title: "Transaksi kas" };

const TITLE = { masuk: "Kas masuk", keluar: "Kas keluar", transfer: "Transfer antar kas/bank" } as const;

export default async function KasBaru({ searchParams }: { searchParams: Promise<{ jenis?: string }> }) {
  await requireModule("keuangan");
  const sp = await searchParams;
  const kind = sp.jenis === "masuk" || sp.jenis === "transfer" ? sp.jenis : "keluar";
  const db = await getDb();
  const [lists, contacts] = await Promise.all([pickLists(db), db.select({ id: schema.contacts.id, name: schema.contacts.name }).from(schema.contacts).where(eq(schema.contacts.active, true)).orderBy(asc(schema.contacts.name))]);
  return (
    <>
      <BackLink href="/keuangan/kas">Kas &amp; bank</BackLink>
      <PageHead title={TITLE[kind]}>
        <nav className="seg" aria-label="Jenis transaksi">
          {(["keluar", "masuk", "transfer"] as const).map((k) => (
            <Link key={k} href={`/keuangan/kas/baru?jenis=${k}`} aria-current={k === kind ? "page" : undefined}>{TITLE[k].split(" ")[0] === "Transfer" ? "Transfer" : TITLE[k]}</Link>
          ))}
        </nav>
      </PageHead>
      <CashForm
        kind={kind}
        head={{ date: today() }}
        lines={[]}
        cashAccounts={lists.pick((a) => a.group === "kas_bank")}
        otherAccounts={lists.pick((a) => a.group !== "kas_bank")}
        contacts={contacts}
      />
    </>
  );
}
