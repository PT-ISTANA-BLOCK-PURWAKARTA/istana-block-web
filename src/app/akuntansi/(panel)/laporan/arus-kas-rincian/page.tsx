// Arus Kas - Rincian (format formulir Zahir): setiap uang masuk/keluar per rekening kas & bank, dengan akun lawannya dan saldo berjalan.
import Link from "next/link";
import { PrintButton } from "@/components/erp/PrintButton";
import { PeriodBar } from "@/components/erp/report/PeriodBar";
import { ZahirForm, zb, zDate, zn, zPeriod } from "@/components/erp/report/ZahirForm";
import { BackLink, PageHead } from "@/components/erp/ui";
import { cashDetail } from "@/lib/erp/journalReports";
import { sourceHref } from "@/lib/erp/links";
import { rangePresets } from "@/lib/erp/periods";
import { reportContext } from "@/lib/erp/reportctx";
import { isDate, monthStart, today } from "@/lib/erp/util";

export const metadata = { title: "Arus Kas - Rincian" };

export default async function ArusKasRincian({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const { db, site } = await reportContext();
  const sp = await searchParams;
  const to = isDate(sp.to) ? sp.to : today();
  const from = isDate(sp.from) && sp.from <= to ? sp.from : monthStart(to);
  const groups = await cashDetail(db, from, to);
  const tot = groups.reduce((a, g) => ({ o: a.o + g.opening, i: a.i + g.inflow, k: a.k + g.outflow, c: a.c + g.closing }), { o: 0, i: 0, k: 0, c: 0 });
  return (
    <>
      <div className="no-print">
        <BackLink href="/akuntansi/laporan?k=keuangan">Laporan</BackLink>
        <PageHead title="Arus Kas - Rincian" sub="Setiap uang masuk dan keluar per rekening kas & bank, dengan akun lawan dan saldo berjalan.">
          <Link href={`/akuntansi/laporan/arus-kas?from=${from}&to=${to}`} className="btn btn-ghost btn-sm">Arus Kas - Rangkuman</Link>
          <PrintButton label="Cetak / PDF" />
        </PageHead>
        <PeriodBar path="/akuntansi/laporan/arus-kas-rincian" presets={rangePresets()} from={from} to={to} />
      </div>
      <ZahirForm company={site.legal_name || site.company_name || "PT. Istana Block Purwakarta"} title="Arus Kas - Rincian" period={zPeriod(from, to)}>
        <table className="zf-table">
          <colgroup><col className="zf-c-date" /><col className="zf-c-ref" /><col /><col style={{ width: "22%" }} /><col className="zf-c-num" /><col className="zf-c-num" /><col className="zf-c-num" /></colgroup>
          <thead><tr><th>Tanggal</th><th>No. Ref.</th><th>Keterangan</th><th>Akun Lawan</th><th className="num">Masuk</th><th className="num">Keluar</th><th className="num">Saldo</th></tr></thead>
          {groups.map((g) => (
            <tbody key={g.id}>
              <tr className="zf-acc-head"><td>{g.code}</td><td colSpan={6}>{g.name}</td></tr>
              <tr className="zf-open"><td colSpan={6}>Saldo Awal :</td><td className="num">{zb(g.opening)}</td></tr>
              {g.rows.map((r, i) => (
                <tr key={i}>
                  <td className="nowrap">{g.rows[i - 1]?.date === r.date ? "" : zDate(r.date)}</td>
                  <td className="nowrap"><Link href={sourceHref(r.source, r.sourceId, r.journalId)}>{r.number}</Link></td>
                  <td>{r.memo}</td>
                  <td className="small">{r.counter}</td>
                  <td className="num">{zn(r.inflow)}</td>
                  <td className="num">{zn(r.outflow)}</td>
                  <td className="num">{zb(r.balance)}</td>
                </tr>
              ))}
              <tr className="zf-total"><td colSpan={4}>Total {g.code}</td><td className="num">{zn(g.inflow, true)}</td><td className="num">{zn(g.outflow, true)}</td><td className="num">{zb(g.closing)}</td></tr>
            </tbody>
          ))}
          <tfoot>
            <tr className="zf-total"><td colSpan={4}>Jumlah semua kas &amp; bank (saldo awal {zb(tot.o)})</td><td className="num">{zn(tot.i, true)}</td><td className="num">{zn(tot.k, true)}</td><td className="num">{zb(tot.c)}</td></tr>
          </tfoot>
        </table>
      </ZahirForm>
    </>
  );
}
