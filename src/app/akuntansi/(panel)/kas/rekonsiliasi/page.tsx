// Rekonsiliasi Bank (seperti fitur Rekonsiliasi Bank di Zahir): impor mutasi rekening koran, cocokkan dengan buku,
// bukukan biaya/bunga bank yang belum dicatat, dan simpan bukti rekonsiliasi per akhir bulan.
import Link from "next/link";
import { BackLink, PageHead } from "@/components/erp/ui";
import { ReconBoard } from "@/components/erp/ReconBoard";
import { getDb } from "@/db";
import { requireModule } from "@/lib/auth";
import { bankLines, bookBalance, bookLines, reconHistory, statementBalance } from "@/lib/erp/bankRecon";
import { loadAccounts } from "@/lib/erp/server";
import { formatAmount, isDate, monthStart, tgl, today } from "@/lib/erp/util";

export const metadata = { title: "Rekonsiliasi Bank" };
export const dynamic = "force-dynamic";

const monthEnd = (d: string) => new Date(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)), 0)).toISOString().slice(0, 10);

export default async function Rekonsiliasi({ searchParams }: { searchParams: Promise<{ akun?: string; dari?: string; sampai?: string }> }) {
  await requireModule("keuangan");
  const sp = await searchParams;
  const db = await getDb();
  const acc = await loadAccounts(db);
  const banks = acc.rows.filter((a) => a.group === "kas_bank" && a.active).sort((a, b) => a.code.localeCompare(b.code));
  // Bawaan: rekening bank pertama (nama mengandung "bank"/"BCA"), bulan ini.
  const account = banks.find((a) => a.id === sp.akun) ?? banks.find((a) => /bank|bca|mandiri|bri|bni/i.test(a.name)) ?? banks[0];
  const now = today();
  const from = isDate(sp.dari ?? "") ? sp.dari! : monthStart(now);
  const to = isDate(sp.sampai ?? "") ? sp.sampai! : monthEnd(from) < now ? monthEnd(from) : now;
  if (!account) return <><PageHead title="Rekonsiliasi Bank" /><p className="muted">Belum ada rekening kas/bank.</p></>;

  const [bank, book, bookBal, stmtBal, history] = await Promise.all([
    bankLines(db, account.id, from, to),
    bookLines(db, account.id, from, to),
    bookBalance(db, account.id, to),
    statementBalance(db, account.id, to),
    reconHistory(db, account.id),
  ]);
  const counters = acc.rows
    .filter((a) => a.active && a.id !== account.id)
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((a) => ({ id: a.id, label: `${a.code} · ${a.name}` }));
  const prevMonth = (() => { const d = new Date(Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 2, 1)); return d.toISOString().slice(0, 10); })();
  const nextMonth = (() => { const d = new Date(Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)), 1)); return d.toISOString().slice(0, 10); })();
  const href = (p: Record<string, string>) => `/akuntansi/kas/rekonsiliasi?${new URLSearchParams({ akun: account.id, dari: from, sampai: to, ...p })}`;

  return (
    <>
      <BackLink href="/akuntansi/kas">Kas &amp; Bank</BackLink>
      <PageHead title="Rekonsiliasi Bank" sub="Cocokkan mutasi rekening koran dengan catatan buku, lalu simpan bukti rekonsiliasi tiap akhir bulan." />
      <form method="get" className="filter-bar">
        <div className="field">
          <label htmlFor="rc-akun">Rekening</label>
          <select id="rc-akun" name="akun" defaultValue={account.id}>
            {banks.map((b) => <option key={b.id} value={b.id}>{b.code} · {b.name}</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor="rc-dari">Dari</label><input id="rc-dari" type="date" name="dari" defaultValue={from} /></div>
        <div className="field"><label htmlFor="rc-sampai">Sampai</label><input id="rc-sampai" type="date" name="sampai" defaultValue={to} /></div>
        <button type="submit" className="btn btn-blue btn-sm">Tampilkan</button>
        <Link href={href({ dari: prevMonth, sampai: monthEnd(prevMonth) })} className="btn btn-ghost btn-sm">‹ Bulan lalu</Link>
        <Link href={href({ dari: nextMonth, sampai: monthEnd(nextMonth) < now ? monthEnd(nextMonth) : now })} className="btn btn-ghost btn-sm">Bulan berikutnya ›</Link>
      </form>

      <ReconBoard
        accountId={account.id}
        accountName={`${account.code} · ${account.name}`}
        from={from}
        to={to}
        bank={bank}
        book={book}
        counters={counters}
        bookBal={bookBal}
        statementBal={stmtBal}
      />

      <section className="zd-card" style={{ marginTop: 16 }}>
        <h2>Riwayat rekonsiliasi {account.name}</h2>
        {history.length ? (
          <div className="admin-table"><table className="compact">
            <thead><tr><th>Per tanggal</th><th className="num">Saldo rekening koran</th><th className="num">Saldo buku</th><th>Catatan</th><th>Oleh</th></tr></thead>
            <tbody>{history.map((h) => <tr key={h.id}><td>{tgl(h.periodEnd)}</td><td className="num">{formatAmount(h.statementBalance)}</td><td className="num">{formatAmount(h.bookBalance)}</td><td className="small">{h.note || "-"}</td><td className="small">{h.createdByName ?? "-"}</td></tr>)}</tbody>
          </table></div>
        ) : <p className="zd-empty">Belum ada rekonsiliasi yang disimpan.</p>}
      </section>
    </>
  );
}
