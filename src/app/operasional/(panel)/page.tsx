import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { ColumnChart } from "@/components/erp/ColumnChart";
import { Kpis, PageHead, Status } from "@/components/erp/ui";
import { DeliveryStatusBadge } from "@/components/ops/delivery/StatusBadge";
import { SQL_ON_ROAD } from "@/components/ops/delivery/status";
import { NotificationPanel } from "@/components/ops/order/NotificationPanel";
import { getDb, schema } from "@/db";
import { documentAlerts, loadingPlan, orderStats, stockPosition } from "@/lib/erp/insights";
import { opsAccess } from "@/lib/erp/ops";
import { addDays, formatQty, monthStart, tgl, today } from "@/lib/erp/util";
import { unreadNotifications } from "@/lib/ops/deliveries";

export const metadata = { title: "Ringkasan operasional" };

const C_TRIPS = "#3d63c4";

export default async function OpsDashboard() {
  const { user, canOrders, canShip, canLoad, canStock } = await opsAccess();
  const db = await getDb();
  const now = today();
  const tomorrow = addDays(now, 1);
  const from14 = addDays(now, -13);
  const warehouseFirst = canStock && !canOrders;
  const office = canOrders || canShip;
  const [counts, plan, waiting, stock, daily, productions, alerts, stats, notices] = await Promise.all([
    db.get<{ active: number; draft: number; due: number; onRoad: number; doneMonth: number }>(sql`
      select
        (select count(*) from ops_orders where status in ('dikonfirmasi','dikirim_sebagian')) active,
        (select count(*) from ops_orders where status = 'draft') draft,
        (select count(*) from ops_deliveries where status = 'dijadwalkan' and date <= ${now}) due,
        (select count(*) from ops_deliveries d where ${sql.raw(SQL_ON_ROAD)}) onRoad,
        (select count(*) from ops_deliveries where status = 'terkirim' and date >= ${monthStart(now)}) doneMonth`),
    loadingPlan(db, tomorrow),
    db.all<{ id: string; number: string; date: string; requestedDate: string | null; status: string; contactName: string; project: string; ordered: number; scheduled: number }>(sql`
      select o.id, o.number, o.date, o.requested_date requestedDate, o.status, c.name contactName, o.project,
        (select coalesce(sum(qty),0) from ops_order_lines where order_id = o.id) ordered,
        (select coalesce(sum(dl.qty),0) from ops_delivery_lines dl join ops_deliveries d on d.id = dl.delivery_id where d.order_id = o.id and d.status <> 'batal') scheduled
      from ops_orders o join fin_contacts c on c.id = o.contact_id
      where o.status in ('dikonfirmasi','dikirim_sebagian')
      order by coalesce(o.requested_date, o.date), o.number limit 40`),
    stockPosition(db),
    db.all<{ date: string; n: number }>(sql`select date, count(*) n from ops_deliveries where status = 'terkirim' and date >= ${from14} group by date`),
    db.select().from(schema.productions).orderBy(desc(schema.productions.date), desc(schema.productions.number)).limit(5),
    office ? documentAlerts(db, now) : [],
    office ? orderStats(db) : null,
    canShip || canLoad ? unreadNotifications(db, ["po_baru", "dimuat", "status_kirim", "umum"], 10) : [],
  ]);
  const unscheduled = waiting.filter((o) => Number(o.scheduled) + 1e-9 < Number(o.ordered));
  const low = stock.filter((s) => s.minStock > 0 && s.onHand < s.minStock);
  const shortTrips = plan.filter((t) => t.short).length;
  const days = Array.from({ length: 14 }, (_, i) => addDays(from14, i));
  const perDay = days.map((d) => Number(daily.find((r) => r.date === d)?.n ?? 0));

  return (
    <>
      <PageHead title={warehouseFirst ? "Ringkasan gudang" : "Ringkasan operasional"} sub={`${tgl(now)} · masuk sebagai ${user.name}`}>
        {canOrders && <Link href="/operasional/pesanan/baru" className="btn btn-primary btn-sm">+ Pesanan</Link>}
        {canShip && <Link href="/operasional/pengiriman/baru" className="btn btn-blue btn-sm">+ Jadwalkan kirim</Link>}
        {canStock && <Link href="/operasional/produksi/baru" className={`btn ${warehouseFirst ? "btn-primary" : "btn-ghost"} btn-sm`}>+ Hasil produksi</Link>}
        {canStock && <Link href="/operasional/stok/penyesuaian/baru" className="btn btn-ghost btn-sm">+ Penyesuaian stok</Link>}
      </PageHead>

      <Kpis
        items={[
          { label: "Pesanan aktif", value: Number(counts?.active ?? 0), sub: Number(counts?.draft ?? 0) ? `${counts?.draft} draf menunggu konfirmasi` : `${unscheduled.length} belum dijadwalkan penuh`, href: "/operasional/pesanan" },
          { label: "Harus dimuat s.d. hari ini", value: Number(counts?.due ?? 0), sub: shortTrips ? `${shortTrips} muatan stoknya kurang` : "surat jalan dijadwalkan", href: "/operasional/pengiriman?status=dijadwalkan", tone: shortTrips ? "warn" : undefined },
          { label: "Dalam perjalanan", value: Number(counts?.onRoad ?? 0), sub: "truk sudah berangkat", href: "/operasional/pengiriman?status=berangkat" },
          { label: "Terkirim bulan ini", value: Number(counts?.doneMonth ?? 0), sub: "surat jalan", href: "/operasional/pengiriman?status=terkirim" },
          { label: "Stok di bawah minimum", value: low.length, sub: low.length ? `${low[0].name}${low.length > 1 ? ` dan ${low.length - 1} lainnya` : ""}` : "semua aman", href: "/operasional/stok", tone: low.length ? "warn" : "ok" },
        ]}
      />

      <div className="dash-grid dash-3" style={{ marginBottom: 16 }}>
        <section className="admin-card">
          <div className="card-head">
            <h2>Muatan hari ini & besok</h2>
            <Link href="/operasional/pengiriman">Semua pengiriman</Link>
          </div>
          <div className="load-list">
            {plan.map((t) => (
              <article key={t.id} className={`load-item${t.short ? " is-short" : ""}`}>
                <div>
                  <Link href={`/operasional/pengiriman/${t.id}`}><b>{t.number}</b></Link> <DeliveryStatusBadge s={t.status} />
                  <div className="small muted">
                    {tgl(t.date)}{t.date < now && !t.posted ? " · terlambat" : ""} · {t.contactName}{t.destination ? ` · ${t.destination}` : ""}
                  </div>
                </div>
                <div className="small" style={{ textAlign: "right" }}>
                  {t.plate ?? <span className="text-warn">armada belum dipilih</span>}
                  <div className="muted">{t.driver ?? "sopir belum dipilih"}</div>
                </div>
                <ul>
                  {t.lines.map((l, i) => (
                    <li key={i}>
                      <span>{l.name}</span>
                      <span className="tabular">
                        <b>{formatQty(l.qty)}</b> {l.unit}
                        {!t.posted && (canStock || canLoad) && (
                          <span className={`avail ${l.qty > l.onHand + 1e-9 ? "text-bahaya" : "muted"}`}> · tersedia {formatQty(Math.max(0, l.onHand))}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                {t.short && <p className="flag flag-warn small" style={{ gridColumn: "1 / -1", margin: 0 }}>Stok gudang belum cukup untuk muatan ini. Catat hasil produksi atau geser jadwalnya.</p>}
              </article>
            ))}
            {plan.length === 0 && <p className="muted">Tidak ada muatan untuk hari ini dan besok.</p>}
          </div>
        </section>

        <div className="stack" style={{ gap: 16 }}>
          <section className="admin-card">
            <div className="card-head"><h2>Surat jalan terkirim, 14 hari</h2></div>
            <ColumnChart
              label="Jumlah surat jalan terkirim per hari dalam 14 hari terakhir"
              money={false}
              height={180}
              categories={days.map((d) => tgl(d))}
              short={days.map((d) => String(Number(d.slice(8, 10))))}
              showEvery={2}
              series={[{ name: "Surat jalan terkirim", color: C_TRIPS, values: perDay }]}
            />
          </section>
          <section className="admin-card">
            <div className="card-head"><h2>Stok di bawah minimum</h2><Link href="/operasional/stok">Stok</Link></div>
            <table className="compact">
              <tbody>
                {low.map((i) => (
                  <tr key={i.id}>
                    <td><Link href={`/operasional/stok/${i.id}`}>{i.name}</Link><div className="small muted">{i.code}</div></td>
                    <td className="num text-warn">{formatQty(i.onHand)} {i.unit}<div className="small muted">min. {formatQty(i.minStock)}</div></td>
                  </tr>
                ))}
                {low.length === 0 && <tr><td className="muted">Tidak ada barang di bawah stok minimum.</td></tr>}
              </tbody>
            </table>
          </section>
        </div>
      </div>

      <div className="dash-grid">
        {!warehouseFirst && (
          <section className="admin-card">
            <div className="card-head"><h2>Pesanan belum dijadwalkan penuh</h2><Link href="/operasional/pesanan">Semua pesanan</Link></div>
            <table className="compact stack-sm">
              <tbody>
                {unscheduled.slice(0, 8).map((o) => (
                  <tr key={o.id}>
                    <td><Link href={`/operasional/pesanan/${o.id}`}>{o.number}</Link><div className="small muted">{o.contactName}{o.project ? ` · ${o.project}` : ""}</div></td>
                    <td className="small">{o.requestedDate ? <>minta {tgl(o.requestedDate)}</> : <>pesan {tgl(o.date)}</>}<div><Status s={o.status} /></div></td>
                    <td className="num">{canShip && <Link href={`/operasional/pengiriman/baru?pesanan=${o.id}`} className="btn btn-ghost btn-sm">Jadwalkan</Link>}</td>
                  </tr>
                ))}
                {unscheduled.length === 0 && <tr><td className="muted">Semua pesanan aktif sudah dijadwalkan.</td></tr>}
              </tbody>
            </table>
          </section>
        )}
        {office && (
          <section className="admin-card">
            <div className="card-head"><h2>Peringatan dokumen</h2><span className="small muted">SIM, STNK, KIR · sisa ≤ 30 hari</span></div>
            <table className="compact">
              <tbody>
                {alerts.map((a, i) => (
                  <tr key={`${a.kind}-${a.owner}-${i}`}>
                    <td><Link href={a.href}><b>{a.kind}</b> · {a.owner}</Link></td>
                    <td className={`num small ${a.daysLeft < 0 ? "text-bahaya" : "text-warn"}`}>
                      {tgl(a.expiry)}
                      <div>{a.daysLeft < 0 ? `lewat ${-a.daysLeft} hari` : a.daysLeft === 0 ? "berakhir hari ini" : `sisa ${a.daysLeft} hari`}</div>
                    </td>
                  </tr>
                ))}
                {alerts.length === 0 && <tr><td className="muted">Semua dokumen armada dan sopir aman. Isi masa berlaku di halaman Armada dan Sopir.</td></tr>}
              </tbody>
            </table>
          </section>
        )}
        {(canShip || canLoad) && <NotificationPanel items={notices} />}
        {stats && (
          <section className="admin-card">
            <div className="card-head"><h2>Statistik pesanan</h2><Link href="/operasional/pesanan?status=semua">Semua</Link></div>
            <table className="compact">
              <tbody>
                <tr><td>Total pesanan</td><td className="num"><b>{stats.total}</b></td></tr>
                <tr><td>Di jalan</td><td className="num"><b>{stats.inTransit}</b></td></tr>
                <tr><td>Terkirim / selesai</td><td className="num"><b>{stats.delivered}</b></td></tr>
                <tr><td><Link href="/operasional/pesanan?status=batal">Dibatalkan</Link></td><td className="num"><b>{stats.cancelled}</b></td></tr>
              </tbody>
            </table>
          </section>
        )}
        <section className="admin-card">
          <div className="card-head"><h2>Hasil produksi terakhir</h2><Link href="/operasional/produksi">Semua</Link></div>
          <table className="compact">
            <tbody>
              {productions.map((p) => (
                <tr key={p.id}>
                  <td><Link href={`/operasional/produksi/${p.id}`}>{p.number}</Link><div className="small muted">{p.note}</div></td>
                  <td className="num small">{tgl(p.date)}</td>
                </tr>
              ))}
              {productions.length === 0 && <tr><td className="muted">Belum ada hasil produksi yang dicatat.</td></tr>}
            </tbody>
          </table>
        </section>
        {warehouseFirst && (
          <section className="admin-card">
            <div className="card-head"><h2>Stok barang jadi</h2><Link href="/operasional/stok?jenis=barang_jadi">Detail</Link></div>
            <table className="compact">
              <thead><tr><th>Barang</th><th className="num">Gudang</th><th className="num">Bebas</th></tr></thead>
              <tbody>
                {stock.filter((s) => s.kind === "barang_jadi" && (s.onHand || s.scheduled)).slice(0, 10).map((s) => (
                  <tr key={s.id}>
                    <td><Link href={`/operasional/stok/${s.id}`}>{s.name}</Link></td>
                    <td className="num">{formatQty(s.onHand)} {s.unit}</td>
                    <td className={`num${s.free < 0 ? " text-bahaya" : ""}`}>{formatQty(s.free)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </>
  );
}
