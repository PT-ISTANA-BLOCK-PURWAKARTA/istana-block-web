import { asc } from "drizzle-orm";
import { GiroForm } from "@/components/erp/GiroForms";
import { BackLink, PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { contactsOfKind } from "@/lib/erp/server";
import { today } from "@/lib/erp/util";

export const metadata = { title: "Giro baru" };

export default async function GiroBaru({ searchParams }: { searchParams: Promise<{ jenis?: string }> }) {
  await requireModule("keuangan");
  const kind = (await searchParams).jenis === "keluar" ? "keluar" : "masuk";
  const db = await getDb();
  const contacts = await db.select().from(schema.contacts).where(contactsOfKind(kind === "masuk" ? "pelanggan" : "pemasok")).orderBy(asc(schema.contacts.name));
  return (
    <>
      <BackLink href={`/akuntansi/giro?jenis=${kind}`}>Giro {kind}</BackLink>
      <PageHead title={kind === "masuk" ? "Giro Masuk baru" : "Giro Keluar baru"} />
      <GiroForm kind={kind} contacts={contacts.map((c) => ({ value: c.id, label: c.name }))} date={today()} />
    </>
  );
}
