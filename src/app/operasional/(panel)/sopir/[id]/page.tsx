import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { deleteDriver } from "@/app/operasional/actions/fleet";
import { ConfirmAction } from "@/components/erp/ConfirmAction";
import { BackLink, PageHead } from "@/components/erp/ui";
import { DriverForm } from "@/components/ops/FleetForms";
import { getDb, schema } from "@/db";
import { opsAccess } from "@/lib/erp/ops";

export const metadata = { title: "Sopir" };

export default async function SopirDetail({ params }: { params: Promise<{ id: string }> }) {
  const { canEdit } = await opsAccess();
  if (!canEdit) redirect("/operasional/sopir");
  const { id } = await params;
  const db = await getDb();
  const d = await db.query.drivers.findFirst({ where: eq(schema.drivers.id, id) });
  if (!d) notFound();
  return (
    <>
      <BackLink href="/operasional/sopir">Sopir</BackLink>
      <PageHead title={d.name} />
      <div className="stack" style={{ gap: 20, maxWidth: 860 }}>
        <DriverForm d={d} />
        <div><ConfirmAction action={deleteDriver.bind(null, d.id)} label="Hapus / nonaktifkan" confirmText={`Hapus ${d.name}? Bila sudah dipakai surat jalan, sopir hanya dinonaktifkan.`} /></div>
      </div>
    </>
  );
}
