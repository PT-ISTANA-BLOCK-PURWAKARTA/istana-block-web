// Daftar Retur Penjualan / Retur Pembelian.
import Link from "next/link";
import { PageHead } from "@/components/erp/ui";
import { getDb } from "@/db";
import { requireModule } from "@/lib/auth";
import { listReturns, SETTLEMENT_LABEL } from "@/lib/erp/returnsGiro";
import { formatAmount, isDate, tgl, today, yearStart } from "@/lib/erp/util";

export const metadata = { title: "Retur" };
export const dynamic = "force-dynamic";

export default async function Retur({ searchParams }: { searchParams: Promise<{ jenis?: string; from?: string; to?: string; ok?: string }> }) {
  await requireModule("keuangan");
  const sp = await searchParams;
  const kind = sp.jenis === "pembelian" ? "pembelian" : "penjualan";
  const to = isDate(sp.to) ? sp.to : today();
  const from = isDate(sp.from) ? sp.from : yearStart(to);
  const db = await getDb();
  const rows = await listReturns(db, kind, from, to);
  return (
    <>
      <PageHead title={kind === "penjualan" ? "Retur Penjualan" : "Retur Pembelian"} sub={kind === "penjualan" ? "Barang dikembalikan pelanggan: mengurangi penjualan & PPN keluaran, lalu memotong tagihan, jadi uang muka, atau dikembalikan tunai." : "Barang dikembalikan ke pemasok: mengurangi persediaan/beban & PPN masukan, lalu memotong tagihan, jadi uang muka, atau uang kembali."}>
        <Link href={`/akuntansi/retur/baru?jenis=${kind}`} className="btn btn-primary btn-sm">+ Retur {kind} baru</Link>
      </PageHead>
      {sp.ok && <p className="alert alert-ok">{sp.ok === "dihapus" ? "Retur dihapus." : `Tersimpan: ${sp.ok}`}</p>}
      <nav className="zt-tabs">
        <Link href="/akuntansi/retur" aria-current={kind === "penjualan" ? "page" : undefined}>Retur Penjualan</Link>
        <Link href="/akuntansi/retur?jenis=pembelian" aria-current={kind === "pembelian" ? "page" : undefined}>Retur Pembelian</Link>
      </nav>
      <form method="get" className="filter-bar">
        <input type="hidden" name="jenis" value={kind} />
        <div className="field"><label htmlFor="rf">Dari</label><input id="rf" type="date" name="from" defaultValue={from} /></div>
        <div className="field"><label htmlFor="rt">Sampai</label><input id="rt" type="date" name="to" defaultValue={to} /></div>
        <button className="btn btn-blue btn-sm">Tampilkan</button>
      </form>
      <div className="admin-table">
        <table>
          <thead><tr><th>Tanggal</th><th>Nomor</th><th>{kind === "penjualan" ? "Pelanggan" : "Pemasok"}</th><th>Faktur asal</th><th>Penyelesaian</th><th className="num">Total</th></tr></thead>
          <tbody>
            {rows.map((r) => <tr key={r.id}><td className="nowrap">{tgl(r.date)}</td><td><Link href={`/akuntansi/retur/${r.id}`}>{r.number}</Link></td><td>{r.contactName}</td><td>{r.docNumber ?? "-"}</td><td className="small">{SETTLEMENT_LABEL[r.settlement]}</td><td className="num">{formatAmount(r.total)}</td></tr>)}
            {!rows.length && <tr><td colSpan={6} className="muted">Belum ada retur pada periode ini.</td></tr>}
          </tbody>
          {rows.length > 0 && <tfoot><tr><th colSpan={5}>Jumlah</th><th className="num">{formatAmount(rows.reduce((s, r) => s + Number(r.total), 0))}</th></tr></tfoot>}
        </table>
      </div>
    </>
  );
}
