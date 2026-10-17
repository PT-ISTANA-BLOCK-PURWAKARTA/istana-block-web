import Link from "next/link";
import { and, asc, eq, like, or } from "drizzle-orm";
import { ImportItemsButton } from "@/components/erp/ImportItemsButton";
import { Ok, PageHead, Rp } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { itemKinds } from "@/db/erp";
import { requireModule } from "@/lib/auth";
import { ITEM_KIND_LABEL } from "@/lib/erp/accounting";
import { stockLevels, unitCost } from "@/lib/erp/server";
import { formatQty } from "@/lib/erp/util";

export const metadata = { title: "Barang & jasa" };

export default async function Barang({ searchParams }: { searchParams: Promise<{ ok?: string; q?: string; jenis?: string }> }) {
  await requireModule("keuangan");
  const { ok, q, jenis } = await searchParams;
  const db = await getDb();
  const kind = (itemKinds as readonly string[]).includes(jenis ?? "") ? (jenis as (typeof itemKinds)[number]) : undefined;
  const rows = await db
    .select()
    .from(schema.items)
    .where(and(q ? or(like(schema.items.name, `%${q}%`), like(schema.items.code, `%${q}%`)) : undefined, kind ? eq(schema.items.kind, kind) : undefined))
    .orderBy(asc(schema.items.kind), asc(schema.items.code));
  const levels = await stockLevels(db);
  return (
    <>
      <PageHead title="Barang & jasa" sub="Daftar barang untuk faktur, pesanan, pembelian, dan stok.">
        <ImportItemsButton />
        <Link href="/akuntansi/barang/baru" className="btn btn-primary btn-sm">+ Barang</Link>
      </PageHead>
      <Ok ok={ok} />
      <form className="filter-bar" method="get">
        <div className="field grow"><label htmlFor="q">Cari</label><input id="q" name="q" defaultValue={q} placeholder="kode atau nama" /></div>
        <div className="field">
          <label htmlFor="jenis">Jenis</label>
          <select id="jenis" name="jenis" defaultValue={jenis ?? ""}>
            <option value="">Semua</option>
            {itemKinds.map((k) => <option key={k} value={k}>{ITEM_KIND_LABEL[k]}</option>)}
          </select>
        </div>
        <button className="btn btn-blue btn-sm" type="submit">Cari</button>
      </form>
      <div className="admin-table">
        <table>
          <thead>
            <tr><th>Kode</th><th>Nama</th><th>Jenis</th><th className="num">Harga jual</th><th className="num">Harga pokok</th><th className="num">Stok</th></tr>
          </thead>
          <tbody>
            {rows.map((i) => {
              const lv = levels.get(i.id);
              const low = i.trackStock && i.minStock > 0 && (lv?.qty ?? 0) < i.minStock;
              return (
                <tr key={i.id} className={i.active ? "" : "row-muted"}>
                  <td className="tabular">{i.code}</td>
                  <td><Link href={`/akuntansi/barang/${i.id}`}><b>{i.name}</b></Link><div className="small muted">per {i.unit}</div></td>
                  <td>{ITEM_KIND_LABEL[i.kind]}</td>
                  <td className="num"><Rp n={i.sellPrice} /></td>
                  <td className="num">{i.trackStock ? <Rp n={Math.round(unitCost(lv, i))} /> : "—"}</td>
                  <td className={`num${low ? " text-bahaya" : ""}`}>{i.trackStock ? `${formatQty(lv?.qty ?? 0)} ${i.unit}` : "—"}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="muted">Belum ada barang. Klik <b>Ambil dari daftar harga website</b> untuk membuat barang dari tabel harga produk, atau tambah manual.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
