"use server";

// Dokumen penjualan dari Keuangan (pindahan app.kirim): Surat Penawaran & Invoice. Operasional hanya melihat.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import type { FormState } from "@/components/admin/FormMessage";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { guard, insertMany, nextNumber, parseRows, requireDate, runBatch, UserError } from "@/lib/erp/server";
import { orderProgress } from "@/lib/erp/orders";
import { logActivity } from "@/lib/ops/activity";
import { notificationOp } from "@/lib/ops/notify";
import { findCustomerByPhone, normPhone } from "@/lib/ops/orders";
import { hidePrices } from "@/lib/ops/shared/prices";
import { isDate, parseQty } from "@/lib/erp/util";
import { LAST_MANUAL_QUOTATION_SEQ as LAST_MANUAL_SEQ, quotationNumber } from "@/lib/erp/quotation";
import { EIB_BANK, invoiceNumber, invoiceTotals, LAST_MANUAL_INVOICE_SEQ, type InvoiceLine } from "@/lib/erp/salesInvoice";

/* ---------------- Surat penawaran ---------------- */
const wibMidnight = (day: string) => new Date(`${day}T00:00:00+07:00`);
const STATUSES = ["draft", "terkirim", "diterima", "ditolak"];

export async function saveQuotation(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireModule("keuangan");
  const res = await guard(async () => {
    const db = await getDb();
    const id = String(form.get("id") ?? "");
    const day = String(form.get("quoteDate") ?? "");
    if (!isDate(day)) throw new UserError("Isi tanggal surat.");
    const customerName = String(form.get("customerName") ?? "").trim();
    if (!customerName) throw new UserError("Isi nama pelanggan (Kepada).");
    const items = parseRows(form.get("items")).map((r) => {
      const num = (v: unknown) => { const s = String(v ?? "").replace(/\./g, "").replace(",", ".").trim(); const n = Number(s); return s && Number.isFinite(n) ? n : null; };
      return { name: String(r.name ?? "").trim(), size: String(r.size ?? "").trim() || null, note: String(r.note ?? "").trim() || null, unit: String(r.unit ?? "").trim(), price: num(r.price) ?? 0, quantity: num(r.quantity) };
    }).filter((i) => i.name);
    if (!items.length) throw new UserError("Isi minimal satu barang / pekerjaan.");
    if (items.some((i) => !(i.price > 0))) throw new UserError("Isi harga untuk setiap barang.");
    const terms = parseRows(form.get("terms")).map((t) => ({ label: String(t.label ?? "").trim(), lines: String(t.lines ?? "").split("\n").map((l) => l.trim()).filter(Boolean) })).filter((t) => t.label || t.lines.length);
    const signerId = Number(form.get("signerId")) || null;
    const signer = signerId ? await db.query.users.findFirst({ where: eq(schema.users.id, signerId) }) : undefined;
    const s = (k: string) => String(form.get(k) ?? "").trim() || null;
    const values = {
      quoteDate: wibMidnight(day), projectName: s("projectName"), projectCity: s("projectCity"), customerName, customerAddress: s("customerAddress"), customerPhone: s("customerPhone"),
      attnName: s("attnName"), attnPhone: s("attnName") ? s("attnPhone") : null,
      work: s("work"), location: s("location"), items, terms, bankName: s("bankName"), bankAccount: s("bankAccount"),
      signerId: signer?.id ?? null, signerName: s("signerName") ?? signer?.name ?? null, signerTitle: s("signerTitle"), customerSignTitle: s("customerSignTitle") ?? "PENANGGUNG JAWAB", updatedAt: new Date(),
    };
    if (id) {
      const cur = await db.query.quotations.findFirst({ where: eq(schema.quotations.id, id) });
      if (!cur) throw new UserError("Surat tidak ditemukan.");
      await db.update(schema.quotations).set({ ...values, number: quotationNumber(cur.seq, day) }).where(eq(schema.quotations.id, id));
      return { id };
    }
    const m = await db.get<{ s: number }>(sql`select coalesce(max(seq), 0) s from ops_quotations`);
    const seq = Math.max(LAST_MANUAL_SEQ, Number(m?.s ?? 0)) + 1;
    const newId = crypto.randomUUID();
    await db.insert(schema.quotations).values({ id: newId, seq, number: quotationNumber(seq, day), ...values, status: "draft", createdBy: me.id, createdByName: me.name });
    return { id: newId };
  });
  if ("error" in res) return res;
  revalidatePath("/akuntansi/dokumen/penawaran");
  redirect(`/akuntansi/dokumen/penawaran/${res.id}?ok=1`);
}

export async function setQuotationStatus(id: string, status: string): Promise<{ ok?: string; error?: string }> {
  await requireModule("keuangan");
  const res = await guard(async () => {
    if (!STATUSES.includes(status)) throw new UserError("Status tidak dikenal.");
    const db = await getDb();
    await db.update(schema.quotations).set({ status, updatedAt: new Date() }).where(eq(schema.quotations.id, id));
    return { ok: `Status: ${status}.` };
  });
  revalidatePath(`/akuntansi/dokumen/penawaran/${id}`);
  return res;
}

export async function deleteQuotation(id: string): Promise<{ ok?: string; error?: string }> {
  await requireModule("keuangan");
  const res = await guard(async () => {
    const db = await getDb();
    const q = await db.query.quotations.findFirst({ where: eq(schema.quotations.id, id) });
    if (!q) return { ok: "" };
    if (q.status !== "draft") throw new UserError("Hanya surat berstatus Draft yang bisa dihapus — ubah status bila salah.");
    await db.delete(schema.quotations).where(eq(schema.quotations.id, id));
    return { ok: "deleted" };
  });
  if ("error" in res) return res;
  redirect("/akuntansi/dokumen/penawaran");
}

/* ---------------- Invoice penjualan ---------------- */
const INVOICE_STATUSES = ["draft", "terkirim", "dp", "lunas", "batal"];
const numOf = (v: unknown) => { const t = String(v ?? "").replace(/\./g, "").replace(",", ".").trim(); const n = Number(t); return t && Number.isFinite(n) ? n : null; };

export async function saveSalesInvoice(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireModule("keuangan");
  const res = await guard(async () => {
    const db = await getDb();
    const id = String(form.get("id") ?? "");
    const day = String(form.get("invoiceDate") ?? "");
    if (!isDate(day)) throw new UserError("Isi tanggal invoice.");
    const customerName = String(form.get("customerName") ?? "").trim();
    if (!customerName) throw new UserError("Isi nama pelanggan (Kepada).");
    const items: InvoiceLine[] = parseRows(form.get("items")).map((r) => ({ name: String(r.name ?? "").trim(), unit: String(r.unit ?? "").trim() || "pcs", quantity: numOf(r.quantity) ?? 0, price: numOf(r.price) ?? 0 })).filter((i) => i.name);
    if (!items.length) throw new UserError("Isi minimal satu barang.");
    if (items.some((i) => !(i.quantity > 0))) throw new UserError("Isi banyaknya untuk setiap barang.");
    const s = (k: string) => String(form.get(k) ?? "").trim() || null;
    const issuer = String(form.get("issuer") ?? "ib");
    const dpMode = String(form.get("dpMode") ?? "none");
    const signerId = Number(form.get("signerId")) || null;
    const signer = signerId ? await db.query.users.findFirst({ where: eq(schema.users.id, signerId) }) : undefined;
    const values = {
      invoiceDate: wibMidnight(day), quotationId: s("quotationId"), customerName, customerAddress: s("customerAddress"), customerPhone: s("customerPhone"), poNumber: s("poNumber"),
      items, ppnPercent: numOf(form.get("ppnPercent")) ?? 0,
      downPaymentPercent: dpMode === "persen" ? numOf(form.get("downPaymentPercent")) : null, downPaymentAmount: dpMode === "nominal" ? numOf(form.get("downPaymentAmount")) : null,
      note: s("note"), bankName: issuer === "eib" ? EIB_BANK.name : s("bankName"), bankAccount: issuer === "eib" ? EIB_BANK.account : s("bankAccount"),
      signerId: signer?.id ?? null, signerName: s("signerName") ?? signer?.name ?? null, updatedAt: new Date(),
    };
    // Nomor boleh diisi sendiri (mis. disamakan dengan faktur Zahir); harus unik.
    const custom = s("number")?.toUpperCase();
    if (custom) {
      const taken = await db.get<{ id: string }>(sql`select id from ops_sales_invoices where number = ${custom} limit 1`);
      if (taken && taken.id !== id) throw new UserError(`Nomor ${custom} sudah dipakai invoice lain.`);
    }
    if (id) {
      const cur = await db.query.salesInvoices.findFirst({ where: eq(schema.salesInvoices.id, id) });
      if (!cur) throw new UserError("Invoice tidak ditemukan.");
      await db.update(schema.salesInvoices).set({ ...values, ...(custom ? { number: custom } : {}) }).where(eq(schema.salesInvoices.id, id));
      return { id };
    }
    const m = await db.get<{ s: number }>(sql`select coalesce(max(seq), 0) s from ops_sales_invoices where issuer = ${issuer}`);
    const seq = Math.max(issuer === "ib" ? LAST_MANUAL_INVOICE_SEQ : 0, Number(m?.s ?? 0)) + 1;
    const newId = crypto.randomUUID();
    await db.insert(schema.salesInvoices).values({ id: newId, issuer, seq: custom ? 0 : seq, number: custom ?? invoiceNumber(seq, issuer), shipments: [], status: "draft", ...values, createdBy: me.id, createdByName: me.name });
    return { id: newId };
  });
  if ("error" in res) return res;
  revalidatePath("/akuntansi/dokumen/invoice");
  redirect(`/akuntansi/dokumen/invoice/${res.id}?ok=1`);
}

export async function setSalesInvoiceStatus(id: string, status: string): Promise<{ ok?: string; error?: string }> {
  const me = await requireModule("keuangan");
  const res = await guard(async () => {
    if (!INVOICE_STATUSES.includes(status)) throw new UserError("Status tidak dikenal.");
    const db = await getDb();
    const inv = await db.query.salesInvoices.findFirst({ where: eq(schema.salesInvoices.id, id) });
    if (!inv) throw new UserError("Invoice tidak ditemukan.");
    const { grandTotal } = invoiceTotals(inv.items as unknown as InvoiceLine[], inv.ppnPercent, inv.downPaymentPercent, inv.downPaymentAmount);
    // Lunas lewat status = dibayar penuh; kembali ke Draft / Terkirim = catatan pembayaran dihapus.
    const payment = status === "lunas" && (inv.paidAmount ?? 0) < grandTotal
      ? { paidAmount: grandTotal, paidAt: inv.paidAt ?? new Date(), paidByName: me.name, paymentNote: inv.paymentNote ?? "Ditandai lunas" }
      : (status === "draft" || status === "terkirim") && (inv.paidAmount ?? 0) > 0
        ? { paidAmount: null, paidAt: null, paidByName: null, paymentMethod: null, paymentNote: null }
        : {};
    await db.update(schema.salesInvoices).set({ status, ...payment, updatedAt: new Date() }).where(eq(schema.salesInvoices.id, id));
    return { ok: "Status diubah." };
  });
  revalidatePath(`/akuntansi/dokumen/invoice/${id}`);
  return res;
}

export async function recordSalesInvoicePayment(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireModule("keuangan");
  const id = String(form.get("id") ?? "");
  const res = await guard(async () => {
    const db = await getDb();
    const inv = await db.query.salesInvoices.findFirst({ where: eq(schema.salesInvoices.id, id) });
    if (!inv) throw new UserError("Invoice tidak ditemukan.");
    const amount = Math.round(numOf(form.get("amount")) ?? 0);
    const day = String(form.get("paidAt") ?? "");
    if (amount && !isDate(day)) throw new UserError("Isi tanggal bayar.");
    const { grandTotal } = invoiceTotals(inv.items as unknown as InvoiceLine[], inv.ppnPercent, inv.downPaymentPercent, inv.downPaymentAmount);
    const status = amount >= grandTotal ? "lunas" : amount > 0 ? "dp" : inv.status === "dp" || inv.status === "lunas" ? "terkirim" : inv.status;
    await db.update(schema.salesInvoices).set({
      paidAmount: amount || null, paidAt: amount ? wibMidnight(day) : null, paymentMethod: amount ? String(form.get("method") ?? "") || null : null,
      paymentNote: amount ? String(form.get("note") ?? "").trim() || null : null, paidByName: amount ? me.name : null, status, updatedAt: new Date(),
    }).where(eq(schema.salesInvoices.id, id));
    return { ok: true };
  });
  if ("error" in res) return res;
  revalidatePath(`/akuntansi/dokumen/invoice/${id}`);
  redirect(`/akuntansi/dokumen/invoice/${id}?ok=bayar`);
}

export async function deleteSalesInvoice(id: string): Promise<{ ok?: string; error?: string }> {
  await requireModule("keuangan");
  const res = await guard(async () => {
    const db = await getDb();
    const inv = await db.query.salesInvoices.findFirst({ where: eq(schema.salesInvoices.id, id) });
    if (!inv) return { ok: "" };
    if (inv.status !== "draft") throw new UserError("Hanya invoice berstatus Draft yang bisa dihapus — ubah status ke Batal bila salah.");
    await db.delete(schema.salesInvoices).where(eq(schema.salesInvoices.id, id));
    return { ok: "deleted" };
  });
  if ("error" in res) return res;
  redirect("/akuntansi/dokumen/invoice");
}

/* ---------------- Surat jalan dari invoice (alur: invoice → surat jalan → penugasan sopir di Operasional) ---------------- */
/**
 * Keuangan membuat surat jalan dari invoice. Invoice pertama kali dikirim → dibuat satu PO pengiriman (ops_orders) berisi
 * seluruh barang invoice; tiap surat jalan = satu pengiriman (ops_deliveries) dari sisa PO itu. Sopir & armada boleh kosong:
 * Operasional menugaskan sopir. Stok keluar & jurnal HPP terposting per surat jalan saat truk berangkat (sama seperti alur lama).
 */
export async function createDeliveryFromInvoice(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireModule("keuangan");
  const invoiceId = String(form.get("invoiceId") ?? "");
  const res = await guard(async () => {
    const db = await getDb();
    const inv = await db.query.salesInvoices.findFirst({ where: eq(schema.salesInvoices.id, invoiceId) });
    if (!inv) throw new UserError("Invoice tidak ditemukan.");
    if (inv.status === "batal") throw new UserError("Invoice sudah dibatalkan.");
    const items = inv.items as unknown as InvoiceLine[];
    const date = requireDate(form.get("date"), "Tanggal surat jalan");
    const address = String(form.get("address") ?? "").trim().slice(0, 500);
    if (address.length < 5) throw new UserError("Isi alamat kirim (minimal 5 huruf) untuk sopir.");
    const mapsUrl = String(form.get("mapsUrl") ?? "").trim().slice(0, 500);
    if (mapsUrl && !/^https?:\/\//i.test(mapsUrl)) throw new UserError("Tautan peta harus diawali https://");
    const siteContact = String(form.get("siteContact") ?? "").trim().slice(0, 120);
    const note = (hidePrices(String(form.get("note") ?? "").trim().slice(0, 1000)) ?? "");
    const paid = inv.paidAmount ?? 0;
    const { grandTotal } = invoiceTotals(items, inv.ppnPercent, inv.downPaymentPercent, inv.downPaymentAmount);
    if (!paid && form.get("paymentConfirmed") !== "on") throw new UserError("Belum ada DP / pembayaran tercatat — catat pembayaran dulu atau centang persetujuan kirim.");
    const rows = parseRows(form.get("lines"));
    const want = new Map(rows.map((r) => [Number(r.index), { qty: parseQty(r.qty), itemId: String(r.itemId ?? "") }]));

    // PO pengiriman invoice ini (dibuat sekali; dipakai lagi untuk kirim bertahap).
    let order = inv.orderId ? await db.query.orders.findFirst({ where: eq(schema.orders.id, inv.orderId) }) : undefined;
    if (order && (order.status === "batal" || order.status === "selesai")) order = undefined;
    const ops: Parameters<typeof runBatch>[1] = [];
    let orderLines: { id: string; itemId: string; sort: number }[] = [];
    if (order) {
      orderLines = await db.select({ id: schema.orderLines.id, itemId: schema.orderLines.itemId, sort: schema.orderLines.sort }).from(schema.orderLines).where(eq(schema.orderLines.orderId, order.id));
    } else {
      const catalog = await db.select().from(schema.items).where(eq(schema.items.active, true));
      const byId = new Map(catalog.map((i) => [i.id, i]));
      const orderId = crypto.randomUUID();
      const lines = items.map((it, idx) => {
        const item = byId.get(want.get(idx)?.itemId ?? "");
        if (!item) throw new UserError(`Pilih barang stok untuk "${it.name}".`);
        return { id: crypto.randomUUID(), orderId, itemId: item.id, description: it.name.slice(0, 300), qty: Number(it.quantity) || 0, unit: it.unit || item.unit, price: Math.round(Number(it.price) || 0), sort: idx };
      });
      // Pelanggan: lewat nomor HP, atau nama persis; bila belum ada dibuat baru.
      const phone = normPhone(inv.customerPhone ?? "");
      let contactId = phone ? (await findCustomerByPhone(db, phone))?.id ?? null : null;
      if (!contactId) contactId = (await db.get<{ id: string }>(sql`select id from fin_contacts where active = 1 and kind <> 'pemasok' and lower(name) = ${inv.customerName.toLowerCase()} limit 1`))?.id ?? null;
      const newContactId = contactId ? null : crypto.randomUUID();
      const number = await nextNumber(db, "PO", date);
      const paymentStatus = paid >= grandTotal ? "lunas" as const : "belum_lunas" as const;
      ops.push(
        newContactId ? db.insert(schema.contacts).values({ id: newContactId, kind: "pelanggan", name: inv.customerName, phone, address: inv.customerAddress ?? address }) : null,
        db.insert(schema.orders).values({
          id: orderId, number, date, contactId: contactId ?? newContactId!, customerRef: inv.poNumber ?? "", project: "", address, mapsUrl, siteContact, requestedDate: date,
          status: "dikonfirmasi", note: `Invoice ${inv.number}`, externalRef: inv.number, paymentStatus,
          paymentConfirmedBy: paymentStatus === "belum_lunas" ? me.id : null, paymentConfirmedAt: paymentStatus === "belum_lunas" ? new Date() : null, createdBy: me.id,
        }),
        ...insertMany(db, schema.orderLines, lines),
      );
      order = { id: orderId, number } as unknown as NonNullable<typeof order>;
      orderLines = lines.map((l) => ({ id: l.id, itemId: l.itemId, sort: l.sort }));
    }
    // Jumlah dikirim per barang tidak boleh melebihi sisa (surat jalan batal tidak dihitung).
    const prog = inv.orderId && order!.id === inv.orderId ? await orderProgress(db, order!.id) : [];
    const deliveryId = crypto.randomUUID();
    const dl: { deliveryId: string; orderLineId: string; itemId: string; qty: number }[] = [];
    const shipped: { index: number; quantity: number }[] = [];
    for (const ol of orderLines) {
      const qty = want.get(ol.sort)?.qty ?? 0;
      if (qty <= 1e-9) continue;
      const it = items[ol.sort];
      const p = prog.find((x) => x.id === ol.id);
      const left = p ? p.qty - p.scheduled : Number(it?.quantity ?? 0);
      if (qty > left + 1e-9) throw new UserError(`${it?.name ?? "Barang"}: sisa hanya ${left.toLocaleString("id-ID")} ${it?.unit ?? ""}.`);
      dl.push({ deliveryId, orderLineId: ol.id, itemId: ol.itemId, qty });
      shipped.push({ index: ol.sort, quantity: qty });
    }
    if (!dl.length) throw new UserError("Isi jumlah barang yang dikirim di surat jalan ini.");
    const sjNumber = await nextNumber(db, "SJ", date);
    const shipments = [...((inv.shipments ?? []) as unknown[]), { deliveryId, deliveryNumber: sjNumber, orderId: order!.id, poNumber: order!.number, date, createdAt: new Date().toISOString(), createdByName: me.name, items: shipped }];
    await runBatch(db, [
      ...ops,
      db.insert(schema.deliveries).values({ id: deliveryId, number: sjNumber, orderId: order!.id, date, status: "dijadwalkan", note, createdBy: me.id }),
      ...insertMany(db, schema.deliveryLines, dl),
      db.insert(schema.deliveryHistory).values({ deliveryId, fromStatus: null, toStatus: "dijadwalkan", changedBy: me.id, note: `Surat jalan dibuat Keuangan dari invoice ${inv.number}` }),
      db.update(schema.salesInvoices).set({ orderId: order!.id, orderPoNumber: order!.number, shipments, updatedAt: new Date() }).where(eq(schema.salesInvoices.id, inv.id)),
      notificationOp(db, "umum", deliveryId, "Surat jalan baru perlu ditugaskan sopir", `${sjNumber} · ${inv.customerName} · invoice ${inv.number}`),
    ]);
    await logActivity(me, { action: "pengiriman.dari_invoice", label: "Membuat surat jalan dari invoice", summary: `${sjNumber} dari ${inv.number}` });
    return { id: deliveryId, number: sjNumber };
  });
  if ("error" in res) return res;
  revalidatePath(`/akuntansi/dokumen/invoice/${invoiceId}`);
  redirect(`/akuntansi/dokumen/surat-jalan/${res.id}?ok=1`);
}
