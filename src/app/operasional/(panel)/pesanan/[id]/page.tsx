import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import { setOrderStatus } from "@/app/operasional/actions/orders";
import { ConfirmAction } from "@/components/erp/ConfirmAction";
import { BackLink, Ok, PageHead, payStatus, Rp, Status } from "@/components/erp/ui";
import { isPosted } from "@/components/ops/delivery/status";
import { OrderDanger } from "@/components/ops/order/OrderDanger";
import { PaymentBadge } from "@/components/ops/order/PaymentBadge";
import { ShareOrderButton } from "@/components/ops/order/ShareOrderButton";
import { getDb, schema } from "@/db";
import { isArchive } from "@/lib/erp/archive";
import { docTotals } from "@/lib/erp/docs";
import { overdueByContact, stockPosition } from "@/lib/erp/insights";
import { deliveryItems, opsAccess } from "@/lib/erp/ops";
import { orderProgress } from "@/lib/erp/orders";
import { depositBalance, getFinSettings, loadAccounts } from "@/lib/erp/server";
import { formatAmount, formatQty, tgl, today } from "@/lib/erp/util";
import { formatDateTime } from "@/lib/ops/shared/format";

export const metadata = { title: "Pesanan" };
const EPS = 1e-9;

export default async function PesananDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const { canOrders, canShip: canShipAccess, canFinance } = await opsAccess();
  // Harga terlihat oleh keuangan dan peran yang mengisi harga di form PO (izin pesanan).
  const canPrice = canFinance || canOrders;
  const { id } = await params;
  // Data arsip dari aplikasi lama: baca-saja, tanpa tombol ubah/status/batal/hapus/jadwal/faktur.
  const archived = isArchive(id);
  const canEdit = canOrders && !archived;
  const canShip = canShipAccess && !archived;
  const { ok } = await searchParams;
  const db = await getDb();
  const o = await db.query.orders.findFirst({ where: eq(schema.orders.id, id) });
  if (!o) notFound();
  const [contact, prog, deliveries, invoices, fin, acc] = await Promise.all([
    db.query.contacts.findFirst({ where: eq(schema.contacts.id, o.contactId) }),
    orderProgress(db, id),
    db
      .select({ d: schema.deliveries, plate: schema.vehicles.plate, driver: schema.drivers.name, driverPhone: schema.drivers.phone })
      .from(schema.deliveries)
      .leftJoin(schema.vehicles, eq(schema.vehicles.id, schema.deliveries.vehicleId))
      .leftJoin(schema.drivers, eq(schema.drivers.id, schema.deliveries.driverId))
      .where(eq(schema.deliveries.orderId, id))
      .orderBy(desc(schema.deliveries.date), desc(schema.deliveries.number)),
    db.select().from(schema.invoices).where(and(eq(schema.invoices.orderId, id), eq(schema.invoices.void, false))).orderBy(desc(schema.invoices.date)),
    getFinSettings(db),
    loadAccounts(db),
  ]);
  const [items, stock, overdue] = await Promise.all([deliveryItems(db, deliveries.map((x) => x.d.id)), stockPosition(db), overdueByContact(db, today())]);
  const whoIds = [o.paymentConfirmedBy, o.cancelledBy].filter((x): x is number => x != null);
  const who = new Map((whoIds.length ? await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(inArray(schema.users.id, whoIds)) : []).map((u) => [u.id, u.name]));
  const free = new Map(stock.map((s) => [s.id, s.free]));
  const late = overdue.get(o.contactId);
  const deposit = canFinance ? await depositBalance(db, acc.sys("uang_muka_pelanggan"), o.contactId, "credit") : 0;
  const t = docTotals(prog, { discount: o.discount, ongkir: o.ongkir, taxable: o.taxable, taxRate: fin.ppnRate });
  const open = o.status === "dikonfirmasi" || o.status === "dikirim_sebagian" || o.status === "terkirim";
  const canSchedule = (o.status === "dikonfirmasi" || o.status === "dikirim_sebagian") && prog.some((p) => p.scheduled + EPS < p.qty);
  const canInvoice = canFinance && !archived && o.status !== "draft" && o.status !== "batal" && prog.some((p) => p.invoiced + EPS < (p.delivered > EPS ? p.delivered : p.qty));
  // Surat jalan belum selesai: dijadwalkan, dimuat, berangkat, tiba, tertunda.
  const activeTrips = deliveries.some((x) => x.d.status !== "terkirim" && x.d.status !== "batal");
  // Barang sudah keluar gudang (terposting) atau terkirim.
  const shippedAny = deliveries.some((x) => x.d.status === "terkirim" || isPosted(x.d.status, x.d.departedAt));
  const live = deliveries.find((x) => x.d.status !== "terkirim" && x.d.status !== "batal");
  const share = {
    number: o.number,
    customerName: contact?.name ?? "",
    customerPhone: contact?.phone ?? "",
    lines: prog.map((p) => ({ name: p.name, qty: p.qty, unit: p.unit })),
    address: o.address,
    mapsUrl: o.mapsUrl,
    requestedDate: live?.d.date ?? o.requestedDate,
    driverName: live?.driver ?? null,
    driverPhone: live?.driverPhone ?? null,
    plate: live?.plate ?? null,
    trackDeliveryId: canShip && live ? live.d.id : null,
    trackDeliveryNumber: live?.d.number ?? null,
  };
  const canCancel = canEdit && o.status !== "batal" && o.status !== "selesai" && o.status !== "terkirim" && !shippedAny && invoices.length === 0;
  const canDelete = canEdit && !shippedAny && invoices.length === 0;

  return (
    <>
      <BackLink href="/operasional/pesanan">Pesanan</BackLink>
      <PageHead title={o.number} sub={<><Status s={o.status} /> <PaymentBadge status={o.paymentStatus} long /></>}>
        {canShip && canSchedule && <Link href={`/operasional/pengiriman/baru?pesanan=${o.id}`} className="btn btn-primary btn-sm">+ Jadwalkan pengiriman</Link>}
        {canInvoice && <Link href={`/akuntansi/penjualan/baru?pesanan=${o.id}`} className="btn btn-blue btn-sm">Buat faktur</Link>}
        {canFinance && o.status !== "batal" && <Link href={`/akuntansi/penerimaan/baru?kontak=${o.contactId}`} className="btn btn-ghost btn-sm">Catat DP / pembayaran</Link>}
        {canEdit && o.status !== "batal" && o.status !== "selesai" && <Link href={`/operasional/pesanan/${o.id}/ubah`} className="btn btn-ghost btn-sm">Ubah</Link>}
      </PageHead>
      <Ok ok={ok} />
      {archived && <p className="flag flag-info" style={{ marginBottom: 16 }}>Arsip aplikasi lama. Pesanan ini hanya bisa dilihat, tidak bisa diubah, dijadwalkan kirim, atau difaktur.</p>}
      {o.status === "draft" && (
        <p className="alert alert-ok" style={{ marginBottom: 16, background: "var(--biru-muda)", color: "var(--biru-tua)" }}>
          Pesanan masih draf. Konfirmasi dulu agar bisa dijadwalkan kirim.
        </p>
      )}
      {o.status === "batal" && o.cancelReason && (
        <p className="flag flag-warn" style={{ marginBottom: 16 }}>
          Dibatalkan{o.cancelledBy != null && who.get(o.cancelledBy) ? ` oleh ${who.get(o.cancelledBy)}` : ""}{o.cancelledAt ? ` pada ${formatDateTime(o.cancelledAt)}` : ""}. Alasan: {o.cancelReason}
        </p>
      )}
      {o.paymentStatus && o.paymentConfirmedBy != null && (
        <p className="flag flag-info" style={{ marginBottom: 16 }}>
          Status bayar &quot;{o.paymentStatus === "belum_lunas" ? "belum lunas" : o.paymentStatus === "tidak_diketahui" ? "tidak terbaca" : o.paymentStatus}&quot; dari faktur Zahir dikonfirmasi oleh {who.get(o.paymentConfirmedBy) ?? "pengguna"}{o.paymentConfirmedAt ? ` pada ${formatDateTime(o.paymentConfirmedAt)}` : ""}.
        </p>
      )}
      {late && o.status !== "selesai" && o.status !== "batal" && (
        <p className="flag flag-warn" style={{ marginBottom: 16 }}>
          Pelanggan ini punya {late.n} faktur lewat jatuh tempo (tertua {tgl(late.oldest)}). Koordinasikan dengan bagian keuangan sebelum mengirim lagi.
        </p>
      )}
      <div className="stack" style={{ gap: 16 }}>
        <section className="admin-card doc-head">
          <div><span className="muted small">Pelanggan</span><Link href={`/operasional/pelanggan/${contact?.id}`}><b>{contact?.name}</b></Link>{contact?.company && <div className="small">{contact.company}</div>}{contact?.phone && <div className="small"><a href={`tel:${contact.phone}`}>{contact.phone}</a></div>}</div>
          <div><span className="muted small">Tanggal pesanan</span><b>{tgl(o.date)}</b>{o.requestedDate && <div className="small">minta kirim {tgl(o.requestedDate)}</div>}</div>
          {o.customerRef && <div><span className="muted small">No. PO pelanggan</span><b>{o.customerRef}</b></div>}
          {o.externalRef && <div><span className="muted small">Dokumen Zahir</span><b>{o.externalRef}</b></div>}
          {o.project && <div><span className="muted small">Proyek</span><b>{o.project}</b></div>}
          <div style={{ maxWidth: 360 }}>
            <span className="muted small">Alamat kirim</span>
            <span className="pre">{o.address || "Diambil sendiri / belum diisi"}</span>
            {o.siteContact && <div className="small">Kontak lokasi: {o.siteContact}</div>}
            {o.mapsUrl && <a href={o.mapsUrl} target="_blank" rel="noopener noreferrer" className="small">Buka peta ↗</a>}
          </div>
          {canFinance && deposit > 0 && <div><span className="muted small">Uang muka pelanggan</span><b><Rp n={deposit} /></b></div>}
        </section>

        {o.status !== "batal" && (
          <div className="stack" style={{ gap: 10, alignItems: "flex-start" }}>
            <ShareOrderButton info={share} />
          </div>
        )}

        <section className="admin-table">
          <table>
            <caption>Barang</caption>
            <thead><tr><th>Barang</th><th className="num">Dipesan</th><th className="num">Dijadwalkan</th><th className="num">Stok bebas</th><th className="num">Dikirim</th><th className="num">Diterima</th><th className="num">Difaktur</th>{canPrice && <><th className="num">Harga</th><th className="num">Jumlah</th></>}</tr></thead>
            <tbody>
              {prog.map((p) => (
                <tr key={p.id}>
                  <td><b>{p.name}</b>{p.description && <div className="small muted">{p.description}</div>}</td>
                  <td className="num">{formatQty(p.qty)} {p.unit}</td>
                  <td className="num">{formatQty(p.scheduled)}</td>
                  <td className="num small">
                    {free.has(p.itemId) ? (
                      <span className={p.scheduled + EPS < p.qty && (free.get(p.itemId) ?? 0) < p.qty - p.scheduled ? "text-warn" : "muted"}>{formatQty(free.get(p.itemId) ?? 0)}</span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="num">{formatQty(p.shipped)}</td>
                  <td className={`num${p.delivered + EPS >= p.qty ? " text-sukses" : ""}`}>{formatQty(p.delivered)}</td>
                  <td className="num">{formatQty(p.invoiced)}</td>
                  {canPrice && <td className="num"><Rp n={p.price} /></td>}
                  {canPrice && <td className="num"><Rp n={Math.round(p.qty * p.price)} /></td>}
                </tr>
              ))}
            </tbody>
            {canPrice && (
              <tfoot>
                <tr><td colSpan={8} className="num">Subtotal</td><td className="num"><Rp n={t.subtotal} /></td></tr>
                {t.discount > 0 && <tr><td colSpan={8} className="num">Diskon</td><td className="num"><Rp n={-t.discount} /></td></tr>}
                {t.ongkir > 0 && <tr><td colSpan={8} className="num">Ongkos kirim</td><td className="num"><Rp n={t.ongkir} /></td></tr>}
                {o.taxable && <tr><td colSpan={8} className="num">PPN {formatQty(fin.ppnRate)}% (perkiraan)</td><td className="num"><Rp n={t.tax} /></td></tr>}
                <tr><th colSpan={8} className="num">Nilai pesanan</th><th className="num"><Rp n={t.total} strong /></th></tr>
              </tfoot>
            )}
          </table>
        </section>
        {o.note && <section className="admin-card"><span className="muted small">Catatan</span><p className="pre" style={{ marginTop: 4 }}>{o.note}</p></section>}

        <section className="admin-table">
          <table>
            <caption>Surat jalan</caption>
            <thead><tr><th>Nomor</th><th>Tanggal</th><th>Isi</th><th>Armada &amp; sopir</th><th>Status</th></tr></thead>
            <tbody>
              {deliveries.map(({ d, plate, driver }) => (
                <tr key={d.id} className={d.status === "batal" ? "row-muted" : undefined}>
                  <td><Link href={`/operasional/pengiriman/${d.id}`}><b>{d.number}</b></Link></td>
                  <td>{tgl(d.date)}</td>
                  <td className="small">{(items.get(d.id) ?? []).map((x, i) => <div key={i}><b className="tabular">{formatQty(x.qty)} {x.unit}</b> · {x.name}</div>)}</td>
                  <td className="small">{plate ?? "—"}<div className="muted">{driver ?? ""}</div></td>
                  <td><Status s={d.status} />{d.receivedBy && <div className="small muted">diterima {d.receivedBy}</div>}</td>
                </tr>
              ))}
              {deliveries.length === 0 && <tr><td colSpan={5} className="muted">Belum ada surat jalan.{canShip && canSchedule && <> <Link href={`/operasional/pengiriman/baru?pesanan=${o.id}`}>Jadwalkan sekarang</Link>.</>}</td></tr>}
            </tbody>
          </table>
        </section>

        {canFinance && (
          <section className="admin-table">
            <table className="compact">
              <caption>Faktur</caption>
              <thead><tr><th>Nomor</th><th>Tanggal</th><th>Status bayar</th><th className="num">Total</th><th className="num">Sisa</th></tr></thead>
              <tbody>
                {invoices.map((iv) => (
                  <tr key={iv.id}>
                    <td>{canFinance ? <Link href={`/akuntansi/penjualan/${iv.id}`}><b>{iv.number}</b></Link> : <b>{iv.number}</b>}</td>
                    <td>{tgl(iv.date)}</td>
                    <td><Status s={payStatus(iv)} /></td>
                    <td className="num"><Rp n={iv.total} /></td>
                    <td className="num">{formatAmount(iv.total - iv.paid)}</td>
                  </tr>
                ))}
                {invoices.length === 0 && <tr><td colSpan={5} className="muted">Belum difaktur.</td></tr>}
              </tbody>
            </table>
          </section>
        )}

        {canEdit && (
          <section className="admin-card stack" style={{ gap: 12 }}>
            <h2 style={{ fontSize: 17 }}>Status pesanan</h2>
            <div className="head-actions">
              {o.status === "draft" && <ConfirmAction action={setOrderStatus.bind(null, o.id, "konfirmasi")} label="Konfirmasi pesanan" confirmText="Konfirmasi pesanan ini?" className="btn btn-blue btn-sm" />}
              {open && <ConfirmAction action={setOrderStatus.bind(null, o.id, "selesai")} label="Tandai selesai" confirmText={activeTrips ? "Masih ada surat jalan berjalan. Tetap coba tandai selesai?" : "Tandai pesanan selesai? Sisa barang yang belum dikirim tidak akan dikirim lagi."} className="btn btn-ghost btn-sm" />}
              {(o.status === "selesai" || o.status === "batal") && <ConfirmAction action={setOrderStatus.bind(null, o.id, "buka")} label="Buka kembali" confirmText="Buka kembali pesanan ini?" className="btn btn-ghost btn-sm" />}
            </div>
            <OrderDanger id={o.id} number={o.number} canCancel={canCancel} canDelete={canDelete} />
          </section>
        )}
      </div>
    </>
  );
}
