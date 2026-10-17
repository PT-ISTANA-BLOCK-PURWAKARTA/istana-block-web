import Link from "next/link";
import { and, asc, eq, like, or, sql } from "drizzle-orm";
import { ContactList } from "@/components/erp/ContactList";
import { Ok, PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";

export const metadata = { title: "Kontak" };

export default async function Kontak({ searchParams }: { searchParams: Promise<{ ok?: string; q?: string; jenis?: string; nonaktif?: string }> }) {
  await requireModule("keuangan");
  const { ok, q, jenis, nonaktif } = await searchParams;
  const db = await getDb();
  const where = and(
    q ? or(like(schema.contacts.name, `%${q}%`), like(schema.contacts.company, `%${q}%`), like(schema.contacts.phone, `%${q}%`)) : undefined,
    jenis === "pelanggan" || jenis === "pemasok" ? or(eq(schema.contacts.kind, jenis), eq(schema.contacts.kind, "keduanya")) : undefined,
    nonaktif ? undefined : eq(schema.contacts.active, true),
  );
  const rows = await db.select().from(schema.contacts).where(where).orderBy(asc(schema.contacts.name));
  const bal = await db.all<{ id: string; ar: number; ap: number }>(sql`
    select c.id,
      coalesce((select sum(total - paid) from fin_invoices where contact_id = c.id and void = 0),0) ar,
      coalesce((select sum(total - paid) from fin_bills where contact_id = c.id and void = 0),0) ap
    from fin_contacts c`);
  const balances = new Map(bal.map((b) => [b.id, { ar: Number(b.ar), ap: Number(b.ap) }]));
  return (
    <>
      <PageHead title="Kontak" sub="Pelanggan dan pemasok. Data ini juga dipakai modul operasional.">
        <Link href="/keuangan/kontak/baru" className="btn btn-primary btn-sm">+ Kontak</Link>
      </PageHead>
      <Ok ok={ok} />
      <ContactList rows={rows} balances={balances} base="/keuangan/kontak" q={q} jenis={jenis} nonaktif={!!nonaktif} />
    </>
  );
}
