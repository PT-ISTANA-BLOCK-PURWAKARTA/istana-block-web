// Laporan Harta Tetap (format formulir Zahir): Daftar Harta Tetap, Analisa Penyusutan (per aset / per kelompok), Kode Rekening Harta Tetap.
import Link from "next/link";
import { PrintButton } from "@/components/erp/PrintButton";
import { ZahirForm, zb, zDate, zLongDate, zn } from "@/components/erp/report/ZahirForm";
import { BackLink, PageHead } from "@/components/erp/ui";
import { assetCategories } from "@/db/erp";
import { CATEGORY_LABEL, METHOD_LABEL, depreciationInRange, listAssets, monthEnd } from "@/lib/erp/assets";
import { reportContext } from "@/lib/erp/reportctx";
import { today } from "@/lib/erp/util";

export const metadata = { title: "Laporan Harta Tetap" };

const MODES = { daftar: "Daftar Harta Tetap", analisa: "Analisa Penyusutan Harta Tetap", kelompok: "Analisa Penyusutan Per Kelompok Harta Tetap", rekening: "Kode Rekening Harta Tetap" } as const;
type Mode = keyof typeof MODES;
const isP = (s?: string) => !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
const life = (m: number) => (m ? `${Math.floor(m / 12)} th${m % 12 ? ` ${m % 12} bl` : ""}` : "-");

export default async function LaporanHartaTetap({ searchParams }: { searchParams: Promise<{ mode?: string; dari?: string; sampai?: string }> }) {
  const { db, acc, site } = await reportContext();
  const sp = await searchParams;
  const mode: Mode = (Object.keys(MODES) as Mode[]).includes(sp.mode as Mode) ? (sp.mode as Mode) : "daftar";
  const now = today().slice(0, 7);
  const to = isP(sp.sampai) ? sp.sampai! : now;
  const from = isP(sp.dari) && sp.dari! <= to ? sp.dari! : `${to.slice(0, 4)}-01`;
  const end = monthEnd(to);
  const [assetsEnd, inRange] = await Promise.all([listAssets(db, end), depreciationInRange(db, from, to)]);
  const rows = assetsEnd.filter((a) => a.acquiredDate <= end);
  const accName = (id: string | null) => { const a = id ? acc.byId.get(id) : undefined; return a ? `${a.code} ${a.name}` : "-"; };
  const title = MODES[mode];
  const period = mode === "analisa" || mode === "kelompok" ? `${zLongDate(`${from}-01`)} - ${zLongDate(end)}` : `Per ${zLongDate(end)}`;
  const byCat = assetCategories.map((c) => ({ c, list: rows.filter((a) => a.category === c) })).filter((x) => x.list.length);
  const tabs = (Object.keys(MODES) as Mode[]).map((m) => <Link key={m} href={`/akuntansi/laporan/harta-tetap?mode=${m}&dari=${from}&sampai=${to}`} aria-current={m === mode ? "page" : undefined}>{MODES[m].replace(" Harta Tetap", "")}</Link>);
  return (
    <>
      <div className="no-print">
        <BackLink href="/akuntansi/laporan?k=lainnya&t=1">Laporan</BackLink>
        <PageHead title={title}>
          <Link href="/akuntansi/harta-tetap" className="btn btn-ghost btn-sm">Daftar aset</Link>
          <PrintButton label="Cetak / PDF" />
        </PageHead>
        <nav className="zt-tabs">{tabs}</nav>
        <form method="get" className="filter-bar">
          <input type="hidden" name="mode" value={mode} />
          {(mode === "analisa" || mode === "kelompok") && <div className="field"><label htmlFor="ht-dari">Dari bulan</label><input id="ht-dari" type="month" name="dari" defaultValue={from} /></div>}
          <div className="field"><label htmlFor="ht-sampai">{mode === "analisa" || mode === "kelompok" ? "Sampai bulan" : "Per akhir bulan"}</label><input id="ht-sampai" type="month" name="sampai" defaultValue={to} /></div>
          <button type="submit" className="btn btn-blue btn-sm">Tampilkan</button>
        </form>
      </div>
      <ZahirForm company={site.legal_name || site.company_name || "PT. Istana Block Purwakarta"} title={title} period={period}>
        {mode === "daftar" && (
          <table className="zf-table">
            <thead><tr><th>Kode</th><th>Nama Aset</th><th>Tgl. Beli</th><th>Metode</th><th>Umur</th><th className="num">Harga Perolehan</th><th className="num">Akum. Penyusutan</th><th className="num">Nilai Buku</th></tr></thead>
            {byCat.map(({ c, list }) => (
              <tbody key={c}>
                <tr className="zf-acc-head"><td colSpan={8}>{CATEGORY_LABEL[c]}</td></tr>
                {list.map((a) => <tr key={a.id}><td><Link href={`/akuntansi/harta-tetap/${a.id}`}>{a.code}</Link></td><td>{a.name}{a.disposedDate && <em className="zf-sub">dijual/dihapus {zDate(a.disposedDate)}</em>}</td><td>{zDate(a.acquiredDate)}</td><td>{METHOD_LABEL[a.method]}</td><td>{life(a.lifeMonths)}</td><td className="num">{zn(a.cost, true)}</td><td className="num">{zn(a.accum, true)}</td><td className="num">{zb(a.book)}</td></tr>)}
                <tr className="zf-total"><td colSpan={5}>Total {CATEGORY_LABEL[c]}</td><td className="num">{zn(list.reduce((s, a) => s + a.cost, 0), true)}</td><td className="num">{zn(list.reduce((s, a) => s + a.accum, 0), true)}</td><td className="num">{zb(list.reduce((s, a) => s + a.book, 0))}</td></tr>
              </tbody>
            ))}
            <tfoot><tr className="zf-total"><td colSpan={5}>JUMLAH HARTA TETAP</td><td className="num">{zn(rows.reduce((s, a) => s + a.cost, 0), true)}</td><td className="num">{zn(rows.reduce((s, a) => s + a.accum, 0), true)}</td><td className="num">{zb(rows.reduce((s, a) => s + a.book, 0))}</td></tr></tfoot>
          </table>
        )}
        {(mode === "analisa" || mode === "kelompok") && (
          <table className="zf-table">
            <thead><tr><th>{mode === "analisa" ? "Aset" : "Kelompok"}</th><th className="num">Harga Perolehan</th><th className="num">Akum. Awal</th><th className="num">Penyusutan Periode</th><th className="num">Akum. Akhir</th><th className="num">Nilai Buku</th></tr></thead>
            {mode === "analisa" ? (
              byCat.map(({ c, list }) => (
                <tbody key={c}>
                  <tr className="zf-acc-head"><td colSpan={6}>{CATEGORY_LABEL[c]}</td></tr>
                  {list.map((a) => { const d = inRange.get(a.id) ?? 0; return <tr key={a.id}><td>{a.code} {a.name}</td><td className="num">{zn(a.cost, true)}</td><td className="num">{zn(a.accum - d, true)}</td><td className="num">{zn(d, true)}</td><td className="num">{zn(a.accum, true)}</td><td className="num">{zb(a.book)}</td></tr>; })}
                </tbody>
              ))
            ) : (
              <tbody>
                {byCat.map(({ c, list }) => { const d = list.reduce((s, a) => s + (inRange.get(a.id) ?? 0), 0); const accum = list.reduce((s, a) => s + a.accum, 0); const cost = list.reduce((s, a) => s + a.cost, 0); return <tr key={c}><td>{CATEGORY_LABEL[c]} ({list.length})</td><td className="num">{zn(cost, true)}</td><td className="num">{zn(accum - d, true)}</td><td className="num">{zn(d, true)}</td><td className="num">{zn(accum, true)}</td><td className="num">{zb(cost - accum)}</td></tr>; })}
              </tbody>
            )}
            <tfoot><tr className="zf-total"><td>JUMLAH</td><td className="num">{zn(rows.reduce((s, a) => s + a.cost, 0), true)}</td><td className="num">{zn(rows.reduce((s, a) => s + a.accum - (inRange.get(a.id) ?? 0), 0), true)}</td><td className="num">{zn(rows.reduce((s, a) => s + (inRange.get(a.id) ?? 0), 0), true)}</td><td className="num">{zn(rows.reduce((s, a) => s + a.accum, 0), true)}</td><td className="num">{zb(rows.reduce((s, a) => s + a.book, 0))}</td></tr></tfoot>
          </table>
        )}
        {mode === "rekening" && (
          <table className="zf-table">
            <thead><tr><th>Kode</th><th>Nama Aset</th><th>Rekening Aset</th><th>Rekening Akumulasi</th><th>Rekening Beban</th></tr></thead>
            <tbody>{rows.map((a) => <tr key={a.id}><td>{a.code}</td><td>{a.name}</td><td>{accName(a.assetAccountId)}</td><td>{accName(a.accumAccountId)}</td><td>{accName(a.expenseAccountId)}</td></tr>)}</tbody>
          </table>
        )}
        {!rows.length && <p>Belum ada harta tetap. <Link href="/akuntansi/harta-tetap">Isi daftar harta tetap</Link>.</p>}
      </ZahirForm>
    </>
  );
}
