import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { deleteOrder, setOrderStatus } from "@/app/operasional/actions/orders";
import { ConfirmAction } from "@/components/erp/ConfirmAction";
import { BackLink, Ok, PageHead, payStatus, Rp, Status } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { docTotals } from "@/lib/erp/docs";
import { deliveryItems, opsAccess } from "@/lib/erp/ops";
import { orderProgress } from "@/lib/erp/orders";
import { depositBalance, getFinSettings, loadAccounts } from "@/lib/erp/server";
import { formatAmount, formatQty, tgl } from "@/lib/erp/util";

export const metadata = { title: "Pesanan" };
const EPS = 1e-9;

export default async function PesananDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const { canEdit, canFinance } = await opsAccess();
  const { id } = await params;
  const { ok } = await searchParams;
  const db = await getDb();
  const o = await db.query.orders.findFirst({ where: eq(schema.orders.id, id) });
  if (!o) notFound();
  const [contact, prog, deliveries, invoices, fin, acc] = await Promise.all([
    db.query.contacts.findFirst({ where: eq(schema.contacts.id, o.contactId) }),
    orderProgress(db, id),
    db
      .select({ d: schema.deliveries, plate: schema.vehicles.plate, driver: schema.drivers.name })
      .from(schema.deliveries)
      .leftJoin(schema.vehicles, eq(schema.vehicles.id, schema.deliveries.vehicleId))
      .leftJoin(schema.drivers, eq(schema.drivers.id, schema.deliveries.driverId))
      .where(eq(schema.deliveries.orderId, id))
      .orderBy(desc(schema.deliveries.date), desc(schema.deliveries.number)),
    db.select().from(schema.invoices).where(and(eq(schema.invoices.orderId, id), eq(schema.invoices.void, false))).orderBy(desc(schema.invoices.date)),
    getFinSettings(db),
    loadAccounts(db),
  ]);
  const items = await deliveryItems(db, deliveries.map((x) => x.d.id));
  const deposit = canFinance ? await depositBalance(db, acc.sys("uang_muka_pelanggan"), o.contactId, "credit") : 0;
  const t = docTotals(prog, { discount: o.discount, ongkir: o.ongkir, taxable: o.taxable, taxRate: fin.ppnRate });
  const open = o.status === "dikonfirmasi" || o.status === "dikirim_sebagian" || o.status === "terkirim";
  const canSchedule = (o.status === "dikonfirmasi" || o.status === "dikirim_sebagian") && prog.some((p) => p.scheduled + EPS < p.qty);
  const canInvoice = canFinance && o.status !== "draft" && o.status !== "batal" && prog.some((p) => p.invoiced + EPS < (p.delivered > EPS ? p.delivered : p.qty));
  const activeTrips = deliveries.some((x) => x.d.status === "dijadwalkan" || x.d.status === "berangkat");
  const shippedAny = deliveries.some((x) => x.d.status === "berangkat" || x.d.status === "terkirim");

  return (
    <>
      <BackLink href="/operasional/pesanan">Pesanan</BackLink>
      <PageHead title={o.number} sub={<Status s={o.status} />}>
        {canEdit && canSchedule && <Link href={`/operasional/pengiriman/baru?pesanan=${o.id}`} className="btn btn-primary btn-sm">+ Jadwalkan pengiriman</Link>}
        {canInvoice && <Link href={`/keuangan/penjualan/baru?pesanan=${o.id}`} className="btn btn-blue btn-sm">Buat faktur</Link>}
        {canFinance && o.status !== "batal" && <Link href={`/keuangan/penerimaan/baru?kontak=${o.contactId}`} className="btn btn-ghost btn-sm">Catat DP / pembayaran</Link>}
        {canEdit && o.status !== "batal" && o.status !== "selesai" && <Link href={`/operasional/pesanan/${o.id}/ubah`} className="btn btn-ghost btn-sm">Ubah</Link>}
      </PageHead>
      <Ok ok={ok} />
      {o.status === "draft" && (
        <p className="alert alert-ok" style={{ marginBottom: 16, background: "var(--biru-muda)", color: "var(--biru-tua)" }}>
          Pesanan masih draf. Konfirmasi dulu agar bisa dijadwalkan kirim.
        </p>
      )}
      <div className="stack" style={{ gap: 20 }}>
        <section className="admin-card doc-head">
          <div><span className="muted small">Pelanggan</span><Link href={`/operasional/pelanggan/${contact?.id}`}><b>{contact?.name}</b></Link>{contact?.company && <div className="small">{contact.company}</div>}{contact?.phone && <div className="small"><a href={`tel:${contact.phone}`}>{contact.phone}</a></div>}</div>
          <div><span className="muted small">Tanggal pesanan</span><b>{tgl(o.date)}</b>{o.requestedDate && <div className="small">minta kirim {tgl(o.requestedDate)}</div>}</div>
          {o.customerRef && <div><span className="muted small">No. PO pelanggan</span><b>{o.customerRef}</b></div>}
          {o.project && <div><span className="muted small">Proyek</span><b>{o.project}</b></div>}
          <div style={{ maxWidth: 360 }}>
            <span className="muted small">Alamat kirim</span>
            <span className="pre">{o.address || "Diambil sendiri / belum diisi"}</span>
            {o.siteContact && <div className="small">Kontak lokasi: {o.siteContact}</div>}
            {o.mapsUrl && <a href={o.mapsUrl} target="_blank" rel="noopener noreferrer" className="small">Buka peta ↗</a>}
          </div>
          {canFinance && deposit > 0 && <div><span className="muted small">Uang muka pelanggan</span><b><Rp n={deposit} /></b></div>}
        </section>

        <section className="admin-table">
          <table>
            <caption>Barang</caption>
            <thead><tr><th>Barang</th><th className="num">Dipesan</th><th className="num">Dijadwalkan</th><th className="num">Dikirim</th><th className="num">Diterima</th><th className="num">Difaktur</th><th className="num">Harga</th><th className="num">Jumlah</th></tr></thead>
            <tbody>
              {prog.map((p) => (
                <tr key={p.id}>
                  <td><b>{p.name}</b>{p.description && <div className="small muted">{p.description}</div>}</td>
                  <td className="num">{formatQty(p.qty)} {p.unit}</td>
                  <td className="num">{formatQty(p.scheduled)}</td>
                  <td className="num">{formatQty(p.shipped)}</td>
                  <td className={`num${p.delivered + EPS >= p.qty ? " text-sukses" : ""}`}>{formatQty(p.delivered)}</td>
                  <td className="num">{formatQty(p.invoiced)}</td>
                  <td className="num"><Rp n={p.price} /></td>
                  <td className="num"><Rp n={Math.round(p.qty * p.price)} /></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={7} className="num">Subtotal</td><td className="num"><Rp n={t.subtotal} /></td></tr>
              {t.discount > 0 && <tr><td colSpan={7} className="num">Diskon</td><td className="num"><Rp n={-t.discount} /></td></tr>}
              {t.ongkir > 0 && <tr><td colSpan={7} className="num">Ongkos kirim</td><td className="num"><Rp n={t.ongkir} /></td></tr>}
              {o.taxable && <tr><td colSpan={7} className="num">PPN {formatQty(fin.ppnRate)}% (perkiraan)</td><td className="num"><Rp n={t.tax} /></td></tr>}
              <tr><th colSpan={7} className="num">Nilai pesanan</th><th className="num"><Rp n={t.total} strong /></th></tr>
            </tfoot>
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
                  <td className="small">{(items.get(d.id) ?? []).map((x, i) => <div key={i}>{x.name} <b>{formatQty(x.qty)}</b> {x.unit}</div>)}</td>
                  <td className="small">{plate ?? "—"}<div className="muted">{driver ?? ""}</div></td>
                  <td><Status s={d.status} />{d.receivedBy && <div className="small muted">diterima {d.receivedBy}</div>}</td>
                </tr>
              ))}
              {deliveries.length === 0 && <tr><td colSpan={5} className="muted">Belum ada surat jalan.{canEdit && canSchedule && <> <Link href={`/operasional/pengiriman/baru?pesanan=${o.id}`}>Jadwalkan sekarang</Link>.</>}</td></tr>}
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
                    <td>{canFinance ? <Link href={`/keuangan/penjualan/${iv.id}`}><b>{iv.number}</b></Link> : <b>{iv.number}</b>}</td>
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
              {o.status !== "batal" && !shippedAny && <ConfirmAction action={setOrderStatus.bind(null, o.id, "batal")} label="Batalkan pesanan" confirmText="Batalkan pesanan ini? Jadwal kirim yang belum berangkat ikut dibatalkan." />}
              {!shippedAny && invoices.length === 0 && <ConfirmAction action={deleteOrder.bind(null, o.id)} label="Hapus" confirmText={`Hapus ${o.number} permanen?`} />}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
