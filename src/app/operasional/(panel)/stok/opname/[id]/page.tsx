import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { deleteCount } from "@/app/operasional/actions/stock-count";
import { ConfirmAction } from "@/components/erp/ConfirmAction";
import { BackLink, Ok, PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { requirePerm } from "@/lib/auth";
import { formatQty, tgl } from "@/lib/erp/util";

export const metadata = { title: "Stok opname" };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  await requirePerm("opname");
  const { id } = await params;
  const { ok } = await searchParams;
  const db = await getDb();
  const c = await db.query.stockCounts.findFirst({ where: eq(schema.stockCounts.id, id) });
  if (!c) notFound();
  const [lines, adjs, by] = await Promise.all([
    db.select({ l: schema.stockCountLines, name: schema.items.name, code: schema.items.code, unit: schema.items.unit }).from(schema.stockCountLines).leftJoin(schema.items, eq(schema.items.id, schema.stockCountLines.itemId)).where(eq(schema.stockCountLines.countId, id)).orderBy(asc(schema.items.name)),
    db.select().from(schema.adjustments).where(eq(schema.adjustments.countId, id)),
    c.createdBy != null ? db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, c.createdBy)).limit(1) : Promise.resolve([]),
  ]);
  const adjOf = new Map(adjs.map((a) => [a.itemId, a]));
  return (
    <>
      <BackLink href="/operasional/stok/opname">Stok opname</BackLink>
      <PageHead title={c.number} sub={`${tgl(c.date)} · ${lines.length} barang dihitung · ${adjs.length} selisih diposting${by[0] ? ` · ${by[0].name}` : ""}`} />
      <Ok ok={ok} />
      {c.note && <p className="small muted">{c.note}</p>}
      <div className="admin-table">
        <table>
          <thead><tr><th>Barang</th><th className="num">Di sistem</th><th className="num">Fisik</th><th className="num">Selisih</th><th>Penyesuaian</th></tr></thead>
          <tbody>
            {lines.map(({ l, name, code, unit }) => {
              const diff = Math.round((l.countedQty - l.systemQty) * 1000) / 1000;
              const a = adjOf.get(l.itemId);
              return (
                <tr key={l.id}>
                  <td><Link href={`/operasional/stok/${l.itemId}`}><b>{name ?? "(barang dihapus)"}</b></Link><div className="small muted">{code}</div></td>
                  <td className="num">{formatQty(l.systemQty)} {unit}</td>
                  <td className="num">{formatQty(l.countedQty)} {unit}</td>
                  <td className={`num${diff < 0 ? " text-bahaya" : ""}`}>{diff === 0 ? "-" : `${diff > 0 ? "+" : ""}${formatQty(diff)} ${unit ?? ""}`}</td>
                  <td className="small">{a ? <Link href={`/operasional/stok/penyesuaian/${a.id}`}>{a.number}</Link> : "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ marginTop: 12 }}>Di sistem = stok web saat dokumen disimpan. Stok web adalah jumlah semua pergerakan, jadi opname menambah / mengurangi selisihnya sehingga stok sama dengan jumlah fisik pada waktu hitung.</p>
      <div><ConfirmAction action={deleteCount.bind(null, c.id)} label="Hapus stok opname" confirmText={`Hapus ${c.number}? Penyesuaian stok dan jurnalnya ikut dibalik.`} /></div>
    </>
  );
}
