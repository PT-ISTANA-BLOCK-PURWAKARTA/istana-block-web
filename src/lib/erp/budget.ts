import "server-only";
// Anggaran per akun per bulan dan perbandingannya dengan realisasi (laba rugi: mutasi bulan; neraca: saldo akhir bulan).
import { sql } from "drizzle-orm";
import type { Account, AccountGroup } from "@/db/erp";
import { GROUP_ORDER, normalBalance, sectionOf } from "./accounting";
import type { DB } from "./server";

export type BudgetKind = "lr" | "neraca";
export const PL_GROUPS: AccountGroup[] = ["pendapatan", "hpp", "beban", "pendapatan_lain", "beban_lain"];
export const BS_GROUPS: AccountGroup[] = GROUP_ORDER.filter((g) => !PL_GROUPS.includes(g));
export const MONTHS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
export const periodsOfYear = (y: number) => Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`);
const monthEnd = (p: string) => new Date(Date.UTC(Number(p.slice(0, 4)), Number(p.slice(5, 7)), 0)).toISOString().slice(0, 10);

/** Anggaran (map accountId → period → amount) untuk rentang bulan. */
export async function loadBudgets(db: DB, fromPeriod: string, toPeriod: string) {
  const rows = await db.all<{ accountId: string; period: string; amount: number }>(sql`
    select account_id accountId, period, amount from fin_budgets where period >= ${fromPeriod} and period <= ${toPeriod}`);
  const m = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const e = m.get(r.accountId) ?? new Map<string, number>();
    e.set(r.period, Number(r.amount));
    m.set(r.accountId, e);
  }
  return m;
}

/** Realisasi per akun per bulan, menurut saldo normal: LR = mutasi bulan itu; neraca = saldo akhir bulan. */
export async function actualByMonth(db: DB, accounts: Account[], kind: BudgetKind, periods: string[]) {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const out = new Map<string, Map<string, number>>();
  const put = (id: string, p: string, v: number) => { const e = out.get(id) ?? new Map<string, number>(); e.set(p, v); out.set(id, e); };
  if (!periods.length) return out;
  const first = periods[0], last = periods[periods.length - 1];
  if (kind === "lr") {
    const rows = await db.all<{ accountId: string; p: string; d: number; c: number }>(sql`
      select account_id accountId, substr(date,1,7) p, sum(debit) d, sum(credit) c from fin_journal_lines
       where date >= ${`${first}-01`} and date <= ${monthEnd(last)} group by account_id, p`);
    for (const r of rows) { const a = byId.get(r.accountId); if (a && PL_GROUPS.includes(a.group)) put(a.id, r.p, normalBalance(a.group, Number(r.d), Number(r.c))); }
  } else {
    const open = await db.all<{ accountId: string; d: number; c: number }>(sql`
      select account_id accountId, sum(debit) d, sum(credit) c from fin_journal_lines where date < ${`${first}-01`} group by account_id`);
    const moves = await db.all<{ accountId: string; p: string; d: number; c: number }>(sql`
      select account_id accountId, substr(date,1,7) p, sum(debit) d, sum(credit) c from fin_journal_lines
       where date >= ${`${first}-01`} and date <= ${monthEnd(last)} group by account_id, p`);
    const run = new Map<string, number>();
    for (const r of open) { const a = byId.get(r.accountId); if (a && !PL_GROUPS.includes(a.group)) run.set(a.id, normalBalance(a.group, Number(r.d), Number(r.c))); }
    const mv = new Map<string, number>();
    for (const r of moves) { const a = byId.get(r.accountId); if (a && !PL_GROUPS.includes(a.group)) mv.set(`${a.id}|${r.p}`, normalBalance(a.group, Number(r.d), Number(r.c))); }
    for (const a of accounts.filter((x) => !PL_GROUPS.includes(x.group))) {
      let bal = run.get(a.id) ?? 0;
      for (const p of periods) { bal += mv.get(`${a.id}|${p}`) ?? 0; if (bal) put(a.id, p, bal); }
    }
  }
  return out;
}

export type BvaRow = { account: Account; budget: number; actual: number };
export type BvaSection = { key: string; label: string; rows: BvaRow[]; budget: number; actual: number };

const SECTION_LABEL: Record<string, string> = { pendapatan: "Pendapatan", hpp: "Beban atas Pendapatan", beban: "Beban Operasional", lain: "Pendapatan & Beban Lain", aset: "Aset", kewajiban: "Kewajiban", modal: "Ekuitas" };

/** Anggaran vs realisasi: LR dijumlah sepanjang rentang; neraca memakai bulan terakhir rentang. */
export async function budgetVsActual(db: DB, accounts: Account[], kind: BudgetKind, periods: string[]) {
  const [b, act] = await Promise.all([loadBudgets(db, periods[0], periods[periods.length - 1]), actualByMonth(db, accounts, kind, periods)]);
  const groups = kind === "lr" ? PL_GROUPS : BS_GROUPS;
  const last = periods[periods.length - 1];
  const rows: BvaRow[] = accounts
    .filter((a) => groups.includes(a.group))
    .map((a) => {
      const bm = b.get(a.id), am = act.get(a.id);
      const budget = kind === "lr" ? periods.reduce((s, p) => s + (bm?.get(p) ?? 0), 0) : bm?.get(last) ?? 0;
      const actual = kind === "lr" ? periods.reduce((s, p) => s + (am?.get(p) ?? 0), 0) : am?.get(last) ?? 0;
      return { account: a, budget, actual };
    })
    .filter((r) => r.budget || r.actual)
    .sort((x, y) => x.account.code.localeCompare(y.account.code));
  const sections = new Map<string, BvaSection>();
  for (const r of rows) {
    const sec = sectionOf(r.account.group);
    const key = kind === "lr" ? (r.account.group === "pendapatan_lain" || r.account.group === "beban_lain" ? "lain" : sec) : sec;
    const s = sections.get(key) ?? { key, label: SECTION_LABEL[key] ?? key, rows: [], budget: 0, actual: 0 };
    // Bagian "lain" dijumlah sebagai pendapatan bersih (pendapatan lain − beban lain).
    const sign = key === "lain" && r.account.group === "beban_lain" ? -1 : 1;
    s.rows.push(r); s.budget += sign * r.budget; s.actual += sign * r.actual;
    sections.set(key, s);
  }
  const order = kind === "lr" ? ["pendapatan", "hpp", "beban", "lain"] : ["aset", "kewajiban", "modal"];
  const list = order.map((k) => sections.get(k)).filter(Boolean) as BvaSection[];
  const get = (k: string) => sections.get(k) ?? { budget: 0, actual: 0 };
  const net = kind === "lr"
    ? { budget: get("pendapatan").budget - get("hpp").budget - get("beban").budget + get("lain").budget, actual: get("pendapatan").actual - get("hpp").actual - get("beban").actual + get("lain").actual }
    : null;
  return { sections: list, net };
}
