import "server-only";
import { sql } from "drizzle-orm";
import type { Account, AccountGroup } from "@/db/erp";
import { GROUP_ORDER, normalBalance, sectionOf } from "./accounting";
import type { DB } from "./server";
import { addDays, daysBetween, yearStart } from "./util";

type Sums = { accountId: string; debit: number; credit: number };

/** Total debit/kredit per akun dalam rentang tanggal (inklusif; from opsional). */
export async function sumsByAccount(db: DB, opts: { from?: string; to: string }): Promise<Map<string, Sums>> {
  const rows = await db.all<Sums>(sql`
    select account_id as accountId, coalesce(sum(debit),0) as debit, coalesce(sum(credit),0) as credit
    from fin_journal_lines
    where date <= ${opts.to} ${opts.from ? sql`and date >= ${opts.from}` : sql``}
    group by account_id`);
  return new Map(rows.map((r) => [r.accountId, { accountId: r.accountId, debit: Number(r.debit), credit: Number(r.credit) }]));
}

export type Row = { account: Account; debit: number; credit: number; balance: number };

function rowsFor(accounts: Account[], sums: Map<string, Sums>, groups: AccountGroup[]) {
  return accounts
    .filter((a) => groups.includes(a.group))
    .map((a) => {
      const s = sums.get(a.id);
      const debit = s?.debit ?? 0;
      const credit = s?.credit ?? 0;
      return { account: a, debit, credit, balance: normalBalance(a.group, debit, credit) };
    })
    .sort((x, y) => GROUP_ORDER.indexOf(x.account.group) - GROUP_ORDER.indexOf(y.account.group) || x.account.code.localeCompare(y.account.code));
}

/** Neraca saldo per tanggal. */
export async function trialBalance(db: DB, accounts: Account[], to: string) {
  const sums = await sumsByAccount(db, { to });
  const rows = rowsFor(accounts, sums, GROUP_ORDER).filter((r) => r.debit || r.credit || r.account.active);
  const net = rows.map((r) => ({ ...r, nd: Math.max(0, r.debit - r.credit), nc: Math.max(0, r.credit - r.debit) }));
  return { rows: net, totalDebit: net.reduce((a, r) => a + r.nd, 0), totalCredit: net.reduce((a, r) => a + r.nc, 0) };
}

const PL_GROUPS: AccountGroup[] = ["pendapatan", "hpp", "beban", "pendapatan_lain", "beban_lain"];

/** Laba rugi untuk rentang tanggal. */
export async function profitLoss(db: DB, accounts: Account[], from: string, to: string) {
  const sums = await sumsByAccount(db, { from, to });
  const rows = rowsFor(accounts, sums, PL_GROUPS).filter((r) => r.debit || r.credit);
  const tot = (g: AccountGroup) => rows.filter((r) => r.account.group === g).reduce((a, r) => a + r.balance, 0);
  const revenue = tot("pendapatan");
  const cogs = tot("hpp");
  const gross = revenue - cogs;
  const opex = tot("beban");
  const operating = gross - opex;
  const otherIncome = tot("pendapatan_lain");
  const otherExpense = tot("beban_lain");
  const net = operating + otherIncome - otherExpense;
  return { rows, revenue, cogs, gross, opex, operating, otherIncome, otherExpense, net };
}

/** Laba bersih kumulatif s.d. tanggal (untuk laba ditahan di neraca). */
async function netIncomeUpTo(db: DB, accounts: Account[], to: string) {
  const sums = await sumsByAccount(db, { to });
  return rowsFor(accounts, sums, PL_GROUPS).reduce((a, r) => a + (r.account.group === "pendapatan" || r.account.group === "pendapatan_lain" ? r.balance : -r.balance), 0);
}

/** Neraca per tanggal: laba tahun berjalan dihitung otomatis (tanpa perlu jurnal penutup). */
export async function balanceSheet(db: DB, accounts: Account[], asOf: string) {
  const sums = await sumsByAccount(db, { to: asOf });
  const all = rowsFor(accounts, sums, GROUP_ORDER);
  const assets = all.filter((r) => sectionOf(r.account.group) === "aset" && (r.debit || r.credit));
  const liabilities = all.filter((r) => sectionOf(r.account.group) === "kewajiban" && (r.debit || r.credit));
  const equity = all.filter((r) => sectionOf(r.account.group) === "modal" && (r.debit || r.credit));
  // Akumulasi penyusutan bersaldo kredit → mengurangi aset.
  const assetTotal = assets.reduce((a, r) => a + (r.account.group === "akum_penyusutan" ? -r.balance : r.balance), 0);
  const ys = yearStart(asOf);
  const priorYears = await netIncomeUpTo(db, accounts, addDays(ys, -1));
  const currentYear = (await netIncomeUpTo(db, accounts, asOf)) - priorYears;
  const liabTotal = liabilities.reduce((a, r) => a + r.balance, 0);
  const equityTotal = equity.reduce((a, r) => a + r.balance, 0) + priorYears + currentYear;
  return { assets, liabilities, equity, assetTotal, liabTotal, equityTotal, priorYears, currentYear, balanced: assetTotal === liabTotal + equityTotal };
}

export type LedgerLine = { journalId: string; number: string; date: string; memo: string; lineMemo: string; source: string; sourceId: string | null; debit: number; credit: number; contactName: string | null };

/** Buku besar satu akun: saldo awal + mutasi + saldo berjalan (menurut saldo normal). */
export async function ledger(db: DB, account: Account, from: string, to: string) {
  const open = await db.get<{ d: number; c: number }>(sql`select coalesce(sum(debit),0) d, coalesce(sum(credit),0) c from fin_journal_lines where account_id = ${account.id} and date < ${from}`);
  const lines = await db.all<LedgerLine>(sql`
    select j.id as journalId, j.number, l.date, j.memo, l.memo as lineMemo, j.source, j.source_id as sourceId, l.debit, l.credit, c.name as contactName
    from fin_journal_lines l join fin_journals j on j.id = l.journal_id left join fin_contacts c on c.id = l.contact_id
    where l.account_id = ${account.id} and l.date >= ${from} and l.date <= ${to}
    order by l.date, j.number, l.sort`);
  const opening = normalBalance(account.group, Number(open?.d ?? 0), Number(open?.c ?? 0));
  let bal = opening;
  const rows = lines.map((l) => {
    bal += normalBalance(account.group, Number(l.debit), Number(l.credit));
    return { ...l, debit: Number(l.debit), credit: Number(l.credit), balance: bal };
  });
  return { opening, rows, closing: bal, totalDebit: rows.reduce((a, r) => a + r.debit, 0), totalCredit: rows.reduce((a, r) => a + r.credit, 0) };
}

export type AgingDoc = { id: string; number: string; date: string; dueDate: string; contactId: string; contactName: string; total: number; paid: number; open: number; overdue: number };

/** Umur piutang/hutang per tanggal: sisa = total − alokasi pembayaran s.d. tanggal itu. */
export async function aging(db: DB, kind: "piutang" | "hutang", asOf: string) {
  const docs =
    kind === "piutang"
      ? await db.all<AgingDoc>(sql`
          select i.id, i.number, i.date, i.due_date as dueDate, i.contact_id as contactId, c.name as contactName, i.total,
            coalesce((select sum(a.amount) from fin_receipt_allocations a join fin_receipts r on r.id = a.receipt_id where a.invoice_id = i.id and r.date <= ${asOf}),0) as paid
          from fin_invoices i join fin_contacts c on c.id = i.contact_id
          where i.date <= ${asOf} and i.void = 0`)
      : await db.all<AgingDoc>(sql`
          select b.id, b.number, b.date, b.due_date as dueDate, b.contact_id as contactId, c.name as contactName, b.total,
            coalesce((select sum(a.amount) from fin_payment_allocations a join fin_payments p on p.id = a.payment_id where a.bill_id = b.id and p.date <= ${asOf}),0) as paid
          from fin_bills b join fin_contacts c on c.id = b.contact_id
          where b.date <= ${asOf} and b.void = 0`);
  const open = docs
    .map((d) => ({ ...d, total: Number(d.total), paid: Number(d.paid), open: Number(d.total) - Number(d.paid), overdue: Math.max(0, daysBetween(d.dueDate, asOf)) }))
    .filter((d) => d.open > 0)
    .sort((a, b) => a.contactName.localeCompare(b.contactName) || a.dueDate.localeCompare(b.dueDate));
  const bucket = (d: number) => (d <= 0 ? 0 : d <= 30 ? 1 : d <= 60 ? 2 : d <= 90 ? 3 : 4);
  const byContact = new Map<string, { name: string; buckets: number[]; total: number; docs: typeof open }>();
  for (const d of open) {
    const e = byContact.get(d.contactId) ?? { name: d.contactName, buckets: [0, 0, 0, 0, 0], total: 0, docs: [] };
    e.buckets[bucket(d.overdue)] += d.open;
    e.total += d.open;
    e.docs.push(d);
    byContact.set(d.contactId, e);
  }
  const totals = [0, 0, 0, 0, 0];
  for (const e of byContact.values()) e.buckets.forEach((v, i) => (totals[i] += v));
  return { docs: open, contacts: [...byContact.entries()].map(([id, e]) => ({ id, ...e })), totals, grand: totals.reduce((a, b) => a + b, 0) };
}

/** Penjualan per barang dan per pelanggan (dari faktur, sebelum PPN). */
export async function salesSummary(db: DB, from: string, to: string) {
  const byItem = await db.all<{ name: string; unit: string; qty: number; amount: number }>(sql`
    select coalesce(it.name, l.description) as name, l.unit, sum(l.qty) as qty, sum(l.amount) as amount
    from fin_invoice_lines l join fin_invoices i on i.id = l.invoice_id left join fin_items it on it.id = l.item_id
    where i.date between ${from} and ${to} and i.void = 0
    group by coalesce(l.item_id, l.description), l.unit order by amount desc`);
  const byCustomer = await db.all<{ name: string; count: number; amount: number; total: number; paid: number }>(sql`
    select c.name, count(*) as count, sum(i.subtotal - i.discount + i.ongkir) as amount, sum(i.total) as total, sum(i.paid) as paid
    from fin_invoices i join fin_contacts c on c.id = i.contact_id
    where i.date between ${from} and ${to} and i.void = 0
    group by i.contact_id order by amount desc`);
  return {
    byItem: byItem.map((r) => ({ ...r, qty: Number(r.qty), amount: Number(r.amount) })),
    byCustomer: byCustomer.map((r) => ({ ...r, count: Number(r.count), amount: Number(r.amount), total: Number(r.total), paid: Number(r.paid) })),
  };
}

/** Saldo akun kas/bank saat ini (untuk ringkasan). */
export async function cashBalances(db: DB, accounts: Account[], to: string) {
  const sums = await sumsByAccount(db, { to });
  return rowsFor(accounts, sums, ["kas_bank"]).filter((r) => r.account.active || r.balance);
}
