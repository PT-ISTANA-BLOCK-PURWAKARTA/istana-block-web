"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import type { FormState } from "@/components/admin/FormMessage";
import { getDb, schema } from "@/db";
import { cashKinds, type CashKind } from "@/db/erp";
import { requireModule } from "@/lib/auth";
import {
  assertOpen,
  deleteJournalOps,
  getFinSettings,
  guard,
  insertMany,
  journalOps,
  loadAccounts,
  nextNumber,
  parseRows,
  requireDate,
  runBatch,
  UserError,
  type JLine,
} from "@/lib/erp/server";
import { parseRupiah } from "@/lib/erp/util";

/* ============================================================ Kas & bank */

const CASH_PREFIX: Record<CashKind, string> = { masuk: "KM", keluar: "KK", transfer: "TRF" };

export async function saveCash(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireModule("keuangan");
  const res = await guard(async () => {
    const db = await getDb();
    const id = String(form.get("id") ?? "");
    const existing = id ? await db.query.cashTxns.findFirst({ where: eq(schema.cashTxns.id, id) }) : undefined;
    if (id && !existing) throw new UserError("Transaksi tidak ditemukan.");
    const kind = (existing?.kind ?? String(form.get("kind") ?? "")) as CashKind;
    if (!cashKinds.includes(kind)) throw new UserError("Jenis transaksi tidak valid.");
    const fin = await getFinSettings(db);
    const date = requireDate(form.get("date"));
    assertOpen(date, fin.lockDate, "Transaksi kas");
    if (existing) assertOpen(existing.date, fin.lockDate, "Transaksi kas");
    const acc = await loadAccounts(db);
    const cash = acc.byId.get(String(form.get("accountId") ?? ""));
    if (!cash || cash.group !== "kas_bank") throw new UserError("Pilih akun kas/bank.");
    const contactId = String(form.get("contactId") ?? "") || null;
    const memo = String(form.get("memo") ?? "").slice(0, 500);

    let lines: { accountId: string; amount: number; memo: string }[] = [];
    let toAccountId: string | null = null;
    let amount = 0;
    if (kind === "transfer") {
      const to = acc.byId.get(String(form.get("toAccountId") ?? ""));
      if (!to || to.group !== "kas_bank" || to.id === cash.id) throw new UserError("Pilih akun kas/bank tujuan yang berbeda.");
      toAccountId = to.id;
      amount = parseRupiah(form.get("amount"));
      if (amount <= 0) throw new UserError("Jumlah transfer harus lebih dari 0.");
    } else {
      lines = parseRows(form.get("lines"))
        .map((r) => ({ accountId: String(r.accountId ?? ""), amount: parseRupiah(r.amount), memo: String(r.memo ?? "").slice(0, 300) }))
        .filter((l) => l.accountId || l.amount);
      if (!lines.length) throw new UserError("Isi minimal satu rincian.");
      for (const [i, l] of lines.entries()) {
        const a = acc.byId.get(l.accountId);
        if (!a) throw new UserError(`Rincian ${i + 1}: pilih akun.`);
        if (a.id === cash.id) throw new UserError(`Rincian ${i + 1}: akun lawan tidak boleh sama dengan akun kas.`);
        if (l.amount <= 0) throw new UserError(`Rincian ${i + 1}: jumlah harus lebih dari 0.`);
      }
      amount = lines.reduce((a, l) => a + l.amount, 0);
    }

    const cashId = existing?.id ?? crypto.randomUUID();
    const number = existing?.number ?? (await nextNumber(db, CASH_PREFIX[kind], date));
    const header = { number, date, kind, accountId: cash.id, toAccountId, contactId, amount, memo, updatedAt: new Date() };
    const jl: JLine[] =
      kind === "transfer"
        ? [
            { accountId: toAccountId as string, debit: amount, memo },
            { accountId: cash.id, credit: amount, memo },
          ]
        : kind === "masuk"
          ? [{ accountId: cash.id, debit: amount, memo, contactId }, ...lines.map((l) => ({ accountId: l.accountId, credit: l.amount, memo: l.memo || memo, contactId }))]
          : [...lines.map((l) => ({ accountId: l.accountId, debit: l.amount, memo: l.memo || memo, contactId })), { accountId: cash.id, credit: amount, memo, contactId }];

    await runBatch(db, [
      existing
        ? [db.update(schema.cashTxns).set(header).where(eq(schema.cashTxns.id, cashId)), db.delete(schema.cashLines).where(eq(schema.cashLines.cashId, cashId)), ...deleteJournalOps(db, "kas", cashId)]
        : db.insert(schema.cashTxns).values({ id: cashId, ...header, createdBy: me.id }),
      ...insertMany(db, schema.cashLines, lines.map((l, sort) => ({ ...l, cashId, sort }))),
      ...journalOps(db, { number, date, memo: memo || `Kas ${kind} ${number}`, source: "kas", sourceId: cashId, createdBy: me.id, lines: jl }),
    ]);
    return { id: cashId, number };
  });
  if ("error" in res) return res;
  redirect(`/keuangan/kas/${res.id}?ok=${encodeURIComponent(res.number)}`);
}

export async function deleteCash(id: string): Promise<FormState> {
  await requireModule("keuangan");
  const res = await guard(async () => {
    const db = await getDb();
    const c = await db.query.cashTxns.findFirst({ where: eq(schema.cashTxns.id, id) });
    if (!c) return { ok: "" };
    const fin = await getFinSettings(db);
    assertOpen(c.date, fin.lockDate, "Transaksi kas");
    await runBatch(db, [db.delete(schema.cashLines).where(eq(schema.cashLines.cashId, id)), ...deleteJournalOps(db, "kas", id), db.delete(schema.cashTxns).where(eq(schema.cashTxns.id, id))]);
    return { ok: "deleted" };
  });
  if ("error" in res) return res;
  redirect("/keuangan/kas?ok=dihapus");
}

/* ============================================================ Jurnal umum (manual) */

export async function saveJournal(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireModule("keuangan");
  const res = await guard(async () => {
    const db = await getDb();
    const id = String(form.get("id") ?? "");
    const existing = id ? await db.query.journals.findFirst({ where: eq(schema.journals.id, id) }) : undefined;
    if (id && (!existing || existing.source !== "manual")) throw new UserError("Hanya jurnal umum yang bisa diubah di sini; jurnal otomatis diubah lewat dokumen asalnya.");
    const fin = await getFinSettings(db);
    const date = requireDate(form.get("date"));
    assertOpen(date, fin.lockDate, "Jurnal");
    if (existing) assertOpen(existing.date, fin.lockDate, "Jurnal");
    const acc = await loadAccounts(db);
    const memo = String(form.get("memo") ?? "").trim().slice(0, 500);
    if (!memo) throw new UserError("Isi keterangan jurnal.");
    const lines: JLine[] = parseRows(form.get("lines"))
      .map((r) => ({ accountId: String(r.accountId ?? ""), memo: String(r.memo ?? "").slice(0, 300), debit: parseRupiah(r.debit), credit: parseRupiah(r.credit) }))
      .filter((l) => l.accountId || l.debit || l.credit);
    if (lines.length < 2) throw new UserError("Jurnal minimal dua baris.");
    for (const [i, l] of lines.entries()) {
      if (!acc.byId.has(l.accountId)) throw new UserError(`Baris ${i + 1}: pilih akun.`);
      if ((l.debit ?? 0) < 0 || (l.credit ?? 0) < 0) throw new UserError(`Baris ${i + 1}: angka tidak boleh negatif.`);
      if ((l.debit ?? 0) > 0 && (l.credit ?? 0) > 0) throw new UserError(`Baris ${i + 1}: isi debit atau kredit saja, jangan keduanya.`);
    }
    const journalId = existing?.id ?? crypto.randomUUID();
    const number = existing?.number ?? (await nextNumber(db, "JU", date));
    await runBatch(db, [
      existing ? deleteJournalOps(db, "manual", journalId) : null,
      ...journalOps(db, { id: journalId, number, date, memo, source: "manual", sourceId: journalId, createdBy: me.id, lines }),
    ]);
    return { id: journalId, number };
  });
  if ("error" in res) return res;
  redirect(`/keuangan/jurnal/${res.id}?ok=${encodeURIComponent(res.number)}`);
}

export async function deleteJournal(id: string): Promise<FormState> {
  await requireModule("keuangan");
  const res = await guard(async () => {
    const db = await getDb();
    const j = await db.query.journals.findFirst({ where: eq(schema.journals.id, id) });
    if (!j) return { ok: "" };
    if (j.source !== "manual") throw new UserError("Jurnal otomatis hanya bisa dihapus lewat dokumen asalnya.");
    const fin = await getFinSettings(db);
    assertOpen(j.date, fin.lockDate, "Jurnal");
    await runBatch(db, deleteJournalOps(db, "manual", id));
    return { ok: "deleted" };
  });
  if ("error" in res) return res;
  redirect("/keuangan/jurnal?ok=dihapus");
}
