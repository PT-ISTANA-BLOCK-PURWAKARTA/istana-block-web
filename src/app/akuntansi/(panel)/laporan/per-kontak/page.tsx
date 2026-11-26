// Penjualan per Pelanggan / Pembelian per Pemasok (format formulir Zahir), dari jurnal faktur web dan jurnal impor Zahir (SJ/SR/SD, PJ).
import Link from "next/link";
import { PrintButton } from "@/components/erp/PrintButton";
import { PeriodBar } from "@/components/erp/report/PeriodBar";
import { ZahirForm, zDate, zn, zPeriod } from "@/components/erp/report/ZahirForm";
import { BackLink, PageHead } from "@/components/erp/ui";
import { partyAnalysis } from "@/lib/erp/journalReports";
import { sourceHref } from "@/lib/erp/links";
import { rangePresets } from "@/lib/erp/periods";
import { reportContext } from "@/lib/erp/reportctx";
import { isDate, monthStart, today } from "@/lib/erp/util";

export const metadata = { title: "Penjualan / Pembelian per Kontak" };

export default async function PerKontak({ searchParams }: { searchParams: Promise<{ jenis?: string; rinci?: string; from?: string; to?: string }> }) {
  const { db, site } = await reportContext();
  const sp = await searchParams;
  const kind = sp.jenis === "pembelian" ? "pembelian" : "penjualan";
  const detail = sp.rinci === "1";
  const to = isDate(sp.to) ? sp.to : today();
  const from = isDate(sp.from) && sp.from <= to ? sp.from : monthStart(to);
  const r = await partyAnalysis(db, kind, from, to);
  const who = kind === "penjualan" ? "Pelanggan" : "Pemasok";
  const title = `${kind === "penjualan" ? "Penjualan Per Pelanggan" : "Pembelian per Pemasok"} - ${detail ? "Rincian" : "Rangkuman"}`;
  const path = "/akuntansi/laporan/per-kontak";
  const keep = { jenis: kind, ...(detail ? { rinci: "1" } : {}) };
  return (
    <>
      <div className="no-print">
        <BackLink href={`/akuntansi/laporan?k=${kind}`}>Laporan</BackLink>
        <PageHead title={title} sub={`${kind === "penjualan" ? "Nilai penjualan (sebelum PPN, dikurangi retur/potongan)" : "Nilai pembelian (tanpa PPN masukan)"} per ${who.toLowerCase()}, terbesar di atas. Data Zahir memakai nama di keterangan transaksi.`}>
          <Link href={`${path}?${new URLSearchParams({ from, to, jenis: kind, ...(detail ? {} : { rinci: "1" }) })}`} className="btn btn-ghost btn-sm">{detail ? "Lihat rangkuman" : "Lihat rincian per faktur"}</Link>
          <Link href={`${path}?${new URLSearchParams({ from, to, jenis: kind === "penjualan" ? "pembelian" : "penjualan" })}`} className="btn btn-ghost btn-sm">Lihat {kind === "penjualan" ? "pembelian" : "penjualan"}</Link>
          <PrintButton label="Cetak / PDF" />
        </PageHead>
        <PeriodBar path={path} presets={rangePresets()} from={from} to={to} keep={keep} />
      </div>
      <ZahirForm company={site.legal_name || site.company_name || "PT. Istana Block Purwakarta"} title={title} period={zPeriod(from, to)}>
        <table className="zf-table">
          {detail ? (
            <>
              <thead><tr><th>{who} / No. Ref.</th><th className="zf-c-date">Tanggal</th><th className="num">Nilai</th></tr></thead>
              {r.list.map((e) => (
                <tbody key={e.name} id={e.name}>
                  <tr className="zf-acc-head"><td colSpan={3}>{e.name}</td></tr>
                  {e.docs.map((d) => <tr key={d.journalId}><td style={{ paddingLeft: 22 }}><Link href={sourceHref(d.source, d.sourceId, d.journalId)}>{d.number}</Link></td><td className="nowrap">{zDate(d.date)}</td><td className="num">{zn(d.amount, true)}</td></tr>)}
                  <tr className="zf-total"><td colSpan={2}>Total {e.name} ({e.count} transaksi)</td><td className="num">{zn(e.amount, true)}</td></tr>
                </tbody>
              ))}
            </>
          ) : (
            <>
              <thead><tr><th style={{ width: 36 }}>No</th><th>{who}</th><th className="num" style={{ width: 90 }}>Transaksi</th><th className="zf-c-date">Pertama</th><th className="zf-c-date">Terakhir</th><th className="num">Nilai</th><th className="num" style={{ width: 70 }}>%</th></tr></thead>
              <tbody>
                {r.list.map((e, i) => (
                  <tr key={e.name}><td>{i + 1}</td><td><Link href={`${path}?${new URLSearchParams({ from, to, jenis: kind, rinci: "1" })}#${encodeURIComponent(e.name)}`}>{e.name}</Link></td><td className="num">{e.count}</td><td className="nowrap">{zDate(e.first)}</td><td className="nowrap">{zDate(e.last)}</td><td className="num">{zn(e.amount, true)}</td><td className="num">{r.total ? ((e.amount / r.total) * 100).toFixed(1) : "0.0"}</td></tr>
                ))}
                {!r.list.length && <tr><td colSpan={7}>Tidak ada transaksi pada periode ini.</td></tr>}
              </tbody>
            </>
          )}
          <tfoot><tr className="zf-total"><td colSpan={detail ? 2 : 5}>Jumlah ({r.list.length} {who.toLowerCase()})</td><td className="num">{zn(r.total, true)}</td>{!detail && <td className="num">100.0</td>}</tr></tfoot>
        </table>
      </ZahirForm>
    </>
  );
}
