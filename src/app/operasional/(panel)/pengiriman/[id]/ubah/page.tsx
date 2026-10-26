import { notFound, redirect } from "next/navigation";
import { asc, eq, or } from "drizzle-orm";
import { BackLink, PageHead } from "@/components/erp/ui";
import { DeliveryForm } from "@/components/ops/DeliveryForm";
import { getDb, schema } from "@/db";
import { isArchive } from "@/lib/erp/archive";
import { opsAccess } from "@/lib/erp/ops";
import { stockPosition } from "@/lib/erp/insights";
import { orderProgress } from "@/lib/erp/orders";

export const metadata = { title: "Ubah jadwal kirim" };

export default async function UbahPengiriman({ params }: { params: Promise<{ id: string }> }) {
  const { canShip: canEdit } = await opsAccess();
  const { id } = await params;
  if (!canEdit || isArchive(id)) redirect(`/operasional/pengiriman/${id}`);
  const db = await getDb();
  const d = await db.query.deliveries.findFirst({ where: eq(schema.deliveries.id, id) });
  if (!d) notFound();
  if (d.status !== "dijadwalkan") redirect(`/operasional/pengiriman/${id}`);
  const [prog, own, vehicles, drivers] = await Promise.all([
    orderProgress(db, d.orderId),
    db.select().from(schema.deliveryLines).where(eq(schema.deliveryLines.deliveryId, id)),
    db.select().from(schema.vehicles).where(d.vehicleId ? or(eq(schema.vehicles.active, true), eq(schema.vehicles.id, d.vehicleId)) : eq(schema.vehicles.active, true)).orderBy(asc(schema.vehicles.plate)),
    db.select().from(schema.drivers).where(d.driverId ? or(eq(schema.drivers.active, true), eq(schema.drivers.id, d.driverId)) : eq(schema.drivers.active, true)).orderBy(asc(schema.drivers.name)),
  ]);
  const free = new Map((await stockPosition(db)).map((x) => [x.id, x.free]));
  const mine = new Map<string, number>();
  for (const l of own) mine.set(l.orderLineId, (mine.get(l.orderLineId) ?? 0) + l.qty);
  const lines = prog
    .map((p) => {
      const qty = mine.get(p.id) ?? 0;
      const left = Math.max(0, Math.round((p.qty - p.scheduled + qty) * 1000) / 1000);
      // Muatan surat jalan ini sendiri sudah terhitung "dijadwalkan"; tambahkan kembali ke stok bebasnya.
      const f = free.get(p.itemId);
      return { orderLineId: p.id, name: p.name, unit: p.unit, ordered: p.qty, left, qty, free: f == null ? null : f + qty };
    })
    .filter((l) => l.left > 0 || l.qty > 0);
  return (
    <>
      <BackLink href={`/operasional/pengiriman/${id}`}>{d.number}</BackLink>
      <PageHead title={`Ubah ${d.number}`} />
      <DeliveryForm id={d.id} orderId={d.orderId} date={d.date} vehicleId={d.vehicleId} driverId={d.driverId} note={d.note} lines={lines} vehicles={vehicles} drivers={drivers} />
    </>
  );
}
