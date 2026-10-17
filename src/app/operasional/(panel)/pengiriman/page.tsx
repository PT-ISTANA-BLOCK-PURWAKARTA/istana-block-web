import Link from "next/link";
import { sql } from "drizzle-orm";
import { Ok, PageHead, Status } from "@/components/erp/ui";
import { getDb } from "@/db";
import { deliveryItems, opsAccess } from "@/lib/erp/ops";
import { formatQty, isDate, tgl } from "@/lib/erp/util";

export const metadata = { title: "Pengiriman" };

const TABS = [
  { key: "", label: "Berjalan" },
  { key: "dijadwalkan", label: "Dijadwalkan" },
  { key: "berangkat", label: "Dalam perjalanan" },
  { key: "terkirim", label: "Terkirim" },
  { key: "batal", label: "Batal" },
  { key: "semua", label: "Semua" },
];

type Row = { id: string; number: string; date: string; status: string; orderId: string; orderNumber: string; contactName: string; project: string; address: string; plate: string | null; driver: string | null; receivedBy: string };

export default async function Pengiriman({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; tanggal?: string; ok?: string }> }) {
  const { canShip: canEdit } = await opsAccess();
  const sp = await searchParams;
  const status = TABS.some((t) => t.key === sp.status) ? (sp.status as string) : "";
  const q = (sp.q ?? "").trim();
  const date = isDate(sp.tanggal) ? sp.tanggal : "";
  const like = `%${q}%`;
  const db = await getDb();
  const statusSql = status === "" ? sql`d.status in ('dijadwalkan','berangkat')` : status === "semua" ? sql`1 = 1` : sql`d.status = ${status}`;
  const rows = await db.all<Row>(sql`
    select d.id, d.number, d.date, d.status, o.id orderId, o.number orderNumber, c.name contactName, o.project, o.address, v.plate, dr.name driver, d.received_by receivedBy
    from ops_deliveries d join ops_orders o on o.id = d.order_id join fin_contacts c on c.id = o.contact_id
      left join ops_vehicles v on v.id = d.vehicle_id left join ops_drivers dr on dr.id = d.driver_id
    where ${statusSql}
      ${date ? sql`and d.date = ${date}` : sql``}
      ${q ? sql`and (d.number like ${like} or o.number like ${like} or c.name like ${like} or o.project like ${like} or v.plate like ${like} or dr.name like ${like})` : sql``}
    order by ${status === "" || status === "dijadwalkan" ? sql`d.date asc, d.number asc` : sql`d.date desc, d.number desc`} limit 300`);
  const items = await deliveryItems(db, rows.map((r) => r.id));
  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ ...(status ? { status } : {}), ...(date ? { tanggal: date } : {}), ...(q ? { q } : {}), ...patch });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    const s = p.toString();
    return `/operasional/pengiriman${s ? `?${s}` : ""}`;
  };
  return (
    <>
      <PageHead title="Pengiriman" sub="Surat jalan: dijadwalkan → berangkat → terkirim.">
        {canEdit && <Link href="/operasional/pengiriman/baru" className="btn btn-primary btn-sm">+ Jadwalkan kirim</Link>}
      </PageHead>
      <Ok ok={sp.ok} />
      <form className="filter-bar" method="get">
        <nav className="seg" aria-label="Status pengiriman">
          {TABS.map((t) => (
            <Link key={t.key} href={qs({ status: t.key })} aria-current={t.key === status ? "page" : undefined}>{t.label}</Link>
          ))}
        </nav>
        {status && <input type="hidden" name="status" value={status} />}
        <div className="field"><label htmlFor="tanggal">Tanggal</label><input id="tanggal" name="tanggal" type="date" defaultValue={date} /></div>
        <div className="field grow"><label htmlFor="q">Cari</label><input id="q" name="q" defaultValue={q} placeholder="nomor, pelanggan, proyek, nopol, sopir" /></div>
        <button type="submit" className="btn btn-blue btn-sm">Tampilkan</button>
      </form>
      <div className="admin-table">
        <table>
          <thead><tr><th>Surat jalan</th><th>Pelanggan &amp; tujuan</th><th>Isi</th><th>Armada &amp; sopir</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.status === "batal" ? "row-muted" : undefined}>
                <td><Link href={`/operasional/pengiriman/${r.id}`}><b>{r.number}</b></Link><div className="small muted">{tgl(r.date)} · <Link href={`/operasional/pesanan/${r.orderId}`}>{r.orderNumber}</Link></div></td>
                <td><b>{r.contactName}</b><div className="small muted clamp-2">{r.project || r.address}</div></td>
                <td className="small">{(items.get(r.id) ?? []).map((x, i) => <div key={i}><b className="tabular">{formatQty(x.qty)} {x.unit}</b> · {x.name}</div>)}</td>
                <td className="small">{r.plate ?? <span className="muted">—</span>}<div className="muted">{r.driver ?? ""}</div></td>
                <td><Status s={r.status} />{r.receivedBy && <div className="small muted">diterima {r.receivedBy}</div>}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="muted" style={{ padding: 24 }}>Tidak ada surat jalan di kelompok ini.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
