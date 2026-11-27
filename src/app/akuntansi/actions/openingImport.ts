"use server";

// Impor saldo awal piutang / hutang per faktur dari Zahir: pratinjau (uji coba, tidak menyimpan) → simpan per batch → batalkan batch.
// Faktur saldo awal TIDAK membuat jurnal (saldo sudah ada di akun Piutang/Hutang Usaha); yang dibuat hanya dokumen sub-ledger
// sehingga umur piutang, kartu piutang, tagihan, dan Pembayaran Piutang/Hutang Usaha bisa berjalan per faktur.
import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { normName, openingNumber, openingTotal, readOpeningTable, type OpeningKind, type OpeningRow } from "@/lib/erp/openingImport";
import { chunk, guard, insertMany, loadAccounts, runBatch, UserError, type DB } from "@/lib/erp/server";
import { isDate } from "@/lib/erp/util";
import { logActivity } from "@/lib/ops/activity";

type Contact = { id: string; name: string; note: string; kind: string };
export type OpeningGroup = { key: string; code: string; name: string; rows: number; total: number; contactId: string | null; matchedBy: "kode" | "nama" | null };
export type OpeningPreview = {
  kind: OpeningKind; asOf: string; errors: string[]; rows: (OpeningRow & { number: string; groupKey: string; exists: boolean })[];
  groups: OpeningGroup[]; contacts: { id: string; name: string }[]; total: number; glBalance: number; difference: number; existing: number;
};
type Payload = { kind: OpeningKind; asOf: string; fileName: string; table: unknown[][] };

const groupKey = (r: Pick<OpeningRow, "code" | "name">) => (r.code ? `kode:${r.code.toUpperCase()}` : `nama:${normName(r.name)}`);
const KIND_OK = (k: string): k is OpeningKind => k === "piutang" || k === "hutang";
const contactKinds = (kind: OpeningKind) => (kind === "piutang" ? ["pelanggan", "keduanya"] : ["pemasok", "keduanya"]);

/** Saldo akun Piutang Usaha (debit − kredit) / Hutang Usaha (kredit − debit) per tanggal posisi. */
async function glBalance(db: DB, kind: OpeningKind, asOf: string) {
  const acc = await loadAccounts(db);
  const id = acc.sys(kind === "piutang" ? "piutang" : "hutang");
  const r = await db.get<{ d: number; c: number }>(sql`select coalesce(sum(debit),0) d, coalesce(sum(credit),0) c from fin_journal_lines where account_id = ${id} and date <= ${asOf}`);
  const d = Number(r?.d ?? 0), c = Number(r?.c ?? 0);
  return Math.round(kind === "piutang" ? d - c : c - d);
}

async function build(db: DB, p: Payload, mapping: Record<string, string> = {}): Promise<OpeningPreview> {
  if (!KIND_OK(p.kind)) throw new UserError("Jenis impor tidak dikenal.");
  if (!isDate(p.asOf)) throw new UserError("Isi tanggal posisi saldo.");
  if (!Array.isArray(p.table) || p.table.length > 20000) throw new UserError("File kosong atau terlalu besar.");
  const { rows, errors } = readOpeningTable(p.table);
  const kinds = contactKinds(p.kind);
  const contacts = await db.all<Contact>(sql`select id, name, note, kind from fin_contacts where active = 1 order by name`);
  const pool = contacts.filter((c) => kinds.includes(c.kind));
  const byName = new Map<string, Contact>();
  for (const c of pool) if (!byName.has(normName(c.name))) byName.set(normName(c.name), c);
  const groups = new Map<string, OpeningGroup>();
  for (const r of rows) {
    const k = groupKey(r);
    const g = groups.get(k) ?? (() => {
      // Cocokkan: pilihan pengguna > kode Zahir tercatat di catatan kontak > nama sama (tanda baca diabaikan).
      const byCode = r.code ? pool.find((c) => new RegExp(`(^|[^A-Z0-9-])${r.code.toUpperCase().replace(/[-]/g, "\\-")}([^0-9]|$)`).test(c.note.toUpperCase())) : undefined;
      const byNm = byName.get(normName(r.name));
      const chosen = mapping[k];
      const contactId = chosen === "baru" ? null : chosen && contacts.some((c) => c.id === chosen) ? chosen : byCode?.id ?? byNm?.id ?? null;
      return { key: k, code: r.code, name: r.name, rows: 0, total: 0, contactId, matchedBy: chosen ? null : byCode ? ("kode" as const) : byNm ? ("nama" as const) : null };
    })();
    g.rows += 1;
    g.total += Math.round(r.balance);
    groups.set(k, g);
  }
  // Faktur yang sudah pernah diimpor (nomor Zahir + kontak sama) dilewati.
  const table = p.kind === "piutang" ? "fin_invoices" : "fin_bills";
  const existingRefs = new Set(
    (await db.all<{ ref: string; contact: string }>(sql`select ext_ref ref, contact_id contact from ${sql.raw(table)} where ext_ref is not null`)).map((x) => `${x.ref}|${x.contact}`),
  );
  const out = rows.map((r) => {
    const g = groups.get(groupKey(r))!;
    const number = openingNumber(r);
    return { ...r, number, groupKey: g.key, exists: Boolean(g.contactId && existingRefs.has(`${number}|${g.contactId}`)) };
  });
  const total = openingTotal(rows);
  const gl = await glBalance(db, p.kind, p.asOf);
  return {
    kind: p.kind, asOf: p.asOf, errors, rows: out, groups: [...groups.values()].sort((a, b) => a.name.localeCompare(b.name)),
    contacts: pool.map((c) => ({ id: c.id, name: c.name })), total, glBalance: gl, difference: total - gl, existing: out.filter((r) => r.exists).length,
  };
}

/** Uji coba: baca file, cocokkan pelanggan/pemasok, hitung selisih terhadap saldo akun. Tidak menyimpan apa pun. */
export async function previewOpening(p: Payload, mapping: Record<string, string> = {}): Promise<{ error: string } | OpeningPreview> {
  await requireModule("keuangan");
  return guard(async () => build(await getDb(), p, mapping));
}

/** Simpan sebagai satu batch. Selisih dengan saldo akun wajib disetujui dengan alasan (tercatat di jejak audit). */
export async function commitOpening(p: Payload & { mapping: Record<string, string>; acceptDiff: boolean; reason: string }): Promise<{ error: string } | { ok: string; batchId: string }> {
  const me = await requireModule("keuangan");
  const res = await guard(async () => {
    const db = await getDb();
    const pv = await build(db, p, p.mapping ?? {});
    if (pv.errors.length) throw new UserError(`Perbaiki file dulu: ${pv.errors[0]}${pv.errors.length > 1 ? ` (+${pv.errors.length - 1} lagi)` : ""}`);
    if (!pv.rows.length) throw new UserError("Tidak ada faktur terbuka di file.");
    const reason = String(p.reason ?? "").trim().slice(0, 500);
    if (pv.difference !== 0 && (!p.acceptDiff || reason.length < 10)) throw new UserError(`Total file selisih ${pv.difference.toLocaleString("id-ID")} dengan saldo akun. Centang "simpan dengan selisih" dan isi alasan (min. 10 huruf).`);
    const fresh = pv.rows.filter((r) => !r.exists);
    if (!fresh.length) throw new UserError("Semua faktur di file ini sudah pernah diimpor — tidak ada yang ditambahkan.");

    // Kontak baru untuk kelompok yang tidak cocok (atau dipilih "buat baru").
    const newContacts: (typeof schema.contacts.$inferInsert)[] = [];
    const contactOf = new Map<string, string>();
    for (const g of pv.groups) {
      if (g.contactId) { contactOf.set(g.key, g.contactId); continue; }
      const id = crypto.randomUUID();
      newContacts.push({ id, kind: p.kind === "piutang" ? "pelanggan" : "pemasok", name: g.name, note: g.code ? `Zahir ${g.code}` : "Dari impor saldo awal Zahir" });
      contactOf.set(g.key, id);
    }
    // Nomor faktur harus unik di aplikasi; bila bentrok dengan faktur lain, beri akhiran -SA.
    const table = p.kind === "piutang" ? schema.invoices : schema.bills;
    const numbers = fresh.map((r) => r.number);
    const taken = new Set<string>();
    for (const part of chunk(numbers)) for (const x of await db.select({ n: table.number }).from(table).where(inArray(table.number, part))) taken.add(x.n);
    const batchId = crypto.randomUUID();
    const note = `Saldo awal Zahir per ${p.asOf}${p.fileName ? ` (${p.fileName})` : ""}`;
    const docs = fresh.map((r) => {
      let number = r.number;
      if (taken.has(number)) number = `${number}-SA`;
      taken.add(number);
      const base = { id: crypto.randomUUID(), number, date: r.date, dueDate: r.dueDate < r.date ? r.date : r.dueDate, contactId: contactOf.get(r.groupKey)!, subtotal: 0, total: Math.round(r.balance), paid: 0, note, openingBatchId: batchId, extRef: r.number, createdBy: me.id };
      return p.kind === "hutang" ? { ...base, supplierRef: r.ref } : base;
    });
    const total = docs.reduce((s, d) => s + d.total, 0);
    await runBatch(db, [
      db.insert(schema.openingBatches).values({ id: batchId, kind: p.kind, asOf: p.asOf, fileName: String(p.fileName ?? "").slice(0, 200), rowCount: docs.length, total, glBalance: pv.glBalance, difference: pv.difference, reason, createdBy: me.id, createdByName: me.name }),
      ...insertMany(db, schema.contacts, newContacts),
      ...(p.kind === "piutang" ? insertMany(db, schema.invoices, docs) : insertMany(db, schema.bills, docs as (typeof schema.bills.$inferInsert)[])),
    ]);
    await logActivity(me, {
      action: `keuangan.impor_saldo_${p.kind}`, label: `Impor saldo awal ${p.kind} per faktur dari Zahir`,
      summary: `${docs.length} faktur · Rp ${total.toLocaleString("id-ID")} per ${p.asOf}${pv.difference ? ` · selisih ${pv.difference.toLocaleString("id-ID")} — alasan: ${reason}` : " · cocok dengan saldo akun"}`,
      details: { batchId, skipped: pv.existing, newContacts: newContacts.length, glBalance: pv.glBalance },
    });
    return { ok: `${docs.length} faktur saldo awal tersimpan${pv.existing ? `, ${pv.existing} dilewati karena sudah ada` : ""}${newContacts.length ? `, ${newContacts.length} kontak baru` : ""}.`, batchId };
  });
  revalidatePath(p.kind === "piutang" ? "/akuntansi/penjualan/impor-saldo-piutang" : "/akuntansi/pembelian/impor-saldo-hutang");
  return res;
}

/** Batalkan satu batch: hapus faktur saldo awalnya — ditolak bila sudah ada pembayaran / retur atas faktur batch itu. */
export async function cancelOpeningBatch(batchId: string): Promise<{ ok?: string; error?: string }> {
  const me = await requireModule("keuangan");
  const res = await guard(async () => {
    const db = await getDb();
    const b = await db.query.openingBatches.findFirst({ where: and(eq(schema.openingBatches.id, batchId), isNull(schema.openingBatches.cancelledAt)) });
    if (!b) throw new UserError("Batch tidak ditemukan atau sudah dibatalkan.");
    const used = b.kind === "piutang"
      ? await db.get<{ n: number }>(sql`select count(*) n from fin_invoices i where i.opening_batch_id = ${batchId} and (exists (select 1 from fin_receipt_allocations a where a.invoice_id = i.id) or exists (select 1 from fin_returns r where r.invoice_id = i.id))`)
      : await db.get<{ n: number }>(sql`select count(*) n from fin_bills b where b.opening_batch_id = ${batchId} and (exists (select 1 from fin_payment_allocations a where a.bill_id = b.id) or exists (select 1 from fin_returns r where r.bill_id = b.id))`);
    if (Number(used?.n ?? 0) > 0) throw new UserError(`${used?.n} faktur di batch ini sudah punya pembayaran/retur. Hapus pembayarannya dulu.`);
    await runBatch(db, [
      b.kind === "piutang" ? db.delete(schema.invoices).where(eq(schema.invoices.openingBatchId, batchId)) : db.delete(schema.bills).where(eq(schema.bills.openingBatchId, batchId)),
      db.update(schema.openingBatches).set({ cancelledAt: new Date(), cancelledByName: me.name, updatedAt: new Date() }).where(eq(schema.openingBatches.id, batchId)),
    ]);
    await logActivity(me, { action: `keuangan.batal_impor_saldo_${b.kind}`, label: `Membatalkan impor saldo awal ${b.kind}`, summary: `${b.rowCount} faktur · Rp ${b.total.toLocaleString("id-ID")} per ${b.asOf}` });
    return { ok: "Batch dibatalkan; faktur saldo awalnya dihapus." };
  });
  revalidatePath(res && "ok" in res ? "/akuntansi/penjualan/impor-saldo-piutang" : "/akuntansi");
  revalidatePath("/akuntansi/pembelian/impor-saldo-hutang");
  return res;
}
