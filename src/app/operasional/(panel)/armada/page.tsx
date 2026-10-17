import Link from "next/link";
import { asc, sql } from "drizzle-orm";
import { Ok, PageHead } from "@/components/erp/ui";
import { VehicleForm } from "@/components/ops/FleetForms";
import { getDb, schema } from "@/db";
import { opsAccess } from "@/lib/erp/ops";
import { tgl } from "@/lib/erp/util";

export const metadata = { title: "Armada" };

export default async function Armada({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { canShip: canEdit } = await opsAccess();
  const { ok } = await searchParams;
  const db = await getDb();
  const [rows, usage] = await Promise.all([
    db.select().from(schema.vehicles).orderBy(asc(schema.vehicles.plate)),
    db.all<{ id: string; n: number; last: string }>(sql`select vehicle_id id, count(*) n, max(date) last from ops_deliveries where status = 'terkirim' and vehicle_id is not null group by vehicle_id`),
  ]);
  const u = new Map(usage.map((x) => [x.id, x]));
  return (
    <>
      <PageHead title="Armada" sub="Kendaraan pengiriman yang dipilih di surat jalan." />
      <Ok ok={ok} />
      <div className="stack" style={{ gap: 20 }}>
        <div className="admin-table">
          <table>
            <thead><tr><th>Nomor polisi</th><th>Jenis</th><th>Kapasitas</th><th className="num">Trip terkirim</th><th>Terakhir</th></tr></thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id} className={v.active ? undefined : "row-muted"}>
                  <td>{canEdit ? <Link href={`/operasional/armada/${v.id}`}><b>{v.plate}</b></Link> : <b>{v.plate}</b>}{!v.active && <div className="small">nonaktif</div>}</td>
                  <td>{v.name}</td>
                  <td className="small">{v.capacity}</td>
                  <td className="num">{Number(u.get(v.id)?.n ?? 0)}</td>
                  <td className="small">{u.get(v.id)?.last ? tgl(u.get(v.id)!.last) : "—"}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={5} className="muted" style={{ padding: 24 }}>Belum ada kendaraan.</td></tr>}
            </tbody>
          </table>
        </div>
        {canEdit && <VehicleForm />}
      </div>
    </>
  );
}
