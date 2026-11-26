// Detail surat jalan (Keuangan): isi muatan, status perjalanan, penugasan sopir (oleh Operasional), riwayat, cetak.
import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { STATUS_LABEL } from "@/components/ops/delivery/status";
import { BackLink, PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { deliveryItems, isPosted } from "@/lib/erp/ops";
import { formatQty } from "@/lib/erp/util";

export const metadata = { title: "Surat Jalan" };
export const dynamic = "force-dynamic";

export default async function SuratJalanDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  await requireModule("keuangan");
  const { id } = await params;
  const sp = await searchParams;
  const db = await getDb();
  const d = await db.query.deliveries.findFirst({ where: eq(schema.deliveries.id, id) });
  if (!d) notFound();
  const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, d.orderId) });
  const [contact, driver, vehicle, items, history, inv] = await Promise.all([
    order ? db.query.contacts.findFirst({ where: eq(schema.contacts.id, order.contactId) }) : undefined,
    d.driverId ? db.query.drivers.findFirst({ where: eq(schema.drivers.id, d.driverId) }) : undefined,
    d.vehicleId ? db.query.vehicles.findFirst({ where: eq(schema.vehicles.id, d.vehicleId) }) : undefined,
    deliveryItems(db, [d.id]),
    db.select().from(schema.deliveryHistory).where(eq(schema.deliveryHistory.deliveryId, d.id)).orderBy(desc(schema.deliveryHistory.createdAt)).limit(30),
    db.get<{ id: string; number: string }>(sql`select id, number from ops_sales_invoices where order_id = ${d.orderId} limit 1`),
  ]);
  const posted = isPosted(d.status, d.departedAt);
  return (
    <>
      <BackLink href="/akuntansi/dokumen/surat-jalan">Surat Jalan</BackLink>
      <PageHead title={d.number} sub={`${contact?.name ?? "-"} · ${d.date} · ${STATUS_LABEL[d.status] ?? d.status}`}>
        <Link href={`/akuntansi/cetak/surat-jalan/${d.id}`} className="btn btn-blue btn-sm">Cetak / PDF</Link>
        {inv && <Link href={`/akuntansi/dokumen/invoice/${inv.id}`} className="btn btn-ghost btn-sm">Invoice {inv.number}</Link>}
      </PageHead>
      {sp.ok && <p className="alert alert-ok">Surat jalan dibuat dan dikirim ke Operasional untuk penugasan sopir.</p>}
      <dl className="kv">
        <dt>PO pengiriman</dt><dd>{order?.number ?? "-"}{order?.customerRef ? ` · PO pelanggan ${order.customerRef}` : ""}</dd>
        <dt>Alamat kirim</dt><dd className="pre">{order?.address || "-"}{order?.mapsUrl && <> · <a href={order.mapsUrl} target="_blank" rel="noreferrer">peta</a></>}</dd>
        {order?.siteContact && <><dt>Kontak lokasi</dt><dd>{order.siteContact}</dd></>}
        <dt>Sopir / armada</dt><dd>{driver ? `${driver.name}${vehicle ? ` · ${vehicle.plate}` : ""}` : <span className="muted">Belum ditugaskan — penugasan sopir dilakukan Operasional</span>}</dd>
        <dt>Stok keluar</dt><dd>{posted ? "Sudah tercatat keluar (truk berangkat)" : d.status === "batal" ? "Batal — tidak mengurangi stok" : "Tercatat saat truk dimuat & berangkat"}</dd>
        {d.note && <><dt>Catatan</dt><dd className="pre">{d.note}</dd></>}
      </dl>
      <div className="admin-table">
        <table>
          <thead><tr><th>No</th><th>Barang</th><th className="num">Qty</th><th>Satuan</th></tr></thead>
          <tbody>{(items.get(d.id) ?? []).map((l, i) => <tr key={i}><td>{i + 1}</td><td>{l.name}</td><td className="num">{formatQty(l.qty)}</td><td>{l.unit}</td></tr>)}</tbody>
        </table>
      </div>
      <h2 className="form-sub">Riwayat</h2>
      <ul className="small">
        {history.map((h) => <li key={h.id}>{h.createdAt.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" })} · {STATUS_LABEL[h.toStatus] ?? h.toStatus}{h.note ? ` — ${h.note}` : ""}</li>)}
      </ul>
    </>
  );
}
