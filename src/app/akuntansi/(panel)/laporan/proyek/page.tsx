// Daftar Proyek & Laba Rugi Proyek / Departemen (format formulir Zahir): dari baris jurnal yang diberi tag proyek/departemen.
import Link from "next/link";
import { sql } from "drizzle-orm";
import { PrintButton } from "@/components/erp/PrintButton";
import { PeriodBar } from "@/components/erp/report/PeriodBar";
import { ZahirForm, zb, zDate, zn, zPeriod } from "@/components/erp/report/ZahirForm";
import { BackLink, PageHead } from "@/components/erp/ui";
import { Select } from "@/components/ui";
import { sourceHref } from "@/lib/erp/links";
import { rangePresets } from "@/lib/erp/periods";
import { reportContext } from "@/lib/erp/reportctx";
import { isDate, today, yearStart } from "@/lib/erp/util";

export const metadata = { title: "Laba Rugi Proyek" };

const PL = ["pendapatan", "pendapatan_lain", "hpp", "beban", "beban_lain"];
const credit = (g: string) => g === "pendapatan" || g === "pendapatan_lain";

export default async function LabaRugiProyek({ searchParams }: { searchParams: Promise<{ jenis?: string; proyek?: string; from?: string; to?: string }> }) {
  const { db, site } = await reportContext();
  const sp = await searchParams;
  const dept = sp.jenis === "departemen";
  const col = dept ? "department_id" : "project_id";
  const to = isDate(sp.to) ? sp.to : today();
  const from = isDate(sp.from) && sp.from <= to ? sp.from : yearStart(to);
  const tags = await db.all<{ id: string; code: string; name: string; budget: number | null; status: string | null; contact: string | null; startDate: string | null; endDate: string | null }>(
    dept
      ? sql`select id, code, name, null budget, null status, null contact, null startDate, null endDate from fin_departments order by code`
      : sql`select p.id, p.code, p.name, p.budget, p.status, c.name contact, p.start_date startDate, p.end_date endDate from fin_projects p left join fin_contacts c on c.id = p.contact_id order by p.code`,
  );
  const rows = await db.all<{ tag: string; grp: string; code: string; name: string; d: number; c: number }>(sql.raw(`
    select l.${col} tag, a.grp, a.code, a.name, sum(l.debit) d, sum(l.credit) c from fin_journal_lines l join fin_accounts a on a.id = l.account_id
     where l.${col} is not null and l.date >= '${from}' and l.date <= '${to}' and a.grp in ('${PL.join("','")}') group by l.${col}, a.id order by a.code`));
  const by = new Map<string, { rev: number; cost: number; accounts: { code: string; name: string; grp: string; amt: number }[] }>();
  for (const r of rows) {
    const e = by.get(r.tag) ?? { rev: 0, cost: 0, accounts: [] };
    const amt = credit(r.grp) ? Number(r.c) - Number(r.d) : Number(r.d) - Number(r.c);
    if (credit(r.grp)) e.rev += amt; else e.cost += amt;
    e.accounts.push({ code: r.code, name: r.name, grp: r.grp, amt });
    by.set(r.tag, e);
  }
  const sel = tags.find((t) => t.id === sp.proyek);
  const txns = sel
    ? await db.all<{ journalId: string; number: string; date: string; memo: string; source: string; sourceId: string | null; code: string; name: string; debit: number; credit: number }>(sql.raw(`
        select j.id journalId, j.number, l.date, coalesce(nullif(l.memo,''), j.memo) memo, j.source, j.source_id sourceId, a.code, a.name, l.debit, l.credit
          from fin_journal_lines l join fin_journals j on j.id = l.journal_id join fin_accounts a on a.id = l.account_id
         where l.${col} = '${sel.id.replace(/'/g, "''")}' and l.date >= '${from}' and l.date <= '${to}' order by l.date, j.number, l.sort`))
    : [];
  const label = dept ? "Departemen" : "Proyek";
  const title = sel ? `Laba Rugi ${label} - Rincian` : dept ? "Laba Rugi Departemen - Rangkuman" : "Daftar Proyek & Laba Rugi Proyek";
  const keep = { ...(dept ? { jenis: "departemen" } : {}), ...(sel ? { proyek: sel.id } : {}) };
  const e = sel ? by.get(sel.id) : undefined;
  return (
    <>
      <div className="no-print">
        <BackLink href="/akuntansi/laporan?k=lainnya">Laporan</BackLink>
        <PageHead title={title} sub={`Dihitung dari jurnal yang diberi tag ${label.toLowerCase()} (pilih ${label.toLowerCase()} di Jurnal Umum / Kas).`}>
          <Link href={`/akuntansi/data/${dept ? "departemen" : "proyek"}`} className="btn btn-ghost btn-sm">Data {label}</Link>
          <Link href={`/akuntansi/laporan/proyek?${dept ? "" : "jenis=departemen"}`} className="btn btn-ghost btn-sm">Per {dept ? "proyek" : "departemen"}</Link>
          <PrintButton label="Cetak / PDF" />
        </PageHead>
        <PeriodBar path="/akuntansi/laporan/proyek" presets={rangePresets()} from={from} to={to} keep={keep} keepInForm={false}
          extra={<>{dept && <input type="hidden" name="jenis" value="departemen" />}<label className="grow"><span>{label}</span><Select name="proyek" defaultValue={sel?.id ?? ""} searchable options={[{ value: "", label: `Semua ${label.toLowerCase()} (rangkuman)` }, ...tags.map((t) => ({ value: t.id, label: `${t.code} · ${t.name}` }))]} /></label></>} />
      </div>
      <ZahirForm company={site.legal_name || site.company_name || "PT. Istana Block Purwakarta"} title={title} period={zPeriod(from, to)}>
        {sel ? (
          <>
            <table className="zf-table">
              <thead><tr><th>Kode</th><th>Rekening</th><th className="num">Jumlah</th></tr></thead>
              <tbody>
                <tr className="zf-acc-head"><td colSpan={3}>{sel.code} · {sel.name}{sel.contact ? ` — ${sel.contact}` : ""}</td></tr>
                {(e?.accounts ?? []).map((a) => <tr key={a.code}><td>{a.code}</td><td>{a.name}</td><td className="num">{zb(credit(a.grp) ? a.amt : -a.amt)}</td></tr>)}
              </tbody>
              <tfoot>
                <tr className="zf-total"><td colSpan={2}>Pendapatan</td><td className="num">{zn(e?.rev ?? 0, true)}</td></tr>
                <tr className="zf-total"><td colSpan={2}>Biaya</td><td className="num">{zn(e?.cost ?? 0, true)}</td></tr>
                <tr className="zf-total"><td colSpan={2}>LABA (RUGI) {label.toUpperCase()}</td><td className="num">{zb((e?.rev ?? 0) - (e?.cost ?? 0))}</td></tr>
                {!dept && sel.budget ? <tr className="zf-total"><td colSpan={2}>Nilai kontrak / anggaran</td><td className="num">{zn(Number(sel.budget), true)}</td></tr> : null}
              </tfoot>
            </table>
            <h3 className="zf-h3">Transaksi</h3>
            <table className="zf-table">
              <thead><tr><th className="zf-c-date">Tanggal</th><th className="zf-c-ref">No. Ref.</th><th>Keterangan</th><th>Rekening</th><th className="num">Debet</th><th className="num">Kredit</th></tr></thead>
              <tbody>{txns.map((t, i) => <tr key={i}><td>{zDate(t.date)}</td><td><Link href={sourceHref(t.source, t.sourceId, t.journalId)}>{t.number}</Link></td><td>{t.memo}</td><td className="small">{t.code} {t.name}</td><td className="num">{zn(Number(t.debit))}</td><td className="num">{zn(Number(t.credit))}</td></tr>)}
                {!txns.length && <tr><td colSpan={6}>Belum ada transaksi dengan tag ini pada periode.</td></tr>}</tbody>
            </table>
          </>
        ) : (
          <table className="zf-table">
            <thead><tr><th>Kode</th><th>{label}</th>{!dept && <th>Pelanggan</th>}{!dept && <th>Status</th>}<th className="num">Pendapatan</th><th className="num">Biaya</th><th className="num">Laba (Rugi)</th>{!dept && <th className="num">Nilai kontrak</th>}</tr></thead>
            <tbody>
              {tags.map((t) => { const x = by.get(t.id); return (
                <tr key={t.id}><td>{t.code}</td><td><Link href={`/akuntansi/laporan/proyek?${new URLSearchParams({ ...(dept ? { jenis: "departemen" } : {}), proyek: t.id, from, to })}`}>{t.name}</Link></td>
                  {!dept && <td>{t.contact ?? "-"}</td>}{!dept && <td>{t.status}</td>}
                  <td className="num">{zn(x?.rev ?? 0, true)}</td><td className="num">{zn(x?.cost ?? 0, true)}</td><td className="num">{zb((x?.rev ?? 0) - (x?.cost ?? 0))}</td>{!dept && <td className="num">{zn(Number(t.budget ?? 0), true)}</td>}</tr>); })}
              {!tags.length && <tr><td colSpan={8}>Belum ada data {label.toLowerCase()}. <Link href={`/akuntansi/data/${dept ? "departemen" : "proyek"}`}>Tambah</Link>.</td></tr>}
            </tbody>
          </table>
        )}
      </ZahirForm>
    </>
  );
}
