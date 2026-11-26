"use server";

// Harta tetap: simpan/hapus/lepas aset, bukukan & batalkan penyusutan bulanan, dan buat daftar awal dari saldo rekening (Zahir).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import type { FormState } from "@/components/admin/FormMessage";
import { getDb, schema } from "@/db";
import { assetCategories, depreciationMethods, type AssetCategory, type DepreciationMethod } from "@/db/erp";
import { requireModule } from "@/lib/auth";
import { CATEGORY_CODES, CATEGORY_LABEL, monthEnd, planDepreciation, ym } from "@/lib/erp/assets";
import { assertOpen, chunk, deleteJournalOps, getFinSettings, guard, journalOps, loadAccounts, nextNumber, runBatch, UserError, type JLine } from "@/lib/erp/server";
import { isDate, parseRupiah } from "@/lib/erp/util";

const BASE = "/akuntansi/harta-tetap";
type Res = { ok?: string; error?: string };
const isPeriod = (p: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(p);

export async function saveAsset(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireModule("keuangan");
  const db = await getDb();
  const id = String(form.get("id") ?? "");
  const s = (k: string) => String(form.get(k) ?? "").trim();
  const code = s("code"), name = s("name");
  const category = s("category") as AssetCategory;
  const method = s("method") as DepreciationMethod;
  if (!code || !name) return { error: "Isi kode dan nama aset." };
  if (!assetCategories.includes(category)) return { error: "Pilih kelompok aset." };
  if (!depreciationMethods.includes(method)) return { error: "Pilih metode penyusutan." };
  const acquiredDate = s("acquiredDate");
  if (!isDate(acquiredDate)) return { error: "Isi tanggal perolehan." };
  const startMonth = s("startMonth") || ym(acquiredDate);
  if (!isPeriod(startMonth)) return { error: "Bulan mulai penyusutan tidak valid." };
  const cost = parseRupiah(s("cost"));
  if (!(cost > 0)) return { error: "Isi harga perolehan." };
  const salvage = parseRupiah(s("salvage")) || 0;
  const years = Number(s("lifeYears").replace(",", ".")) || 0;
  const lifeMonths = Math.round(years * 12) + (Number(s("lifeExtraMonths")) || 0);
  if (method !== "tidak_disusutkan" && category !== "tanah" && lifeMonths <= 0) return { error: "Isi umur ekonomis (tahun)." };
  if (salvage >= cost) return { error: "Nilai sisa harus lebih kecil dari harga perolehan." };
  const openingAccum = parseRupiah(s("openingAccum")) || 0;
  const openingDate = s("openingDate");
  if (openingAccum && !isDate(openingDate)) return { error: "Isi tanggal akumulasi awal." };
  if (openingAccum > cost - salvage) return { error: "Akumulasi awal melebihi nilai yang bisa disusutkan." };
  const acc = await loadAccounts(db);
  const assetAccountId = s("assetAccountId"), accumAccountId = s("accumAccountId") || null, expenseAccountId = s("expenseAccountId") || null;
  if (acc.byId.get(assetAccountId)?.group !== "aset_tetap") return { error: "Rekening aset harus golongan Aset tetap." };
  if (method !== "tidak_disusutkan" && category !== "tanah") {
    if (!accumAccountId || acc.byId.get(accumAccountId)?.group !== "akum_penyusutan") return { error: "Pilih rekening akumulasi penyusutan." };
    if (!expenseAccountId) return { error: "Pilih rekening beban penyusutan." };
  }
  const clash = await db.get<{ id: string }>(sql`select id from fin_fixed_assets where code = ${code} and id <> ${id}`);
  if (clash) return { error: `Kode ${code} sudah dipakai aset lain.` };
  const values = {
    code, name, category, method, assetAccountId, accumAccountId, expenseAccountId, acquiredDate, startDate: `${startMonth}-01`, cost, salvage, lifeMonths,
    openingAccum, openingDate: openingAccum ? openingDate : null, location: s("location"), note: s("note"), updatedAt: new Date(),
  };
  if (id) {
    const posted = await db.get<{ n: number }>(sql`select count(*) n from fin_depreciation_lines where asset_id = ${id}`);
    const old = await db.query.fixedAssets.findFirst({ where: eq(schema.fixedAssets.id, id) });
    if (!old) return { error: "Aset tidak ditemukan." };
    if (Number(posted?.n ?? 0) > 0 && (old.cost !== cost || old.openingAccum !== openingAccum)) return { error: "Harga perolehan / akumulasi awal tidak bisa diubah setelah ada penyusutan yang dibukukan. Batalkan penyusutannya dulu." };
    await db.update(schema.fixedAssets).set(values).where(eq(schema.fixedAssets.id, id));
  } else await db.insert(schema.fixedAssets).values({ ...values, createdBy: me.id });
  redirect(`${BASE}?ok=${encodeURIComponent(`${code} ${name}`)}`);
}

export async function deleteAsset(id: string): Promise<Res> {
  await requireModule("keuangan");
  const res = await guard(async () => {
    const db = await getDb();
    const posted = await db.get<{ n: number }>(sql`select count(*) n from fin_depreciation_lines where asset_id = ${id}`);
    if (Number(posted?.n ?? 0) > 0) throw new UserError("Aset sudah punya penyusutan yang dibukukan. Tandai dijual/dihapus saja.");
    await db.delete(schema.fixedAssets).where(eq(schema.fixedAssets.id, id));
    return { ok: "Aset dihapus." };
  });
  revalidatePath(BASE);
  return res;
}

export async function disposeAsset(id: string, date: string, note: string): Promise<Res> {
  await requireModule("keuangan");
  const res = await guard(async () => {
    if (date && !isDate(date)) throw new UserError("Tanggal tidak valid.");
    const db = await getDb();
    await db.update(schema.fixedAssets).set({ disposedDate: date || null, disposalNote: date ? note.slice(0, 300) : "", updatedAt: new Date() }).where(eq(schema.fixedAssets.id, id));
    return { ok: date ? "Aset ditandai dijual/dihapus. Catat penjualannya lewat Jurnal Umum bila ada." : "Status aset dikembalikan aktif." };
  });
  revalidatePath(BASE);
  return res;
}

/** Bukukan penyusutan satu bulan untuk semua aset yang belum disusutkan di bulan itu. */
export async function postDepreciation(period: string): Promise<Res> {
  const me = await requireModule("keuangan");
  const res = await guard(async () => {
    if (!isPeriod(period)) throw new UserError("Pilih bulan.");
    const db = await getDb();
    const date = monthEnd(period);
    const fin = await getFinSettings(db);
    assertOpen(date, fin.lockDate, "Penyusutan");
    const plan = await planDepreciation(db, period);
    if (!plan.length) throw new UserError("Tidak ada aset yang perlu disusutkan di bulan ini (sudah dibukukan, belum mulai, atau sudah habis).");
    const journalId = crypto.randomUUID();
    const number = await nextNumber(db, "PNY", date);
    const lines: JLine[] = [];
    for (const p of plan) {
      lines.push({ accountId: p.asset.expenseAccountId!, debit: p.amount, memo: `${p.asset.code} ${p.asset.name}` });
      lines.push({ accountId: p.asset.accumAccountId!, credit: p.amount, memo: `${p.asset.code} ${p.asset.name}` });
    }
    const total = plan.reduce((s, p) => s + p.amount, 0);
    await runBatch(db, [
      ...journalOps(db, { id: journalId, number, date, memo: `Penyusutan harta tetap ${period}`, source: "penyusutan", sourceId: period, createdBy: me.id, lines }),
      ...plan.map((p) => db.insert(schema.depreciationLines).values({ period, assetId: p.asset.id, journalId, amount: p.amount })),
    ]);
    return { ok: `${number}: penyusutan ${plan.length} aset, total Rp${total.toLocaleString("id-ID")}.` };
  });
  revalidatePath(BASE);
  revalidatePath(`${BASE}/penyusutan`);
  return res;
}

export async function undoDepreciation(period: string): Promise<Res> {
  await requireModule("keuangan");
  const res = await guard(async () => {
    if (!isPeriod(period)) throw new UserError("Pilih bulan.");
    const db = await getDb();
    const fin = await getFinSettings(db);
    assertOpen(monthEnd(period), fin.lockDate, "Penyusutan");
    await runBatch(db, [db.delete(schema.depreciationLines).where(eq(schema.depreciationLines.period, period)), ...deleteJournalOps(db, "penyusutan", period)]);
    return { ok: `Penyusutan ${period} dibatalkan.` };
  });
  revalidatePath(BASE);
  revalidatePath(`${BASE}/penyusutan`);
  return res;
}

/**
 * Buat daftar awal dari saldo rekening (hasil Zahir): satu aset per kelompok, harga = saldo rekening aset,
 * akumulasi awal = saldo akumulasi s.d. bulan terakhir yang sudah disusutkan, umur diatur supaya penyusutan
 * per bulan sama dengan penyusutan Zahir bulan terakhir. Setelah itu boleh dipecah per aset.
 */
export async function seedFromBalances(): Promise<Res> {
  const me = await requireModule("keuangan");
  const res = await guard(async () => {
    const db = await getDb();
    const existing = await db.get<{ n: number }>(sql`select count(*) n from fin_fixed_assets`);
    if (Number(existing?.n ?? 0) > 0) throw new UserError("Daftar harta tetap sudah berisi. Tambahkan aset satu per satu.");
    const acc = await loadAccounts(db);
    const byCode = new Map(acc.rows.map((a) => [a.code, a]));
    const made: string[] = [];
    for (const cat of assetCategories) {
      const c = CATEGORY_CODES[cat];
      const asset = byCode.get(c.asset);
      if (!asset) continue;
      const bal = await db.get<{ b: number; first: string | null }>(sql`select coalesce(sum(debit),0) - coalesce(sum(credit),0) b, min(date) first from fin_journal_lines where account_id = ${asset.id}`);
      const cost = Number(bal?.b ?? 0);
      if (cost <= 0) continue;
      const accum = c.accum ? byCode.get(c.accum) : undefined;
      const expense = c.expense ? byCode.get(c.expense) : undefined;
      let openingAccum = 0, openingDate: string | null = null, lifeMonths = c.lifeMonths, monthly = 0, salvage = 0;
      if (accum) {
        const last = await db.get<{ m: string | null }>(sql`select max(substr(date,1,7)) m from fin_journal_lines where account_id = ${accum.id} and credit > 0`);
        if (last?.m) {
          openingDate = monthEnd(last.m);
          const a = await db.get<{ b: number }>(sql`select coalesce(sum(credit),0) - coalesce(sum(debit),0) b from fin_journal_lines where account_id = ${accum.id} and date <= ${openingDate}`);
          openingAccum = Math.max(0, Number(a?.b ?? 0));
          const m = await db.get<{ b: number }>(sql`select coalesce(sum(credit),0) - coalesce(sum(debit),0) b from fin_journal_lines where account_id = ${accum.id} and substr(date,1,7) = ${last.m}`);
          monthly = Number(m?.b ?? 0);
          // Umur = bulat ke bawah, sisanya jadi nilai sisa, supaya (harga − nilai sisa) / umur = penyusutan Zahir per bulan persis.
          if (monthly > 0) { lifeMonths = Math.max(1, Math.floor(cost / monthly)); salvage = cost - monthly * lifeMonths; }
        }
      }
      const start = bal?.first ?? openingDate ?? new Date().toISOString().slice(0, 10);
      await db.insert(schema.fixedAssets).values({
        code: `HT-${c.asset}`, name: `${CATEGORY_LABEL[cat]} (saldo Zahir)`, category: cat, method: cat === "tanah" ? "tidak_disusutkan" : "garis_lurus",
        assetAccountId: asset.id, accumAccountId: accum?.id ?? null, expenseAccountId: expense?.id ?? null,
        acquiredDate: start, startDate: `${ym(start)}-01`, cost, salvage, lifeMonths: cat === "tanah" ? 0 : lifeMonths,
        openingAccum, openingDate: openingAccum ? openingDate : null,
        note: monthly ? `Dari saldo rekening ${c.asset}; penyusutan Zahir terakhir Rp${monthly.toLocaleString("id-ID")}/bulan (${openingDate?.slice(0, 7)}).` : `Dari saldo rekening ${c.asset}.`,
        createdBy: me.id,
      });
      made.push(CATEGORY_LABEL[cat]);
    }
    if (!made.length) throw new UserError("Tidak ada saldo rekening harta tetap.");
    return { ok: `Dibuat ${made.length} aset dari saldo: ${made.join(", ")}. Periksa umur & akumulasinya, lalu pecah per aset bila perlu.` };
  });
  revalidatePath(BASE);
  return res;
}

/* ---------------- Anggaran ---------------- */

/** Simpan anggaran: rows = [{accountId, period, amount}] — amount kosong/0 menghapus. */
export async function saveBudgets(rows: { accountId: string; period: string; amount: number | null }[]): Promise<Res> {
  const me = await requireModule("keuangan");
  const res = await guard(async () => {
    const db = await getDb();
    const clean = rows.filter((r) => r.accountId && isPeriod(r.period)).slice(0, 5000);
    const ops = clean.map((r) =>
      r.amount
        ? db.insert(schema.budgets).values({ accountId: r.accountId, period: r.period, amount: Math.round(r.amount), updatedBy: me.id })
            .onConflictDoUpdate({ target: [schema.budgets.accountId, schema.budgets.period], set: { amount: Math.round(r.amount), updatedBy: me.id, updatedAt: new Date() } })
        : db.delete(schema.budgets).where(and(eq(schema.budgets.accountId, r.accountId), eq(schema.budgets.period, r.period))),
    );
    for (const part of chunk(ops, 150)) await runBatch(db, part);
    return { ok: `Anggaran disimpan (${clean.filter((r) => r.amount).length} isian).` };
  });
  revalidatePath("/akuntansi/anggaran");
  return res;
}
