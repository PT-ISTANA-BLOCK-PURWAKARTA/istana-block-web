import Link from "next/link";
import { and, desc, eq, gte, like, lte, sql } from "drizzle-orm";
import { Ok, PageHead, Rp } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { journalSources } from "@/db/erp";
import { requireModule } from "@/lib/auth";
import { SOURCE_LABEL, sourceHref } from "@/lib/erp/links";
import { isDate, monthStart, tgl, today } from "@/lib/erp/util";
import { DateField, Select } from "@/components/ui";

export const metadata = { title: "Jurnal" };

export default async function Jurnal({ searchParams }: { searchParams: Promise<{ ok?: string; q?: string; sumber?: string; semua?: string; from?: string; to?: string }> }) {
  await requireModule("keuangan");
  const sp = await searchParams;
  const now = today();
  const from = isDate(sp.from) ? sp.from : monthStart(now);
  const to = isDate(sp.to) ? sp.to : now;
  const source = (journalSources as readonly string[]).includes(sp.sumber ?? "") ? (sp.sumber as (typeof journalSources)[number]) : sp.semua ? undefined : "manual";
  const db = await getDb();
  const rows = await db
    .select({ j: schema.journals, total: sql<number>`(select coalesce(sum(l.debit),0) from fin_journal_lines l where l.journal_id = fin_journals.id)` })
    .from(schema.journals)
    .where(and(gte(schema.journals.date, from), lte(schema.journals.date, to), source ? eq(schema.journals.source, source) : undefined, sp.q ? like(schema.journals.memo, `%${sp.q}%`) : undefined))
    .orderBy(desc(schema.journals.date), desc(schema.journals.number))
    .limit(400);
  return (
    <>
      <PageHead title="Jurnal" sub="Jurnal umum (saldo awal, penyusutan, koreksi) dan semua jurnal otomatis dari transaksi.">
        <Link href="/akuntansi/jurnal/baru" className="btn btn-primary btn-sm">+ Jurnal umum</Link>
      </PageHead>
      <Ok ok={sp.ok} />
      <form className="filter-bar" method="get">
        <div className="field grow"><label htmlFor="q">Cari keterangan</label><input id="q" name="q" defaultValue={sp.q} /></div>
        <div className="field">
          <label htmlFor="sumber">Sumber</label>
          <Select id="sumber" name="sumber" defaultValue={source ?? ""} options={[{ value: "", label: "Semua sumber" }, ...journalSources.map((s) => ({ value: s, label: SOURCE_LABEL[s] }))]} />
        </div>
        <input type="hidden" name="semua" value="1" />
        <div className="field"><label htmlFor="from">Dari</label><DateField id="from" name="from" defaultValue={from} /></div>
        <div className="field"><label htmlFor="to">Sampai</label><DateField id="to" name="to" defaultValue={to} /></div>
        <button className="btn btn-blue btn-sm" type="submit">Tampilkan</button>
      </form>
      <div className="admin-table">
        <table>
          <thead><tr><th>Tanggal</th><th>Nomor</th><th>Sumber</th><th>Keterangan</th><th className="num">Jumlah</th></tr></thead>
          <tbody>
            {rows.map(({ j, total }) => (
              <tr key={j.id}>
                <td>{tgl(j.date)}</td>
                <td><Link href={`/akuntansi/jurnal/${j.id}`}><b>{j.number}</b></Link></td>
                <td className="small">{j.source === "manual" ? "Jurnal umum" : <Link href={sourceHref(j.source, j.sourceId, j.id)}>{SOURCE_LABEL[j.source]}</Link>}</td>
                <td className="small">{j.memo}</td>
                <td className="num"><Rp n={Number(total)} /></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="muted">Belum ada jurnal pada filter ini.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
