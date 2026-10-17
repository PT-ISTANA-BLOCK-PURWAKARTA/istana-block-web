import Link from "next/link";
import { and, desc, eq, gte, like, lte, or } from "drizzle-orm";
import { Ok, PageHead, Rp } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { cashKinds } from "@/db/erp";
import { requireModule } from "@/lib/auth";
import { cashBalances } from "@/lib/erp/reports";
import { loadAccounts } from "@/lib/erp/server";
import { formatAmount, isDate, monthStart, tgl, today } from "@/lib/erp/util";

export const metadata = { title: "Kas & bank" };

const KIND = { masuk: "Kas masuk", keluar: "Kas keluar", transfer: "Transfer" } as const;

export default async function Kas({ searchParams }: { searchParams: Promise<{ ok?: string; q?: string; jenis?: string; from?: string; to?: string }> }) {
  await requireModule("keuangan");
  const sp = await searchParams;
  const now = today();
  const from = isDate(sp.from) ? sp.from : monthStart(now);
  const to = isDate(sp.to) ? sp.to : now;
  const db = await getDb();
  const acc = await loadAccounts(db);
  const kind = (cashKinds as readonly string[]).includes(sp.jenis ?? "") ? (sp.jenis as (typeof cashKinds)[number]) : undefined;
  const [rows, balances] = await Promise.all([
    db
      .select()
      .from(schema.cashTxns)
      .where(and(gte(schema.cashTxns.date, from), lte(schema.cashTxns.date, to), kind ? eq(schema.cashTxns.kind, kind) : undefined, sp.q ? or(like(schema.cashTxns.number, `%${sp.q}%`), like(schema.cashTxns.memo, `%${sp.q}%`)) : undefined))
      .orderBy(desc(schema.cashTxns.date), desc(schema.cashTxns.number))
      .limit(300),
    cashBalances(db, acc.rows, now),
  ]);
  return (
    <>
      <PageHead title="Kas & bank" sub="Biaya harian, pemasukan lain, dan transfer antar rekening. Penerimaan dari pelanggan dicatat di menu Penerimaan.">
        <Link href="/akuntansi/kas/baru?jenis=keluar" className="btn btn-primary btn-sm">+ Kas keluar</Link>
        <Link href="/akuntansi/kas/baru?jenis=masuk" className="btn btn-blue btn-sm">+ Kas masuk</Link>
        <Link href="/akuntansi/kas/baru?jenis=transfer" className="btn btn-ghost btn-sm">+ Transfer</Link>
      </PageHead>
      <Ok ok={sp.ok} />
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        {balances.map((b) => (
          <Link key={b.account.id} href={`/akuntansi/laporan/buku-besar?akun=${b.account.id}`} className="stat stat-link"><span className="muted small">{b.account.name}</span><b>{formatAmount(b.balance)}</b></Link>
        ))}
      </div>
      <form className="filter-bar" method="get">
        <div className="field grow"><label htmlFor="q">Cari</label><input id="q" name="q" defaultValue={sp.q} placeholder="nomor atau keterangan" /></div>
        <div className="field">
          <label htmlFor="jenis">Jenis</label>
          <select id="jenis" name="jenis" defaultValue={sp.jenis ?? ""}>
            <option value="">Semua</option>
            {cashKinds.map((k) => <option key={k} value={k}>{KIND[k]}</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor="from">Dari</label><input id="from" name="from" type="date" defaultValue={from} /></div>
        <div className="field"><label htmlFor="to">Sampai</label><input id="to" name="to" type="date" defaultValue={to} /></div>
        <button className="btn btn-blue btn-sm" type="submit">Tampilkan</button>
      </form>
      <div className="admin-table">
        <table>
          <thead><tr><th>Tanggal</th><th>Nomor</th><th>Jenis</th><th>Akun</th><th>Keterangan</th><th className="num">Masuk</th><th className="num">Keluar</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{tgl(r.date)}</td>
                <td><Link href={`/akuntansi/kas/${r.id}`}><b>{r.number}</b></Link></td>
                <td>{KIND[r.kind]}</td>
                <td className="small">{acc.byId.get(r.accountId)?.name}{r.toAccountId && ` → ${acc.byId.get(r.toAccountId)?.name}`}</td>
                <td className="small">{r.memo}</td>
                <td className="num">{r.kind === "masuk" ? <Rp n={r.amount} /> : ""}</td>
                <td className="num">{r.kind === "keluar" ? <Rp n={r.amount} /> : r.kind === "transfer" ? <span className="muted"><Rp n={r.amount} /></span> : ""}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="muted">Belum ada transaksi kas pada rentang ini.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
