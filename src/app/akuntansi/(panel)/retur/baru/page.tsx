// Retur baru / ubah retur (?id=).
import { asc, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ReturnForm } from "@/components/erp/ReturnForm";
import { BackLink, PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { contactsOfKind, getFinSettings, loadAccounts } from "@/lib/erp/server";
import { today } from "@/lib/erp/util";

export const metadata = { title: "Retur" };
export const dynamic = "force-dynamic";

export default async function ReturBaru({ searchParams }: { searchParams: Promise<{ jenis?: string; id?: string; faktur?: string; kontak?: string }> }) {
  await requireModule("keuangan");
  const sp = await searchParams;
  const db = await getDb();
  const existing = sp.id ? await db.query.returns.findFirst({ where: eq(schema.returns.id, sp.id) }) : undefined;
  if (sp.id && !existing) notFound();
  const kind = existing?.kind ?? (sp.jenis === "pembelian" ? "pembelian" : "penjualan");
  const [contacts, fin, acc, lines] = await Promise.all([
    db.select().from(schema.contacts).where(contactsOfKind(kind === "penjualan" ? "pelanggan" : "pemasok", existing?.contactId)).orderBy(asc(schema.contacts.name)),
    getFinSettings(db),
    loadAccounts(db),
    existing ? db.select().from(schema.returnLines).where(eq(schema.returnLines.returnId, existing.id)).orderBy(schema.returnLines.sort) : Promise.resolve([]),
  ]);
  const docs = kind === "penjualan"
    ? await db.all<{ id: string; number: string; date: string; contactId: string; total: number; paid: number }>(sql`select id, number, date, contact_id contactId, total, paid from fin_invoices where void = 0 order by date desc limit 3000`)
    : await db.all<{ id: string; number: string; date: string; contactId: string; total: number; paid: number }>(sql`select id, number, date, contact_id contactId, total, paid from fin_bills where void = 0 order by date desc limit 3000`);
  const own = existing?.settlement === "potong_tagihan" ? existing.total : 0;
  const ownDoc = existing?.invoiceId ?? existing?.billId;
  const fromDoc = sp.faktur ? docs.find((d) => d.id === sp.faktur) : undefined;
  const lineAccounts = acc.rows.filter((a) => a.active && ["persediaan", "beban", "hpp", "aset_tetap", "aset_lancar_lain", "beban_lain"].includes(a.group)).sort((a, b) => a.code.localeCompare(b.code)).map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` }));
  return (
    <>
      <BackLink href={`/akuntansi/retur?jenis=${kind}`}>Retur {kind}</BackLink>
      <PageHead title={existing ? `Ubah ${existing.number}` : kind === "penjualan" ? "Retur Penjualan baru" : "Retur Pembelian baru"} />
      <ReturnForm
        kind={kind}
        value={{
          id: existing?.id, date: existing?.date ?? today(), contactId: existing?.contactId ?? fromDoc?.contactId ?? sp.kontak, docId: ownDoc ?? fromDoc?.id ?? null,
          settlement: existing?.settlement, cashAccountId: existing?.cashAccountId, memo: existing?.memo, ppn: existing ? existing.tax > 0 : false, costBack: existing?.costBack,
          lines: lines.map((l) => ({ description: l.description, qty: l.qty, unit: l.unit, price: l.price, accountId: l.accountId })),
        }}
        contacts={contacts.map((c) => ({ value: c.id, label: c.name }))}
        docs={docs.map((d) => ({ id: d.id, number: d.number, date: d.date, contactId: d.contactId, total: Number(d.total), left: Number(d.total) - Number(d.paid) + (d.id === ownDoc ? own : 0) }))}
        cash={acc.rows.filter((a) => a.group === "kas_bank" && a.active).map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` }))}
        lineAccounts={lineAccounts}
        defaultLineAccount={acc.sys("persediaan_bahan")}
        ppnRate={fin.ppnRate}
      />
    </>
  );
}
