import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq, sql } from "drizzle-orm";
import { BackLink, PageHead, Status } from "@/components/erp/ui";
import { DeliveryForm } from "@/components/ops/DeliveryForm";
import { getDb, schema } from "@/db";
import { opsAccess } from "@/lib/erp/ops";
import { overdueByContact, stockPosition } from "@/lib/erp/insights";
import { orderProgress } from "@/lib/erp/orders";
import { tgl, today } from "@/lib/erp/util";

export const metadata = { title: "Jadwalkan pengiriman" };

export default async function PengirimanBaru({ searchParams }: { searchParams: Promise<{ pesanan?: string }> }) {
  const { canShip: canEdit } = await opsAccess();
  if (!canEdit) redirect("/operasional/pengiriman");
  const sp = await searchParams;
  const db = await getDb();
  const order = sp.pesanan ? await db.query.orders.findFirst({ where: eq(schema.orders.id, sp.pesanan) }) : undefined;

  if (!order) {
    // Belum memilih pesanan: tampilkan pesanan aktif yang masih punya sisa untuk dijadwalkan.
    const open = await db.all<{ id: string; number: string; date: string; requestedDate: string | null; status: string; contactName: string; project: string; ordered: number; scheduled: number }>(sql`
      select o.id, o.number, o.date, o.requested_date requestedDate, o.status, c.name contactName, o.project,
        (select coalesce(sum(qty),0) from ops_order_lines where order_id = o.id) ordered,
        (select coalesce(sum(dl.qty),0) from ops_delivery_lines dl join ops_deliveries d on d.id = dl.delivery_id where d.order_id = o.id and d.status <> 'batal') scheduled
      from ops_orders o join fin_contacts c on c.id = o.contact_id
      where o.status in ('dikonfirmasi','dikirim_sebagian')
      order by coalesce(o.requested_date, o.date), o.number`);
    const rows = open.filter((o) => Number(o.scheduled) + 1e-9 < Number(o.ordered));
    return (
      <>
        <BackLink href="/operasional/pengiriman">Pengiriman</BackLink>
        <PageHead title="Jadwalkan pengiriman" sub="Pilih pesanan yang akan dikirim." />
        <div className="admin-table">
          <table>
            <thead><tr><th>Pesanan</th><th>Pelanggan</th><th>Minta kirim</th><th>Status</th><th /></tr></thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id}>
                  <td><b>{o.number}</b><div className="small muted">{tgl(o.date)}</div></td>
                  <td><b>{o.contactName}</b>{o.project && <div className="small muted">{o.project}</div>}</td>
                  <td className="small">{o.requestedDate ? tgl(o.requestedDate) : "—"}</td>
                  <td><Status s={o.status} /></td>
                  <td className="num"><Link href={`/operasional/pengiriman/baru?pesanan=${o.id}`} className="btn btn-blue btn-sm">Pilih</Link></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={5} className="muted" style={{ padding: 24 }}>Tidak ada pesanan aktif yang menunggu dijadwalkan. <Link href="/operasional/pesanan/baru">Buat pesanan</Link>.</td></tr>}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  const [prog, contact, vehicles, drivers, stock, overdue] = await Promise.all([
    orderProgress(db, order.id),
    db.query.contacts.findFirst({ where: eq(schema.contacts.id, order.contactId) }),
    db.select().from(schema.vehicles).where(eq(schema.vehicles.active, true)).orderBy(asc(schema.vehicles.plate)),
    db.select().from(schema.drivers).where(eq(schema.drivers.active, true)).orderBy(asc(schema.drivers.name)),
    stockPosition(db),
    overdueByContact(db, today()),
  ]);
  const free = new Map(stock.map((s) => [s.id, s.free]));
  const late = overdue.get(order.contactId);
  const lines = prog
    .map((p) => {
      const left = Math.max(0, Math.round((p.qty - p.scheduled) * 1000) / 1000);
      return { orderLineId: p.id, name: p.name, unit: p.unit, ordered: p.qty, left, qty: left, free: free.get(p.itemId) ?? null };
    })
    .filter((l) => l.left > 0);
  const date = order.requestedDate && order.requestedDate > today() ? order.requestedDate : today();
  return (
    <>
      <BackLink href={`/operasional/pesanan/${order.id}`}>{order.number}</BackLink>
      <PageHead title="Jadwalkan pengiriman" sub={`${order.number} · ${contact?.name ?? ""}${order.project ? ` · ${order.project}` : ""}`} />
      {order.status === "draft" || order.status === "batal" || order.status === "selesai" ? (
        <p className="alert alert-error">Pesanan berstatus {order.status}; tidak bisa dijadwalkan kirim.</p>
      ) : (
        <>
          {late && (
            <p className="flag flag-warn" style={{ marginBottom: 12 }}>
              Pelanggan ini punya {late.n} faktur lewat jatuh tempo (tertua {tgl(late.oldest)}). Pastikan keuangan sudah setuju sebelum barang dikirim.
            </p>
          )}
          {(vehicles.length === 0 || drivers.length === 0) && (
            <p className="small muted" style={{ marginBottom: 12 }}>
              Data {vehicles.length === 0 ? "armada" : ""}{vehicles.length === 0 && drivers.length === 0 ? " dan " : ""}{drivers.length === 0 ? "sopir" : ""} belum ada.{" "}
              <Link href={vehicles.length === 0 ? "/operasional/armada" : "/operasional/sopir"}>Tambahkan</Link> agar bisa dipilih (boleh dikosongkan dulu).
            </p>
          )}
          <DeliveryForm orderId={order.id} date={date} lines={lines} vehicles={vehicles} drivers={drivers} />
        </>
      )}
    </>
  );
}
