import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { deleteDelivery } from "@/app/operasional/actions/deliveries";
import { ConfirmAction } from "@/components/erp/ConfirmAction";
import { JournalView } from "@/components/erp/JournalView";
import { BackLink, Ok, PageHead, Status } from "@/components/erp/ui";
import { DeliveryActions } from "@/components/ops/DeliveryActions";
import { getDb, schema } from "@/db";
import { deliveryItems, opsAccess } from "@/lib/erp/ops";
import { journalFor } from "@/lib/erp/server";
import { formatQty, tgl } from "@/lib/erp/util";

export const metadata = { title: "Surat jalan" };

const jam = (d: Date | null) => (d ? new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d) : "");

export default async function PengirimanDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const { canShip: canEdit, canLoad, canFinance } = await opsAccess();
  const { id } = await params;
  const { ok } = await searchParams;
  const db = await getDb();
  const d = await db.query.deliveries.findFirst({ where: eq(schema.deliveries.id, id) });
  if (!d) notFound();
  const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, d.orderId) });
  const [contact, vehicle, driver, items, journal] = await Promise.all([
    order ? db.query.contacts.findFirst({ where: eq(schema.contacts.id, order.contactId) }) : undefined,
    d.vehicleId ? db.query.vehicles.findFirst({ where: eq(schema.vehicles.id, d.vehicleId) }) : undefined,
    d.driverId ? db.query.drivers.findFirst({ where: eq(schema.drivers.id, d.driverId) }) : undefined,
    deliveryItems(db, [id]),
    canFinance ? journalFor(db, "pengiriman", id) : [],
  ]);
  const wa = driver?.phone ? `https://wa.me/${driver.phone.replace(/\D/g, "").replace(/^0/, "62")}` : null;
  return (
    <>
      <BackLink href="/operasional/pengiriman">Pengiriman</BackLink>
      <PageHead title={d.number} sub={<Status s={d.status} />}>
        <Link href={`/operasional/cetak/surat-jalan/${d.id}`} target="_blank" className="btn btn-ghost btn-sm">Cetak surat jalan</Link>
        {canEdit && d.status === "dijadwalkan" && <Link href={`/operasional/pengiriman/${d.id}/ubah`} className="btn btn-ghost btn-sm">Ubah jadwal</Link>}
      </PageHead>
      <Ok ok={ok} />
      <div className="stack" style={{ gap: 20 }}>
        <section className="admin-card doc-head">
          <div><span className="muted small">Pesanan</span><Link href={`/operasional/pesanan/${order?.id}`}><b>{order?.number}</b></Link>{order?.customerRef && <div className="small">PO {order.customerRef}</div>}</div>
          <div><span className="muted small">Pelanggan</span><b>{contact?.name}</b>{contact?.phone && <a className="small" href={`tel:${contact.phone}`}>{contact.phone}</a>}</div>
          <div><span className="muted small">Tanggal</span><b>{tgl(d.date)}</b>{d.departedAt && <div className="small">berangkat {jam(d.departedAt)}</div>}{d.deliveredAt && <div className="small">tiba {jam(d.deliveredAt)}</div>}</div>
          <div><span className="muted small">Armada</span><b>{vehicle?.plate ?? "—"}</b>{vehicle?.name && <div className="small">{vehicle.name}</div>}</div>
          <div><span className="muted small">Sopir</span><b>{driver?.name ?? "—"}</b>{wa && <a className="small" href={wa} target="_blank" rel="noopener noreferrer">WhatsApp ↗</a>}</div>
          <div style={{ maxWidth: 380 }}>
            <span className="muted small">Tujuan</span>
            {order?.project && <b>{order.project}</b>}
            <span className="pre small">{order?.address || "Diambil sendiri"}</span>
            {order?.siteContact && <div className="small">Kontak lokasi: {order.siteContact}</div>}
            {order?.mapsUrl && <a href={order.mapsUrl} target="_blank" rel="noopener noreferrer" className="small">Buka peta ↗</a>}
          </div>
        </section>

        <section className="admin-table">
          <table>
            <caption>Barang dikirim</caption>
            <thead><tr><th>Barang</th><th className="num">Qty</th></tr></thead>
            <tbody>
              {(items.get(id) ?? []).map((x, i) => (
                <tr key={i}><td><b>{x.name}</b></td><td className="num">{formatQty(x.qty)} {x.unit}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
        {(d.note || order?.note) && <section className="admin-card"><span className="muted small">Catatan</span><p className="pre" style={{ marginTop: 4 }}>{[d.note, order?.note].filter(Boolean).join("\n")}</p></section>}

        {(d.receivedBy || d.proofKey) && (
          <section className="admin-card stack" style={{ gap: 10 }}>
            <h2 style={{ fontSize: 17 }}>Bukti terima</h2>
            {d.receivedBy && <p>Diterima oleh <b>{d.receivedBy}</b>{d.deliveredAt ? ` · ${jam(d.deliveredAt)}` : ""}</p>}
            {d.proofKey && (
              <a href={`/operasional/bukti/${d.proofKey}`} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/operasional/bukti/${d.proofKey}`} alt={`Bukti terima ${d.number}`} className="proof-img" />
              </a>
            )}
          </section>
        )}

        {(canEdit || canLoad) && <DeliveryActions id={d.id} status={d.status} canShip={canEdit} />}

        {canFinance && <JournalView lines={journal} title="Jurnal harga pokok" />}

        {canEdit && (d.status === "dijadwalkan" || d.status === "batal") && (
          <div><ConfirmAction action={deleteDelivery.bind(null, d.id)} label="Hapus surat jalan" confirmText={`Hapus ${d.number} permanen?`} /></div>
        )}
      </div>
    </>
  );
}
