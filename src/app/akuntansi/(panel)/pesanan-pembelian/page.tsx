// Daftar Permintaan Penawaran / Pesanan Pembelian ke pemasok.
import Link from "next/link";
import { sql } from "drizzle-orm";
import { PageHead } from "@/components/erp/ui";
import { getDb } from "@/db";
import { requireModule } from "@/lib/auth";
import { PO_STATUS } from "@/lib/erp/masterData";
import { formatAmount, isDate, tgl, today, yearStart } from "@/lib/erp/util";

export const metadata = { title: "Pesanan Pembelian" };
export const dynamic = "force-dynamic";


export default async function PesananPembelian({ searchParams }: { searchParams: Promise<{ jenis?: string; status?: string; from?: string; to?: string }> }) {
  await requireModule("keuangan");
  const sp = await searchParams;
  const kind = sp.jenis === "rfq" ? "rfq" : "po";
  const to = isDate(sp.to) ? sp.to : today();
  const from = isDate(sp.from) ? sp.from : yearStart(to);
  const st = sp.status && PO_STATUS[sp.status] ? sp.status : null;
  const db = await getDb();
  const rows = await db.all<{ id: string; number: string; date: string; expectedDate: string | null; status: string; total: number; contact: string; n: number }>(sql`
    select o.id, o.number, o.date, o.expected_date expectedDate, o.status, o.total, c.name contact, (select count(*) from fin_purchase_order_lines l where l.order_id = o.id) n
      from fin_purchase_orders o join fin_contacts c on c.id = o.contact_id
     where o.kind = ${kind} and o.date >= ${from} and o.date <= ${to} and (${st} is null or o.status = ${st}) order by o.date desc, o.number desc`);
  const title = kind === "rfq" ? "Permintaan Penawaran" : "Pesanan Pembelian";
  return (
    <>
      <PageHead title={title} sub={kind === "rfq" ? "Minta penawaran harga ke pemasok; penawaran yang disetujui diteruskan menjadi pesanan pembelian." : "Pesanan ke pemasok sebelum barang datang; setelah barang diterima, buat faktur pembelian dari pesanan."}>
        <Link href={`/akuntansi/pesanan-pembelian/baru?jenis=${kind}`} className="btn btn-primary btn-sm">+ {title} baru</Link>
      </PageHead>
      <nav className="zt-tabs">
        <Link href="/akuntansi/pesanan-pembelian?jenis=rfq" aria-current={kind === "rfq" ? "page" : undefined}>Permintaan Penawaran</Link>
        <Link href="/akuntansi/pesanan-pembelian" aria-current={kind === "po" ? "page" : undefined}>Pesanan Pembelian</Link>
      </nav>
      <form method="get" className="filter-bar">
        {kind === "rfq" && <input type="hidden" name="jenis" value="rfq" />}
        <div className="field"><label htmlFor="pf">Dari</label><input id="pf" type="date" name="from" defaultValue={from} /></div>
        <div className="field"><label htmlFor="pt">Sampai</label><input id="pt" type="date" name="to" defaultValue={to} /></div>
        <div className="field"><label htmlFor="ps">Status</label><select id="ps" name="status" defaultValue={st ?? ""}><option value="">Semua</option>{Object.entries(PO_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <button className="btn btn-blue btn-sm">Tampilkan</button>
      </form>
      <div className="admin-table">
        <table>
          <thead><tr><th>Tanggal</th><th>Nomor</th><th>Pemasok</th><th>{kind === "rfq" ? "Ditunggu" : "Diharapkan datang"}</th><th>Status</th><th className="num">Baris</th><th className="num">Total</th></tr></thead>
          <tbody>
            {rows.map((r) => <tr key={r.id}><td className="nowrap">{tgl(r.date)}</td><td><Link href={`/akuntansi/pesanan-pembelian/${r.id}`}>{r.number}</Link></td><td>{r.contact}</td><td className="nowrap">{r.expectedDate ? tgl(r.expectedDate) : "-"}</td><td className="small">{PO_STATUS[r.status]}</td><td className="num">{r.n}</td><td className="num">{formatAmount(Number(r.total))}</td></tr>)}
            {!rows.length && <tr><td colSpan={7} className="muted">Belum ada {title.toLowerCase()} pada periode ini.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
