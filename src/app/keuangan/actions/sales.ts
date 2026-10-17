"use server";

import { redirect } from "next/navigation";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import type { FormState } from "@/components/admin/FormMessage";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { docTotals, lineAmount } from "@/lib/erp/docs";
import {
  assertOpen,
  deleteJournalOps,
  getFinSettings,
  guard,
  insertMany,
  depositBalance,
  journalOps,
  loadAccounts,
  nextNumber,
  parseRows,
  requireDate,
  revenueAccount,
  runBatch,
  UserError,
  type DB,
  type JLine,
} from "@/lib/erp/server";
import { addDays, parseQty, parseRupiah } from "@/lib/erp/util";

/* ============================================================ Faktur penjualan */

async function customer(db: DB, id: string) {
  const c = id ? await db.query.contacts.findFirst({ where: eq(schema.contacts.id, id) }) : undefined;
  if (!c || c.kind === "pemasok") throw new UserError("Pilih pelanggan.");
  return c;
}

export async function saveInvoice(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireModule("keuangan");
  const res = await guard(async () => {
    const db = await getDb();
    const id = String(form.get("id") ?? "");
    const existing = id ? await db.query.invoices.findFirst({ where: eq(schema.invoices.id, id) }) : undefined;
    if (id && !existing) throw new UserError("Faktur tidak ditemukan.");
    const fin = await getFinSettings(db);
    const date = requireDate(form.get("date"), "Tanggal faktur");
    assertOpen(date, fin.lockDate, "Faktur");
    if (existing) assertOpen(existing.date, fin.lockDate, "Faktur");
    const contact = await customer(db, String(form.get("contactId") ?? ""));
    const dueDate = String(form.get("dueDate") ?? "") ? requireDate(form.get("dueDate"), "Jatuh tempo") : addDays(date, contact.termDays || fin.termDays);
    if (dueDate < date) throw new UserError("Jatuh tempo tidak boleh sebelum tanggal faktur.");
    const orderId = String(form.get("orderId") ?? "") || existing?.orderId || null;

    const acc = await loadAccounts(db);
    const itemRows = await db.select().from(schema.items);
    const itemMap = new Map(itemRows.map((i) => [i.id, i]));

    const raw = parseRows(form.get("lines"));
    const lines = raw
      .map((r, sort) => {
        const ref = String(r.ref ?? "");
        const [kind, refId] = ref.split(":");
        const item = kind === "item" ? itemMap.get(refId) : undefined;
        if (!item) throw new UserError(`Baris ${sort + 1}: pilih barang/jasa.`);
        const qty = parseQty(r.qty);
        const price = parseRupiah(r.price);
        if (qty <= 0) throw new UserError(`Baris ${sort + 1}: qty harus lebih dari 0.`);
        if (price < 0) throw new UserError(`Baris ${sort + 1}: harga tidak boleh negatif.`);
        return {
          itemId: item.id,
          orderLineId: r.orderLineId ? String(r.orderLineId) : null,
          accountId: revenueAccount(acc, item),
          description: String(r.description ?? "").slice(0, 300) || item.name,
          qty,
          unit: String(r.unit ?? "").slice(0, 20) || item.unit,
          price,
          amount: lineAmount({ qty, price }),
          sort,
        };
      });
    if (!lines.length) throw new UserError("Isi minimal satu baris barang.");

    // Cegah faktur ganda atas baris pesanan yang sama.
    const olIds = lines.map((l) => l.orderLineId).filter((x): x is string => !!x);
    if (olIds.length) {
      const ordered = await db.select().from(schema.orderLines).where(inArray(schema.orderLines.id, olIds));
      const invoiced = await db
        .select({ orderLineId: schema.invoiceLines.orderLineId, qty: sql<number>`sum(${schema.invoiceLines.qty})` })
        .from(schema.invoiceLines)
        .innerJoin(schema.invoices, eq(schema.invoices.id, schema.invoiceLines.invoiceId))
        .where(and(inArray(schema.invoiceLines.orderLineId, olIds), id ? ne(schema.invoices.id, id) : undefined))
        .groupBy(schema.invoiceLines.orderLineId);
      const inv = new Map(invoiced.map((r) => [r.orderLineId, Number(r.qty)]));
      for (const l of lines) {
        if (!l.orderLineId) continue;
        const ol = ordered.find((o) => o.id === l.orderLineId);
        if (!ol) continue;
        const left = ol.qty - (inv.get(l.orderLineId) ?? 0);
        if (l.qty > left + 1e-9) throw new UserError(`"${l.description}": qty ${l.qty} melebihi sisa pesanan yang belum difaktur (${Math.max(0, left)}).`);
      }
    }

    const taxable = form.get("taxable") === "on";
    const taxRate = existing?.taxable ? existing.taxRate : fin.ppnRate;
    const t = docTotals(lines, { discount: parseRupiah(form.get("discount")), ongkir: parseRupiah(form.get("ongkir")), taxable, taxRate });
    if (existing && t.total < existing.paid) throw new UserError(`Total baru (${t.total}) lebih kecil dari yang sudah dibayar (${existing.paid}). Hapus/ubah penerimaannya dulu.`);

    const invoiceId = existing?.id ?? crypto.randomUUID();
    const number = existing?.number ?? (await nextNumber(db, "INV", date));
    const header = {
      number,
      date,
      dueDate,
      contactId: contact.id,
      orderId,
      subtotal: t.subtotal,
      discount: t.discount,
      ongkir: t.ongkir,
      taxable,
      taxRate: taxable ? taxRate : 0,
      tax: t.tax,
      total: t.total,
      note: String(form.get("note") ?? "").slice(0, 2000),
      updatedAt: new Date(),
    };

    // Jurnal: Dr Piutang; Dr Potongan; Cr Penjualan (per akun); Cr Ongkir; Cr PPN Keluaran.
    const revenue = new Map<string, number>();
    for (const l of lines) revenue.set(l.accountId, (revenue.get(l.accountId) ?? 0) + l.amount);
    const jl: JLine[] = [
      { accountId: acc.sys("piutang"), debit: t.total, contactId: contact.id, memo: contact.name },
      { accountId: acc.sys("potongan_penjualan"), debit: t.discount, contactId: contact.id },
      ...[...revenue].map(([accountId, amount]) => ({ accountId, credit: amount, contactId: contact.id })),
      { accountId: acc.sys("pendapatan_ongkir"), credit: t.ongkir, contactId: contact.id },
      { accountId: acc.sys("ppn_keluaran"), credit: t.tax, contactId: contact.id },
    ];

    await runBatch(db, [
      existing
        ? [db.update(schema.invoices).set(header).where(eq(schema.invoices.id, invoiceId)), db.delete(schema.invoiceLines).where(eq(schema.invoiceLines.invoiceId, invoiceId)), ...deleteJournalOps(db, "faktur", invoiceId)]
        : db.insert(schema.invoices).values({ id: invoiceId, ...header, createdBy: me.id }),
      ...insertMany(db, schema.invoiceLines, lines.map((l) => ({ ...l, invoiceId }))),
      ...journalOps(db, { number, date, memo: `Faktur ${number} — ${contact.name}`, source: "faktur", sourceId: invoiceId, createdBy: me.id, lines: jl }),
    ]);
    return { id: invoiceId, number };
  });
  if ("error" in res) return res;
  redirect(`/keuangan/penjualan/${res.id}?ok=${encodeURIComponent(res.number)}`);
}

export async function deleteInvoice(id: string): Promise<FormState> {
  await requireModule("keuangan");
  const res = await guard(async () => {
    const db = await getDb();
    const inv = await db.query.invoices.findFirst({ where: eq(schema.invoices.id, id) });
    if (!inv) return { ok: "" };
    const fin = await getFinSettings(db);
    assertOpen(inv.date, fin.lockDate, "Faktur");
    const alloc = await db.select().from(schema.receiptAllocations).where(eq(schema.receiptAllocations.invoiceId, id)).limit(1);
    if (alloc.length) throw new UserError("Faktur sudah punya penerimaan. Hapus penerimaannya dulu.");
    await runBatch(db, [db.delete(schema.invoiceLines).where(eq(schema.invoiceLines.invoiceId, id)), ...deleteJournalOps(db, "faktur", id), db.delete(schema.invoices).where(eq(schema.invoices.id, id))]);
    return { ok: "deleted" };
  });
  if ("error" in res) return res;
  redirect("/keuangan/penjualan?ok=dihapus");
}

/* ============================================================ Penerimaan (pembayaran pelanggan) */

type Alloc = { docId: string; amount: number };

function parseAllocs(form: FormData): Alloc[] {
  return parseRows(form.get("allocs"))
    .map((r) => ({ docId: String(r.docId ?? ""), amount: parseRupiah(r.amount) }))
    .filter((a) => a.docId && a.amount > 0);
}

export async function saveReceipt(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireModule("keuangan");
  const res = await guard(async () => {
    const db = await getDb();
    const id = String(form.get("id") ?? "");
    const existing = id ? await db.query.receipts.findFirst({ where: eq(schema.receipts.id, id) }) : undefined;
    if (id && !existing) throw new UserError("Penerimaan tidak ditemukan.");
    const fin = await getFinSettings(db);
    const date = requireDate(form.get("date"));
    assertOpen(date, fin.lockDate, "Penerimaan");
    if (existing) assertOpen(existing.date, fin.lockDate, "Penerimaan");
    const contact = await customer(db, String(form.get("contactId") ?? existing?.contactId ?? ""));
    const acc = await loadAccounts(db);
    const accountId = String(form.get("accountId") ?? "");
    const account = acc.byId.get(accountId);
    const deposit = acc.sys("uang_muka_pelanggan");
    if (!account || (account.group !== "kas_bank" && account.id !== deposit)) throw new UserError("Pilih akun kas/bank penerima.");
    const amount = parseRupiah(form.get("amount"));
    if (amount <= 0) throw new UserError("Jumlah diterima harus lebih dari 0.");
    const allocs = parseAllocs(form);
    const allocTotal = allocs.reduce((a, x) => a + x.amount, 0);
    if (allocTotal > amount) throw new UserError("Total alokasi ke faktur melebihi jumlah diterima.");

    // Validasi sisa tagihan per faktur.
    const prev = existing ? await db.select().from(schema.receiptAllocations).where(eq(schema.receiptAllocations.receiptId, existing.id)) : [];
    const invIds = allocs.map((a) => a.docId);
    const invs = invIds.length ? await db.select().from(schema.invoices).where(inArray(schema.invoices.id, invIds)) : [];
    for (const a of allocs) {
      const inv = invs.find((i) => i.id === a.docId);
      if (!inv || inv.contactId !== contact.id) throw new UserError("Faktur yang dipilih bukan milik pelanggan ini.");
      const own = prev.filter((p) => p.invoiceId === inv.id).reduce((s, p) => s + p.amount, 0);
      const left = inv.total - inv.paid + own;
      if (a.amount > left) throw new UserError(`Alokasi ke ${inv.number} (${a.amount}) melebihi sisa tagihan (${left}).`);
    }
    if (accountId === deposit) {
      if (allocTotal !== amount) throw new UserError("Pemakaian uang muka harus seluruhnya dialokasikan ke faktur.");
      const bal = await depositBalance(db, deposit, contact.id, "credit", existing?.id);
      if (amount > bal) throw new UserError(`Saldo uang muka pelanggan hanya ${bal}.`);
    }

    const receiptId = existing?.id ?? crypto.randomUUID();
    const number = existing?.number ?? (await nextNumber(db, "TRM", date));
    const header = { number, date, contactId: contact.id, accountId, amount, memo: String(form.get("memo") ?? "").slice(0, 500), updatedAt: new Date() };
    const affected = Array.from(new Set([...prev.map((p) => p.invoiceId), ...invIds]));

    const jl: JLine[] = [
      { accountId, debit: amount, contactId: contact.id },
      { accountId: acc.sys("piutang"), credit: allocTotal, contactId: contact.id },
      { accountId: deposit, credit: amount - allocTotal, contactId: contact.id, memo: amount > allocTotal ? "Uang muka / titipan pelanggan" : "" },
    ];
    await runBatch(db, [
      existing
        ? [db.update(schema.receipts).set(header).where(eq(schema.receipts.id, receiptId)), db.delete(schema.receiptAllocations).where(eq(schema.receiptAllocations.receiptId, receiptId)), ...deleteJournalOps(db, "penerimaan", receiptId)]
        : db.insert(schema.receipts).values({ id: receiptId, ...header, createdBy: me.id }),
      ...insertMany(db, schema.receiptAllocations, allocs.map((a) => ({ receiptId, invoiceId: a.docId, amount: a.amount }))),
      ...journalOps(db, { number, date, memo: `Penerimaan ${number} — ${contact.name}`, source: "penerimaan", sourceId: receiptId, createdBy: me.id, lines: jl }),
      affected.length ? recalcInvoicePaid(db, affected) : null,
    ]);
    return { id: receiptId, number };
  });
  if ("error" in res) return res;
  redirect(`/keuangan/penerimaan/${res.id}?ok=${encodeURIComponent(res.number)}`);
}

function recalcInvoicePaid(db: DB, ids: string[]) {
  return db
    .update(schema.invoices)
    .set({ paid: sql`(select coalesce(sum(a.amount),0) from fin_receipt_allocations a where a.invoice_id = ${schema.invoices.id})` })
    .where(inArray(schema.invoices.id, ids));
}

export async function deleteReceipt(id: string): Promise<FormState> {
  await requireModule("keuangan");
  const res = await guard(async () => {
    const db = await getDb();
    const r = await db.query.receipts.findFirst({ where: eq(schema.receipts.id, id) });
    if (!r) return { ok: "" };
    const fin = await getFinSettings(db);
    assertOpen(r.date, fin.lockDate, "Penerimaan");
    const acc = await loadAccounts(db);
    const allocs = await db.select().from(schema.receiptAllocations).where(eq(schema.receiptAllocations.receiptId, id));
    // Uang muka dari penerimaan ini tidak boleh sudah terpakai.
    const allocTotal = allocs.reduce((a, x) => a + x.amount, 0);
    if (r.amount > allocTotal && r.accountId !== acc.sys("uang_muka_pelanggan")) {
      const bal = await depositBalance(db, acc.sys("uang_muka_pelanggan"), r.contactId, "credit", r.id);
      if (bal < 0) throw new UserError("Uang muka dari penerimaan ini sudah dipakai untuk faktur lain. Hapus pemakaiannya dulu.");
    }
    await runBatch(db, [
      db.delete(schema.receiptAllocations).where(eq(schema.receiptAllocations.receiptId, id)),
      ...deleteJournalOps(db, "penerimaan", id),
      db.delete(schema.receipts).where(eq(schema.receipts.id, id)),
      allocs.length ? recalcInvoicePaid(db, allocs.map((a) => a.invoiceId)) : null,
    ]);
    return { ok: "deleted" };
  });
  if ("error" in res) return res;
  redirect("/keuangan/penerimaan?ok=dihapus");
}
