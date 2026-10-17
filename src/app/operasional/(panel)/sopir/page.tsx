import Link from "next/link";
import { asc, sql } from "drizzle-orm";
import { Ok, PageHead } from "@/components/erp/ui";
import { DriverForm } from "@/components/ops/FleetForms";
import { getDb, schema } from "@/db";
import { opsAccess } from "@/lib/erp/ops";
import { tgl } from "@/lib/erp/util";

export const metadata = { title: "Sopir" };

export default async function Sopir({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { canShip: canEdit } = await opsAccess();
  const { ok } = await searchParams;
  const db = await getDb();
  const [rows, usage] = await Promise.all([
    db.select().from(schema.drivers).orderBy(asc(schema.drivers.name)),
    db.all<{ id: string; n: number; last: string }>(sql`select driver_id id, count(*) n, max(date) last from ops_deliveries where status = 'terkirim' and driver_id is not null group by driver_id`),
  ]);
  const u = new Map(usage.map((x) => [x.id, x]));
  return (
    <>
      <PageHead title="Sopir" />
      <Ok ok={ok} />
      <div className="stack" style={{ gap: 20 }}>
        <div className="admin-table">
          <table>
            <thead><tr><th>Nama</th><th>Telepon</th><th>Catatan</th><th className="num">Trip terkirim</th><th>Terakhir</th></tr></thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} className={d.active ? undefined : "row-muted"}>
                  <td>{canEdit ? <Link href={`/operasional/sopir/${d.id}`}><b>{d.name}</b></Link> : <b>{d.name}</b>}{!d.active && <div className="small">nonaktif</div>}</td>
                  <td>{d.phone && <a href={`tel:${d.phone}`}>{d.phone}</a>}</td>
                  <td className="small">{d.note}</td>
                  <td className="num">{Number(u.get(d.id)?.n ?? 0)}</td>
                  <td className="small">{u.get(d.id)?.last ? tgl(u.get(d.id)!.last) : "—"}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={5} className="muted" style={{ padding: 24 }}>Belum ada sopir.</td></tr>}
            </tbody>
          </table>
        </div>
        {canEdit && <DriverForm />}
      </div>
    </>
  );
}
