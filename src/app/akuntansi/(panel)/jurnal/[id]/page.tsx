import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { deleteJournal } from "@/app/akuntansi/actions/ledger";
import { ConfirmAction } from "@/components/erp/ConfirmAction";
import { BackLink, Ok, PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { SOURCE_LABEL, sourceHref } from "@/lib/erp/links";
import { formatAmount, tgl } from "@/lib/erp/util";

export const metadata = { title: "Jurnal" };

export default async function JurnalDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  await requireModule("keuangan");
  const { id } = await params;
  const { ok } = await searchParams;
  const db = await getDb();
  const j = await db.query.journals.findFirst({ where: eq(schema.journals.id, id) });
  if (!j) notFound();
  const lines = await db
    .select({ l: schema.journalLines, a: schema.accounts, c: schema.contacts })
    .from(schema.journalLines)
    .innerJoin(schema.accounts, eq(schema.accounts.id, schema.journalLines.accountId))
    .leftJoin(schema.contacts, eq(schema.contacts.id, schema.journalLines.contactId))
    .where(eq(schema.journalLines.journalId, id))
    .orderBy(asc(schema.journalLines.sort));
  const d = lines.reduce((s, x) => s + x.l.debit, 0);
  const manual = j.source === "manual";
  return (
    <>
      <BackLink href="/akuntansi/jurnal">Jurnal</BackLink>
      <PageHead title={j.number} sub={`${tgl(j.date)} · ${SOURCE_LABEL[j.source]}`}>
        {manual ? <Link href={`/akuntansi/jurnal/${j.id}/ubah`} className="btn btn-ghost btn-sm">Ubah</Link> : <Link href={sourceHref(j.source, j.sourceId, j.id)} className="btn btn-ghost btn-sm">Buka dokumen asal</Link>}
      </PageHead>
      <Ok ok={ok} />
      <div className="stack" style={{ gap: 20 }}>
        <section className="admin-card"><span className="muted small">Keterangan</span><p style={{ margin: "4px 0 0" }}>{j.memo}</p></section>
        <section className="admin-table">
          <table>
            <thead><tr><th>Akun</th><th>Kontak</th><th>Keterangan</th><th className="num">Debit</th><th className="num">Kredit</th></tr></thead>
            <tbody>
              {lines.map(({ l, a, c }) => (
                <tr key={l.id}>
                  <td><Link href={`/akuntansi/laporan/buku-besar?akun=${a.id}&from=${j.date}&to=${j.date}`}><span className="tabular muted">{a.code}</span> {a.name}</Link></td>
                  <td className="small">{c?.name}</td>
                  <td className="small">{l.memo}</td>
                  <td className="num">{formatAmount(l.debit, { blankZero: true })}</td>
                  <td className="num">{formatAmount(l.credit, { blankZero: true })}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><th colSpan={3}>Total</th><th className="num">{formatAmount(d)}</th><th className="num">{formatAmount(d)}</th></tr></tfoot>
          </table>
        </section>
        {manual && <div><ConfirmAction action={deleteJournal.bind(null, j.id)} label="Hapus jurnal" confirmText={`Hapus jurnal ${j.number}?`} /></div>}
      </div>
    </>
  );
}
