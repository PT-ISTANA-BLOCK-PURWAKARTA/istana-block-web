import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { ConfirmAction } from "@/components/erp/ConfirmAction";
import { ContactForm } from "@/components/erp/ContactForm";
import { BackLink, PageHead, payStatus, Rp, Status } from "@/components/erp/ui";
import { deleteContact } from "@/app/akuntansi/actions/master";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { depositBalance, loadAccounts } from "@/lib/erp/server";
import { formatAmount, tgl } from "@/lib/erp/util";

export const metadata = { title: "Kontak" };

export default async function KontakDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireModule("keuangan");
  const { id } = await params;
  const db = await getDb();
  const c = await db.query.contacts.findFirst({ where: eq(schema.contacts.id, id) });
  if (!c) notFound();
  const acc = await loadAccounts(db);
  const [invoices, bills, depIn, depOut] = await Promise.all([
    db.select().from(schema.invoices).where(and(eq(schema.invoices.contactId, id), eq(schema.invoices.void, false))).orderBy(desc(schema.invoices.date)).limit(30),
    db.select().from(schema.bills).where(and(eq(schema.bills.contactId, id), eq(schema.bills.void, false))).orderBy(desc(schema.bills.date)).limit(30),
    depositBalance(db, acc.sys("uang_muka_pelanggan"), id, "credit"),
    depositBalance(db, acc.sys("uang_muka_pembelian"), id, "debit"),
  ]);
  const docs = [
    ...invoices.map((d) => ({ kind: "Faktur", href: `/akuntansi/penjualan/${d.id}`, ...d })),
    ...bills.map((d) => ({ kind: "Pembelian", href: `/akuntansi/pembelian/${d.id}`, ...d })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  async function remove() {
    "use server";
    await deleteContact("/akuntansi/kontak", id);
    redirect("/akuntansi/kontak?ok=dihapus");
  }
  return (
    <>
      <BackLink href="/akuntansi/kontak">Kontak</BackLink>
      <PageHead title={c.name} sub={c.active ? undefined : "Nonaktif"}>
        {c.kind !== "pemasok" && <Link href={`/akuntansi/penjualan/baru?kontak=${c.id}`} className="btn btn-primary btn-sm">+ Faktur</Link>}
        {c.kind !== "pemasok" && <Link href={`/akuntansi/penerimaan/baru?kontak=${c.id}`} className="btn btn-blue btn-sm">+ Penerimaan</Link>}
        {c.kind !== "pelanggan" && <Link href={`/akuntansi/pembelian/baru?kontak=${c.id}`} className="btn btn-ghost btn-sm">+ Pembelian</Link>}
      </PageHead>
      {(depIn > 0 || depOut > 0) && (
        <p className="alert alert-ok" style={{ marginBottom: 16 }}>
          {depIn > 0 && <>Uang muka dari pelanggan ini: <b>Rp{formatAmount(depIn)}</b>. </>}
          {depOut > 0 && <>Uang muka kita ke pemasok ini: <b>Rp{formatAmount(depOut)}</b>.</>}
        </p>
      )}
      <div className="stack" style={{ gap: 20 }}>
        <ContactForm c={c} back="/akuntansi/kontak" />
        <section className="admin-table">
          <table>
            <caption>Riwayat faktur</caption>
            <thead><tr><th>Tanggal</th><th>Dokumen</th><th>Status</th><th className="num">Total</th><th className="num">Sisa</th></tr></thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id}>
                  <td>{tgl(d.date)}</td>
                  <td><Link href={d.href}><b>{d.number}</b></Link><div className="small muted">{d.kind}</div></td>
                  <td><Status s={payStatus(d)} /></td>
                  <td className="num"><Rp n={d.total} /></td>
                  <td className="num"><Rp n={d.total - d.paid} /></td>
                </tr>
              ))}
              {docs.length === 0 && <tr><td colSpan={5} className="muted">Belum ada transaksi.</td></tr>}
            </tbody>
          </table>
        </section>
        <div><ConfirmAction action={remove} label="Hapus / nonaktifkan kontak" confirmText={`Hapus ${c.name}? Bila sudah punya transaksi, kontak hanya dinonaktifkan.`} /></div>
      </div>
    </>
  );
}
