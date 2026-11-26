import "server-only";
// Harta tetap: daftar aset, nilai buku, dan rencana penyusutan bulanan (garis lurus / saldo menurun ganda).
import { sql } from "drizzle-orm";
import type { AssetCategory, DepreciationMethod, FixedAsset } from "@/db/erp";
import type { DB } from "./server";

export const CATEGORY_LABEL: Record<AssetCategory, string> = {
  tanah: "Tanah",
  bangunan: "Bangunan",
  mesin: "Mesin & Peralatan",
  kendaraan: "Kendaraan",
  inventaris: "Inventaris Kantor",
  lain: "Harta Lain",
};
export const METHOD_LABEL: Record<DepreciationMethod, string> = {
  garis_lurus: "Garis lurus",
  saldo_menurun: "Saldo menurun ganda",
  tidak_disusutkan: "Tidak disusutkan",
};
/** Kode rekening bawaan per kelompok (susunan Zahir PT. Istana Block): aset, akumulasi, beban. */
export const CATEGORY_CODES: Record<AssetCategory, { asset: string; accum: string | null; expense: string | null; lifeMonths: number }> = {
  tanah: { asset: "170-10", accum: null, expense: null, lifeMonths: 0 },
  bangunan: { asset: "170-20", accum: "171-20", expense: "710-20", lifeMonths: 240 },
  mesin: { asset: "170-30", accum: "171-30", expense: "710-30", lifeMonths: 96 },
  kendaraan: { asset: "170-40", accum: "171-40", expense: "710-40", lifeMonths: 96 },
  inventaris: { asset: "170-50", accum: "171-50", expense: "710-50", lifeMonths: 48 },
  lain: { asset: "170-90", accum: null, expense: null, lifeMonths: 48 },
};

export const ym = (d: string) => d.slice(0, 7);
export const monthEnd = (period: string) => new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0)).toISOString().slice(0, 10);
export const monthsBetween = (a: string, b: string) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));
export const addMonth = (period: string, n: number) => { const d = new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)) - 1 + n, 1)); return d.toISOString().slice(0, 7); };

export type AssetRow = FixedAsset & { posted: number; accum: number; book: number; monthly: number; lastPeriod: string | null };

/** Penyusutan satu bulan untuk aset, mengingat akumulasi s.d. bulan sebelumnya. */
export function depreciationFor(a: Pick<FixedAsset, "cost" | "salvage" | "lifeMonths" | "method" | "category" | "startDate" | "disposedDate" | "openingDate">, period: string, accumBefore: number) {
  if (a.method === "tidak_disusutkan" || a.category === "tanah" || a.lifeMonths <= 0) return 0;
  if (period < ym(a.startDate)) return 0;
  if (a.openingDate && period <= ym(a.openingDate)) return 0;
  if (a.disposedDate && period > ym(a.disposedDate)) return 0;
  const base = a.cost - a.salvage;
  const remaining = base - accumBefore;
  if (remaining <= 0) return 0;
  if (a.method === "saldo_menurun") {
    const monthlyRate = 2 / a.lifeMonths;
    const v = Math.round((a.cost - accumBefore) * monthlyRate);
    const left = a.lifeMonths - monthsBetween(ym(a.startDate), period);
    return Math.min(remaining, left <= 1 ? remaining : Math.max(v, 0));
  }
  return Math.min(remaining, Math.round(base / a.lifeMonths));
}

/** Daftar aset dengan akumulasi & nilai buku per tanggal (opsional), plus taksiran penyusutan bulan berikutnya. */
export async function listAssets(db: DB, asOf?: string): Promise<AssetRow[]> {
  const until = asOf ? ym(asOf) : "9999-12";
  const assets = await db.all<FixedAsset>(sql`
    select id, code, name, category, asset_account_id assetAccountId, accum_account_id accumAccountId, expense_account_id expenseAccountId,
           acquired_date acquiredDate, start_date startDate, cost, salvage, life_months lifeMonths, method, opening_accum openingAccum, opening_date openingDate,
           location, disposed_date disposedDate, disposal_note disposalNote, note, created_by createdBy, created_at createdAt, updated_at updatedAt
      from fin_fixed_assets order by code`);
  const posted = await db.all<{ assetId: string; s: number; last: string }>(sql`
    select asset_id assetId, sum(amount) s, max(period) last from fin_depreciation_lines where period <= ${until} group by asset_id`);
  const pm = new Map(posted.map((p) => [p.assetId, p]));
  return assets.map((a) => {
    const p = pm.get(a.id);
    const postedSum = Number(p?.s ?? 0);
    const accum = Number(a.openingAccum) + postedSum;
    const next = p?.last ? addMonth(p.last, 1) : a.openingDate ? addMonth(ym(a.openingDate), 1) : ym(a.startDate);
    return { ...a, cost: Number(a.cost), salvage: Number(a.salvage), lifeMonths: Number(a.lifeMonths), openingAccum: Number(a.openingAccum), posted: postedSum, accum, book: Number(a.cost) - accum, monthly: depreciationFor(a, next, accum), lastPeriod: p?.last ?? null };
  });
}

/** Rencana penyusutan untuk satu bulan: aset yang belum disusutkan di bulan itu. */
export async function planDepreciation(db: DB, period: string) {
  const assets = await listAssets(db, monthEnd(addMonth(period, -1)));
  const done = new Set((await db.all<{ assetId: string }>(sql`select asset_id assetId from fin_depreciation_lines where period = ${period}`)).map((r) => r.assetId));
  return assets
    .filter((a) => !done.has(a.id))
    .map((a) => ({ asset: a, amount: depreciationFor(a, period, a.accum) }))
    .filter((x) => x.amount > 0 && x.asset.accumAccountId && x.asset.expenseAccountId);
}

/** Jurnal penyusutan yang sudah ada di bulan itu dari sumber lain (mis. impor Zahir) — supaya tidak dobel. */
export async function otherDepreciationInMonth(db: DB, period: string) {
  return db.all<{ number: string; date: string; source: string; amount: number }>(sql`
    select j.number, j.date, j.source, sum(l.credit) amount from fin_journal_lines l join fin_journals j on j.id = l.journal_id join fin_accounts a on a.id = l.account_id
     where a.grp = 'akum_penyusutan' and j.source <> 'penyusutan' and l.date >= ${`${period}-01`} and l.date <= ${monthEnd(period)} and l.credit > 0
     group by j.id order by j.date`);
}

/** Riwayat penyusutan per aset. */
export async function assetHistory(db: DB, assetId: string) {
  return db.all<{ period: string; amount: number; number: string; journalId: string }>(sql`
    select d.period, d.amount, j.number, j.id journalId from fin_depreciation_lines d join fin_journals j on j.id = d.journal_id where d.asset_id = ${assetId} order by d.period`);
}

/** Penyusutan yang dibukukan pada rentang bulan, per aset. */
export async function depreciationInRange(db: DB, fromPeriod: string, toPeriod: string) {
  const rows = await db.all<{ assetId: string; s: number }>(sql`select asset_id assetId, sum(amount) s from fin_depreciation_lines where period >= ${fromPeriod} and period <= ${toPeriod} group by asset_id`);
  return new Map(rows.map((r) => [r.assetId, Number(r.s)]));
}
