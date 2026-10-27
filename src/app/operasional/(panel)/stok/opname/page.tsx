import Link from "next/link";
import { sql } from "drizzle-orm";
import { Ok, PageHead } from "@/components/erp/ui";
import { getDb } from "@/db";
import { requirePerm } from "@/lib/auth";
import { tgl } from "@/lib/erp/util";

export const metadata = { title: "Stok opname" };

export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await requirePerm("opname");
  const { ok } = await searchParams;
  const db = await getDb();
  const rows = await db.all<{ id: string; number: string; date: string; note: string; creator: string | null; lines: number; diffs: number }>(sql`
    select c.id, c.number, c.date, c.note, u.name as creator,
      (select count(*) from inv_count_lines l where l.count_id = c.id) as lines,
      (select count(*) from inv_adjustments a where a.count_id = c.id) as diffs
    from inv_counts c left join users u on u.id = c.created_by
    order by c.counted_at desc, c.number desc limit 200`);
  return (
    <>
      <PageHead title="Stok opname" sub="Hitung fisik di gudang; selisih terhadap stok di sistem otomatis menjadi penyesuaian stok.">
        <Link href="/operasional/stok/opname/baru" className="btn btn-primary btn-sm">+ Stok opname</Link>
      </PageHead>
      <Ok ok={ok} />
      <div className="admin-table">
        <table>
          <thead><tr><th>Nomor</th><th>Tanggal</th><th className="num">Barang dihitung</th><th className="num">Selisih diposting</th><th>Petugas</th><th>Catatan</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/operasional/stok/opname/${r.id}`}><b>{r.number}</b></Link></td>
                <td>{tgl(r.date)}</td>
                <td className="num">{Number(r.lines)}</td>
                <td className="num">{Number(r.diffs)}</td>
                <td className="small muted">{r.creator ?? "-"}</td>
                <td className="small">{r.note || "-"}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="muted" style={{ padding: 24 }}>Belum ada stok opname. Mulai dengan menghitung fisik barang di gudang.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
