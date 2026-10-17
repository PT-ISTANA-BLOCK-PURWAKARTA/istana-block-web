"use server";

import { redirect } from "next/navigation";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { FormState } from "@/components/admin/FormMessage";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { docTotals, lineAmount } from "@/lib/erp/docs";
import {
  assertOpen,
  chunk,
  deleteJournalOps,
  depositBalance,
  getFinSettings,
  guard,
  insertMany,
  inventoryAccount,
  isStockItem,
  journalOps,
  loadAccounts,
  nextNumber,
  parseRows,
  requireDate,
  runBatch,
  UserError,
  type DB,
  type JLine,
} from "@/lib/erp/server";
import { addDays, parseQty, parseRupiah } from "@/lib/erp/util";

async function supplier(db: DB, id: string) {
  const c = id ? await db.query.contacts.findFirst({ where: eq(schema.contacts.id, id) }) : undefined;
  if (!c || c.kind === "pelanggan") throw new UserError("Pilih pemasok.");
  return c;
}

/* ============================================================ Faktur pembelian */

export async function saveBill(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireModule("keuangan");
  const res = await guard(async () => {
    const db = await getDb();
    const id = String(form.get("id") ?? "");
    const existing = id ? await db.query.bills.findFirst({ where: eq(schema.bills.id, id) }) : undefined;
    if (id && !existing) throw new UserError("Faktur pembelian tidak ditemukan.");
    const fin = await getFinSettings(db);
    const date = requireDate(form.get("date"), "Tanggal");
    assertOpen(date, fin.lockDate, "Faktur pembelian");
    if (existing) assertOpen(existing.date, fin.lockDate, "Faktur pembelian");
    const contact = await supplier(db, String(form.get("contactId") ?? ""));
    if (existing && existing.paid > 0 && contact.id !== existing.contactId) throw new UserError("Faktur ini sudah dibayar sebagian/lunas, jadi pemasoknya tidak bisa diganti. Hapus pembayarannya dulu.");
    const dueDate = String(form.get("dueDate") ?? "") ? requireDate(form.get("dueDate"), "Jatuh tempo") : addDays(date, contact.termDays);
    if (dueDate < date) throw new UserError("Jatuh tempo tidak boleh sebelum tanggal faktur.");
    const acc = await loadAccounts(db);
    const itemMap = new Map((await db.select().from(schema.items)).map((i) => [i.id, i]));

    const lines = parseRows(form.get("lines")).map((r, sort) => {
      const [kind, refId] = String(r.ref ?? "").split(":");
      const qty = parseQty(r.qty);
      const price = parseRupiah(r.price);
      if (qty <= 0) throw new UserError(`Baris ${sort + 1}: qty harus lebih dari 0.`);
      if (price < 0) throw new UserError(`Baris ${sort + 1}: harga tidak boleh negatif.`);
      if (kind === "item") {
        const item = itemMap.get(refId);
        if (!item) throw new UserError(`Baris ${sort + 1}: barang tidak ditemukan.`);
        const stock = isStockItem(item);
        return {
          itemId: item.id,
          accountId: stock ? inventoryAccount(acc, item) : acc.sys("beban_lain"),
          stock,
          description: String(r.description ?? "").slice(0, 300) || item.name,
          qty,
          unit: String(r.unit ?? "").slice(0, 20) || item.unit,
          price,
          amount: lineAmount({ qty, price }),
          sort,
        };
      }
      const a = kind === "acc" ? acc.byId.get(refId) : undefined;
      if (!a) throw new UserError(`Baris ${sort + 1}: pilih barang atau akun biaya.`);
      if (a.group === "kas_bank") throw new UserError(`Baris ${sort + 1}: akun kas/bank tidak bisa dipakai sebagai biaya.`);
      return { itemId: null, accountId: a.id, stock: false, description: String(r.description ?? "").slice(0, 300) || a.name, qty, unit: String(r.unit ?? "").slice(0, 20), price, amount: lineAmount({ qty, price }), sort };
    });
    if (!lines.length) throw new UserError("Isi minimal satu baris.");

    const taxable = form.get("taxable") === "on";
    const taxRate = existing?.taxable ? existing.taxRate : fin.ppnRate;
    const t = docTotals(lines, { discount: parseRupiah(form.get("discount")), taxable, taxRate });
    if (existing && t.total < existing.paid) throw new UserError(`Total baru lebih kecil dari yang sudah dibayar (${existing.paid}).`);

    // Diskon dibagi proporsional ke tiap baris supaya nilai persediaan = harga bersih.
    let left = t.discount;
    const net = lines.map((l, i) => {
      const share = i === lines.length - 1 ? left : t.subtotal ? Math.round((t.discount * l.amount) / t.subtotal) : 0;
      left -= share;
      return l.amount - share;
    });

    const billId = existing?.id ?? crypto.randomUUID();
    const number = existing?.number ?? (await nextNumber(db, "PBL", date));
    const header = {
      number,
      supplierRef: String(form.get("supplierRef") ?? "").slice(0, 60),
      date,
      dueDate,
      contactId: contact.id,
      subtotal: t.subtotal,
      discount: t.discount,
      taxable,
      taxRate: taxable ? taxRate : 0,
      tax: t.tax,
      total: t.total,
      note: String(form.get("note") ?? "").slice(0, 2000),
      updatedAt: new Date(),
    };

    const debit = new Map<string, number>();
    lines.forEach((l, i) => debit.set(l.accountId, (debit.get(l.accountId) ?? 0) + net[i]));
    const jl: JLine[] = [
      ...[...debit].map(([accountId, amount]) => ({ accountId, debit: amount, contactId: contact.id })),
      { accountId: acc.sys("ppn_masukan"), debit: t.tax, contactId: contact.id },
      { accountId: acc.sys("hutang"), credit: t.total, contactId: contact.id, memo: contact.name },
    ];
    const moves = lines
      .map((l, i) => ({ l, v: net[i] }))
      .filter(({ l }) => l.stock && l.itemId)
      .map(({ l, v }) => ({ itemId: l.itemId as string, date, qty: l.qty, value: v, source: "pembelian" as const, sourceId: billId, note: `${number} ${contact.name}` }));

    await runBatch(db, [
      existing
        ? [
            db.update(schema.bills).set(header).where(eq(schema.bills.id, billId)),
            db.delete(schema.billLines).where(eq(schema.billLines.billId, billId)),
            db.delete(schema.stockMoves).where(and(eq(schema.stockMoves.source, "pembelian"), eq(schema.stockMoves.sourceId, billId))),
            ...deleteJournalOps(db, "pembelian", billId),
          ]
        : db.insert(schema.bills).values({ id: billId, ...header, createdBy: me.id }),
      ...insertMany(db, schema.billLines, lines.map(({ stock: _s, ...l }) => ({ ...l, billId }))),
      ...insertMany(db, schema.stockMoves, moves),
      ...journalOps(db, { number, date, memo: `Pembelian ${number} — ${contact.name}`, source: "pembelian", sourceId: billId, createdBy: me.id, lines: jl }),
    ]);
    return { id: billId, number };
  });
  if ("error" in res) return res;
  redirect(`/keuangan/pembelian/${res.id}?ok=${encodeURIComponent(res.number)}`);
}

export async function deleteBill(id: string): Promise<FormState> {
  await requireModule("keuangan");
  const res = await guard(async () => {
    const db = await getDb();
    const b = await db.query.bills.findFirst({ where: eq(schema.bills.id, id) });
    if (!b) return { ok: "" };
    const fin = await getFinSettings(db);
    assertOpen(b.date, fin.lockDate, "Faktur pembelian");
    const alloc = await db.select().from(schema.paymentAllocations).where(eq(schema.paymentAllocations.billId, id)).limit(1);
    if (alloc.length) throw new UserError("Faktur pembelian sudah dibayar. Hapus pembayarannya dulu.");
    await runBatch(db, [
      db.delete(schema.billLines).where(eq(schema.billLines.billId, id)),
      db.delete(schema.stockMoves).where(and(eq(schema.stockMoves.source, "pembelian"), eq(schema.stockMoves.sourceId, id))),
      ...deleteJournalOps(db, "pembelian", id),
      db.delete(schema.bills).where(eq(schema.bills.id, id)),
    ]);
    return { ok: "deleted" };
  });
  if ("error" in res) return res;
  redirect("/keuangan/pembelian?ok=dihapus");
}

/* ============================================================ Pembayaran ke pemasok */

function recalcBillPaid(db: DB, ids: string[]) {
  return chunk(Array.from(new Set(ids))).map((part) =>
    db
      .update(schema.bills)
      .set({ paid: sql`(select coalesce(sum(a.amount),0) from fin_payment_allocations a where a.bill_id = ${schema.bills.id})` })
      .where(inArray(schema.bills.id, part)),
  );
}

export async function savePayment(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireModule("keuangan");
  const res = await guard(async () => {
    const db = await getDb();
    const id = String(form.get("id") ?? "");
    const existing = id ? await db.query.payments.findFirst({ where: eq(schema.payments.id, id) }) : undefined;
    if (id && !existing) throw new UserError("Pembayaran tidak ditemukan.");
    const fin = await getFinSettings(db);
    const date = requireDate(form.get("date"));
    assertOpen(date, fin.lockDate, "Pembayaran");
    if (existing) assertOpen(existing.date, fin.lockDate, "Pembayaran");
    const contact = await supplier(db, existing?.contactId ?? String(form.get("contactId") ?? ""));
    const acc = await loadAccounts(db);
    const accountId = String(form.get("accountId") ?? "");
    const account = acc.byId.get(accountId);
    const deposit = acc.sys("uang_muka_pembelian");
    if (!account || (account.group !== "kas_bank" && account.id !== deposit)) throw new UserError("Pilih akun kas/bank pembayar.");
    const amount = parseRupiah(form.get("amount"));
    if (amount <= 0) throw new UserError("Jumlah dibayar harus lebih dari 0.");
    // Alokasi per faktur; baris dengan faktur sama digabung.
    const sum = new Map<string, number>();
    for (const r of parseRows(form.get("allocs"))) {
      const docId = String(r.docId ?? "");
      const amt = parseRupiah(r.amount);
      if (docId && amt > 0) sum.set(docId, (sum.get(docId) ?? 0) + amt);
    }
    const allocs = [...sum].map(([docId, amt]) => ({ docId, amount: amt }));
    const allocTotal = allocs.reduce((a, x) => a + x.amount, 0);
    if (allocTotal > amount) throw new UserError("Total alokasi melebihi jumlah dibayar.");

    const prev = existing ? await db.select().from(schema.paymentAllocations).where(eq(schema.paymentAllocations.paymentId, existing.id)) : [];
    const ids = allocs.map((a) => a.docId);
    const bills = ids.length ? await db.select().from(schema.bills).where(inArray(schema.bills.id, ids)) : [];
    for (const a of allocs) {
      const b = bills.find((x) => x.id === a.docId);
      if (!b || b.contactId !== contact.id) throw new UserError("Faktur yang dipilih bukan milik pemasok ini.");
      const own = prev.filter((p) => p.billId === b.id).reduce((s, p) => s + p.amount, 0);
      const left = b.total - b.paid + own;
      if (a.amount > left) throw new UserError(`Alokasi ke ${b.number} (${a.amount}) melebihi sisa hutang (${left}).`);
    }
    if (accountId === deposit && allocTotal !== amount) throw new UserError("Pemakaian uang muka harus seluruhnya dialokasikan ke faktur.");
    // Saldo uang muka ke pemasok sesudah transaksi ini tidak boleh minus.
    const others = await depositBalance(db, deposit, contact.id, "debit", existing?.id);
    const after = others + (amount - allocTotal) - (accountId === deposit ? amount : 0);
    if (after < 0) {
      throw new UserError(
        accountId === deposit
          ? `Saldo uang muka ke pemasok ini hanya ${others}.`
          : `Uang muka dari pembayaran ini sudah dipakai untuk faktur lain (kurang ${-after}). Ubah/hapus pemakaiannya dulu.`,
      );
    }

    const paymentId = existing?.id ?? crypto.randomUUID();
    const number = existing?.number ?? (await nextNumber(db, "BYR", date));
    const header = { number, date, contactId: contact.id, accountId, amount, memo: String(form.get("memo") ?? "").slice(0, 500), updatedAt: new Date() };
    const affected = Array.from(new Set([...prev.map((p) => p.billId), ...ids]));
    const jl: JLine[] = [
      { accountId: acc.sys("hutang"), debit: allocTotal, contactId: contact.id },
      { accountId: deposit, debit: amount - allocTotal, contactId: contact.id, memo: amount > allocTotal ? "Uang muka ke pemasok" : "" },
      { accountId, credit: amount, contactId: contact.id },
    ];
    await runBatch(db, [
      existing
        ? [db.update(schema.payments).set(header).where(eq(schema.payments.id, paymentId)), db.delete(schema.paymentAllocations).where(eq(schema.paymentAllocations.paymentId, paymentId)), ...deleteJournalOps(db, "pembayaran", paymentId)]
        : db.insert(schema.payments).values({ id: paymentId, ...header, createdBy: me.id }),
      ...insertMany(db, schema.paymentAllocations, allocs.map((a) => ({ paymentId, billId: a.docId, amount: a.amount }))),
      ...journalOps(db, { number, date, memo: `Pembayaran ${number} — ${contact.name}`, source: "pembayaran", sourceId: paymentId, createdBy: me.id, lines: jl }),
      ...recalcBillPaid(db, affected),
    ]);
    return { id: paymentId, number };
  });
  if ("error" in res) return res;
  redirect(`/keuangan/pembayaran/${res.id}?ok=${encodeURIComponent(res.number)}`);
}

export async function deletePayment(id: string): Promise<FormState> {
  await requireModule("keuangan");
  const res = await guard(async () => {
    const db = await getDb();
    const p = await db.query.payments.findFirst({ where: eq(schema.payments.id, id) });
    if (!p) return { ok: "" };
    const fin = await getFinSettings(db);
    assertOpen(p.date, fin.lockDate, "Pembayaran");
    const acc = await loadAccounts(db);
    const allocs = await db.select().from(schema.paymentAllocations).where(eq(schema.paymentAllocations.paymentId, id));
    const allocTotal = allocs.reduce((a, x) => a + x.amount, 0);
    if (p.amount > allocTotal && p.accountId !== acc.sys("uang_muka_pembelian")) {
      const bal = await depositBalance(db, acc.sys("uang_muka_pembelian"), p.contactId, "debit", p.id);
      if (bal < 0) throw new UserError("Uang muka dari pembayaran ini sudah dipakai. Hapus pemakaiannya dulu.");
    }
    await runBatch(db, [
      db.delete(schema.paymentAllocations).where(eq(schema.paymentAllocations.paymentId, id)),
      ...deleteJournalOps(db, "pembayaran", id),
      db.delete(schema.payments).where(eq(schema.payments.id, id)),
      ...recalcBillPaid(db, allocs.map((a) => a.billId)),
    ]);
    return { ok: "deleted" };
  });
  if ("error" in res) return res;
  redirect("/keuangan/pembayaran?ok=dihapus");
}
