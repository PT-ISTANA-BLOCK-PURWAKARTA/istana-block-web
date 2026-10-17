import { PrintButton } from "@/components/erp/PrintButton";
import { BackLink, PageHead, RangeForm, Rp } from "@/components/erp/ui";
import { getDb } from "@/db";
import { requireModule } from "@/lib/auth";
import { salesSummary } from "@/lib/erp/reports";
import { formatQty, isDate, monthStart, tglPanjang, today } from "@/lib/erp/util";

export const metadata = { title: "Laporan penjualan" };

export default async function LaporanPenjualan({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requireModule("keuangan");
  const sp = await searchParams;
  const to = isDate(sp.to) ? sp.to : today();
  const from = isDate(sp.from) ? sp.from : monthStart(to);
  const db = await getDb();
  const s = await salesSummary(db, from, to);
  const total = s.byItem.reduce((a, r) => a + r.amount, 0);
  return (
    <>
      <BackLink href="/keuangan/laporan">Laporan</BackLink>
      <PageHead title="Penjualan" sub={`${tglPanjang(from)} – ${tglPanjang(to)} · sebelum diskon faktur, ongkir, dan PPN`}>
        <a className="btn btn-ghost btn-sm" href={`/keuangan/ekspor/penjualan?from=${from}&to=${to}`}>Unduh CSV</a>
        <PrintButton />
      </PageHead>
      <RangeForm from={from} to={to} />
      <div className="report-two">
        <div className="admin-table report">
          <table>
            <caption>Per barang</caption>
            <thead><tr><th>Barang</th><th className="num">Qty</th><th className="num">Nilai</th></tr></thead>
            <tbody>
              {s.byItem.map((r, i) => <tr key={i}><td>{r.name}</td><td className="num">{formatQty(r.qty)} {r.unit}</td><td className="num"><Rp n={r.amount} /></td></tr>)}
              {s.byItem.length === 0 && <tr><td colSpan={3} className="muted">Belum ada penjualan.</td></tr>}
            </tbody>
            <tfoot><tr><th colSpan={2}>Total</th><th className="num"><Rp n={total} /></th></tr></tfoot>
          </table>
        </div>
        <div className="admin-table report">
          <table>
            <caption>Per pelanggan</caption>
            <thead><tr><th>Pelanggan</th><th className="num">Faktur</th><th className="num">Penjualan</th><th className="num">Belum dibayar</th></tr></thead>
            <tbody>
              {s.byCustomer.map((r, i) => <tr key={i}><td>{r.name}</td><td className="num">{r.count}</td><td className="num"><Rp n={r.amount} /></td><td className="num"><Rp n={r.total - r.paid} /></td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
