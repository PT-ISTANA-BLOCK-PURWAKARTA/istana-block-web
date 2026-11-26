// Detail retur: baris barang, penyelesaian, jurnal otomatis.
import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/erp/ActionButton";
import { BackLink, PageHead } from "@/components/erp/ui";
import { deleteReturn } from "@/app/akuntansi/actions/returnsGiro";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { SETTLEMENT_LABEL } from "@/lib/erp/returnsGiro";
import { journalFor } from "@/lib/erp/server";
import { formatAmount, formatQty, tgl } from "@/lib/erp/util";

export const metadata = { title: "Retur" };
export const dynamic = "force-dynamic";

export default async function ReturDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  await requireModule("keuangan");
  const { id } = await params;
  const sp = await searchParams;
  const db = await getDb();
  const r = await db.query.returns.findFirst({ where: eq(schema.returns.id, id) });
  if (!r) notFound();
  const [lines, j, info] = await Promise.all([
    db.select().from(schema.returnLines).where(eq(schema.returnLines.returnId, id)).orderBy(schema.returnLines.sort),
    journalFor(db, "retur", id),
    db.get<{ contact: string; doc: string | null; cash: string | null }>(sql`select c.name contact, coalesce(i.number, b.number) doc, a.code || ' ' || a.name cash
      from fin_returns r join fin_contacts c on c.id = r.contact_id left join fin_invoices i on i.id = r.invoice_id left join fin_bills b on b.id = r.bill_id left join fin_accounts a on a.id = r.cash_account_id where r.id = ${id}`),
  ]);
  const docHref = r.invoiceId ? `/akuntansi/penjualan/${r.invoiceId}` : r.billId ? `/akuntansi/pembelian/${r.billId}` : null;
  return (
    <>
      <BackLink href={`/akuntansi/retur?jenis=${r.kind}`}>Retur {r.kind}</BackLink>
      <PageHead title={r.number} sub={`${tgl(r.date)} · Retur ${r.kind} · ${info?.contact ?? ""}`}>
        <Link href={`/akuntansi/retur/baru?id=${r.id}`} className="btn btn-ghost btn-sm">Ubah</Link>
        <ActionButton action={deleteReturn.bind(null, r.id)} label="Hapus" confirmText={`Hapus retur ${r.number}?`} className="btn btn-ghost btn-sm" />
      </PageHead>
      {sp.ok && <p className="alert alert-ok">Tersimpan: {sp.ok}</p>}
      <section className="zd-card">
        <p>Faktur asal: {docHref && info?.doc ? <Link href={docHref}>{info.doc}</Link> : "-"} · Penyelesaian: <b>{SETTLEMENT_LABEL[r.settlement]}</b>{info?.cash ? ` (${info.cash})` : ""}</p>
        {r.memo && <p className="muted">{r.memo}</p>}
        <div className="admin-table"><table className="compact">
          <thead><tr><th>Barang</th><th className="num">Jumlah</th><th>Satuan</th><th className="num">Harga</th><th className="num">Nilai</th></tr></thead>
          <tbody>{lines.map((l) => <tr key={l.id}><td>{l.description}</td><td className="num">{formatQty(l.qty)}</td><td>{l.unit}</td><td className="num">{formatAmount(l.price)}</td><td className="num">{formatAmount(l.amount)}</td></tr>)}</tbody>
          <tfoot>
            <tr><th colSpan={4}>Subtotal</th><th className="num">{formatAmount(r.subtotal)}</th></tr>
            {r.tax > 0 && <tr><th colSpan={4}>PPN</th><th className="num">{formatAmount(r.tax)}</th></tr>}
            <tr><th colSpan={4}>Total retur</th><th className="num">{formatAmount(r.total)}</th></tr>
            {r.costBack > 0 && <tr><th colSpan={4}>Nilai pokok kembali ke gudang</th><th className="num">{formatAmount(r.costBack)}</th></tr>}
          </tfoot>
        </table></div>
      </section>
      <section className="zd-card" style={{ marginTop: 16 }}>
        <h2>Jurnal otomatis {j[0] && <Link href={`/akuntansi/jurnal/${j[0].journalId}`}>{j[0].number}</Link>}</h2>
        <div className="admin-table"><table className="compact">
          <thead><tr><th>Rekening</th><th>Keterangan</th><th className="num">Debit</th><th className="num">Kredit</th></tr></thead>
          <tbody>{j.map((l, i) => <tr key={i}><td>{l.code} {l.name}</td><td className="small">{l.memo}</td><td className="num">{formatAmount(l.debit, { blankZero: true })}</td><td className="num">{formatAmount(l.credit, { blankZero: true })}</td></tr>)}</tbody>
        </table></div>
      </section>
    </>
  );
}
