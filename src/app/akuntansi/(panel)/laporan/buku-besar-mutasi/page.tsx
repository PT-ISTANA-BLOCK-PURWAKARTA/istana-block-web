// Buku Besar - Mutasi (format formulir Zahir): per akun — Tanggal, Tp, No. Ref., Keterangan (baris kedua miring = catatan baris),
// Debet, Kredit, Saldo berjalan. Bisa satu akun atau semua akun yang bermutasi pada periode.
import Link from "next/link";
import { sql } from "drizzle-orm";
import { PrintButton } from "@/components/erp/PrintButton";
import { PeriodBar } from "@/components/erp/report/PeriodBar";
import { ZahirForm } from "@/components/erp/report/ZahirForm";
import { BackLink, PageHead } from "@/components/erp/ui";
import { Select } from "@/components/ui";
import { accountGroups } from "@/db/erp";
import { GROUP_LABEL } from "@/lib/erp/accounting";
import { sourceHref, txType } from "@/lib/erp/links";
import { rangePresets } from "@/lib/erp/periods";
import { reportContext } from "@/lib/erp/reportctx";
import { ledger } from "@/lib/erp/reports";
import { isDate, monthStart, today } from "@/lib/erp/util";

export const metadata = { title: "Buku Besar - Mutasi" };

const n2 = (v: number) => (v ? v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");
const nb = (v: number) => (v < 0 ? `(${n2(-v)})` : v === 0 ? "0.00" : n2(v));
const d8 = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const longDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });

export default async function BukuBesarMutasi({ searchParams }: { searchParams: Promise<{ akun?: string; from?: string; to?: string }> }) {
  const { db, acc, site } = await reportContext();
  const sp = await searchParams;
  const to = isDate(sp.to) ? sp.to : today();
  const from = isDate(sp.from) && sp.from <= to ? sp.from : monthStart(to);
  const all = sp.akun === "semua";
  let accounts = acc.rows.filter((a) => a.id === sp.akun);
  if (all) {
    const ids = new Set((await db.all<{ id: string }>(sql`select distinct account_id id from fin_journal_lines where date >= ${from} and date <= ${to}`)).map((r) => r.id));
    accounts = acc.rows.filter((a) => ids.has(a.id)).sort((a, b) => a.code.localeCompare(b.code));
  }
  if (!accounts.length) {
    const kas = acc.byId.get(acc.sys("kas"));
    if (kas) accounts = [kas];
  }
  const ledgers = await Promise.all(accounts.map(async (a) => ({ a, lg: await ledger(db, a, from, to) })));
  const groups = accountGroups.map((g) => ({ g, list: acc.rows.filter((a) => a.group === g).sort((a, b) => a.code.localeCompare(b.code)) })).filter((x) => x.list.length);
  const keepAkun = all ? "semua" : accounts[0]?.id ?? "";

  return (
    <>
      <div className="no-print">
        <BackLink href="/akuntansi/laporan?k=keuangan&t=1">Laporan</BackLink>
        <PageHead title="Buku Besar - Mutasi" sub="Format formulir Zahir: setiap transaksi per akun dengan tipe, nomor referensi, keterangan, debet, kredit, dan saldo berjalan.">
          <Link href={`/akuntansi/laporan/buku-besar?akun=${accounts[0]?.id ?? ""}&from=${from}&to=${to}`} className="btn btn-ghost btn-sm">Tampilan biasa</Link>
          <PrintButton label="Cetak / PDF" />
        </PageHead>
        <PeriodBar
          path="/akuntansi/laporan/buku-besar-mutasi"
          presets={rangePresets()}
          from={from}
          to={to}
          keep={{ akun: keepAkun }}
          keepInForm={false}
          extra={
            <label className="grow">
              <span>Akun</span>
              <Select
                name="akun"
                defaultValue={keepAkun}
                searchable
                menuWidth={340}
                options={[{ value: "semua", label: "Semua akun yang bermutasi" }, ...groups.flatMap((x) => x.list.map((a) => ({ value: a.id, label: `${a.code} · ${a.name}`, group: GROUP_LABEL[x.g] })))]}
              />
            </label>
          }
        />
      </div>
      <ZahirForm company={site.legal_name || site.company_name || "PT. Istana Block Purwakarta"} title="Buku Besar - Mutasi" period={`${longDate(from)} - ${longDate(to)}`}>
        <table className="zf-table">
          <colgroup><col className="zf-c-date" /><col className="zf-c-tp" /><col className="zf-c-ref" /><col /><col className="zf-c-num" /><col className="zf-c-num" /><col className="zf-c-num" /></colgroup>
          <thead><tr><th>Tanggal</th><th>Tp</th><th>No. Ref.</th><th>Keterangan</th><th className="num">Debet</th><th className="num">Kredit</th><th className="num">Saldo</th></tr></thead>
          {ledgers.map(({ a, lg }) => (
            <tbody key={a.id} className="zf-acc">
              <tr className="zf-acc-head"><td colSpan={2}>{a.code}</td><td colSpan={5}>{a.name}</td></tr>
              <tr className="zf-open"><td colSpan={6}>Saldo Awal :</td><td className="num">{nb(lg.opening)}</td></tr>
              {lg.rows.map((r, i) => {
                const prev = lg.rows[i - 1];
                const head = [r.memo, r.contactName && !r.memo?.includes(r.contactName) ? r.contactName : ""].filter(Boolean).join(", ");
                const sub = r.lineMemo && r.lineMemo !== r.memo ? r.lineMemo : "";
                return (
                  <tr key={i}>
                    <td className="nowrap">{prev?.date === r.date ? "" : d8(r.date)}</td>
                    <td>{txType(r.source, r.number)}</td>
                    <td className="nowrap"><Link href={sourceHref(r.source, r.sourceId, r.journalId)}>{r.number}</Link></td>
                    <td>{head || sub}{head && sub && <em className="zf-sub">{sub}</em>}</td>
                    <td className="num">{n2(r.debit)}</td>
                    <td className="num">{n2(r.credit)}</td>
                    <td className="num">{nb(r.balance)}</td>
                  </tr>
                );
              })}
              <tr className="zf-total"><td colSpan={4}>Total {a.code}</td><td className="num">{n2(lg.totalDebit) || "0.00"}</td><td className="num">{n2(lg.totalCredit) || "0.00"}</td><td className="num">{nb(lg.closing)}</td></tr>
            </tbody>
          ))}
        </table>
      </ZahirForm>
    </>
  );
}
