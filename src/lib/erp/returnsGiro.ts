import "server-only";
// Data untuk halaman Uang Muka, Retur, dan Giro.
import { sql } from "drizzle-orm";
import type { DB } from "./server";

/** Saldo uang muka per kontak (penjualan: kredit akun uang muka pelanggan; pembelian: debit akun uang muka pembelian). */
export async function depositBalances(db: DB, kind: "penjualan" | "pembelian", accountId: string) {
  const sign = kind === "penjualan" ? sql`l.credit - l.debit` : sql`l.debit - l.credit`;
  const rows = await db.all<{ contactId: string | null; name: string | null; masuk: number; pakai: number; saldo: number; last: string }>(sql`
    select l.contact_id contactId, c.name,
           sum(case when (${sign}) > 0 then (${sign}) else 0 end) masuk,
           sum(case when (${sign}) < 0 then -(${sign}) else 0 end) pakai,
           sum(${sign}) saldo, max(l.date) last
      from fin_journal_lines l left join fin_contacts c on c.id = l.contact_id
     where l.account_id = ${accountId}
     group by l.contact_id order by saldo desc`);
  return rows.map((r) => ({ ...r, masuk: Number(r.masuk), pakai: Number(r.pakai), saldo: Number(r.saldo) }));
}

/** Mutasi akun uang muka terbaru (penerimaan, pemakaian, pengembalian, retur). */
export async function depositMoves(db: DB, accountId: string, kind: "penjualan" | "pembelian", limit = 200) {
  const sign = kind === "penjualan" ? sql`l.credit - l.debit` : sql`l.debit - l.credit`;
  const rows = await db.all<{ journalId: string; number: string; date: string; source: string; sourceId: string | null; name: string | null; memo: string; amount: number }>(sql`
    select j.id journalId, j.number, l.date, j.source, j.source_id sourceId, c.name, coalesce(nullif(l.memo,''), j.memo) memo, (${sign}) amount
      from fin_journal_lines l join fin_journals j on j.id = l.journal_id left join fin_contacts c on c.id = l.contact_id
     where l.account_id = ${accountId} order by l.date desc, j.created_at desc limit ${limit}`);
  return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
}

export async function listReturns(db: DB, kind: "penjualan" | "pembelian", from: string, to: string) {
  return db.all<{ id: string; number: string; date: string; contactName: string; docNumber: string | null; settlement: string; total: number }>(sql`
    select r.id, r.number, r.date, c.name contactName, coalesce(i.number, b.number) docNumber, r.settlement, r.total
      from fin_returns r join fin_contacts c on c.id = r.contact_id left join fin_invoices i on i.id = r.invoice_id left join fin_bills b on b.id = r.bill_id
     where r.kind = ${kind} and r.date >= ${from} and r.date <= ${to} order by r.date desc, r.number desc`);
}

export async function listGiros(db: DB, kind: "masuk" | "keluar", status?: string) {
  const st = status ?? null;
  return db.all<{ id: string; giroNo: string; bank: string; contactName: string; amount: number; issueDate: string; dueDate: string; status: string; clearedDate: string | null; docNumber: string | null }>(sql`
    select g.id, g.giro_no giroNo, g.bank, c.name contactName, g.amount, g.issue_date issueDate, g.due_date dueDate, g.status, g.cleared_date clearedDate,
           coalesce(r.number, p.number) docNumber
      from fin_giros g join fin_contacts c on c.id = g.contact_id left join fin_receipts r on r.id = g.doc_id left join fin_payments p on p.id = g.doc_id
     where g.kind = ${kind} and (${st} is null or g.status = ${st})
     order by case g.status when 'beredar' then 0 else 1 end, g.due_date`);
}

export const SETTLEMENT_LABEL: Record<string, string> = { potong_tagihan: "Potong tagihan faktur", uang_muka: "Jadi uang muka / deposit", tunai: "Dikembalikan tunai/transfer" };
export const GIRO_STATUS_LABEL: Record<string, string> = { beredar: "Belum cair", cair: "Cair", tolak: "Ditolak/batal" };
