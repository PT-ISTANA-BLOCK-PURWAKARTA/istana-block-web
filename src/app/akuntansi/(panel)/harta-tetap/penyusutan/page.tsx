// Bukukan penyusutan bulanan: pratinjau per aset, peringatan bila bulan itu sudah ada penyusutan dari Zahir, lalu satu jurnal PNY.
import Link from "next/link";
import { sql } from "drizzle-orm";
import { ActionButton } from "@/components/erp/ActionButton";
import { BackLink, PageHead } from "@/components/erp/ui";
import { postDepreciation, undoDepreciation } from "@/app/akuntansi/actions/assets";
import { getDb } from "@/db";
import { requireModule } from "@/lib/auth";
import { addMonth, otherDepreciationInMonth, planDepreciation } from "@/lib/erp/assets";
import { formatAmount, tgl, today } from "@/lib/erp/util";

export const metadata = { title: "Penyusutan harta tetap" };
export const dynamic = "force-dynamic";

export default async function Penyusutan({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  await requireModule("keuangan");
  const sp = await searchParams;
  const period = /^\d{4}-\d{2}$/.test(sp.periode ?? "") ? sp.periode! : today().slice(0, 7);
  const db = await getDb();
  const [plan, other, posted, runs] = await Promise.all([
    planDepreciation(db, period),
    otherDepreciationInMonth(db, period),
    db.all<{ code: string; name: string; amount: number; number: string; journalId: string }>(sql`
      select a.code, a.name, d.amount, j.number, j.id journalId from fin_depreciation_lines d join fin_fixed_assets a on a.id = d.asset_id join fin_journals j on j.id = d.journal_id
       where d.period = ${period} order by a.code`),
    db.all<{ period: string; n: number; total: number }>(sql`select period, count(*) n, sum(amount) total from fin_depreciation_lines group by period order by period desc limit 24`),
  ]);
  const planTotal = plan.reduce((s, p) => s + p.amount, 0);
  const postedTotal = posted.reduce((s, p) => s + Number(p.amount), 0);
  return (
    <>
      <BackLink href="/akuntansi/harta-tetap">Harta Tetap</BackLink>
      <PageHead title={`Penyusutan ${period}`} sub="Penyusutan dibukukan sebagai satu jurnal di akhir bulan: debit beban penyusutan, kredit akumulasi penyusutan per aset.">
        <Link href={`/akuntansi/harta-tetap/penyusutan?periode=${addMonth(period, -1)}`} className="btn btn-ghost btn-sm">‹ Bulan lalu</Link>
        <form method="get" style={{ display: "inline-flex", gap: 6 }}><input type="month" name="periode" defaultValue={period} /><button className="btn btn-ghost btn-sm">Tampilkan</button></form>
        <Link href={`/akuntansi/harta-tetap/penyusutan?periode=${addMonth(period, 1)}`} className="btn btn-ghost btn-sm">Bulan berikutnya ›</Link>
      </PageHead>
      {other.length > 0 && (
        <p className="alert alert-error">
          Bulan ini sudah ada penyusutan dari sumber lain ({other.map((o) => `${o.number} ${tgl(o.date)} Rp${Number(o.amount).toLocaleString("id-ID")}`).join("; ")}). Biasanya ini penyusutan dari Zahir —
          jangan bukukan lagi supaya tidak dobel. Isi &quot;akumulasi awal per tanggal&quot; di tiap aset sampai bulan ini.
        </p>
      )}
      {posted.length > 0 && (
        <section className="zd-card">
          <h2>Sudah dibukukan · {posted[0].number}</h2>
          <div className="admin-table"><table className="compact">
            <thead><tr><th>Aset</th><th className="num">Penyusutan</th></tr></thead>
            <tbody>{posted.map((p) => <tr key={p.code}><td>{p.code} · {p.name}</td><td className="num">{formatAmount(Number(p.amount))}</td></tr>)}</tbody>
            <tfoot><tr><th>Jumlah</th><th className="num">{formatAmount(postedTotal)}</th></tr></tfoot>
          </table></div>
          <ActionButton action={undoDepreciation.bind(null, period)} label={`Batalkan penyusutan ${period}`} confirmText={`Batalkan jurnal penyusutan ${period}?`} className="btn btn-ghost btn-sm" />
        </section>
      )}
      <section className="zd-card" style={{ marginTop: 16 }}>
        <h2>{posted.length ? "Aset yang belum disusutkan bulan ini" : "Pratinjau penyusutan"}</h2>
        {plan.length ? (
          <>
            <div className="admin-table"><table className="compact">
              <thead><tr><th>Aset</th><th className="num">Nilai buku awal</th><th className="num">Penyusutan</th><th className="num">Nilai buku akhir</th></tr></thead>
              <tbody>{plan.map((p) => <tr key={p.asset.id}><td><Link href={`/akuntansi/harta-tetap/${p.asset.id}`}>{p.asset.code}</Link> · {p.asset.name}</td><td className="num">{formatAmount(p.asset.book)}</td><td className="num">{formatAmount(p.amount)}</td><td className="num">{formatAmount(p.asset.book - p.amount)}</td></tr>)}</tbody>
              <tfoot><tr><th>Jumlah</th><th /><th className="num">{formatAmount(planTotal)}</th><th /></tr></tfoot>
            </table></div>
            <ActionButton action={postDepreciation.bind(null, period)} label={`Bukukan penyusutan ${period} (Rp${planTotal.toLocaleString("id-ID")})`} confirmText={other.length ? "Bulan ini sudah ada penyusutan dari sumber lain. Tetap bukukan?" : undefined} />
          </>
        ) : <p className="zd-empty">Tidak ada aset yang perlu disusutkan di bulan ini.</p>}
      </section>
      {runs.length > 0 && (
        <section className="zd-card" style={{ marginTop: 16 }}>
          <h2>Riwayat penyusutan yang dibukukan di web</h2>
          <div className="admin-table"><table className="compact">
            <thead><tr><th>Bulan</th><th className="num">Aset</th><th className="num">Jumlah</th></tr></thead>
            <tbody>{runs.map((r) => <tr key={r.period}><td><Link href={`/akuntansi/harta-tetap/penyusutan?periode=${r.period}`}>{r.period}</Link></td><td className="num">{r.n}</td><td className="num">{formatAmount(Number(r.total))}</td></tr>)}</tbody>
          </table></div>
        </section>
      )}
    </>
  );
}
