import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { deleteContact } from "@/app/keuangan/actions/master";
import { ConfirmAction } from "@/components/erp/ConfirmAction";
import { ContactForm } from "@/components/erp/ContactForm";
import { BackLink, PageHead, Status } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { opsAccess } from "@/lib/erp/ops";
import { tgl } from "@/lib/erp/util";

export const metadata = { title: "Pelanggan" };

export default async function PelangganDetail({ params }: { params: Promise<{ id: string }> }) {
  const { canEdit, canFinance } = await opsAccess();
  const { id } = await params;
  const db = await getDb();
  const c = await db.query.contacts.findFirst({ where: eq(schema.contacts.id, id) });
  if (!c) notFound();
  const orders = await db.select().from(schema.orders).where(eq(schema.orders.contactId, id)).orderBy(desc(schema.orders.date)).limit(50);
  async function remove() {
    "use server";
    await deleteContact("/operasional/pelanggan", id);
    redirect("/operasional/pelanggan?ok=dihapus");
  }
  return (
    <>
      <BackLink href="/operasional/pelanggan">Pelanggan</BackLink>
      <PageHead title={c.name} sub={c.active ? c.company || undefined : "Nonaktif"}>
        {canEdit && <Link href={`/operasional/pesanan/baru?kontak=${c.id}`} className="btn btn-primary btn-sm">+ Pesanan</Link>}
        {canFinance && <Link href={`/keuangan/kontak/${c.id}`} className="btn btn-ghost btn-sm">Lihat di keuangan</Link>}
      </PageHead>
      <div className="stack" style={{ gap: 20 }}>
        {canEdit ? <ContactForm c={c} back="/operasional/pelanggan" /> : (
          <section className="admin-card small"><p>{c.phone}</p><p className="pre">{c.address}</p></section>
        )}
        <section className="admin-table">
          <table>
            <caption>Riwayat pesanan</caption>
            <thead><tr><th>Pesanan</th><th>Tanggal</th><th>Proyek</th><th>Status</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}><td><Link href={`/operasional/pesanan/${o.id}`}><b>{o.number}</b></Link></td><td>{tgl(o.date)}</td><td className="small">{o.project}</td><td><Status s={o.status} /></td></tr>
              ))}
              {orders.length === 0 && <tr><td colSpan={4} className="muted">Belum ada pesanan.</td></tr>}
            </tbody>
          </table>
        </section>
        {canEdit && <div><ConfirmAction action={remove} label="Hapus / nonaktifkan pelanggan" confirmText={`Hapus ${c.name}? Bila sudah punya transaksi, pelanggan hanya dinonaktifkan.`} /></div>}
      </div>
    </>
  );
}
