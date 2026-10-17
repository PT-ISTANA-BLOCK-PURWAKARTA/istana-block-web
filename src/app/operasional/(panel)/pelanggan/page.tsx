import Link from "next/link";
import { and, asc, eq, like, or } from "drizzle-orm";
import { ContactList } from "@/components/erp/ContactList";
import { Ok, PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { opsAccess } from "@/lib/erp/ops";

export const metadata = { title: "Pelanggan" };

export default async function Pelanggan({ searchParams }: { searchParams: Promise<{ ok?: string; q?: string; nonaktif?: string }> }) {
  const { canOrders: canEdit } = await opsAccess();
  const { ok, q, nonaktif } = await searchParams;
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.contacts)
    .where(
      and(
        or(eq(schema.contacts.kind, "pelanggan"), eq(schema.contacts.kind, "keduanya")),
        q ? or(like(schema.contacts.name, `%${q}%`), like(schema.contacts.company, `%${q}%`), like(schema.contacts.phone, `%${q}%`)) : undefined,
        nonaktif ? undefined : eq(schema.contacts.active, true),
      ),
    )
    .orderBy(asc(schema.contacts.name));
  return (
    <>
      <PageHead title="Pelanggan" sub="Data yang sama dengan kontak di modul keuangan.">
        {canEdit && <Link href="/operasional/pelanggan/baru" className="btn btn-primary btn-sm">+ Pelanggan</Link>}
      </PageHead>
      <Ok ok={ok} />
      <ContactList rows={rows} base="/operasional/pelanggan" q={q} nonaktif={!!nonaktif} showJenis={false} />
    </>
  );
}
