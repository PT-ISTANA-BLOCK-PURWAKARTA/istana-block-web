// eFaktur Penjualan: daftar faktur ber-PPN per masa pajak + unduh CSV untuk impor aplikasi e-Faktur.
import Link from "next/link";
import { sql } from "drizzle-orm";
import { PeriodBar } from "@/components/erp/report/PeriodBar";
import { ZahirForm, zDate, zn, zPeriod } from "@/components/erp/report/ZahirForm";
import { BackLink, PageHead } from "@/components/erp/ui";
import { rangePresets } from "@/lib/erp/periods";
import { reportContext } from "@/lib/erp/reportctx";
import { isDate, monthStart, today } from "@/lib/erp/util";

export const metadata = { title: "eFaktur Penjualan" };

export default async function EFaktur({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const { db, site } = await reportContext();
  const sp = await searchParams;
  const to = isDate(sp.to) ? sp.to : today();
  const from = isDate(sp.from) && sp.from <= to ? sp.from : monthStart(to);
  const rows = await db.all<{ id: string; number: string; date: string; dpp: number; tax: number; name: string; npwp: string }>(sql`
    select i.id, i.number, i.date, i.subtotal - i.discount + i.ongkir dpp, i.tax, c.name, c.npwp from fin_invoices i join fin_contacts c on c.id = i.contact_id
     where i.void = 0 and i.tax > 0 and i.date >= ${from} and i.date <= ${to} order by i.date, i.number`);
  const noNpwp = rows.filter((r) => !r.npwp.replace(/\D/g, "")).length;
  return (
    <>
      <div className="no-print">
        <BackLink href="/akuntansi/laporan?k=penjualan">Laporan</BackLink>
        <PageHead title="eFaktur Penjualan" sub="Faktur penjualan yang memakai PPN. Unduh CSV lalu impor di aplikasi e-Faktur DJP; nomor seri faktur pajak diisi di sana.">
          <a href={`/akuntansi/efaktur?from=${from}&to=${to}`} className="btn btn-primary btn-sm">Unduh CSV e-Faktur</a>
        </PageHead>
        <PeriodBar path="/akuntansi/laporan/efaktur" presets={rangePresets()} from={from} to={to} />
        {noNpwp > 0 && <p className="alert alert-error">{noNpwp} faktur pelanggannya belum punya NPWP (diisi 000000000000000). Lengkapi NPWP di <Link href="/akuntansi/kontak">Nama Alamat</Link> bila perlu.</p>}
      </div>
      <ZahirForm company={site.legal_name || site.company_name || "PT. Istana Block Purwakarta"} title="eFaktur Penjualan" period={zPeriod(from, to)}>
        <table className="zf-table">
          <thead><tr><th>Tanggal</th><th>No. Faktur</th><th>Pelanggan</th><th>NPWP</th><th className="num">DPP</th><th className="num">PPN</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id}><td>{zDate(r.date)}</td><td><Link href={`/akuntansi/penjualan/${r.id}`}>{r.number}</Link></td><td>{r.name}</td><td>{r.npwp || "-"}</td><td className="num">{zn(Number(r.dpp), true)}</td><td className="num">{zn(Number(r.tax), true)}</td></tr>)}
            {!rows.length && <tr><td colSpan={6}>Tidak ada faktur ber-PPN pada periode ini.</td></tr>}</tbody>
          <tfoot><tr className="zf-total"><td colSpan={4}>Jumlah ({rows.length} faktur)</td><td className="num">{zn(rows.reduce((s, r) => s + Number(r.dpp), 0), true)}</td><td className="num">{zn(rows.reduce((s, r) => s + Number(r.tax), 0), true)}</td></tr></tfoot>
        </table>
      </ZahirForm>
    </>
  );
}
