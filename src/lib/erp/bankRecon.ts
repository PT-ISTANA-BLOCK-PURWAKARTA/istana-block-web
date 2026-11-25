import "server-only";
// Rekonsiliasi bank: mutasi rekening koran vs baris jurnal rekening kas/bank di buku.
// Cocok otomatis = jumlah & arah sama, tanggal selisih ≤ toleransi hari (yang paling dekat dulu).
import { sql } from "drizzle-orm";
import type { DB } from "./server";
import { addDays } from "./util";

export type BankLineRow = { id: string; date: string; description: string; amount: number; balance: number | null; matchedLineId: string | null; matchNumber: string | null; matchDate: string | null; note: string };
export type BookLineRow = { id: string; date: string; amount: number; number: string; memo: string; source: string; sourceId: string | null; journalId: string; contactName: string | null; matched: boolean };

/** Mutasi bank pada rentang (dengan nomor jurnal pasangannya bila sudah cocok). Pasangan yang jurnalnya hilang dianggap belum cocok. */
export async function bankLines(db: DB, accountId: string, from: string, to: string): Promise<BankLineRow[]> {
  const rows = await db.all<BankLineRow>(sql`
    select b.id, b.date, b.description, b.amount, b.balance, case when l.id is null then null else b.matched_line_id end matchedLineId,
           j.number matchNumber, l.date matchDate, b.note
      from fin_bank_lines b left join fin_journal_lines l on l.id = b.matched_line_id left join fin_journals j on j.id = l.journal_id
     where b.account_id = ${accountId} and b.date >= ${from} and b.date <= ${to}
     order by b.date, b.rowid`);
  return rows.map((r) => ({ ...r, amount: Number(r.amount), balance: r.balance == null ? null : Number(r.balance) }));
}

/** Baris buku (jurnal) rekening ini pada rentang; amount + = uang masuk (debit). */
export async function bookLines(db: DB, accountId: string, from: string, to: string): Promise<BookLineRow[]> {
  const rows = await db.all<Omit<BookLineRow, "matched"> & { matched: number }>(sql`
    select l.id, l.date, l.debit - l.credit amount, j.number, coalesce(nullif(l.memo, ''), j.memo) memo, j.source, j.source_id sourceId, j.id journalId, c.name contactName,
           exists (select 1 from fin_bank_lines b where b.matched_line_id = l.id) matched
      from fin_journal_lines l join fin_journals j on j.id = l.journal_id left join fin_contacts c on c.id = l.contact_id
     where l.account_id = ${accountId} and l.date >= ${from} and l.date <= ${to}
     order by l.date, j.created_at, l.sort`);
  return rows.map((r) => ({ ...r, amount: Number(r.amount), matched: Boolean(r.matched) }));
}

/** Saldo buku rekening s.d. tanggal (debit − kredit). */
export async function bookBalance(db: DB, accountId: string, to: string) {
  const r = await db.get<{ b: number }>(sql`select coalesce(sum(debit),0) - coalesce(sum(credit),0) b from fin_journal_lines where account_id = ${accountId} and date <= ${to}`);
  return Number(r?.b ?? 0);
}

/** Saldo menurut bank per tanggal: saldo baris mutasi terakhir s.d. tanggal itu (bila file memuat saldo). */
export async function statementBalance(db: DB, accountId: string, to: string) {
  const r = await db.get<{ b: number | null }>(sql`select balance b from fin_bank_lines where account_id = ${accountId} and date <= ${to} and balance is not null order by date desc, rowid desc limit 1`);
  return r?.b == null ? null : Number(r.b);
}

/** Pasangan otomatis untuk baris bank yang belum cocok. Mengembalikan [bankLineId, journalLineId][]. */
export async function proposeMatches(db: DB, accountId: string, from: string, to: string, toleranceDays = 3) {
  const [bank, book] = await Promise.all([bankLines(db, accountId, from, to), bookLines(db, accountId, addDays(from, -toleranceDays), addDays(to, toleranceDays))]);
  const free = book.filter((b) => !b.matched);
  const used = new Set<string>();
  const pairs: [string, string][] = [];
  const dayNum = (d: string) => Date.parse(`${d}T00:00:00Z`) / 86400000;
  for (const s of bank.filter((b) => !b.matchedLineId)) {
    let best: BookLineRow | null = null;
    let bestGap = Infinity;
    for (const b of free) {
      if (used.has(b.id) || b.amount !== s.amount) continue;
      const gap = Math.abs(dayNum(b.date) - dayNum(s.date));
      if (gap <= toleranceDays && gap < bestGap) { best = b; bestGap = gap; }
    }
    if (best) { used.add(best.id); pairs.push([s.id, best.id]); }
  }
  return pairs;
}

export async function reconHistory(db: DB, accountId: string) {
  return db.all<{ id: string; periodEnd: string; statementBalance: number; bookBalance: number; note: string; createdByName: string | null; createdAt: number }>(sql`
    select id, period_end periodEnd, statement_balance statementBalance, book_balance bookBalance, note, created_by_name createdByName, created_at createdAt
      from fin_bank_recons where account_id = ${accountId} order by period_end desc limit 24`);
}
