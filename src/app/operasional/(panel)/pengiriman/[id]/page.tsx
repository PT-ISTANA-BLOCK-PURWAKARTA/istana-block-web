import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq, or } from "drizzle-orm";
import { deleteDelivery } from "@/app/operasional/actions/deliveries";
import { ConfirmAction } from "@/components/erp/ConfirmAction";
import { JournalView } from "@/components/erp/JournalView";
import { BackLink, Ok, PageHead } from "@/components/erp/ui";
import { DeliveryActions } from "@/components/ops/DeliveryActions";
import { AssignForm } from "@/components/ops/delivery/AssignForm";
import { DeliveryStatusBadge } from "@/components/ops/delivery/StatusBadge";
import { ProofUploader } from "@/components/ops/delivery/ProofUploader";
import { Steps } from "@/components/ops/delivery/Steps";
import { TrackingShare } from "@/components/ops/delivery/TrackingShare";
import { STATUS_LABEL } from "@/components/ops/delivery/status";
import { getDb, schema } from "@/db";
import { MAX_DELIVERY_PROOFS } from "@/db/erp";
import { isArchive } from "@/lib/erp/archive";
import { deliveryItems, opsAccess } from "@/lib/erp/ops";
import { journalFor } from "@/lib/erp/server";
import { formatQty, tgl } from "@/lib/erp/util";
import { deliveryHistoryRows, deliveryProofKeys, proofRowCount, trackingSummary } from "@/lib/ops/deliveries";

export const metadata = { title: "Surat jalan" };

const stamp = (d: Date | number | null) =>
  d ? new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(typeof d === "number" ? new Date(d * 1000) : d) : "";

export default async function PengirimanDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const { canShip, canLoad: canLoadAccess, canFinance, perms } = await opsAccess();
  const { id } = await params;
  // Data arsip dari aplikasi lama: baca-saja, tanpa tombol ubah/status/sopir/bukti/tautan lacak/hapus.
  const archived = isArchive(id);
  const canEdit = canShip && !archived;
  const canLoad = canLoadAccess && !archived;
  const { ok } = await searchParams;
  const db = await getDb();
  const d = await db.query.deliveries.findFirst({ where: eq(schema.deliveries.id, id) });
  if (!d) notFound();
  const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, d.orderId) });
  const canAssign = canEdit && (d.status === "dijadwalkan" || d.status === "dimuat");
  const [contact, vehicle, driver, items, journal, history, proofKeys, uploadCount, track, vehicles, drivers] = await Promise.all([
    order ? db.query.contacts.findFirst({ where: eq(schema.contacts.id, order.contactId) }) : undefined,
    d.vehicleId ? db.query.vehicles.findFirst({ where: eq(schema.vehicles.id, d.vehicleId) }) : undefined,
    d.driverId ? db.query.drivers.findFirst({ where: eq(schema.drivers.id, d.driverId) }) : undefined,
    deliveryItems(db, [id]),
    canFinance ? journalFor(db, "pengiriman", id) : [],
    deliveryHistoryRows(db, id),
    deliveryProofKeys(db, id, d.proofKey),
    proofRowCount(db, id),
    canEdit ? trackingSummary(db, id) : undefined,
    canAssign ? db.select().from(schema.vehicles).where(d.vehicleId ? or(eq(schema.vehicles.active, true), eq(schema.vehicles.id, d.vehicleId)) : eq(schema.vehicles.active, true)).orderBy(asc(schema.vehicles.plate)) : [],
    canAssign ? db.select().from(schema.drivers).where(d.driverId ? or(eq(schema.drivers.active, true), eq(schema.drivers.id, d.driverId)) : eq(schema.drivers.active, true)).orderBy(asc(schema.drivers.name)) : [],
  ]);
  const wa = driver?.phone ? `https://wa.me/${driver.phone.replace(/\D/g, "").replace(/^0/, "62")}` : null;
  const lines = items.get(id) ?? [];
  // Teks bagikan untuk pelanggan: tanpa harga dan tanpa nomor telepon.
  const summary = [
    "Pengiriman Istana Block Purwakarta",
    `Surat jalan ${d.number}${contact?.name ? ` untuk ${contact.name}` : ""}`,
    lines.length ? `Muatan: ${lines.map((x) => `${formatQty(x.qty)} ${x.unit} ${x.name}`).join(", ")}` : "",
    order?.project || order?.address ? `Tujuan: ${order?.project || order?.address.split("\n")[0]}` : "",
    `Jadwal: ${tgl(d.date)}`,
  ].filter(Boolean).join("\n");
  const lastOpened = track?.lastAccessedAt ? stamp(track.lastAccessedAt) : null;
  const canDelete = canEdit && (d.status === "dijadwalkan" || d.status === "dimuat" || d.status === "batal");

  return (
    <>
      <BackLink href="/operasional/pengiriman">Pengiriman</BackLink>
      <PageHead title={d.number} sub={<DeliveryStatusBadge s={d.status} />}>
        <Link href={`/operasional/cetak/surat-jalan/${d.id}`} target="_blank" className="btn btn-ghost btn-sm">Cetak surat jalan</Link>
        {canEdit && d.status === "dijadwalkan" && <Link href={`/operasional/pengiriman/${d.id}/ubah`} className="btn btn-ghost btn-sm">Ubah jadwal</Link>}
      </PageHead>
      <Ok ok={ok} />
      {archived && <p className="flag flag-info">Arsip aplikasi lama. Surat jalan ini hanya bisa dilihat, tidak bisa diubah statusnya.</p>}
      <div className="stack" style={{ gap: 20 }}>
        {d.status === "batal" ? <p className="alert alert-error">Surat jalan ini dibatalkan.</p> : <section className="admin-card"><Steps status={d.status === "tertunda" ? (d.arrivedAt ? "tiba" : d.departedAt ? "berangkat" : d.loadedAt ? "dimuat" : "dijadwalkan") : d.status} /></section>}
        {d.status === "tertunda" && <p className="alert alert-warn">Tertunda{d.delayReason ? `: ${d.delayReason}` : ""}</p>}

        <section className="admin-card doc-head">
          <div><span className="muted small">Pesanan</span><Link href={`/operasional/pesanan/${order?.id}`}><b>{order?.number}</b></Link>{order?.customerRef && <div className="small">PO {order.customerRef}</div>}</div>
          <div><span className="muted small">Pelanggan</span><b>{contact?.name}</b>{contact?.phone && <a className="small" href={`tel:${contact.phone}`}>{contact.phone}</a>}</div>
          <div>
            <span className="muted small">Tanggal</span><b>{tgl(d.date)}</b>
            {d.loadedAt && <div className="small">dimuat {stamp(d.loadedAt)}</div>}
            {d.departedAt && <div className="small">berangkat {stamp(d.departedAt)}</div>}
            {d.arrivedAt && <div className="small">tiba {stamp(d.arrivedAt)}</div>}
            {d.deliveredAt && <div className="small">terkirim {stamp(d.deliveredAt)}</div>}
          </div>
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
              {lines.map((x, i) => (
                <tr key={i}><td><b>{x.name}</b></td><td className="num">{formatQty(x.qty)} {x.unit}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
        {(d.note || order?.note) && <section className="admin-card"><span className="muted small">Catatan</span><p className="pre" style={{ marginTop: 4 }}>{[d.note, order?.note].filter(Boolean).join("\n")}</p></section>}

        {(d.receivedBy || proofKeys.length > 0 || (canEdit && d.status !== "batal")) && (
          <section className="admin-card stack" style={{ gap: 10 }}>
            <h2 style={{ fontSize: 17 }}>Bukti terima {proofKeys.length > 0 && <span className="muted small">({proofKeys.length} foto)</span>}</h2>
            {d.receivedBy && <p>Diterima oleh <b>{d.receivedBy}</b>{d.deliveredAt ? ` · ${stamp(d.deliveredAt)}` : ""}</p>}
            {d.status === "terkirim" && !d.receivedBy && <p className="muted small">Diselesaikan dari kantor tanpa nama penerima.</p>}
            {proofKeys.length > 0 && (
              <div className="dl-proofs">
                {proofKeys.map((k, i) => (
                  <a key={k} href={`/operasional/bukti/${k}`} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/operasional/bukti/${k}`} alt={`Bukti ${d.number} foto ${i + 1}`} loading="lazy" />
                  </a>
                ))}
              </div>
            )}
            {canEdit && d.status !== "batal" && <ProofUploader id={d.id} count={uploadCount} max={MAX_DELIVERY_PROOFS} />}
          </section>
        )}

        {(canEdit || canLoad || (!archived && perms.has("selesaikan"))) && <DeliveryActions id={d.id} status={d.status} canShip={canEdit} canLoad={canLoad} canComplete={!archived && perms.has("selesaikan")} hasDriver={!!d.driverId} />}
        {canAssign && <AssignForm id={d.id} vehicleId={d.vehicleId} driverId={d.driverId} vehicles={vehicles} drivers={drivers} />}

        {canEdit && d.status !== "batal" && (
          <section className="admin-card stack" style={{ gap: 8 }}>
            <h2 style={{ fontSize: 17 }}>Tautan lacak untuk pelanggan</h2>
            <TrackingShare deliveryId={d.id} summary={summary} count={track?.count ?? 0} lastOpened={lastOpened} />
          </section>
        )}

        <section className="admin-card stack" style={{ gap: 10 }}>
          <h2 style={{ fontSize: 17 }}>Riwayat status</h2>
          <ol className="dl-timeline">
            {history.map((h) => (
              <li key={h.id}>
                <span className="dl-pin" aria-hidden="true" />
                <div>
                  <b>{h.fromStatus && h.fromStatus !== h.toStatus ? `${STATUS_LABEL[h.fromStatus as keyof typeof STATUS_LABEL] ?? h.fromStatus} → ` : ""}{STATUS_LABEL[h.toStatus as keyof typeof STATUS_LABEL] ?? h.toStatus}</b>
                  <div className="dl-when">{stamp(h.at)} · {h.who}</div>
                  {h.note && <div className="small">{h.note}</div>}
                </div>
              </li>
            ))}
            {history.length === 0 && <li><span className="dl-pin" aria-hidden="true" /><span className="muted small">Belum ada riwayat (surat jalan dibuat sebelum pencatatan riwayat).</span></li>}
          </ol>
        </section>

        {canFinance && <JournalView lines={journal} title="Jurnal harga pokok" />}

        {canDelete && (
          <div><ConfirmAction action={deleteDelivery.bind(null, d.id)} label="Hapus surat jalan" confirmText={`Hapus ${d.number} permanen?`} /></div>
        )}
      </div>
    </>
  );
}
