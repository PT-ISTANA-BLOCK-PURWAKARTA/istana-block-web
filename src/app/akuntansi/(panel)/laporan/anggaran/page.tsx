// Laba Rugi / Neraca - Anggaran vs Realisasi (format formulir Zahir).
import Link from "next/link";
import { PrintButton } from "@/components/erp/PrintButton";
import { ZahirForm, zb, zLongDate } from "@/components/erp/report/ZahirForm";
import { BackLink, PageHead } from "@/components/erp/ui";
import { budgetVsActual } from "@/lib/erp/budget";
import { reportContext } from "@/lib/erp/reportctx";
import { today } from "@/lib/erp/util";

export const metadata = { title: "Anggaran vs Realisasi" };

const isP = (s?: string) => !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
const range = (a: string, b: string) => { const out: string[] = []; let y = Number(a.slice(0, 4)), m = Number(a.slice(5, 7)); while (`${y}-${String(m).padStart(2, "0")}` <= b && out.length < 36) { out.push(`${y}-${String(m).padStart(2, "0")}`); m++; if (m > 12) { m = 1; y++; } } return out; };
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : "-");

export default async function AnggaranVsRealisasi({ searchParams }: { searchParams: Promise<{ jenis?: string; dari?: string; sampai?: string }> }) {
  const { db, acc, site } = await reportContext();
  const sp = await searchParams;
  const kind = sp.jenis === "neraca" ? "neraca" : "lr";
  const now = today().slice(0, 7);
  const to = isP(sp.sampai) ? sp.sampai! : now;
  const from = kind === "neraca" ? to : isP(sp.dari) && sp.dari! <= to ? sp.dari! : `${to.slice(0, 4)}-01`;
  const periods = range(from, to);
  const r = await budgetVsActual(db, acc.rows, kind, periods);
  const title = kind === "lr" ? "Laba Rugi - Anggaran vs Realisasi" : "Neraca - Anggaran vs Realisasi";
  const endDate = new Date(Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const period = kind === "lr" ? `${zLongDate(`${from}-01`)} - ${zLongDate(endDate)}` : `Per ${zLongDate(endDate)}`;
  const empty = !r.sections.some((s) => s.rows.some((x) => x.budget));
  return (
    <>
      <div className="no-print">
        <BackLink href="/akuntansi/laporan?k=keuangan">Laporan</BackLink>
        <PageHead title={title} sub={kind === "lr" ? "Target dan realisasi dijumlah sepanjang rentang bulan. Selisih positif = lebih baik dari target (pendapatan lebih tinggi / beban lebih rendah)." : "Target saldo akhir bulan dibanding saldo sebenarnya."}>
          <Link href={`/akuntansi/laporan/anggaran?jenis=${kind === "lr" ? "neraca" : "lr"}&sampai=${to}`} className="btn btn-ghost btn-sm">{kind === "lr" ? "Neraca" : "Laba Rugi"} vs anggaran</Link>
          <Link href={`/akuntansi/anggaran?tahun=${to.slice(0, 4)}&jenis=${kind}`} className="btn btn-ghost btn-sm">Isi anggaran</Link>
          <PrintButton label="Cetak / PDF" />
        </PageHead>
        <form method="get" className="filter-bar">
          <input type="hidden" name="jenis" value={kind} />
          {kind === "lr" && <div className="field"><label htmlFor="av-dari">Dari bulan</label><input id="av-dari" type="month" name="dari" defaultValue={from} /></div>}
          <div className="field"><label htmlFor="av-sampai">{kind === "lr" ? "Sampai bulan" : "Per akhir bulan"}</label><input id="av-sampai" type="month" name="sampai" defaultValue={to} /></div>
          <button type="submit" className="btn btn-blue btn-sm">Tampilkan</button>
        </form>
        {empty && <p className="alert alert-error">Belum ada anggaran untuk periode ini. <Link href={`/akuntansi/anggaran?tahun=${to.slice(0, 4)}&jenis=${kind}`}>Isi anggaran</Link> dulu.</p>}
      </div>
      <ZahirForm company={site.legal_name || site.company_name || "PT. Istana Block Purwakarta"} title={title} period={period}>
        <table className="zf-table">
          <colgroup><col className="zf-c-ref" /><col /><col className="zf-c-num" /><col className="zf-c-num" /><col className="zf-c-num" /><col style={{ width: 72 }} /></colgroup>
          <thead><tr><th>Kode</th><th>Nama Rekening</th><th className="num">Anggaran</th><th className="num">Realisasi</th><th className="num">Selisih</th><th className="num">%</th></tr></thead>
          {r.sections.map((s) => {
            const better = (b: number, a: number, group: string) => (["pendapatan", "pendapatan_lain"].includes(group) || kind === "neraca" ? a - b : b - a);
            return (
              <tbody key={s.key}>
                <tr className="zf-acc-head"><td colSpan={6}>{s.label}</td></tr>
                {s.rows.map((x) => (
                  <tr key={x.account.id}>
                    <td>{x.account.code}</td><td>{x.account.name}</td>
                    <td className="num">{zb(x.budget)}</td><td className="num">{zb(x.actual)}</td>
                    <td className="num">{zb(better(x.budget, x.actual, x.account.group))}</td>
                    <td className="num">{pct(x.actual, x.budget)}</td>
                  </tr>
                ))}
                <tr className="zf-total"><td colSpan={2}>Total {s.label}</td><td className="num">{zb(s.budget)}</td><td className="num">{zb(s.actual)}</td><td className="num">{zb(s.key === "pendapatan" || s.key === "lain" || kind === "neraca" ? s.actual - s.budget : s.budget - s.actual)}</td><td className="num">{pct(s.actual, s.budget)}</td></tr>
              </tbody>
            );
          })}
          {r.net && (
            <tfoot><tr className="zf-total"><td colSpan={2}>LABA (RUGI) BERSIH</td><td className="num">{zb(r.net.budget)}</td><td className="num">{zb(r.net.actual)}</td><td className="num">{zb(r.net.actual - r.net.budget)}</td><td className="num">{pct(r.net.actual, r.net.budget)}</td></tr></tfoot>
          )}
        </table>
      </ZahirForm>
    </>
  );
}
