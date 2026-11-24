// Beranda Operasional untuk kantor — susunan sama dengan app.kirimistanablock.com (PO & Pengiriman):
// kepala + tombol cepat, update pengiriman, 4 angka, menunggu dimuat, peringatan dokumen armada,
// tabel PO & pengiriman (PO aktif / dibatalkan / riwayat hapus), posisi truk, sopir & kendaraan.
import Link from "next/link";
import { sql } from "drizzle-orm";
import { ExportButton } from "@/components/ops/delivery/ExportButton";
import { LoadButton } from "@/components/ops/delivery/LoadButton";
import { NotificationPanel } from "@/components/ops/order/NotificationPanel";
import { PaymentBadge } from "@/components/ops/order/PaymentBadge";
import { TruckTracker } from "@/components/ops/TruckTracker";
import type { DB } from "@/lib/erp/server";
import { documentAlerts } from "@/lib/erp/insights";
import { deliveryItems } from "@/lib/erp/ops";
import { truckBoard } from "@/lib/erp/tracking";
import { formatQty, monthStart, tgl, today } from "@/lib/erp/util";
import { unreadNotifications } from "@/lib/ops/deliveries";
import "./home.css";

const STATUS: Record<string, { label: string; tone: string }> = {
  dijadwalkan: { label: "Sopir ditugaskan", tone: "st-wait" },
  dimuat: { label: "Sudah dimuat", tone: "st-load" },
  berangkat: { label: "Dalam perjalanan", tone: "st-road" },
  tiba: { label: "Sudah tiba", tone: "st-road" },
  tertunda: { label: "Tertunda", tone: "st-warn" },
  terkirim: { label: "Selesai", tone: "st-done" },
  batal: { label: "Dibatalkan", tone: "st-cancel" },
};
const docLabel = (ref: string | null) => (!ref ? null : /^SJ-/i.test(ref) ? `Surat jalan Zahir ${ref}` : /^IN-/i.test(ref) || /^\d{3}$/.test(ref) ? `Faktur Zahir ${ref}` : ref);

type Row = {
  orderId: string; orderNumber: string; date: string; requestedDate: string | null; externalRef: string | null; paymentStatus: string | null; isInternal: number;
  contactName: string; phone: string | null; address: string; mapsUrl: string; deliveryId: string | null; deliveryNumber: string | null; status: string | null;
  deliveryDate: string | null; driver: string | null; plate: string | null; vehicleName: string | null; orderStatus: string;
};

export async function OfficeHome({ db, canOrders, canShip, canLoad, tab }: { db: DB; canOrders: boolean; canShip: boolean; canLoad: boolean; tab: "aktif" | "batal" | "hapus" }) {
  const now = today();
  const [stats, notices, alerts, waiting, rows, deleted, trucks, drivers, vehicles] = await Promise.all([
    db.get<{ total: number; road: number; done: number; drivers: number; cancelled: number; removed: number; active: number }>(sql`
      select (select count(*) from ops_orders) total,
             (select count(*) from ops_deliveries where status in ('berangkat','tiba','tertunda')) road,
             (select count(*) from ops_deliveries where status = 'terkirim') done,
             (select count(*) from ops_drivers where active = 1) drivers,
             (select count(*) from ops_orders where status = 'batal') cancelled,
             (select count(*) from ops_order_deletions) removed,
             (select count(*) from ops_orders where status <> 'batal') active`),
    canShip || canLoad ? unreadNotifications(db, ["po_baru", "dimuat", "status_kirim", "umum"], 10) : [],
    documentAlerts(db, now),
    db.all<{ id: string; orderNumber: string; contactName: string; date: string; driver: string | null; plate: string | null }>(sql`
      select d.id, o.number orderNumber, c.name contactName, d.date, dr.name driver, v.plate
        from ops_deliveries d join ops_orders o on o.id = d.order_id join fin_contacts c on c.id = o.contact_id
        left join ops_drivers dr on dr.id = d.driver_id left join ops_vehicles v on v.id = d.vehicle_id
       where d.status = 'dijadwalkan' and d.driver_id is not null
       order by d.date, d.number limit 30`),
    tab === "hapus"
      ? Promise.resolve([] as Row[])
      : db.all<Row>(sql`
      select o.id orderId, o.number orderNumber, o.date, o.requested_date requestedDate, o.external_ref externalRef, o.payment_status paymentStatus, o.is_internal isInternal,
             c.name contactName, c.phone, o.address, o.maps_url mapsUrl, o.status orderStatus,
             d.id deliveryId, d.number deliveryNumber, d.status, d.date deliveryDate, dr.name driver, v.plate, v.name vehicleName
        from ops_orders o join fin_contacts c on c.id = o.contact_id
        left join ops_deliveries d on d.id = (select id from ops_deliveries where order_id = o.id order by created_at desc limit 1)
        left join ops_drivers dr on dr.id = d.driver_id left join ops_vehicles v on v.id = d.vehicle_id
       where ${tab === "batal" ? sql`o.status = 'batal'` : sql`o.status <> 'batal'`}
       order by coalesce(d.date, o.requested_date, o.date) desc, o.number desc limit 150`),
    tab === "hapus" ? db.all<{ id: string; number: string; customerName: string; reason: string | null; deletedAt: number }>(sql`select id, number, customer_name customerName, reason, deleted_at deletedAt from ops_order_deletions order by deleted_at desc limit 150`) : Promise.resolve([]),
    truckBoard(db),
    db.all<{ id: string; name: string; phone: string; active: number; licenseExpiry: string | null; push: number }>(sql`
      select dr.id, dr.name, dr.phone, dr.active, dr.license_expiry licenseExpiry,
             (select count(*) from users u join ops_push_subscriptions p on p.user_id = u.id where u.driver_id = dr.id) push
        from ops_drivers dr order by dr.active desc, dr.name`),
    db.all<{ id: string; plate: string; name: string; active: number }>(sql`select id, plate, name, active from ops_vehicles order by active desc, plate`),
  ]);
  const lines = await deliveryItems(db, [...rows.flatMap((r) => (r.deliveryId ? [r.deliveryId] : [])), ...waiting.map((w) => w.id)]);
  // PO impor lama tidak punya baris muatan: pakai baris PO sebagai cadangan.
  const orderIds = rows.filter((r) => !r.deliveryId || !lines.get(r.deliveryId)?.length).map((r) => r.orderId);
  const orderLines = new Map<string, { name: string; qty: number; unit: string }[]>();
  for (let i = 0; i < orderIds.length; i += 80) {
    const part = orderIds.slice(i, i + 80);
    const got = await db.all<{ orderId: string; name: string; qty: number; unit: string }>(sql`select l.order_id orderId, coalesce(it.name, l.description, '') name, l.qty, coalesce(nullif(l.unit, ''), it.unit, '') unit from ops_order_lines l left join fin_items it on it.id = l.item_id where l.order_id in (${sql.join(part.map((p) => sql`${p}`), sql`, `)})`);
    for (const g of got) orderLines.set(g.orderId, [...(orderLines.get(g.orderId) ?? []), g]);
  }
  const loadText = (id: string | null, orderId?: string) => {
    const own = id ? lines.get(id) ?? [] : [];
    const items = own.length || !orderId ? own : orderLines.get(orderId) ?? [];
    return { names: items.map((l) => (items.length > 1 ? `${l.name} (${formatQty(l.qty)} ${l.unit})` : l.name)).join(" + "), qty: items.length === 1 ? `${formatQty(items[0].qty)} ${items[0].unit}` : items.length ? "1 muatan" : "" };
  };
  const s = stats ?? { total: 0, road: 0, done: 0, drivers: 0, cancelled: 0, removed: 0, active: 0 };
  const past = alerts.filter((a) => a.daysLeft < 0).length;
  const soon = alerts.filter((a) => a.daysLeft >= 0 && a.daysLeft <= 7).length;

  return (
    <div className="ohome">
      <header className="ohome-head">
        <div>
          <p className="ohome-kicker">Operasional harian</p>
          <h1>Pengiriman yang lebih tertata.</h1>
          <p className="ohome-lead">Kelola PO, tugaskan sopir, konfirmasi muatan, dan kirim detail pengiriman ke tamu.</p>
        </div>
        <div className="ohome-actions">
          <Link href="/operasional/muatan" className="btn btn-ghost btn-sm">Muatan &amp; tugas sopir</Link>
          <Link href="/operasional" className="btn btn-ghost btn-sm">Segarkan</Link>
          <details className="ohome-export">
            <summary className="btn btn-ghost btn-sm">Unduh Excel</summary>
            <div className="ohome-export-pop"><ExportButton defaultFrom={monthStart(now)} defaultTo={now} /></div>
          </details>
          {canOrders && <Link href="/operasional/pesanan/impor" className="btn btn-ghost btn-sm">Impor dari Zahir</Link>}
          {canOrders && <Link href="/operasional/pesanan/baru" className="btn btn-primary btn-sm">+ Buat PO baru</Link>}
        </div>
      </header>

      {(canShip || canLoad) && <NotificationPanel items={notices} />}

      <section className="ohome-stats">
        {[
          { label: "Total PO", value: s.total, note: "semua periode", tone: "c-orange" },
          { label: "Dalam perjalanan", value: s.road, note: "perlu dipantau", tone: "c-amber" },
          { label: "Sudah selesai", value: s.done, note: "pengiriman berhasil", tone: "c-green" },
          { label: "Sopir aktif", value: s.drivers, note: "terdaftar & aktif", tone: "c-navy" },
        ].map((k) => (
          <article key={k.label} className="ohome-card ohome-stat">
            <span className="ohome-stat-label">{k.label}</span>
            <b className={k.tone}>{k.value.toLocaleString("id-ID")}</b>
            <span className="small muted">{k.note}</span>
          </article>
        ))}
      </section>

      <section className="ohome-card">
        <div className="ohome-card-head">
          <div>
            <h2>Menunggu dimuat ({waiting.length})</h2>
            <p className="small muted">PO yang belum dikonfirmasi &quot;Sudah dimuat&quot; oleh mandor, satpam, sopir, atau kantor.</p>
          </div>
          <Link href="/operasional/muatan" className="small">Lihat semua</Link>
        </div>
        {!waiting.length ? (
          <p className="small muted">Semua muatan yang ditugaskan sudah dimuat.</p>
        ) : (
          <ul className="ohome-list">
            {waiting.map((w) => {
              const l = loadText(w.id);
              return (
                <li key={w.id}>
                  <div>
                    <b>{w.orderNumber} · {w.contactName}</b>
                    <div className="small muted">{[l.names, l.qty, w.driver ? `${w.driver}${w.plate ? ` (${w.plate})` : ""}` : null, `kirim ${tgl(w.date)}`].filter(Boolean).join(" · ")}</div>
                  </div>
                  {(canShip || canLoad) && <LoadButton id={w.id} className="btn btn-primary btn-sm" />}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="ohome-card">
        <div className="ohome-card-head">
          <div>
            <h2>Peringatan dokumen armada</h2>
            <p className="small muted">SIM, STNK, dan uji KIR yang habis dalam 30 hari ditampilkan di sini.</p>
          </div>
          <span className="small"><b>{alerts.length}</b> perlu perhatian · {past} lewat · {soon} ≤ 7 hari</span>
        </div>
        {!alerts.length ? (
          <p className="small muted">Tidak ada dokumen yang habis dalam 30 hari.</p>
        ) : (
          <div className="ohome-docs">
            {alerts.map((a, n) => (
              <Link key={n} href={a.href} className={`ohome-doc${a.daysLeft < 0 ? " is-past" : ""}`}>
                <span className="small"><b>{a.kind}</b> · {a.daysLeft < 0 ? "SUDAH HABIS" : `${a.daysLeft} hari lagi`}</span>
                <b>{a.owner}</b>
                <span className="small muted">Berlaku sampai {tgl(a.expiry)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="ohome-card">
        <div className="ohome-card-head">
          <div>
            <h2>PO dan pengiriman</h2>
            <p className="small muted">Edit sebelum ditugaskan, batalkan dengan alasan, atau hapus PO salah input.</p>
          </div>
        </div>
        <nav className="seg" aria-label="Daftar PO" style={{ marginBottom: 12 }}>
          <Link href="/operasional" aria-current={tab === "aktif" ? "page" : undefined}>PO Aktif ({s.active})</Link>
          <Link href="/operasional?po=batal" aria-current={tab === "batal" ? "page" : undefined}>Dibatalkan ({s.cancelled})</Link>
          <Link href="/operasional?po=hapus" aria-current={tab === "hapus" ? "page" : undefined}>Riwayat Hapus ({s.removed})</Link>
        </nav>
        {tab === "hapus" ? (
          <div className="admin-table">
            <table className="compact">
              <thead><tr><th>Nomor PO</th><th>Pelanggan</th><th>Alasan hapus</th><th>Dihapus</th></tr></thead>
              <tbody>
                {deleted.map((d) => (
                  <tr key={d.id}><td><b>{d.number}</b></td><td>{d.customerName}</td><td>{d.reason ?? "-"}</td><td className="small">{new Date(d.deletedAt * 1000).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" })}</td></tr>
                ))}
                {!deleted.length && <tr><td colSpan={4} className="muted">Belum ada PO yang dihapus.</td></tr>}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="admin-table">
            <table className="compact ohome-po">
              <thead><tr><th>Nomor PO</th><th>Pelanggan</th><th>Barang</th><th>Tujuan</th><th>Status</th><th>Armada</th><th>Aksi</th></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const st = r.status ? STATUS[r.status] : null;
                  const l = loadText(r.deliveryId, r.orderId);
                  const assigned = Boolean(r.driver);
                  return (
                    <tr key={r.orderId}>
                      <td>
                        <Link href={`/operasional/pesanan/${r.orderId}`}><b>{r.orderNumber}</b></Link>
                        {r.isInternal ? <span className="badge badge-info" style={{ marginLeft: 4 }}>INTERNAL</span> : null}
                        {docLabel(r.externalRef) && <div className="small muted">{docLabel(r.externalRef)}</div>}
                        <PaymentBadge status={r.paymentStatus} />
                        <div className="small muted">{r.deliveryDate ? tgl(r.deliveryDate) : "Belum dijadwalkan"}</div>
                      </td>
                      <td><b>{r.contactName}</b>{r.phone && <div className="small muted">{r.phone}</div>}</td>
                      <td>{l.names || "-"}{l.qty && <div className="small muted">{l.qty}</div>}</td>
                      <td className="small">
                        <div>{r.address ? "Alamat tersimpan" : "Alamat belum ada"}</div>
                        <div className={r.mapsUrl ? "" : "text-bahaya"}>{r.mapsUrl ? "Share Location tersimpan" : "Lokasi belum presisi"}</div>
                      </td>
                      <td>{st ? <span className={`ohome-status ${st.tone}`}>{r.status === "dijadwalkan" && !assigned ? "Belum ditugaskan" : st.label}</span> : <span className="ohome-status st-wait">{r.orderStatus === "batal" ? "Dibatalkan" : "Belum dijadwalkan"}</span>}</td>
                      <td>{r.driver ? <><b>{r.driver}</b><div className="small muted">{r.plate}{r.vehicleName ? ` (${r.vehicleName})` : ""}</div></> : <span className="small muted">Belum ditugaskan</span>}</td>
                      <td>
                        <div className="ohome-row-actions">
                          {r.deliveryId ? <Link href={`/operasional/pengiriman/${r.deliveryId}`} className="btn btn-ghost btn-sm">{r.status === "terkirim" ? "Lihat" : "Kelola"}</Link> : canShip && r.orderStatus !== "batal" && <Link href={`/operasional/pengiriman/baru?pesanan=${r.orderId}`} className="btn btn-blue btn-sm">Tugaskan</Link>}
                          {r.deliveryId && r.status === "dijadwalkan" && assigned && (canShip || canLoad) && <LoadButton id={r.deliveryId} label="Sudah dimuat" className="btn btn-primary btn-sm" />}
                          {canOrders && <Link href={`/operasional/pesanan/${r.orderId}`} className="btn btn-ghost btn-sm">Ubah tamu</Link>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!rows.length && <tr><td colSpan={7} className="muted">Belum ada PO.</td></tr>}
              </tbody>
            </table>
            {rows.length >= 150 && <p className="small muted">Menampilkan 150 PO terbaru. <Link href="/operasional/pesanan?status=semua">Lihat semua pesanan</Link>.</p>}
          </div>
        )}
      </section>

      <section className="ohome-card">
        <div className="ohome-card-head">
          <div>
            <h2>Posisi &amp; jalur sopir aktif</h2>
            <p className="small muted">Titik dan jalur diperbarui otomatis.</p>
          </div>
          <Link href="/operasional/lacak" className="small">Buka peta penuh</Link>
        </div>
        <TruckTracker initial={{ trucks, route: null, now: Math.floor(Date.now() / 1000) }} today={now} canSetup={false} />
      </section>

      <section className="ohome-card">
        <div className="ohome-card-head">
          <div>
            <h2>Sopir &amp; kendaraan</h2>
            <p className="small muted">Kelola data armada yang dapat ditugaskan ke PO.</p>
          </div>
          {canShip && (
            <div className="ohome-actions">
              <Link href="/operasional/sopir" className="btn btn-ghost btn-sm">Tambah sopir</Link>
              <Link href="/operasional/armada" className="btn btn-ghost btn-sm">Tambah kendaraan</Link>
            </div>
          )}
        </div>
        <div className="ohome-fleet">
          <div>
            <h3>Sopir terdaftar <span className="muted">{drivers.length}</span></h3>
            <ul className="ohome-list">
              {drivers.map((d) => (
                <li key={d.id}>
                  <div>
                    <Link href={`/operasional/sopir/${d.id}`}><b>{d.name}</b></Link>
                    <div className="small muted">{d.phone}</div>
                    <div className="small">{d.push ? "🔔 Notifikasi tugas aktif" : <span className="muted">Notifikasi tugas belum diaktifkan di HP</span>}</div>
                  </div>
                  <span className={`badge ${d.active ? "badge-on" : "badge-off"}`}>{d.active ? "Aktif" : "Nonaktif"}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Kendaraan <span className="muted">{vehicles.length}</span></h3>
            <ul className="ohome-list">
              {vehicles.map((v) => (
                <li key={v.id}>
                  <div><Link href={`/operasional/armada/${v.id}`}><b>{v.plate}</b></Link><div className="small muted">{v.name}</div></div>
                  <span className={`badge ${v.active ? "badge-on" : "badge-off"}`}>{v.active ? "Aktif" : "Nonaktif"}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      <p className="small muted" style={{ textAlign: "center" }}><Link href="/operasional?ringkasan=1">Lihat ringkasan stok &amp; produksi</Link></p>
    </div>
  );
}
