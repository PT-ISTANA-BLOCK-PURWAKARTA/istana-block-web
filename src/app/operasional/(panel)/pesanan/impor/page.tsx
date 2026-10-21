import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { BackLink, PageHead } from "@/components/erp/ui";
import { ZahirImport } from "@/components/ops/order/ZahirImport";
import { getDb, schema } from "@/db";
import { opsAccess } from "@/lib/erp/ops";
import { today } from "@/lib/erp/util";

export const metadata = { title: "Impor dari Zahir" };

export default async function ImporZahir() {
  const { canOrders, canShip, canFinance } = await opsAccess();
  if (!canOrders) redirect("/operasional/pesanan");
  const db = await getDb();
  const [items, drivers, vehicles] = await Promise.all([
    db.select({ id: schema.items.id, name: schema.items.name, unit: schema.items.unit, kind: schema.items.kind }).from(schema.items).where(eq(schema.items.active, true)).orderBy(asc(schema.items.code)),
    canShip ? db.select({ id: schema.drivers.id, name: schema.drivers.name }).from(schema.drivers).where(eq(schema.drivers.active, true)).orderBy(asc(schema.drivers.name)) : [],
    canShip ? db.select({ id: schema.vehicles.id, plate: schema.vehicles.plate, name: schema.vehicles.name }).from(schema.vehicles).where(eq(schema.vehicles.active, true)).orderBy(asc(schema.vehicles.plate)) : [],
  ]);
  return (
    <>
      <BackLink href="/operasional/pesanan">Pesanan</BackLink>
      <PageHead title="Buat PO dari Zahir" sub="Pilih cetakan surat jalan (disarankan: dibuat setelah pelanggan bayar) atau faktur Zahir (.fp3). Satu dokumen menjadi satu PO." />
      <ZahirImport
        items={items}
        drivers={drivers.map((d) => ({ id: d.id, label: d.name }))}
        vehicles={vehicles.map((v) => ({ id: v.id, plate: v.plate, label: v.name ? `${v.plate} · ${v.name}` : v.plate }))}
        canFinance={canFinance}
        canShip={canShip}
        today={today()}
      />
    </>
  );
}
