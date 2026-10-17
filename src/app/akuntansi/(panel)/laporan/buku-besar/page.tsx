import Link from "next/link";
import { PrintButton } from "@/components/erp/PrintButton";
import { PeriodBar } from "@/components/erp/report/PeriodBar";
import { ReadingNote, ReportSheet } from "@/components/erp/report/ReportSheet";
import { BackLink, Kpis, PageHead } from "@/components/erp/ui";
import { GROUP_LABEL, isDebitNormal } from "@/lib/erp/accounting";
import { SOURCE_LABEL, sourceHref } from "@/lib/erp/links";
import { periodLabel, rangePresets } from "@/lib/erp/periods";
import { reportContext } from "@/lib/erp/reportctx";
import { ledger } from "@/lib/erp/reports";
import { formatAmount, isDate, monthStart, tgl, today } from "@/lib/erp/util";
import { accountGroups } from "@/db/erp";
import { Select } from "@/components/ui";

export const metadata = { title: "Buku besar" };

export default async function BukuBesar({ searchParams }: { searchParams: Promise<{ akun?: string; from?: string; to?: string }> }) {
  const { me, db, acc, site, npwp } = await reportContext();
  const sp = await searchParams;
  const to = isDate(sp.to) ? sp.to : today();
  const from = isDate(sp.from) && sp.from <= to ? sp.from : monthStart(to);
  const account = acc.byId.get(sp.akun ?? "") ?? acc.byId.get(acc.sys("kas"));
  if (!account) return null;
  const lg = await ledger(db, account, from, to);
  const debitUp = isDebitNormal(account.group);
  const up = debitUp ? lg.totalDebit : lg.totalCredit;
  const down = debitUp ? lg.totalCredit : lg.totalDebit;
  const groups = accountGroups.map((g) => ({ g, list: acc.rows.filter((a) => a.group === g).sort((a, b) => a.code.localeCompare(b.code)) })).filter((x) => x.list.length);
  return (
    <>
      <div className="no-print">
        <BackLink href="/akuntansi/laporan">Laporan</BackLink>
        <PageHead title="Buku besar" sub="Semua transaksi satu akun dan saldonya dari hari ke hari.">
          <a className="btn btn-ghost btn-sm" href={`/akuntansi/ekspor/buku-besar?akun=${account.id}&from=${from}&to=${to}`}>Unduh CSV (Excel)</a>
          <PrintButton label="Cetak / PDF" />
        </PageHead>
        <PeriodBar
          path="/akuntansi/laporan/buku-besar"
          presets={rangePresets()}
          from={from}
          to={to}
          keep={{ akun: account.id }}
          keepInForm={false}
          extra={
            <label className="grow">
              <span>Akun</span>
              <Select name="akun" defaultValue={account.id} searchable menuWidth={320} options={groups.flatMap((x) => x.list.map((a) => ({ value: a.id, label: `${a.code} · ${a.name}`, group: GROUP_LABEL[x.g] })))} />
            </label>
          }
        />
      </div>
      <ReportSheet site={site} npwp={npwp} title={`Buku Besar · ${account.code} ${account.name}`} period={`Periode ${periodLabel(from, to)} · ${GROUP_LABEL[account.group]}`} printedBy={me.name}>
        <Kpis
          items={[
            { label: "Saldo awal", value: formatAmount(lg.opening), sub: `per ${tgl(from)}` },
            { label: "Bertambah", value: formatAmount(up), sub: debitUp ? "sisi debit" : "sisi kredit" },
            { label: "Berkurang", value: formatAmount(down), sub: debitUp ? "sisi kredit" : "sisi debit" },
            { label: "Saldo akhir", value: formatAmount(lg.closing), sub: `${lg.rows.length} transaksi`, tone: lg.closing < 0 ? "bad" : undefined },
          ]}
        />
        <div className="admin-table report">
          <table>
            <thead><tr><th>Tanggal</th><th>Nomor</th><th>Keterangan</th><th className="num">Debit</th><th className="num">Kredit</th><th className="num">Saldo</th></tr></thead>
            <tbody>
              <tr className="r-sub"><td colSpan={5}>Saldo awal</td><td className="num tabular">{formatAmount(lg.opening)}</td></tr>
              {lg.rows.map((r, i) => (
                <tr key={i}>
                  <td className="nowrap">{tgl(r.date)}</td>
                  <td><Link href={sourceHref(r.source, r.sourceId, r.journalId)}>{r.number}</Link><div className="small muted">{SOURCE_LABEL[r.source]}</div></td>
                  <td className="small">{r.lineMemo || r.memo}{r.contactName && <div className="muted">{r.contactName}</div>}</td>
                  <td className="num tabular">{formatAmount(r.debit, { blankZero: true })}</td>
                  <td className="num tabular">{formatAmount(r.credit, { blankZero: true })}</td>
                  <td className={`num tabular${r.balance < 0 ? " text-bahaya" : ""}`}>{formatAmount(r.balance)}</td>
                </tr>
              ))}
              {lg.rows.length === 0 && <tr><td colSpan={6} className="muted">Tidak ada transaksi pada periode ini.</td></tr>}
            </tbody>
            <tfoot><tr><th colSpan={3}>Jumlah &amp; saldo akhir</th><th className="num">{formatAmount(lg.totalDebit)}</th><th className="num">{formatAmount(lg.totalCredit)}</th><th className="num">{formatAmount(lg.closing)}</th></tr></tfoot>
          </table>
        </div>
        <ReadingNote>
          {debitUp ? "Untuk akun ini, debit menambah saldo dan kredit mengurangi." : "Untuk akun ini, kredit menambah saldo dan debit mengurangi."} Klik nomor transaksi untuk membuka dokumen asalnya.
        </ReadingNote>
      </ReportSheet>
    </>
  );
}
