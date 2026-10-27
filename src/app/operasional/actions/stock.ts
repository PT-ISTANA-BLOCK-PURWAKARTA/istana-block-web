"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, gt, inArray, isNotNull, isNull, or } from "drizzle-orm";
import type { FormState } from "@/components/admin/FormMessage";
import { getDb, schema } from "@/db";
import { productionCategories as PRODUCTION_CATEGORIES, productionMethods, type ProductionCategory, type ProductionMethod } from "@/db/erp";
import { requirePerm } from "@/lib/auth";
import { assertLive } from "@/lib/erp/archive";
import { stockItemsById } from "@/lib/erp/ops";
import {
  assertOpen,
  chunk,
  deleteJournalOps,
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
  stockLevels,
  unitCost,
  UserError,
  type JLine,
} from "@/lib/erp/server";
import { isDate, parseQty, parseRupiah } from "@/lib/erp/util";
import { deleteImage, saveImage, UploadError } from "@/lib/media";
import { logActivity } from "@/lib/ops/activity";
import { requireShift } from "@/lib/ops/duty";
import { batchPrefixFor, canChangeProduction, itemCategories, mixSuggestions, nextBatchCode, productionAccess } from "@/lib/ops/production";
import { CATEGORY_LABEL } from "@/components/ops/production/summary";
import { lineOfItem } from "@/lib/ops/production-lines";
import { deleteProductionOps, simpleProductionOps } from "@/lib/ops/production-post";

/* ============================================================ Hasil produksi */

/** Isian angka opsional (papan, reject, target, sak semen): kosong = null, selain itu 0..1.000.000. */
function optionalNumber(form: FormData, name: string, label: string) {
  const raw = String(form.get(name) ?? "").trim();
  if (!raw) return null;
  const n = parseQty(raw);
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) throw new UserError(`${label} tidak valid (0 sampai 1.000.000).`);
  return n;
}

/** Kendala dari input tersembunyi: maksimal 8 pilihan, tiap pilihan 2-40 huruf, tanpa duplikat. */
function parseIssues(v: FormDataEntryValue | null) {
  let arr: unknown[] = [];
  try {
    const x = JSON.parse(String(v ?? "[]"));
    arr = Array.isArray(x) ? x : [];
  } catch {
    arr = [];
  }
  const out: string[] = [];
  for (const x of arr) {
    const s = String(x ?? "").trim().replace(/\s+/g, " ");
    if (!s) continue;
    if (s.length < 2 || s.length > 40) throw new UserError("Kendala harus 2 sampai 40 huruf.");
    if (!out.includes(s)) out.push(s);
  }
  if (out.length > 8) throw new UserError("Pilih maksimal 8 kendala.");
  return out;
}

/**
 * Hasil produksi: bahan baku keluar (harga pokok rata-rata) + biaya produksi → barang jadi masuk.
 * Jurnal: Dr Persediaan barang jadi / Cr Persediaan bahan baku, Cr Biaya produksi (upah dll. yang diserap).
 * Bila biaya produksi dikosongkan, nilainya = harga pokok standar hasil − nilai bahan (minimal 0).
 *
 * Isian lapangan (F-IB-02): kategori, kode batch otomatis, ketua regu, target, sak semen, papan, reject, kendala, foto.
 * Baris hasil dengan qty 0 hanya dicatat (tidak memposting stok/jurnal); total hasil harus > 0 ATAU ada kendala.
 * Izin: stok (kantor/gudang) atau produksi_lapangan (mandor precast, QC paving). Akun satpam/mandor wajib sedang piket.
 */
export async function saveProduction(_prev: FormState, form: FormData): Promise<FormState> {
  const acc = await productionAccess();
  const me = acc.user;
  if (!acc.canEdit) return { error: "Akun Anda tidak boleh mencatat hasil produksi." };
  const t = { newKey: null as string | null, oldKey: null as string | null };
  let res;
  try {
    res = await guard(async () => {
      const db = await getDb();
      const id = String(form.get("id") ?? "");
      const existing = id ? await db.query.productions.findFirst({ where: eq(schema.productions.id, id) }) : undefined;
      if (id && !existing) throw new UserError("Catatan produksi tidak ditemukan.");
      assertLive(existing?.id, "Catatan produksi");
      if (existing && !canChangeProduction(acc, existing)) throw new UserError("Catatan ini hanya bisa diubah pembuatnya dalam 7 hari, atau oleh kantor.");
      if (!existing) await requireShift(me);

      const category = String(form.get("category") ?? "") as ProductionCategory;
      if (!PRODUCTION_CATEGORIES.includes(category)) throw new UserError("Pilih kategori produksi (precast atau paving).");
      if (!acc.categories.includes(category)) throw new UserError(`Akun Anda tidak boleh mencatat produksi ${CATEGORY_LABEL[category]}.`);

      const fin = await getFinSettings(db);
      const date = requireDate(form.get("date"));
      assertOpen(date, fin.lockDate, "Produksi");
      if (existing) assertOpen(existing.date, fin.lockDate, "Produksi");

      const parse = (key: string) =>
        parseRows(form.get(key))
          .map((r) => ({ itemId: String(r.itemId ?? ""), qty: parseQty(r.qty) }))
          .filter((l) => l.itemId || l.qty);
      const out = parse("hasil");
      const used = parse("bahan");
      const issues = parseIssues(form.get("issues"));
      const items = await stockItemsById(db, [...out, ...used].map((l) => l.itemId));
      for (const [label, rows] of [["Hasil", out], ["Bahan", used]] as const) {
        for (const [i, l] of rows.entries()) {
          const it = items.get(l.itemId);
          if (!it) throw new UserError(`${label} baris ${i + 1}: pilih barang.`);
          if (!isStockItem(it)) throw new UserError(`${label} baris ${i + 1}: "${it.name}" tidak dilacak stoknya.`);
          if (l.qty < 0 || l.qty > 1_000_000) throw new UserError(`${label} baris ${i + 1}: qty tidak valid.`);
          if (label === "Bahan" && l.qty <= 0) throw new UserError(`${label} baris ${i + 1}: qty harus lebih dari 0.`);
        }
      }
      // Barang hasil harus sesuai kategori yang dipilih (paving vs precast).
      const cats = await itemCategories(db, out.map((l) => items.get(l.itemId)!));
      for (const [i, l] of out.entries()) {
        if (cats.get(l.itemId) !== category) throw new UserError(`Hasil baris ${i + 1}: "${items.get(l.itemId)!.name}" bukan barang ${CATEGORY_LABEL[category]}.`);
      }
      const posOut = out.filter((l) => l.qty > 0);
      if (!posOut.length && !issues.length) throw new UserError("Isi jumlah hasil produksi (isi 0 bila produksi berhenti, lalu pilih kendalanya).");
      if (!posOut.length && used.length) throw new UserError("Bahan terpakai hanya bisa dicatat bersama hasil produksi lebih dari 0.");

      const boards = optionalNumber(form, "boards", "Papan");
      const rejects = optionalNumber(form, "rejects", "Reject");
      // Mutu: qty hasil = Grade A (menambah stok); Grade B (masih dijual) & reject hanya dicatat.
      const gradeB = optionalNumber(form, "gradeB", "Grade B");
      const hasBuis = out.some((l) => lineOfItem(items.get(l.itemId)!) === "buis");
      const methodRaw = String(form.get("method") ?? "");
      const method = hasBuis && (productionMethods as readonly string[]).includes(methodRaw) ? (methodRaw as ProductionMethod) : null;
      if (hasBuis && !method) throw new UserError("Pilih metode Buis Beton: Tumbuk, Cor, atau Tulangan.");
      const cementKg = category === "paving" ? optionalNumber(form, "cementKg", "Semen curah (kg)") : null;
      // Nilai mutu berubah = TTD ketidaksesuaian (Manager lalu Pimpinan) harus diulang.
      let resetSign = false;
      if (existing) {
        const old = await db.select({ qty: schema.productionLines.qty }).from(schema.productionLines).where(and(eq(schema.productionLines.productionId, existing.id), eq(schema.productionLines.role, "hasil")));
        resetSign = (existing.gradeB ?? null) !== gradeB || (existing.rejects ?? null) !== rejects || old.reduce((a, l) => a + l.qty, 0) !== out.reduce((a, l) => a + l.qty, 0);
      }
      const target = optionalNumber(form, "target", "Target");
      const cementBags = optionalNumber(form, "cementBags", "Semen terpakai");
      const leader = String(form.get("leader") ?? "").trim().replace(/\s+/g, " ").slice(0, 60) || null;
      const typedBatch = String(form.get("batchCode") ?? "").trim().toUpperCase();
      if (typedBatch && !/^[A-Z0-9][A-Z0-9-]{1,29}$/.test(typedBatch)) throw new UserError("Kode batch hanya boleh huruf, angka, dan tanda minus (maks 30).");
      const note = String(form.get("note") ?? "").trim().slice(0, 1000);

      const prodId = existing?.id ?? crypto.randomUUID();
      const levels = await stockLevels(db, undefined, prodId);
      const usedValues = used.map((l) => Math.round(l.qty * unitCost(levels.get(l.itemId), items.get(l.itemId)!)));
      const materials = usedValues.reduce((a, v) => a + v, 0);
      const standard = posOut.reduce((a, l) => a + Math.round(l.qty * items.get(l.itemId)!.buyPrice), 0);
      // Kolom biaya hanya tampil untuk staf keuangan; bila tidak dikirim saat mengubah, pakai nilai lama (bila ada).
      // Akun tanpa izin keuangan/stok tidak boleh menentukan biaya: isian laborCost dari form diabaikan (nilai lama / aturan default).
      const mayEditCost = acc.canFinance || acc.hasStok;
      const laborField = mayEditCost ? form.get("laborCost") : null;
      const laborRaw = String(laborField ?? "").trim();
      const labor = !posOut.length
        ? 0
        : laborField === null && existing && (existing.laborCost > 0 || !mayEditCost)
          ? existing.laborCost
          : laborRaw
            ? parseRupiah(laborRaw)
            : Math.max(0, standard - materials);
      if (labor < 0) throw new UserError("Biaya produksi tidak boleh negatif.");
      const total = materials + labor;

      // Bagi nilai ke hasil menurut harga pokok standar (atau qty bila standar kosong); sisa pembulatan ke baris terakhir.
      const weights = posOut.map((l) => l.qty * (standard > 0 ? items.get(l.itemId)!.buyPrice : 1));
      const wsum = weights.reduce((a, w) => a + w, 0) || 1;
      const outValues = posOut.map((_, i) => Math.round((total * weights[i]) / wsum));
      if (outValues.length) outValues[outValues.length - 1] += total - outValues.reduce((a, v) => a + v, 0);

      const number = existing?.number ?? (await nextNumber(db, "PRD", date));
      const firstName = items.get(out.find((l) => l.itemId)?.itemId ?? "")?.name;
      const batchCode = typedBatch || existing?.batchCode || (await nextBatchCode(db, batchPrefixFor(category, firstName), date));
      const acct = await loadAccounts(db);
      const jl: JLine[] = [
        ...posOut.map((l, i) => ({ accountId: inventoryAccount(acct, items.get(l.itemId)!), debit: outValues[i], memo: items.get(l.itemId)!.name })),
        ...used.map((l, i) => ({ accountId: inventoryAccount(acct, items.get(l.itemId)!), credit: usedValues[i], memo: items.get(l.itemId)!.name })),
        { accountId: acct.sys("upah_produksi"), credit: labor, memo: "Biaya produksi diserap ke persediaan" },
      ];
      const moves = [
        ...posOut.map((l, i) => ({ itemId: l.itemId, date, qty: l.qty, value: outValues[i], source: "produksi" as const, sourceId: prodId, note: number })),
        ...used.map((l, i) => ({ itemId: l.itemId, date, qty: -l.qty, value: -usedValues[i], source: "produksi" as const, sourceId: prodId, note: number })),
      ];

      // Foto diunggah terakhir (setelah semua validasi); bila batch gagal, dibersihkan di bawah.
      try {
        t.newKey = await saveImage(form.get("proof"), "produksi");
      } catch (e) {
        if (e instanceof UploadError) throw new UserError(e.message);
        throw e;
      }
      if (t.newKey && existing?.photoKey) t.oldKey = existing.photoKey;

      const header = {
        number,
        date,
        laborCost: labor,
        note,
        category,
        batchCode,
        leader,
        target,
        cementBags,
        boards: category === "paving" ? boards : null,
        rejects,
        gradeB,
        method,
        cementKg,
        issues,
        photoKey: t.newKey ?? existing?.photoKey ?? null,
        ...(resetSign ? { rejectManagerBy: null, rejectManagerAt: null, rejectLeaderBy: null, rejectLeaderAt: null } : {}),
        updatedAt: new Date(),
      };
      await runBatch(db, [
        existing
          ? [
              db.update(schema.productions).set(header).where(eq(schema.productions.id, prodId)),
              db.delete(schema.productionLines).where(eq(schema.productionLines.productionId, prodId)),
              db.delete(schema.stockMoves).where(and(eq(schema.stockMoves.source, "produksi"), eq(schema.stockMoves.sourceId, prodId))),
              ...deleteJournalOps(db, "produksi", prodId),
            ]
          : db.insert(schema.productions).values({ id: prodId, ...header, createdBy: me.id }),
        ...insertMany(db, schema.productionLines, [...out.map((l) => ({ ...l, role: "hasil" as const, productionId: prodId })), ...used.map((l) => ({ ...l, role: "bahan" as const, productionId: prodId }))]),
        ...insertMany(db, schema.stockMoves, moves),
        ...journalOps(db, { number, date, memo: `Hasil produksi ${number}${note ? ` · ${note.slice(0, 80)}` : ""}`, source: "produksi", sourceId: prodId, createdBy: me.id, lines: jl }),
      ]);
      return { id: prodId, number, batchCode, edited: !!existing, issues: issues.length, qty: out.reduce((a, l) => a + l.qty, 0) };
    });
  } catch (e) {
    await deleteImage(t.newKey).catch(() => {});
    throw e;
  }
  if ("error" in res) {
    await deleteImage(t.newKey).catch(() => {});
    return res;
  }
  await deleteImage(t.oldKey).catch(() => {});
  await logActivity(me, {
    action: res.edited ? "produksi.ubah" : "produksi.simpan",
    label: res.edited ? "Mengubah hasil produksi" : "Menyimpan hasil produksi",
    summary: `${res.number} · batch ${res.batchCode} · ${res.issues ? `${res.issues} kendala` : `${res.qty} hasil`}`,
  });
  redirect(`/operasional/produksi/${res.id}?ok=${encodeURIComponent(`~${res.number} tersimpan · kode batch ${res.batchCode}.`)}`);
}

export async function deleteProduction(id: string): Promise<FormState> {
  const acc = await productionAccess();
  if (!acc.canEdit) return { error: "Akun Anda tidak boleh menghapus hasil produksi." };
  const res = await guard(async () => {
    const db = await getDb();
    const p = await db.query.productions.findFirst({ where: eq(schema.productions.id, id) });
    if (!p) return { ok: "" };
    assertLive(p.id, "Catatan produksi");
    if (!canChangeProduction(acc, p)) throw new UserError("Catatan ini hanya bisa dihapus pembuatnya dalam 7 hari, atau oleh kantor.");
    const fin = await getFinSettings(db);
    assertOpen(p.date, fin.lockDate, "Produksi");
    await runBatch(db, [
      db.delete(schema.productionLines).where(eq(schema.productionLines.productionId, id)),
      db.delete(schema.stockMoves).where(and(eq(schema.stockMoves.source, "produksi"), eq(schema.stockMoves.sourceId, id))),
      ...deleteJournalOps(db, "produksi", id),
      db.delete(schema.productions).where(eq(schema.productions.id, id)),
    ]);
    // Adukan cor yang tidak punya produk lagi ikut dihapus.
    if (p.batchId) {
      const left = await db.select({ id: schema.productions.id }).from(schema.productions).where(eq(schema.productions.batchId, p.batchId)).limit(1);
      if (!left.length) await db.delete(schema.productionBatches).where(eq(schema.productionBatches.id, p.batchId));
    }
    await deleteImage(p.photoKey).catch(() => {});
    await logActivity(acc.user, { action: "produksi.hapus", label: "Menghapus hasil produksi", summary: `${p.number}${p.batchCode ? ` · batch ${p.batchCode}` : ""}` });
    return { ok: "deleted" };
  });
  if ("error" in res) return res;
  redirect(`/operasional/produksi?ok=${encodeURIComponent("~Hasil produksi dihapus.")}`);
}

/**
 * Tombol "Isi dari catatan mix desain" (form paving): agregasi catatan mix lapisan badan pada tanggal itu
 * per produk (papan, m², reject), dicocokkan ke barang jadi. Hanya membaca; formulir yang mengisi sendiri.
 */
export async function fillProductionFromMix(date: string) {
  const acc = await productionAccess();
  if (!acc.categories.includes("paving")) return { error: "Akun Anda tidak boleh mencatat produksi paving." };
  if (!isDate(date)) return { error: "Tanggal tidak valid." };
  const products = await mixSuggestions(await getDb(), date);
  if (!products.length) return { error: "Belum ada catatan mix desain (lapisan badan) pada tanggal ini." };
  return { products };
}

/* ============================================================ Adukan cor bersama */

/**
 * "Input adukan cor": satu adukan semen untuk beberapa produk precast (Buis cor/tulangan, U-Ditch, Kanstin, ...).
 * Semen dicatat SEKALI di inv_production_batches; tiap produk = satu dokumen produksi ber-batch_id dengan
 * cement_bags kosong (rasio sak/buah dihitung dari adukan). Hasil = Grade A (memposting stok); Grade B & reject hanya dicatat.
 * Payload `items` (JSON): [{ docId?, itemId, qty, gradeB, rejects, target, method }]; dokumen adukan yang tidak ada di payload dihapus.
 */
export async function saveBatch(_prev: FormState, form: FormData): Promise<FormState> {
  const acc = await productionAccess();
  const me = acc.user;
  if (!acc.categories.includes("precast")) return { error: "Akun Anda tidak boleh mencatat produksi precast." };
  const res = await guard(async () => {
    const db = await getDb();
    const batchId = String(form.get("id") ?? "");
    const batch = batchId ? await db.query.productionBatches.findFirst({ where: eq(schema.productionBatches.id, batchId) }) : undefined;
    if (batchId && !batch) throw new UserError("Adukan tidak ditemukan.");
    const oldDocs = batch ? await db.select().from(schema.productions).where(eq(schema.productions.batchId, batch.id)) : [];
    for (const d of oldDocs) if (!canChangeProduction(acc, d)) throw new UserError("Adukan ini hanya bisa diubah pembuatnya dalam 7 hari, atau oleh kantor.");
    if (!batch) await requireShift(me);

    const fin = await getFinSettings(db);
    const date = requireDate(form.get("date"));
    assertOpen(date, fin.lockDate, "Produksi");
    if (batch) assertOpen(batch.date, fin.lockDate, "Produksi");
    const cementBags = optionalNumber(form, "cementBags", "Semen terpakai");
    if (!cementBags) throw new UserError("Isi semen terpakai (sak) untuk adukan ini.");
    const leader = String(form.get("leader") ?? "").trim().replace(/\s+/g, " ").slice(0, 60) || null;
    const note = String(form.get("note") ?? "").trim().slice(0, 1000);

    const rows = parseRows(form.get("items"))
      .map((r) => ({
        docId: String(r.docId ?? ""),
        itemId: String(r.itemId ?? ""),
        qty: parseQty(r.qty),
        gradeB: r.gradeB === "" || r.gradeB == null ? null : parseQty(r.gradeB),
        rejects: r.rejects === "" || r.rejects == null ? null : parseQty(r.rejects),
        target: r.target === "" || r.target == null ? null : parseQty(r.target),
        method: String(r.method ?? ""),
      }))
      .filter((r) => r.itemId || r.qty || r.target);
    if (!rows.length) throw new UserError("Isi minimal satu produk adukan.");
    const items = await stockItemsById(db, rows.map((r) => r.itemId));
    const cats = await itemCategories(db, rows.map((r) => items.get(r.itemId)).filter((x): x is NonNullable<typeof x> => !!x));
    const seen = new Set<string>();
    for (const [i, r] of rows.entries()) {
      const it = items.get(r.itemId);
      if (!it) throw new UserError(`Produk baris ${i + 1}: pilih barang.`);
      if (!isStockItem(it) || it.kind !== "barang_jadi") throw new UserError(`Produk baris ${i + 1}: "${it.name}" bukan barang jadi yang dilacak stoknya.`);
      if (cats.get(it.id) !== "precast") throw new UserError(`Produk baris ${i + 1}: "${it.name}" bukan barang precast.`);
      if (seen.has(it.id)) throw new UserError(`"${it.name}" terisi dua kali; gabungkan jumlahnya.`);
      seen.add(it.id);
      for (const [label, v] of [["Jadi", r.qty], ["Grade B", r.gradeB], ["Reject", r.rejects], ["Target", r.target]] as const) {
        if (v != null && (!Number.isFinite(v) || v < 0 || v > 1_000_000)) throw new UserError(`Produk baris ${i + 1}: ${label} tidak valid.`);
      }
      if (lineOfItem(it) === "buis" && !(productionMethods as readonly string[]).includes(r.method)) throw new UserError(`Produk baris ${i + 1}: pilih metode Buis Beton (Tumbuk, Cor, atau Tulangan).`);
      if (r.docId && !oldDocs.some((d) => d.id === r.docId)) throw new UserError(`Produk baris ${i + 1}: dokumen bukan bagian adukan ini.`);
    }
    if (!rows.some((r) => r.qty > 0)) throw new UserError("Isi jumlah jadi minimal satu produk.");

    const acct = await loadAccounts(db);
    const bid = batch?.id ?? crypto.randomUUID();
    const ops: Parameters<typeof runBatch>[1] = [
      batch
        ? db.update(schema.productionBatches).set({ date, cementBags, leader, note, updatedAt: new Date() }).where(eq(schema.productionBatches.id, bid))
        : db.insert(schema.productionBatches).values({ id: bid, date, cementBags, leader, note, createdBy: me.id }),
    ];
    for (const r of rows) {
      const existing = r.docId ? oldDocs.find((d) => d.id === r.docId) : undefined;
      const oldLines = existing ? await db.select({ qty: schema.productionLines.qty }).from(schema.productionLines).where(eq(schema.productionLines.productionId, existing.id)) : [];
      const resetSign = !!existing && ((existing.gradeB ?? null) !== r.gradeB || (existing.rejects ?? null) !== r.rejects || oldLines.reduce((a, l) => a + l.qty, 0) !== r.qty);
      const it = items.get(r.itemId)!;
      const p = await simpleProductionOps(db, acct, {
        existing,
        date,
        category: "precast",
        lines: [{ itemId: r.itemId, qty: r.qty }],
        items,
        gradeB: r.gradeB,
        rejects: r.rejects,
        target: r.target,
        leader,
        note,
        method: lineOfItem(it) === "buis" ? (r.method as ProductionMethod) : null,
        batchId: bid,
        resetSign,
        createdBy: existing?.createdBy ?? me.id,
      });
      ops.push(...p.ops);
    }
    const keep = new Set(rows.map((r) => r.docId).filter(Boolean));
    for (const d of oldDocs) if (!keep.has(d.id)) ops.push(...deleteProductionOps(db, d.id));
    await runBatch(db, ops);
    return { edited: !!batch, count: rows.length, bags: cementBags };
  });
  if ("error" in res) return res;
  await logActivity(me, { action: res.edited ? "produksi.adukan_ubah" : "produksi.adukan", label: res.edited ? "Mengubah adukan cor" : "Menyimpan adukan cor", summary: `${res.bags} sak · ${res.count} produk` });
  redirect(`/operasional/produksi?ok=${encodeURIComponent("~Adukan cor tersimpan.")}`);
}

export async function deleteBatch(id: string): Promise<FormState> {
  const acc = await productionAccess();
  if (!acc.categories.includes("precast")) return { error: "Akun Anda tidak boleh menghapus produksi precast." };
  const res = await guard(async () => {
    const db = await getDb();
    const b = await db.query.productionBatches.findFirst({ where: eq(schema.productionBatches.id, id) });
    if (!b) return { ok: "" };
    const docs = await db.select().from(schema.productions).where(eq(schema.productions.batchId, id));
    for (const d of docs) if (!canChangeProduction(acc, d)) throw new UserError("Adukan ini hanya bisa dihapus pembuatnya dalam 7 hari, atau oleh kantor.");
    const fin = await getFinSettings(db);
    assertOpen(b.date, fin.lockDate, "Produksi");
    await runBatch(db, [...docs.flatMap((d) => deleteProductionOps(db, d.id)), db.delete(schema.productionBatches).where(eq(schema.productionBatches.id, id))]);
    await logActivity(acc.user, { action: "produksi.adukan_hapus", label: "Menghapus adukan cor", summary: `${b.date} · ${b.cementBags} sak · ${docs.length} produk` });
    return { ok: "deleted" };
  });
  if ("error" in res) return res;
  redirect(`/operasional/produksi?ok=${encodeURIComponent("~Adukan cor dihapus.")}`);
}

/* ============================================================ TTD ketidaksesuaian produksi */

function idList(ids: unknown) {
  const list = [...new Set((Array.isArray(ids) ? ids : []).map(String))];
  if (!list.length) throw new UserError("Tidak ada ketidaksesuaian yang dipilih.");
  if (list.length > 200) throw new UserError("Maksimal 200 ketidaksesuaian sekali tanda tangan.");
  return list;
}

/** TTD Manager in charge (setujui_qc): hanya dokumen ber-Grade B/reject yang belum ditandatangani. */
export async function ackRejectManager(ids: string[]): Promise<FormState> {
  const me = await requirePerm("setujui_qc");
  const res = await guard(async () => {
    const list = idList(ids);
    const db = await getDb();
    const p = schema.productions;
    let n = 0;
    for (const part of chunk(list, 80)) {
      const rows = await db.select({ id: p.id }).from(p).where(and(inArray(p.id, part), or(gt(p.gradeB, 0), gt(p.rejects, 0)), isNull(p.rejectManagerBy)));
      if (!rows.length) continue;
      n += rows.length;
      await db.update(p).set({ rejectManagerBy: me.id, rejectManagerAt: new Date() }).where(inArray(p.id, rows.map((r) => r.id)));
    }
    if (!n) throw new UserError("Tidak ada ketidaksesuaian yang bisa ditandatangani (sudah ditandatangani atau tanpa Grade B / reject).");
    await logActivity(me, { action: "produksi.ttd_manager", label: "TTD ketidaksesuaian produksi (Manager in charge)", summary: `${n} dokumen` });
    return { ok: `${n} ketidaksesuaian ditandatangani.` };
  });
  if (!("error" in res)) revalidatePath("/operasional/produksi");
  return res;
}

/** TTD Pimpinan (ttd_pimpinan): setelah Manager in charge. */
export async function ackRejectLeader(ids: string[]): Promise<FormState> {
  const me = await requirePerm("ttd_pimpinan");
  const res = await guard(async () => {
    const list = idList(ids);
    const db = await getDb();
    const p = schema.productions;
    let n = 0;
    for (const part of chunk(list, 80)) {
      const rows = await db.select({ id: p.id }).from(p).where(and(inArray(p.id, part), or(gt(p.gradeB, 0), gt(p.rejects, 0)), isNotNull(p.rejectManagerBy), isNull(p.rejectLeaderBy)));
      if (!rows.length) continue;
      n += rows.length;
      await db.update(p).set({ rejectLeaderBy: me.id, rejectLeaderAt: new Date() }).where(inArray(p.id, rows.map((r) => r.id)));
    }
    if (!n) throw new UserError("Tidak ada ketidaksesuaian yang bisa disetujui (Manager in charge belum menandatangani, atau sudah disetujui).");
    await logActivity(me, { action: "produksi.ttd_pimpinan", label: "TTD ketidaksesuaian produksi (Pimpinan)", summary: `${n} dokumen` });
    return { ok: `${n} ketidaksesuaian ditandatangani.` };
  });
  if (!("error" in res)) revalidatePath("/operasional/produksi");
  return res;
}

/* ============================================================ Penyesuaian & saldo awal stok */

const ADJ_SOURCES = ["penyesuaian", "saldo_awal"] as const;

/**
 * Penyesuaian stok (hasil stok opname, rusak, dll.) atau saldo awal stok.
 * Tambah: Dr Persediaan / Cr Selisih persediaan (atau Saldo awal). Kurang: kebalikannya, dinilai harga pokok rata-rata.
 */
export async function saveAdjustment(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("stok");
  const res = await guard(async () => {
    const db = await getDb();
    const id = String(form.get("id") ?? "");
    const existing = id ? await db.query.adjustments.findFirst({ where: eq(schema.adjustments.id, id) }) : undefined;
    if (id && !existing) throw new UserError("Penyesuaian tidak ditemukan.");
    if (existing?.countId) throw new UserError("Penyesuaian ini bagian dari stok opname. Ubah atau hapus lewat dokumen stok opname-nya.");
    const fin = await getFinSettings(db);
    const date = requireDate(form.get("date"));
    assertOpen(date, fin.lockDate, "Penyesuaian stok");
    if (existing) assertOpen(existing.date, fin.lockDate, "Penyesuaian stok");
    const item = (await stockItemsById(db, [String(form.get("itemId") ?? "")])).values().next().value;
    if (!item) throw new UserError("Pilih barang.");
    if (!isStockItem(item)) throw new UserError(`"${item.name}" tidak dilacak stoknya. Aktifkan "lacak stok" di data barang.`);
    const dir = String(form.get("direction") ?? "tambah");
    const amount = parseQty(form.get("qty"));
    if (amount <= 0) throw new UserError("Qty harus lebih dari 0.");
    const opening = form.get("opening") === "on";
    if (opening && dir !== "tambah") throw new UserError("Saldo awal stok selalu berupa penambahan.");
    const qty = dir === "kurang" ? -amount : amount;
    const reason = String(form.get("reason") ?? "").trim().slice(0, 300);
    if (!reason && !opening) throw new UserError("Tulis alasan penyesuaian (mis. hasil stok opname, barang rusak).");

    const adjId = existing?.id ?? crypto.randomUUID();
    const levels = await stockLevels(db, undefined, adjId);
    const avg = unitCost(levels.get(item.id), item);
    // Kolom nilai hanya tampil untuk staf keuangan; bila tidak dikirim saat mengubah, pakai nilai lama.
    const costField = form.get("unitCost");
    const typed = costField === null && existing && existing.qty > 0 ? existing.unitCost : parseRupiah(costField);
    const cost = qty > 0 ? typed || Math.round(avg) : Math.round(avg);
    const value = Math.round(qty * cost);
    const number = existing?.number ?? (await nextNumber(db, "ADJ", date));
    const acc = await loadAccounts(db);
    const inv = inventoryAccount(acc, item);
    const other = opening ? acc.sys("saldo_awal") : acc.sys("selisih_persediaan");
    const memo = `${opening ? "Saldo awal stok" : "Penyesuaian stok"} ${item.name}${reason ? ` · ${reason}` : ""}`;
    const jl: JLine[] = value >= 0 ? [{ accountId: inv, debit: value, memo }, { accountId: other, credit: value, memo }] : [{ accountId: other, debit: -value, memo }, { accountId: inv, credit: -value, memo }];
    const header = { number, date, itemId: item.id, qty, unitCost: cost, reason: opening ? reason || "Saldo awal" : reason, updatedAt: new Date() };
    await runBatch(db, [
      existing
        ? [
            db.update(schema.adjustments).set(header).where(eq(schema.adjustments.id, adjId)),
            db.delete(schema.stockMoves).where(and(inArray(schema.stockMoves.source, [...ADJ_SOURCES]), eq(schema.stockMoves.sourceId, adjId))),
            ...deleteJournalOps(db, "penyesuaian", adjId),
          ]
        : db.insert(schema.adjustments).values({ id: adjId, ...header, createdBy: me.id }),
      db.insert(schema.stockMoves).values({ itemId: item.id, date, qty, value, source: opening ? "saldo_awal" : "penyesuaian", sourceId: adjId, note: number }),
      ...journalOps(db, { number, date, memo, source: "penyesuaian", sourceId: adjId, createdBy: me.id, lines: jl }),
    ]);
    return { id: adjId, number };
  });
  if ("error" in res) return res;
  redirect(`/operasional/stok/penyesuaian/${res.id}?ok=${encodeURIComponent(res.number)}`);
}

export async function deleteAdjustment(id: string): Promise<FormState> {
  await requirePerm("stok");
  const res = await guard(async () => {
    const db = await getDb();
    const a = await db.query.adjustments.findFirst({ where: eq(schema.adjustments.id, id) });
    if (!a) return { ok: "" };
    if (a.countId) throw new UserError("Penyesuaian ini bagian dari stok opname. Hapus lewat dokumen stok opname-nya.");
    const fin = await getFinSettings(db);
    assertOpen(a.date, fin.lockDate, "Penyesuaian stok");
    await runBatch(db, [
      db.delete(schema.stockMoves).where(and(inArray(schema.stockMoves.source, [...ADJ_SOURCES]), eq(schema.stockMoves.sourceId, id))),
      ...deleteJournalOps(db, "penyesuaian", id),
      db.delete(schema.adjustments).where(eq(schema.adjustments.id, id)),
    ]);
    return { ok: "deleted" };
  });
  if ("error" in res) return res;
  redirect("/operasional/stok/penyesuaian?ok=dihapus");
}
