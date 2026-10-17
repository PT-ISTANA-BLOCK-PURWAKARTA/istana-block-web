import Link from "next/link";
import { sql } from "drizzle-orm";
import { PageHead, Status } from "@/components/erp/ui";
import { getDb } from "@/db";
import { deliveryItems, opsAccess } from "@/lib/erp/ops";
import { addDays, formatQty, monthStart, tgl, today } from "@/lib/erp/util";

export const metadata = { title: "Ringkasan operasional" };

type Trip = { id: string; number: string; date: string; status: string; orderNumber: string; contactName: string; project: string; address: string; plate: string | null; driver: string | null };

export default async function OpsDashboard() {
  const { canEdit } = await opsAccess();
  const db = await getDb();
  const now = today();
  const tomorrow = addDays(now, 1);
  const [counts, trips, waiting, low] = await Promise.all([
    db.get<{ active: number; draft: number; today: number; onRoad: number; doneMonth: number }>(sql`
      select
        (select count(*) from ops_orders where status in ('dikonfirmasi','dikirim_sebagian')) active,
        (select count(*) from ops_orders where status = 'draft') draft,
        (select count(*) from ops_deliveries where status = 'dijadwalkan' and date <= ${now}) today,
        (select count(*) from ops_deliveries where status = 'berangkat') onRoad,
        (select count(*) from ops_deliveries where status = 'terkirim' and date >= ${monthStart(now)}) doneMonth`),
    db.all<Trip>(sql`
      select d.id, d.number, d.date, d.status, o.number orderNumber, c.name contactName, o.project, o.address, v.plate, dr.name driver
      from ops_deliveries d join ops_orders o on o.id = d.order_id join fin_contacts c on c.id = o.contact_id
        left join ops_vehicles v on v.id = d.vehicle_id left join ops_drivers dr on dr.id = d.driver_id
      where d.status = 'berangkat' or (d.status = 'dijadwalkan' and d.date <= ${tomorrow})
      order by d.status = 'berangkat' desc, d.date, d.number`),
    db.all<{ id: string; number: string; date: string; requestedDate: string | null; status: string; contactName: string; project: string; ordered: number; scheduled: number }>(sql`
      select o.id, o.number, o.date, o.requested_date requestedDate, o.status, c.name contactName, o.project,
        (select coalesce(sum(qty),0) from ops_order_lines where order_id = o.id) ordered,
        (select coalesce(sum(dl.qty),0) from ops_delivery_lines dl join ops_deliveries d on d.id = dl.delivery_id where d.order_id = o.id and d.status <> 'batal') scheduled
      from ops_orders o join fin_contacts c on c.id = o.contact_id
      where o.status in ('dikonfirmasi','dikirim_sebagian')
      order by coalesce(o.requested_date, o.date), o.number limit 30`),
    db.all<{ id: string; code: string; name: string; unit: string; minStock: number; qty: number }>(sql`
      select i.id, i.code, i.name, i.unit, i.min_stock minStock, coalesce((select sum(qty) from inv_stock_moves where item_id = i.id),0) qty
      from fin_items i where i.active = 1 and i.track_stock = 1 and i.min_stock > 0
        and coalesce((select sum(qty) from inv_stock_moves where item_id = i.id),0) < i.min_stock
      order by i.code`),
  ]);
  const itemsOf = await deliveryItems(db, trips.map((t) => t.id));
  const unscheduled = waiting.filter((o) => Number(o.scheduled) + 1e-9 < Number(o.ordered));
  return (
    <>
      <PageHead title="Ringkasan operasional" sub={`Hari ini ${tgl(now)}`}>
        {canEdit && <Link href="/operasional/pesanan/baru" className="btn btn-primary btn-sm">+ Pesanan</Link>}
        {canEdit && <Link href="/operasional/pengiriman/baru" className="btn btn-blue btn-sm">+ Jadwalkan kirim</Link>}
        {canEdit && <Link href="/operasional/produksi/baru" className="btn btn-ghost btn-sm">+ Hasil produksi</Link>}
      </PageHead>
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <Link href="/operasional/pesanan" className="stat stat-link"><span className="muted small">Pesanan aktif</span><b>{Number(counts?.active ?? 0)}</b></Link>
        <Link href="/operasional/pengiriman?status=dijadwalkan" className="stat stat-link"><span className="muted small">Jadwal kirim s.d. hari ini</span><b>{Number(counts?.today ?? 0)}</b></Link>
        <Link href="/operasional/pengiriman?status=berangkat" className="stat stat-link"><span className="muted small">Dalam perjalanan</span><b>{Number(counts?.onRoad ?? 0)}</b></Link>
        <Link href="/operasional/pengiriman?status=terkirim" className="stat stat-link"><span className="muted small">Terkirim bulan ini</span><b>{Number(counts?.doneMonth ?? 0)}</b></Link>
        {Number(counts?.draft ?? 0) > 0 && <Link href="/operasional/pesanan?status=draft" className="stat stat-link"><span className="muted small">Draf pesanan</span><b>{Number(counts?.draft)}</b></Link>}
      </div>
      <div className="dash-grid">
        <section className="admin-card span-2">
          <div className="card-head"><h2>Pengiriman hari ini &amp; besok</h2><Link href="/operasional/pengiriman">Semua pengiriman →</Link></div>
          <div className="admin-table" style={{ borderRadius: 0 }}>
            <table className="compact">
              <tbody>
                {trips.map((t) => (
                  <tr key={t.id}>
                    <td><Link href={`/operasional/pengiriman/${t.id}`}><b>{t.number}</b></Link><div className="small muted">{tgl(t.date)}{t.date < now && t.status === "dijadwalkan" ? " · terlambat" : ""}</div></td>
                    <td><b>{t.contactName}</b><div className="small muted clamp-2">{t.project || t.address}</div></td>
                    <td className="small">{(itemsOf.get(t.id) ?? []).map((x, i) => <div key={i}>{x.name} <b>{formatQty(x.qty)}</b> {x.unit}</div>)}</td>
                    <td className="small">{t.plate ?? <span className="muted">armada?</span>}<div className="muted">{t.driver ?? "sopir?"}</div></td>
                    <td><Status s={t.status} /></td>
                  </tr>
                ))}
                {trips.length === 0 && <tr><td className="muted">Tidak ada jadwal pengiriman untuk hari ini dan besok.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        <section className="admin-card">
          <div className="card-head"><h2>Pesanan belum dijadwalkan</h2><Link href="/operasional/pesanan">Semua pesanan →</Link></div>
          <table className="compact">
            <tbody>
              {unscheduled.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/operasional/pesanan/${o.id}`}><b>{o.number}</b></Link><div className="small muted">{o.contactName}{o.project ? ` · ${o.project}` : ""}</div></td>
                  <td className="small">{o.requestedDate ? <>minta {tgl(o.requestedDate)}</> : <>pesan {tgl(o.date)}</>}<div><Status s={o.status} /></div></td>
                  <td className="num">{canEdit && <Link href={`/operasional/pengiriman/baru?pesanan=${o.id}`} className="btn btn-ghost btn-sm">Jadwalkan</Link>}</td>
                </tr>
              ))}
              {unscheduled.length === 0 && <tr><td className="muted">Semua pesanan aktif sudah dijadwalkan.</td></tr>}
            </tbody>
          </table>
        </section>
        <section className="admin-card">
          <div className="card-head"><h2>Stok di bawah minimum</h2><Link href="/operasional/stok">Stok →</Link></div>
          <table className="compact">
            <tbody>
              {low.map((i) => (
                <tr key={i.id}>
                  <td><Link href={`/operasional/stok/${i.id}`}><b>{i.name}</b></Link><div className="small muted">{i.code}</div></td>
                  <td className="num text-bahaya">{formatQty(Number(i.qty))} {i.unit}<div className="small muted">min. {formatQty(i.minStock)}</div></td>
                </tr>
              ))}
              {low.length === 0 && <tr><td className="muted">Tidak ada barang di bawah stok minimum.</td></tr>}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
