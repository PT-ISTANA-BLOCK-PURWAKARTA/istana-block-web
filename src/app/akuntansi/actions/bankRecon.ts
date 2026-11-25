"use server";

// Rekonsiliasi bank: impor mutasi rekening koran, cocokkan dengan buku (otomatis / manual),
// catat biaya admin / bunga / transaksi yang belum dibukukan langsung dari baris bank, dan simpan hasil rekonsiliasi.
import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { fingerprints, type StatementLine } from "@/lib/erp/bankStatement";
import { bookBalance, proposeMatches } from "@/lib/erp/bankRecon";
import { assertOpen, getFinSettings, guard, journalOps, loadAccounts, nextNumber, runBatch, UserError, type JLine } from "@/lib/erp/server";
import { isDate } from "@/lib/erp/util";

const BASE = "/akuntansi/kas/rekonsiliasi";
type Res = { ok?: string; error?: string };

async function bankAccount(accountId: string) {
  const db = await getDb();
  const acc = await loadAccounts(db);
  const a = acc.byId.get(accountId);
  if (!a || a.group !== "kas_bank") throw new UserError("Pilih rekening kas/bank.");
  return { db, acc, a };
}

/** Simpan baris mutasi dari file (baris yang sudah pernah diimpor dilewati), lalu cocokkan otomatis. */
export async function importBankLines(accountId: string, lines: StatementLine[]): Promise<Res> {
  const me = await requireModule("keuangan");
  const res = await guard(async () => {
    const { db } = await bankAccount(accountId);
    const clean = lines.filter((l) => isDate(l.date) && Number.isFinite(l.amount) && l.amount !== 0).slice(0, 5000);
    if (!clean.length) throw new UserError("Tidak ada baris mutasi yang bisa dibaca.");
    const fps = fingerprints(clean);
    const importId = crypto.randomUUID();
    const before = await db.get<{ n: number }>(sql`select count(*) n from fin_bank_lines where account_id = ${accountId}`);
    for (let i = 0; i < clean.length; i += 40) {
      const part = clean.slice(i, i + 40).map((l, j) => ({
        accountId, date: l.date, description: l.description.slice(0, 500), amount: Math.round(l.amount), balance: l.balance == null ? null : Math.round(l.balance),
        fingerprint: fps[i + j], importId, createdBy: me.id,
      }));
      await db.insert(schema.bankLines).values(part).onConflictDoNothing();
    }
    const after = await db.get<{ n: number }>(sql`select count(*) n from fin_bank_lines where account_id = ${accountId}`);
    const added = Number(after?.n ?? 0) - Number(before?.n ?? 0);
    const from = clean.reduce((m, l) => (l.date < m ? l.date : m), clean[0].date);
    const to = clean.reduce((m, l) => (l.date > m ? l.date : m), clean[0].date);
    const matched = await applyMatches(db, accountId, from, to, me.id);
    return { ok: `${added} baris mutasi baru diimpor (${clean.length - added} sudah ada sebelumnya); ${matched} cocok otomatis.` };
  });
  revalidatePath(BASE);
  return res;
}

async function applyMatches(db: Awaited<ReturnType<typeof getDb>>, accountId: string, from: string, to: string, by: number) {
  const pairs = await proposeMatches(db, accountId, from, to);
  for (const [bankId, lineId] of pairs) {
    await db.update(schema.bankLines).set({ matchedLineId: lineId, matchedAt: new Date(), matchedBy: by }).where(and(eq(schema.bankLines.id, bankId), isNull(schema.bankLines.matchedLineId)));
  }
  return pairs.length;
}

export async function autoMatch(accountId: string, from: string, to: string): Promise<Res> {
  const me = await requireModule("keuangan");
  const res = await guard(async () => {
    const { db } = await bankAccount(accountId);
    if (!isDate(from) || !isDate(to)) throw new UserError("Periode tidak valid.");
    const n = await applyMatches(db, accountId, from, to, me.id);
    return { ok: n ? `${n} pasangan cocok otomatis.` : "Tidak ada pasangan baru yang cocok (jumlah sama, tanggal selisih ≤ 3 hari)." };
  });
  revalidatePath(BASE);
  return res;
}

/** Cocokkan manual satu baris bank dengan satu atau beberapa baris buku (jumlahnya harus sama). */
export async function matchManual(bankLineId: string, journalLineIds: string[]): Promise<Res> {
  const me = await requireModule("keuangan");
  const res = await guard(async () => {
    const db = await getDb();
    const b = await db.query.bankLines.findFirst({ where: eq(schema.bankLines.id, bankLineId) });
    if (!b) throw new UserError("Baris mutasi tidak ditemukan.");
    if (b.matchedLineId) throw new UserError("Baris mutasi ini sudah cocok. Lepas dulu bila ingin mengganti.");
    if (journalLineIds.length !== 1) throw new UserError("Pilih tepat satu baris buku untuk dipasangkan.");
    const [line] = await db.select().from(schema.journalLines).where(inArray(schema.journalLines.id, journalLineIds));
    if (!line || line.accountId !== b.accountId) throw new UserError("Baris buku harus dari rekening yang sama.");
    const amt = line.debit - line.credit;
    if (amt !== b.amount) throw new UserError(`Jumlah berbeda: bank ${b.amount.toLocaleString("id-ID")}, buku ${amt.toLocaleString("id-ID")}.`);
    const taken = await db.query.bankLines.findFirst({ where: eq(schema.bankLines.matchedLineId, line.id) });
    if (taken) throw new UserError("Baris buku ini sudah dipasangkan dengan mutasi lain.");
    await db.update(schema.bankLines).set({ matchedLineId: line.id, matchedAt: new Date(), matchedBy: me.id }).where(eq(schema.bankLines.id, b.id));
    return { ok: "Dipasangkan." };
  });
  revalidatePath(BASE);
  return res;
}

export async function unmatch(bankLineId: string): Promise<Res> {
  await requireModule("keuangan");
  const res = await guard(async () => {
    const db = await getDb();
    await db.update(schema.bankLines).set({ matchedLineId: null, matchedAt: null, matchedBy: null }).where(eq(schema.bankLines.id, bankLineId));
    return { ok: "Pasangan dilepas." };
  });
  revalidatePath(BASE);
  return res;
}

export async function deleteBankLine(bankLineId: string): Promise<Res> {
  await requireModule("keuangan");
  const res = await guard(async () => {
    const db = await getDb();
    await db.delete(schema.bankLines).where(eq(schema.bankLines.id, bankLineId));
    return { ok: "Baris mutasi dihapus." };
  });
  revalidatePath(BASE);
  return res;
}

/**
 * Bukukan baris bank yang belum ada di buku (biaya admin, bunga, pajak bunga, transfer masuk tanpa faktur)
 * sebagai Kas Masuk/Kas Keluar ke rekening lawan, lalu langsung dipasangkan.
 */
export async function bookFromBank(bankLineId: string, counterAccountId: string, memo: string): Promise<Res> {
  const me = await requireModule("keuangan");
  const res = await guard(async () => {
    const db = await getDb();
    const b = await db.query.bankLines.findFirst({ where: eq(schema.bankLines.id, bankLineId) });
    if (!b) throw new UserError("Baris mutasi tidak ditemukan.");
    if (b.matchedLineId) throw new UserError("Baris ini sudah cocok dengan buku.");
    const acc = await loadAccounts(db);
    const bank = acc.byId.get(b.accountId);
    const counter = acc.byId.get(counterAccountId);
    if (!bank || bank.group !== "kas_bank") throw new UserError("Rekening bank tidak dikenal.");
    if (!counter || counter.id === bank.id) throw new UserError("Pilih rekening lawan (mis. Beban Admin & Jasa Bank).");
    const fin = await getFinSettings(db);
    assertOpen(b.date, fin.lockDate, "Transaksi kas");
    const kind = b.amount > 0 ? "masuk" : "keluar";
    const amount = Math.abs(b.amount);
    const text = (memo.trim() || b.description).slice(0, 500);
    const cashId = crypto.randomUUID();
    const number = await nextNumber(db, kind === "masuk" ? "KM" : "KK", b.date);
    const jl: JLine[] = kind === "masuk"
      ? [{ accountId: bank.id, debit: amount, memo: text }, { accountId: counter.id, credit: amount, memo: text }]
      : [{ accountId: counter.id, debit: amount, memo: text }, { accountId: bank.id, credit: amount, memo: text }];
    await runBatch(db, [
      db.insert(schema.cashTxns).values({ id: cashId, number, date: b.date, kind, accountId: bank.id, toAccountId: null, contactId: null, amount, memo: text, createdBy: me.id }),
      db.insert(schema.cashLines).values({ cashId, accountId: counter.id, amount, memo: text, sort: 0 }),
      ...journalOps(db, { number, date: b.date, memo: text, source: "kas", sourceId: cashId, createdBy: me.id, lines: jl }),
    ]);
    const line = await db.get<{ id: string }>(sql`
      select l.id from fin_journal_lines l join fin_journals j on j.id = l.journal_id
       where j.source = 'kas' and j.source_id = ${cashId} and l.account_id = ${bank.id} limit 1`);
    if (line) await db.update(schema.bankLines).set({ matchedLineId: line.id, matchedAt: new Date(), matchedBy: me.id }).where(eq(schema.bankLines.id, b.id));
    return { ok: `${number} dibukukan dan dipasangkan.` };
  });
  revalidatePath(BASE);
  return res;
}

/** Simpan hasil rekonsiliasi per akhir periode (saldo menurut bank vs buku). */
export async function saveRecon(accountId: string, periodEnd: string, statementBalanceValue: number, note: string): Promise<Res> {
  const me = await requireModule("keuangan");
  const res = await guard(async () => {
    const { db } = await bankAccount(accountId);
    if (!isDate(periodEnd)) throw new UserError("Tanggal akhir periode tidak valid.");
    if (!Number.isFinite(statementBalanceValue)) throw new UserError("Isi saldo menurut rekening koran.");
    const book = await bookBalance(db, accountId, periodEnd);
    await db.insert(schema.bankRecons).values({ accountId, periodEnd, statementBalance: Math.round(statementBalanceValue), bookBalance: book, note: note.slice(0, 500), createdBy: me.id, createdByName: me.name })
      .onConflictDoUpdate({ target: [schema.bankRecons.accountId, schema.bankRecons.periodEnd], set: { statementBalance: Math.round(statementBalanceValue), bookBalance: book, note: note.slice(0, 500), createdBy: me.id, createdByName: me.name, createdAt: new Date() } });
    return { ok: `Rekonsiliasi per ${periodEnd} disimpan.` };
  });
  revalidatePath(BASE);
  return res;
}
