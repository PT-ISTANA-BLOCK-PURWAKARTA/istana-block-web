import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { deleteVehicle } from "@/app/operasional/actions/fleet";
import { ConfirmAction } from "@/components/erp/ConfirmAction";
import { BackLink, PageHead } from "@/components/erp/ui";
import { VehicleForm } from "@/components/ops/FleetForms";
import { getDb, schema } from "@/db";
import { opsAccess } from "@/lib/erp/ops";

export const metadata = { title: "Kendaraan" };

export default async function Kendaraan({ params }: { params: Promise<{ id: string }> }) {
  const { canEdit } = await opsAccess();
  if (!canEdit) redirect("/operasional/armada");
  const { id } = await params;
  const db = await getDb();
  const v = await db.query.vehicles.findFirst({ where: eq(schema.vehicles.id, id) });
  if (!v) notFound();
  return (
    <>
      <BackLink href="/operasional/armada">Armada</BackLink>
      <PageHead title={v.plate} />
      <div className="stack" style={{ gap: 20, maxWidth: 860 }}>
        <VehicleForm v={v} />
        <div><ConfirmAction action={deleteVehicle.bind(null, v.id)} label="Hapus / nonaktifkan" confirmText={`Hapus ${v.plate}? Bila sudah dipakai surat jalan, kendaraan hanya dinonaktifkan.`} /></div>
      </div>
    </>
  );
}
