import "server-only";
// Laporan yang dihitung langsung dari jurnal (termasuk jurnal hasil impor Zahir):
// Arus Kas - Rincian, Jejak Audit, Penjualan per Pelanggan, Pembelian per Pemasok.
import { sql } from "drizzle-orm";
import type { DB } from "./server";

/* ---------------- Arus Kas - Rincian ---------------- */
export type CashDetailRow = { journalId: string; number: string; date: string; memo: string; source: string; sourceId: string | null; inflow: number; outflow: number; counter: string };

/** Setiap mutasi rekening kas/bank beserta akun lawannya, per rekening. */
export async function cashDetail(db: DB, from: string, to: string) {
  const rows = await db.all<CashDetailRow & { accountId: string; code: string; name: string }>(sql`
    select l.account_id accountId, a.code, a.name, j.id journalId, j.number, l.date, coalesce(nullif(l.memo,''), j.memo) memo, j.source, j.source_id sourceId,
           l.debit inflow, l.credit outflow,
           (select group_concat(x.code || ' ' || x.name, ' · ') from (select distinct a2.code, a2.name from fin_journal_lines l2 join fin_accounts a2 on a2.id = l2.account_id
              where l2.journal_id = j.id and a2.grp <> 'kas_bank' order by a2.code) x) counter
      from fin_journal_lines l join fin_journals j on j.id = l.journal_id join fin_accounts a on a.id = l.account_id
     where a.grp = 'kas_bank' and l.date >= ${from} and l.date <= ${to}
     order by a.code, l.date, j.number`);
  const opening = await db.all<{ accountId: string; b: number }>(sql`
    select l.account_id accountId, sum(l.debit) - sum(l.credit) b from fin_journal_lines l join fin_accounts a on a.id = l.account_id
     where a.grp = 'kas_bank' and l.date < ${from} group by l.account_id`);
  const open = new Map(opening.map((o) => [o.accountId, Number(o.b)]));
  const groups = new Map<string, { id: string; code: string; name: string; opening: number; rows: (CashDetailRow & { balance: number })[]; inflow: number; outflow: number; closing: number }>();
  for (const r of rows) {
    const g = groups.get(r.accountId) ?? { id: r.accountId, code: r.code, name: r.name, opening: open.get(r.accountId) ?? 0, rows: [], inflow: 0, outflow: 0, closing: open.get(r.accountId) ?? 0 };
    const inflow = Number(r.inflow), outflow = Number(r.outflow);
    g.inflow += inflow; g.outflow += outflow; g.closing += inflow - outflow;
    g.rows.push({ ...r, inflow, outflow, counter: r.counter ?? "", balance: g.closing });
    groups.set(r.accountId, g);
  }
  return [...groups.values()];
}

/* ---------------- Jejak Audit ---------------- */
export type AuditRow = { id: string; number: string; date: string; memo: string; source: string; sourceId: string | null; total: number; createdAt: number; updatedAt: number; userName: string | null };

export async function auditTrail(db: DB, fromTs: number, toTs: number, userId?: number) {
  const u = userId ?? null;
  const rows = await db.all<AuditRow>(sql`
    select j.id, j.number, j.date, j.memo, j.source, j.source_id sourceId, j.created_at createdAt, j.updated_at updatedAt, u.name userName,
           (select coalesce(sum(debit),0) from fin_journal_lines l where l.journal_id = j.id) total
      from fin_journals j left join users u on u.id = j.created_by
     where ((j.created_at >= ${fromTs} and j.created_at < ${toTs}) or (j.updated_at >= ${fromTs} and j.updated_at < ${toTs}))
       and (${u} is null or j.created_by = ${u})
     order by max(j.created_at, j.updated_at) desc limit 2000`);
  const summary = await db.all<{ userName: string | null; source: string; n: number; total: number; edited: number }>(sql`
    select u.name userName, j.source, count(*) n, sum((select coalesce(sum(debit),0) from fin_journal_lines l where l.journal_id = j.id)) total,
           sum(case when j.updated_at > j.created_at + 5 then 1 else 0 end) edited
      from fin_journals j left join users u on u.id = j.created_by
     where j.created_at >= ${fromTs} and j.created_at < ${toTs} and (${u} is null or j.created_by = ${u})
     group by u.name, j.source order by n desc`);
  const activity = await db.all<{ at: number; userName: string | null; action: string; label: string; summary: string | null; success: number }>(sql`
    select at, user_name userName, action, label, summary, success from ops_activity_logs
     where at >= ${fromTs} and at < ${toTs} and (action like 'keuangan.%' or action like 'gaji.%' or action like 'kasbon.%' or action like 'akuntansi.%')
       and (${u} is null or user_id = ${u})
     order by at desc limit 500`);
  return {
    rows: rows.map((r) => ({ ...r, total: Number(r.total), createdAt: Number(r.createdAt), updatedAt: Number(r.updatedAt) })),
    summary: summary.map((s) => ({ ...s, n: Number(s.n), total: Number(s.total), edited: Number(s.edited) })),
    activity: activity.map((a) => ({ ...a, at: Number(a.at) })),
  };
}

/* ---------------- Penjualan per Pelanggan / Pembelian per Pemasok ---------------- */
/**
 * Dari jurnal: faktur web memakai kontak faktur; jurnal impor Zahir memakai nama di keterangan
 * ("Penjualan, BPK. HARIS" / "Pembelian, PT. KSP BANDUNG"). Penjualan = kredit − debit akun pendapatan;
 * pembelian = debit akun persediaan/aset/beban (tanpa PPN masukan).
 */
export async function partyAnalysis(db: DB, kind: "penjualan" | "pembelian", from: string, to: string) {
  const rows =
    kind === "penjualan"
      ? await db.all<{ journalId: string; number: string; date: string; memo: string; source: string; sourceId: string | null; contact: string | null; amount: number }>(sql`
          select j.id journalId, j.number, j.date, j.memo, j.source, j.source_id sourceId,
                 (select c.name from fin_invoices i join fin_contacts c on c.id = i.contact_id where j.source = 'faktur' and i.id = j.source_id) contact,
                 sum(case when a.grp in ('pendapatan') then l.credit - l.debit else 0 end) amount
            from fin_journals j join fin_journal_lines l on l.journal_id = j.id join fin_accounts a on a.id = l.account_id
           where j.date >= ${from} and j.date <= ${to} and (j.source = 'faktur' or (j.source = 'zahir' and (j.number like 'SJ/%' or j.number like 'SR%' or j.number like 'SD%')))
           group by j.id having amount <> 0`)
      : await db.all<{ journalId: string; number: string; date: string; memo: string; source: string; sourceId: string | null; contact: string | null; amount: number }>(sql`
          select j.id journalId, j.number, j.date, j.memo, j.source, j.source_id sourceId,
                 (select c.name from fin_bills b join fin_contacts c on c.id = b.contact_id where j.source = 'pembelian' and b.id = j.source_id) contact,
                 sum(case when a.grp in ('persediaan', 'aset_lancar_lain', 'aset_tetap', 'hpp', 'beban', 'beban_lain') and a.code not like '152-%' then l.debit - l.credit else 0 end) amount
            from fin_journals j join fin_journal_lines l on l.journal_id = j.id join fin_accounts a on a.id = l.account_id
           where j.date >= ${from} and j.date <= ${to} and (j.source = 'pembelian' or (j.source = 'zahir' and j.number like 'PJ/%'))
           group by j.id having amount <> 0`);
  const nameOf = (r: { contact: string | null; memo: string }) => {
    if (r.contact) return r.contact;
    const m = r.memo.match(/^(?:Penjualan|Pembelian|Potongan Penjualan|Retur Penjualan)\s*,\s*(.+)$/i);
    return (m ? m[1] : r.memo).replace(/\s+/g, " ").trim().toUpperCase() || "(tanpa nama)";
  };
  const by = new Map<string, { name: string; count: number; amount: number; first: string; last: string; docs: { journalId: string; number: string; date: string; amount: number; source: string; sourceId: string | null }[] }>();
  for (const r of rows) {
    const name = nameOf(r);
    const e = by.get(name) ?? { name, count: 0, amount: 0, first: r.date, last: r.date, docs: [] };
    e.count++; e.amount += Number(r.amount);
    if (r.date < e.first) e.first = r.date;
    if (r.date > e.last) e.last = r.date;
    e.docs.push({ journalId: r.journalId, number: r.number, date: r.date, amount: Number(r.amount), source: r.source, sourceId: r.sourceId });
    by.set(name, e);
  }
  const list = [...by.values()].sort((a, b) => b.amount - a.amount);
  return { list, total: list.reduce((s, e) => s + e.amount, 0) };
}
