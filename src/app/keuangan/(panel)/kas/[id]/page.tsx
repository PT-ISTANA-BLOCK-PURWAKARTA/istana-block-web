import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { deleteCash } from "@/app/keuangan/actions/ledger";
import { ConfirmAction } from "@/components/erp/ConfirmAction";
import { JournalView } from "@/components/erp/JournalView";
import { BackLink, Ok, PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { journalFor } from "@/lib/erp/server";
import { formatAmount, terbilang, tgl } from "@/lib/erp/util";

export const metadata = { title: "Transaksi kas" };
const KIND = { masuk: "Kas masuk", keluar: "Kas keluar", transfer: "Transfer" } as const;

export default async function KasDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  await requireModule("keuangan");
  const { id } = await params;
  const { ok } = await searchParams;
  const db = await getDb();
  const c = await db.query.cashTxns.findFirst({ where: eq(schema.cashTxns.id, id) });
  if (!c) notFound();
  const [journal, contact] = await Promise.all([journalFor(db, "kas", id), c.contactId ? db.query.contacts.findFirst({ where: eq(schema.contacts.id, c.contactId) }) : undefined]);
  return (
    <>
      <BackLink href="/keuangan/kas">Kas &amp; bank</BackLink>
      <PageHead title={c.number} sub={KIND[c.kind]}>
        <Link href={`/keuangan/kas/${c.id}/ubah`} className="btn btn-ghost btn-sm">Ubah</Link>
      </PageHead>
      <Ok ok={ok} />
      <div className="stack" style={{ gap: 20 }}>
        <section className="admin-card doc-head">
          <div><span className="muted small">Tanggal</span><b>{tgl(c.date)}</b></div>
          <div><span className="muted small">Jumlah</span><b>Rp{formatAmount(c.amount)}</b><div className="small muted">{terbilang(c.amount)}</div></div>
          {contact && <div><span className="muted small">{c.kind === "masuk" ? "Dari" : "Kepada"}</span><b>{contact.name}</b></div>}
          {c.memo && <div className="span-all"><span className="muted small">Keterangan</span><p style={{ margin: 0 }}>{c.memo}</p></div>}
        </section>
        <JournalView lines={journal} title="Jurnal" />
        <div><ConfirmAction action={deleteCash.bind(null, c.id)} label="Hapus transaksi" confirmText={`Hapus ${c.number}?`} /></div>
      </div>
    </>
  );
}
