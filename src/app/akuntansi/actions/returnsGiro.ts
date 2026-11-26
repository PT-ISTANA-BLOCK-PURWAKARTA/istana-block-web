"use server";

// Retur penjualan/pembelian, pengembalian kelebihan uang muka, dan giro masuk/keluar.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { FormState } from "@/components/admin/FormMessage";
import { getDb, schema } from "@/db";
import type { ReturnKind, ReturnSettlement } from "@/db/erp";
import { requireModule } from "@/lib/auth";
import {
  assertOpen, chunk, deleteJournalOps, depositBalance, getFinSettings, guard, insertMany, journalOps, loadAccounts, nextNumber, parseRows, requireDate, runBatch, UserError,
  type DB, type JLine,
} from "@/lib/erp/server";
import { isDate, parseQty, parseRupiah } from "@/lib/erp/util";

type Res = { ok?: string; error?: string };

async function contactOf(db: DB, id: string, kind: ReturnKind) {
  const c = id ? await db.query.contacts.findFirst({ where: eq(schema.contacts.id, id) }) : undefined;
  if (!c || c.kind === (kind === "penjualan" ? "pemasok" : "pelanggan")) throw new UserError(kind === "penjualan" ? "Pilih pelanggan." : "Pilih pemasok.");
  return c;
}

function recalcInvoices(db: DB, ids: string[]) {
  return chunk(Array.from(new Set(ids.filter(Boolean)))).map((part) =>
    db.update(schema.invoices).set({
      paid: sql`(select coalesce(sum(a.amount),0) from fin_receipt_allocations a where a.invoice_id = ${schema.invoices.id}) + (select coalesce(sum(r.total),0) from fin_returns r where r.invoice_id = ${schema.invoices.id} and r.settlement = 'potong_tagihan')`,
    }).where(inArray(schema.invoices.id, part)),
  );
}
function recalcBills(db: DB, ids: string[]) {
  return chunk(Array.from(new Set(ids.filter(Boolean)))).map((part) =>
    db.update(schema.bills).set({
      paid: sql`(select coalesce(sum(a.amount),0) from fin_payment_allocations a where a.bill_id = ${schema.bills.id}) + (select coalesce(sum(r.total),0) from fin_returns r where r.bill_id = ${schema.bills.id} and r.settlement = 'potong_tagihan')`,
    }).where(inArray(schema.bills.id, part)),
  );
}

/* ============================================================ Retur */

export async function saveReturn(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireModule("keuangan");
  const res = await guard(async () => {
    const db = await getDb();
    const id = String(form.get("id") ?? "");
    const existing = id ? await db.query.returns.findFirst({ where: eq(schema.returns.id, id) }) : undefined;
    if (id && !existing) throw new UserError("Retur tidak ditemukan.");
    const kind = (existing?.kind ?? String(form.get("kind"))) as ReturnKind;
    if (kind !== "penjualan" && kind !== "pembelian") throw new UserError("Jenis retur tidak dikenal.");
    const fin = await getFinSettings(db);
    const date = requireDate(form.get("date"));
    assertOpen(date, fin.lockDate, "Retur");
    if (existing) assertOpen(existing.date, fin.lockDate, "Retur");
    const contact = await contactOf(db, String(form.get("contactId") ?? ""), kind);
    const acc = await loadAccounts(db);
    const settlement = String(form.get("settlement")) as ReturnSettlement;
    if (!["potong_tagihan", "uang_muka", "tunai"].includes(settlement)) throw new UserError("Pilih cara penyelesaian retur.");
    const docId = String(form.get("docId") ?? "") || null;

    const lines = parseRows(form.get("lines"))
      .map((r) => {
        const qty = parseQty(r.qty) || 0;
        const price = parseRupiah(r.price);
        const accountId = String(r.accountId ?? "") || null;
        return { description: String(r.description ?? "").trim().slice(0, 300), qty, unit: String(r.unit ?? "").slice(0, 20), price, amount: Math.round(qty * price), accountId };
      })
      .filter((l) => l.description && l.amount > 0);
    if (!lines.length) throw new UserError("Isi minimal satu baris barang yang diretur (nama, jumlah, harga).");
    const subtotal = lines.reduce((s, l) => s + l.amount, 0);
    const tax = form.get("ppn") === "on" ? Math.round((subtotal * fin.ppnRate) / 100) : 0;
    const total = subtotal + tax;
    const costBack = kind === "penjualan" ? parseRupiah(form.get("costBack")) || 0 : 0;

    // Dokumen asal
    let doc: { id: string; number: string; total: number; paid: number; contactId: string } | undefined;
    if (docId) {
      doc = kind === "penjualan"
        ? await db.query.invoices.findFirst({ where: eq(schema.invoices.id, docId) })
        : await db.query.bills.findFirst({ where: eq(schema.bills.id, docId) });
      if (!doc || doc.contactId !== contact.id) throw new UserError("Faktur asal bukan milik kontak ini.");
    }
    if (settlement === "potong_tagihan") {
      if (!doc) throw new UserError("Pilih faktur yang dipotong.");
      const own = existing && existing.settlement === "potong_tagihan" && (existing.invoiceId === doc.id || existing.billId === doc.id) ? existing.total : 0;
      const left = doc.total - doc.paid + own;
      if (total > left) throw new UserError(`Nilai retur (${total.toLocaleString("id-ID")}) melebihi sisa tagihan ${doc.number} (${left.toLocaleString("id-ID")}). Pilih "jadi uang muka" atau "dikembalikan tunai".`);
    }
    let cashAccountId: string | null = null;
    if (settlement === "tunai") {
      cashAccountId = String(form.get("cashAccountId") ?? "");
      if (acc.byId.get(cashAccountId)?.group !== "kas_bank") throw new UserError("Pilih rekening kas/bank.");
    }

    const returnId = existing?.id ?? crypto.randomUUID();
    const number = existing?.number ?? (await nextNumber(db, kind === "penjualan" ? "RJ" : "RB", date));
    const memo = String(form.get("memo") ?? "").slice(0, 500);
    const text = `Retur ${kind} ${number} — ${contact.name}${doc ? ` (${doc.number})` : ""}`;
    const cid = contact.id;
    const settleAccount =
      settlement === "tunai" ? cashAccountId! : settlement === "uang_muka" ? acc.sys(kind === "penjualan" ? "uang_muka_pelanggan" : "uang_muka_pembelian") : acc.sys(kind === "penjualan" ? "piutang" : "hutang");
    let jl: JLine[];
    if (kind === "penjualan") {
      jl = [
        { accountId: acc.sys("retur_penjualan"), debit: subtotal, memo: memo || text, contactId: cid },
        { accountId: acc.sys("ppn_keluaran"), debit: tax, memo: "PPN retur", contactId: cid },
        { accountId: settleAccount, credit: total, memo: text, contactId: cid },
      ];
      if (costBack > 0) jl.push({ accountId: acc.sys("persediaan_jadi"), debit: costBack, memo: "Barang retur kembali ke gudang" }, { accountId: acc.sys("hpp"), credit: costBack, memo: "Barang retur kembali ke gudang" });
    } else {
      const fallback = acc.sys("persediaan_bahan");
      jl = [
        { accountId: settleAccount, debit: total, memo: text, contactId: cid },
        ...lines.map((l) => ({ accountId: l.accountId && acc.byId.get(l.accountId) ? l.accountId : fallback, credit: l.amount, memo: l.description, contactId: cid })),
        { accountId: acc.sys("ppn_masukan"), credit: tax, memo: "PPN retur", contactId: cid },
      ];
    }
    const header = {
      kind, number, date, contactId: cid, invoiceId: kind === "penjualan" ? doc?.id ?? null : null, billId: kind === "pembelian" ? doc?.id ?? null : null,
      settlement, cashAccountId, subtotal, tax, total, costBack, memo, updatedAt: new Date(),
    };
    const affected = [existing?.invoiceId ?? "", existing?.billId ?? "", doc?.id ?? ""];
    await runBatch(db, [
      existing
        ? [db.update(schema.returns).set(header).where(eq(schema.returns.id, returnId)), db.delete(schema.returnLines).where(eq(schema.returnLines.returnId, returnId)), ...deleteJournalOps(db, "retur", returnId)]
        : db.insert(schema.returns).values({ id: returnId, ...header, createdBy: me.id }),
      ...insertMany(db, schema.returnLines, lines.map((l, i) => ({ returnId, ...l, sort: i }))),
      ...journalOps(db, { number, date, memo: text, source: "retur", sourceId: returnId, createdBy: me.id, lines: jl }),
      ...(kind === "penjualan" ? recalcInvoices(db, affected) : recalcBills(db, affected)),
    ]);
    return { id: returnId, number };
  });
  if ("error" in res) return res;
  redirect(`/akuntansi/retur/${res.id}?ok=${encodeURIComponent(res.number)}`);
}

export async function deleteReturn(id: string): Promise<Res> {
  await requireModule("keuangan");
  const res = await guard(async () => {
    const db = await getDb();
    const r = await db.query.returns.findFirst({ where: eq(schema.returns.id, id) });
    if (!r) return { ok: "" };
    const fin = await getFinSettings(db);
    assertOpen(r.date, fin.lockDate, "Retur");
    if (r.settlement === "uang_muka") {
      const acc = await loadAccounts(db);
      const bal = await depositBalance(db, acc.sys(r.kind === "penjualan" ? "uang_muka_pelanggan" : "uang_muka_pembelian"), r.contactId, r.kind === "penjualan" ? "credit" : "debit", r.id);
      if (bal < 0) throw new UserError("Uang muka dari retur ini sudah dipakai. Hapus pemakaiannya dulu.");
    }
    await runBatch(db, [
      db.delete(schema.returnLines).where(eq(schema.returnLines.returnId, id)),
      ...deleteJournalOps(db, "retur", id),
      db.delete(schema.returns).where(eq(schema.returns.id, id)),
      ...(r.kind === "penjualan" ? recalcInvoices(db, [r.invoiceId ?? ""]) : recalcBills(db, [r.billId ?? ""])),
    ]);
    return { ok: r.kind as string };
  });
  if ("error" in res) return res;
  redirect(`/akuntansi/retur?jenis=${res.ok || "penjualan"}&ok=dihapus`);
}

/* ============================================================ Pengembalian kelebihan uang muka */

/** Penjualan: uang muka pelanggan dikembalikan (Dr uang muka, Cr kas). Pembelian: pemasok mengembalikan uang muka (Dr kas, Cr uang muka). */
export async function refundDeposit(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireModule("keuangan");
  const res = await guard(async () => {
    const db = await getDb();
    const kind = String(form.get("kind")) === "pembelian" ? "pembelian" : "penjualan";
    const fin = await getFinSettings(db);
    const date = requireDate(form.get("date"));
    assertOpen(date, fin.lockDate, "Transaksi kas");
    const contact = await contactOf(db, String(form.get("contactId") ?? ""), kind);
    const acc = await loadAccounts(db);
    const cash = acc.byId.get(String(form.get("accountId") ?? ""));
    if (!cash || cash.group !== "kas_bank") throw new UserError("Pilih rekening kas/bank.");
    const amount = parseRupiah(form.get("amount"));
    if (!(amount > 0)) throw new UserError("Isi jumlah.");
    const deposit = acc.sys(kind === "penjualan" ? "uang_muka_pelanggan" : "uang_muka_pembelian");
    const bal = await depositBalance(db, deposit, contact.id, kind === "penjualan" ? "credit" : "debit");
    if (amount > bal) throw new UserError(`Saldo uang muka ${contact.name} hanya Rp${bal.toLocaleString("id-ID")}.`);
    const memo = (String(form.get("memo") ?? "").trim() || (kind === "penjualan" ? `Pengembalian kelebihan uang muka ke ${contact.name}` : `Penerimaan kembalian uang muka dari ${contact.name}`)).slice(0, 500);
    const cashId = crypto.randomUUID();
    const ck = kind === "penjualan" ? "keluar" : "masuk";
    const number = await nextNumber(db, ck === "masuk" ? "KM" : "KK", date);
    const jl: JLine[] = ck === "keluar"
      ? [{ accountId: deposit, debit: amount, memo, contactId: contact.id }, { accountId: cash.id, credit: amount, memo, contactId: contact.id }]
      : [{ accountId: cash.id, debit: amount, memo, contactId: contact.id }, { accountId: deposit, credit: amount, memo, contactId: contact.id }];
    await runBatch(db, [
      db.insert(schema.cashTxns).values({ id: cashId, number, date, kind: ck, accountId: cash.id, toAccountId: null, contactId: contact.id, amount, memo, createdBy: me.id }),
      db.insert(schema.cashLines).values({ cashId, accountId: deposit, amount, memo, sort: 0 }),
      ...journalOps(db, { number, date, memo, source: "kas", sourceId: cashId, createdBy: me.id, lines: jl }),
    ]);
    return { id: cashId, number };
  });
  if ("error" in res) return res;
  redirect(`/akuntansi/kas/${res.id}?ok=${encodeURIComponent(res.number)}`);
}

/* ============================================================ Giro */

/**
 * Catat giro: masuk = penerimaan dari pelanggan ke rekening "Giro Masuk (Belum Cair)", dialokasikan otomatis ke faktur terbuka
 * paling lama (sisanya jadi uang muka); keluar = pembayaran ke pemasok dari "Giro Keluar (Belum Cair)", dialokasikan ke tagihan terlama.
 */
export async function saveGiro(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireModule("keuangan");
  const res = await guard(async () => {
    const db = await getDb();
    const kind = String(form.get("kind")) === "keluar" ? "keluar" : "masuk";
    const fin = await getFinSettings(db);
    const issueDate = requireDate(form.get("issueDate"), "Tanggal terima/terbit");
    const dueDate = requireDate(form.get("dueDate"), "Tanggal jatuh tempo");
    assertOpen(issueDate, fin.lockDate, "Giro");
    const contact = await contactOf(db, String(form.get("contactId") ?? ""), kind === "masuk" ? "penjualan" : "pembelian");
    const giroNo = String(form.get("giroNo") ?? "").trim().slice(0, 60);
    if (!giroNo) throw new UserError("Isi nomor giro/cek.");
    const amount = parseRupiah(form.get("amount"));
    if (!(amount > 0)) throw new UserError("Isi nominal giro.");
    const allocate = form.get("allocate") === "on";
    const acc = await loadAccounts(db);
    const giroAcc = acc.sys(kind === "masuk" ? "giro_masuk" : "giro_keluar");
    const deposit = acc.sys(kind === "masuk" ? "uang_muka_pelanggan" : "uang_muka_pembelian");
    const docs = allocate
      ? kind === "masuk"
        ? await db.all<{ id: string; total: number; paid: number }>(sql`select id, total, paid from fin_invoices where contact_id = ${contact.id} and void = 0 and paid < total order by due_date, date`)
        : await db.all<{ id: string; total: number; paid: number }>(sql`select id, total, paid from fin_bills where contact_id = ${contact.id} and void = 0 and paid < total order by due_date, date`)
      : [];
    let rest = amount;
    const allocs: { docId: string; amount: number }[] = [];
    for (const d of docs) { if (rest <= 0) break; const a = Math.min(rest, Number(d.total) - Number(d.paid)); if (a > 0) { allocs.push({ docId: d.id, amount: a }); rest -= a; } }
    const allocTotal = amount - rest;
    const giroId = crypto.randomUUID();
    const docId = crypto.randomUUID();
    const number = await nextNumber(db, kind === "masuk" ? "TRM" : "BYR", issueDate);
    const bank = String(form.get("bank") ?? "").slice(0, 80);
    const memo = `Giro ${giroNo}${bank ? ` ${bank}` : ""} jt ${dueDate} — ${contact.name}`;
    const jl: JLine[] = kind === "masuk"
      ? [{ accountId: giroAcc, debit: amount, contactId: contact.id }, { accountId: acc.sys("piutang"), credit: allocTotal, contactId: contact.id }, { accountId: deposit, credit: rest, contactId: contact.id, memo: rest ? "Uang muka / titipan pelanggan" : "" }]
      : [{ accountId: acc.sys("hutang"), debit: allocTotal, contactId: contact.id }, { accountId: deposit, debit: rest, contactId: contact.id, memo: rest ? "Uang muka ke pemasok" : "" }, { accountId: giroAcc, credit: amount, contactId: contact.id }];
    await runBatch(db, [
      kind === "masuk"
        ? db.insert(schema.receipts).values({ id: docId, number, date: issueDate, contactId: contact.id, accountId: giroAcc, amount, memo, createdBy: me.id })
        : db.insert(schema.payments).values({ id: docId, number, date: issueDate, contactId: contact.id, accountId: giroAcc, amount, memo, createdBy: me.id }),
      ...(kind === "masuk"
        ? insertMany(db, schema.receiptAllocations, allocs.map((a) => ({ receiptId: docId, invoiceId: a.docId, amount: a.amount })))
        : insertMany(db, schema.paymentAllocations, allocs.map((a) => ({ paymentId: docId, billId: a.docId, amount: a.amount })))),
      ...journalOps(db, { number, date: issueDate, memo, source: kind === "masuk" ? "penerimaan" : "pembayaran", sourceId: docId, createdBy: me.id, lines: jl }),
      db.insert(schema.giros).values({ id: giroId, kind, giroNo, bank, contactId: contact.id, amount, issueDate, dueDate, status: "beredar", docId, note: String(form.get("note") ?? "").slice(0, 300), createdBy: me.id }),
      ...(kind === "masuk" ? recalcInvoices(db, allocs.map((a) => a.docId)) : recalcBills(db, allocs.map((a) => a.docId))),
    ]);
    return { id: giroId };
  });
  if ("error" in res) return res;
  redirect(`/akuntansi/giro/${res.id}?ok=tersimpan`);
}

async function giroOf(db: DB, id: string) {
  const g = await db.query.giros.findFirst({ where: eq(schema.giros.id, id) });
  if (!g) throw new UserError("Giro tidak ditemukan.");
  return g;
}

/** Cairkan: masuk = Dr bank, Cr Giro Masuk; keluar = Dr Giro Keluar, Cr bank. */
export async function clearGiro(id: string, date: string, accountId: string): Promise<Res> {
  const me = await requireModule("keuangan");
  const res = await guard(async () => {
    const db = await getDb();
    const g = await giroOf(db, id);
    if (g.status !== "beredar") throw new UserError("Giro ini sudah cair/ditolak.");
    if (!isDate(date)) throw new UserError("Isi tanggal cair.");
    const fin = await getFinSettings(db);
    assertOpen(date, fin.lockDate, "Giro");
    const acc = await loadAccounts(db);
    if (acc.byId.get(accountId)?.group !== "kas_bank") throw new UserError("Pilih rekening bank.");
    const giroAcc = acc.sys(g.kind === "masuk" ? "giro_masuk" : "giro_keluar");
    const number = await nextNumber(db, "GR", date);
    const memo = `Giro ${g.giroNo} cair`;
    const jl: JLine[] = g.kind === "masuk"
      ? [{ accountId, debit: g.amount, memo, contactId: g.contactId }, { accountId: giroAcc, credit: g.amount, memo, contactId: g.contactId }]
      : [{ accountId: giroAcc, debit: g.amount, memo, contactId: g.contactId }, { accountId, credit: g.amount, memo, contactId: g.contactId }];
    await runBatch(db, [
      ...journalOps(db, { number, date, memo, source: "giro", sourceId: g.id, createdBy: me.id, lines: jl }),
      db.update(schema.giros).set({ status: "cair", clearedDate: date, clearedAccountId: accountId, updatedAt: new Date() }).where(eq(schema.giros.id, g.id)),
    ]);
    return { ok: `${number}: giro ${g.giroNo} dicairkan.` };
  });
  revalidatePath("/akuntansi/giro");
  revalidatePath(`/akuntansi/giro/${id}`);
  return res;
}

export async function undoClearGiro(id: string): Promise<Res> {
  await requireModule("keuangan");
  const res = await guard(async () => {
    const db = await getDb();
    const g = await giroOf(db, id);
    if (g.status !== "cair") throw new UserError("Giro ini belum cair.");
    const fin = await getFinSettings(db);
    assertOpen(g.clearedDate ?? "", fin.lockDate, "Giro");
    await runBatch(db, [...deleteJournalOps(db, "giro", g.id), db.update(schema.giros).set({ status: "beredar", clearedDate: null, clearedAccountId: null, updatedAt: new Date() }).where(eq(schema.giros.id, g.id))]);
    return { ok: "Pencairan dibatalkan; giro kembali beredar." };
  });
  revalidatePath(`/akuntansi/giro/${id}`);
  return res;
}

/** Tolak/batal: penerimaan/pembayaran giro dihapus sehingga faktur kembali terbuka; catatan giro disimpan dengan status ditolak. */
export async function rejectGiro(id: string, note: string): Promise<Res> {
  await requireModule("keuangan");
  const res = await guard(async () => {
    const db = await getDb();
    const g = await giroOf(db, id);
    if (g.status !== "beredar") throw new UserError("Hanya giro yang belum cair yang bisa ditolak.");
    const fin = await getFinSettings(db);
    assertOpen(g.issueDate, fin.lockDate, "Giro");
    const acc = await loadAccounts(db);
    const docId = g.docId ?? "";
    if (g.kind === "masuk") {
      const allocs = await db.select().from(schema.receiptAllocations).where(eq(schema.receiptAllocations.receiptId, docId));
      const bal = await depositBalance(db, acc.sys("uang_muka_pelanggan"), g.contactId, "credit", docId);
      if (bal < 0) throw new UserError("Uang muka dari giro ini sudah dipakai untuk faktur lain. Hapus pemakaiannya dulu.");
      await runBatch(db, [
        db.delete(schema.receiptAllocations).where(eq(schema.receiptAllocations.receiptId, docId)),
        ...deleteJournalOps(db, "penerimaan", docId),
        db.delete(schema.receipts).where(eq(schema.receipts.id, docId)),
        ...recalcInvoices(db, allocs.map((a) => a.invoiceId)),
        db.update(schema.giros).set({ status: "tolak", docId: null, note: note.slice(0, 300) || g.note, updatedAt: new Date() }).where(eq(schema.giros.id, g.id)),
      ]);
    } else {
      const allocs = await db.select().from(schema.paymentAllocations).where(eq(schema.paymentAllocations.paymentId, docId));
      const bal = await depositBalance(db, acc.sys("uang_muka_pembelian"), g.contactId, "debit", docId);
      if (bal < 0) throw new UserError("Uang muka dari giro ini sudah dipakai. Hapus pemakaiannya dulu.");
      await runBatch(db, [
        db.delete(schema.paymentAllocations).where(eq(schema.paymentAllocations.paymentId, docId)),
        ...deleteJournalOps(db, "pembayaran", docId),
        db.delete(schema.payments).where(eq(schema.payments.id, docId)),
        ...recalcBills(db, allocs.map((a) => a.billId)),
        db.update(schema.giros).set({ status: "tolak", docId: null, note: note.slice(0, 300) || g.note, updatedAt: new Date() }).where(eq(schema.giros.id, g.id)),
      ]);
    }
    return { ok: `Giro ${g.giroNo} ditolak/dibatalkan; tagihan kembali terbuka.` };
  });
  revalidatePath("/akuntansi/giro");
  revalidatePath(`/akuntansi/giro/${id}`);
  return res;
}

export async function deleteGiro(id: string): Promise<Res> {
  await requireModule("keuangan");
  const res = await guard(async () => {
    const db = await getDb();
    const g = await giroOf(db, id);
    if (g.status === "cair") throw new UserError("Batalkan pencairannya dulu.");
    if (g.status === "beredar") throw new UserError("Tolak/batalkan giro dulu supaya penerimaan/pembayarannya terhapus.");
    await db.delete(schema.giros).where(and(eq(schema.giros.id, id), eq(schema.giros.status, "tolak")));
    return { ok: "Catatan giro dihapus." };
  });
  if ("error" in res) return res;
  redirect("/akuntansi/giro?ok=dihapus");
}
