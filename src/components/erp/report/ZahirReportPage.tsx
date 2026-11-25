// Halaman "Neraca - 12 Bulan" / "Laba Rugi - 12 Bulan" seperti laporan Zahir Accounting 6:
// pilih bulan awal, 12 kolom bulan, kop perusahaan, cetak / PDF, unduh Excel.
import Link from "next/link";
import { PrintButton } from "@/components/erp/PrintButton";
import { ReadingNote, ReportSheet } from "@/components/erp/report/ReportSheet";
import { ZahirExcel } from "@/components/erp/report/ZahirExcel";
import { ZahirTable, zahirRows } from "@/components/erp/report/ZahirTable";
import { BackLink, PageHead } from "@/components/erp/ui";
import { reportContext } from "@/lib/erp/reportctx";
import { today } from "@/lib/erp/util";
import { addMonths, defaultStart, monthCol, monthName, twelveMonths, zahirBalanceSheet, zahirProfitLoss } from "@/lib/erp/zahirReports";

export async function ZahirReportPage({ kind, mulai }: { kind: "neraca" | "laba-rugi"; mulai?: string }) {
  const { me, db, acc, site, npwp } = await reportContext();
  const nowYm = today().slice(0, 7);
  const start = /^\d{4}-\d{2}$/.test(mulai ?? "") ? mulai! : await defaultStart(db, nowYm);
  const months = twelveMonths(start);
  const title = kind === "neraca" ? "Neraca - 12 Bulan" : "Laba Rugi - 12 Bulan";
  const path = `/akuntansi/laporan/${kind}-12`;
  const report = kind === "neraca" ? await zahirBalanceSheet(db, acc.rows, months) : await zahirProfitLoss(db, acc.rows, months);
  // Periode di judul: bulan awal s.d. bulan terakhir yang sudah lewat / berjalan (seperti "Juni 2026 - Oktober 2026").
  const lastShown = months.filter((m) => m <= nowYm).at(-1) ?? months[0];
  const period = `${monthName(start)} - ${monthName(lastShown)}`;
  const ledgerTo = (id: string) => `/akuntansi/laporan/buku-besar?akun=${id}&from=${start}-01&to=${today()}`;
  const balanced = "balanced" in report ? report.balanced : true;

  return (
    <>
      <BackLink href="/akuntansi/laporan">Laporan</BackLink>
      <PageHead title={title} sub="Susunan rekening & judul sama dengan laporan Zahir Accounting 6.">
        <Link href={kind === "neraca" ? "/akuntansi/laporan/laba-rugi-12" : "/akuntansi/laporan/neraca-12"} className="btn btn-ghost btn-sm">{kind === "neraca" ? "Laba Rugi - 12 Bulan" : "Neraca - 12 Bulan"}</Link>
        <ZahirExcel fileName={`${kind === "neraca" ? "neraca" : "laba-rugi"} - 12 bulan ${start}.xlsx`} title={`${(site.legal_name || site.company_name).toUpperCase()} · ${title} · ${period}`} sheet={title} months={months} monthLabels={months.map(monthCol)} rows={zahirRows(report.blocks, months)} />
        <PrintButton />
      </PageHead>
      <form method="get" className="filter-bar no-print zr-filter">
        <Link href={`${path}?mulai=${addMonths(start, -12)}`} className="btn btn-ghost btn-sm" aria-label="12 bulan sebelumnya">‹ 12 bulan</Link>
        <div className="field"><label htmlFor="zr-mulai">Mulai bulan</label><input id="zr-mulai" type="month" name="mulai" defaultValue={start} /></div>
        <button type="submit" className="btn btn-blue btn-sm">Tampilkan</button>
        <Link href={`${path}?mulai=${addMonths(start, 12)}`} className="btn btn-ghost btn-sm" aria-label="12 bulan berikutnya">12 bulan ›</Link>
      </form>
      <ReportSheet site={site} npwp={npwp} title={title} period={period} printedBy={me.name} sign>
        {!balanced && <p className="alert alert-error">Neraca tidak seimbang di salah satu bulan. Periksa neraca saldo.</p>}
        <ZahirTable blocks={report.blocks} months={months} ledgerTo={ledgerTo} />
        <ReadingNote>
          {kind === "neraca"
            ? "Saldo akhir setiap bulan. Laba Tahun Berjalan sudah termasuk laba bersih sampai akhir bulan itu, sama seperti Zahir. Klik nama rekening untuk buku besarnya."
            : "Mutasi setiap bulan. Laba/Rugi Kotor = Pendapatan − Beban Atas Pendapatan; Laba/Rugi Operasi = Kotor − Beban Operasional (lalu − Beban Non Operasional); Laba/Rugi Bersih setelah Pendapatan & Beban Lain."}
        </ReadingNote>
      </ReportSheet>
    </>
  );
}
