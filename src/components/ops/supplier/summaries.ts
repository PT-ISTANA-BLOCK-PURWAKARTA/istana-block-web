// Ringkasan bahan baku / supplier / vendor / kurva nilai — murni, dihitung di browser (hemat CPU Worker).
import { quantitySum, wibMonth } from "@/components/ops/receipts/util";
import type { DeliveryMode } from "@/db/erp";
import type { ReceiptRow } from "@/lib/ops/receipts";
import { MAX_SILT_PERCENT, SAND_TIERS, siltLevel, sourceLabel, type SandTier } from "@/lib/ops/shared/sand";
import { averageParts, overallScore, receiptParts, type ScoreParts } from "@/lib/ops/shared/score";

/** Kolom barang masuk yang dibutuhkan halaman bahan baku (dipangkas di server supaya payload kecil). */
export type SupplierRow = Pick<
  ReceiptRow,
  | "id" | "receivedAt" | "category" | "itemName" | "tag" | "supplier" | "quarry" | "quantity" | "unit" | "vehiclePlate" | "status" | "hasBrangkal" | "notes"
  | "photoKeys" | "deliveryMode" | "expeditionName" | "speedRating" | "deliveryNote" | "deliveryByName" | "priceRating" | "priceNote" | "priceByName"
  | "tier" | "tierConfirmed" | "qualityNote" | "qualityByName" | "createdByName" | "siltPercent"
> & { test: { status: "draft" | "selesai"; maxSiltPercent: number; decision: "diterima" | "ditolak" | "diterima_bersyarat" | null; photoKey: string | null; startPhotoKey: string | null } | null };

export const toSupplierRow = (row: ReceiptRow): SupplierRow => ({
  id: row.id, receivedAt: row.receivedAt, category: row.category, itemName: row.itemName, tag: row.tag, supplier: row.supplier, quarry: row.quarry, quantity: row.quantity, unit: row.unit,
  vehiclePlate: row.vehiclePlate, status: row.status, hasBrangkal: row.hasBrangkal, notes: row.notes, photoKeys: row.photoKeys, deliveryMode: row.deliveryMode, expeditionName: row.expeditionName,
  speedRating: row.speedRating, deliveryNote: row.deliveryNote, deliveryByName: row.deliveryByName, priceRating: row.priceRating, priceNote: row.priceNote, priceByName: row.priceByName,
  tier: row.tier, tierConfirmed: row.tierConfirmed, qualityNote: row.qualityNote, qualityByName: row.qualityByName, createdByName: row.createdByName, siltPercent: row.siltPercent,
  test: row.test ? { status: row.test.status, maxSiltPercent: row.test.maxSiltPercent, decision: row.test.decision, photoKey: row.test.photoKey, startPhotoKey: row.test.startPhotoKey } : null,
});

export const NO_TAG = "Tanpa tag";

export const average = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);
export const share = (part: number, total: number) => (total ? `${Math.round((part / total) * 100)}%` : "-");
export const round = (value: number | null, digits = 2) => (value === null ? "" : Math.round(value * 10 ** digits) / 10 ** digits);
export const pts = (value: number | null) => (value === null ? "-" : String(Math.round(value)));
export const qty = (items: SupplierRow[]) => quantitySum(items);

export const sourceKey = (row: SupplierRow) => `${(row.supplier ?? "").trim().toLowerCase()}|${(row.quarry ?? "").trim().toLowerCase()}`;
export const tagOf = (row: SupplierRow) => row.tag?.trim() || NO_TAG;
export const tagKey = (row: SupplierRow) => tagOf(row).toLowerCase();
export const materialKey = (row: SupplierRow) => row.itemName.trim().toLowerCase();
export const vendorName = (row: SupplierRow) =>
  row.deliveryMode === "ekspedisi"
    ? row.expeditionName?.trim() || "Ekspedisi (tanpa nama)"
    : row.deliveryMode === "quarry"
      ? `Armada ${sourceLabel(row)}`
      : row.deliveryMode === "sendiri"
        ? "Armada Istana Block (ambil sendiri)"
        : "Belum diisi";

/** Kecepatan kirim yang ikut menilai supplier/vendor: armada Istana Block sendiri tidak (bukan kinerja supplier), jadi diabaikan. */
export const speedOf = (row: Pick<SupplierRow, "deliveryMode" | "speedRating">) => (row.deliveryMode === "sendiri" ? null : row.speedRating);
export const levelOf = (row: SupplierRow) => (row.siltPercent === null ? null : siltLevel(row.siltPercent, row.test?.maxSiltPercent ?? MAX_SILT_PERCENT));
export const silts = (items: SupplierRow[]) => items.flatMap((row) => (row.siltPercent === null ? [] : [row.siltPercent]));

/** Penilaian satu kiriman → komponen nilai. */
export const partsOf = (items: SupplierRow[]) =>
  averageParts(items.map((row) => receiptParts({ tier: row.category === "bahan_baku" ? row.tier : null, speedRating: speedOf(row), priceRating: row.priceRating })));

export function groupBy<T>(rows: T[], key: (row: T) => string) {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = groups.get(k);
    if (list) list.push(row);
    else groups.set(k, [row]);
  }
  return groups;
}

export type Note = { at: Date; text: string; source: string; by: string | null };
const notesOf = (items: SupplierRow[], pick: (row: SupplierRow) => [string | null, string | null]): Note[] =>
  items
    .flatMap((row) => {
      const [text, by] = pick(row);
      return text?.trim() ? [{ at: new Date(row.receivedAt), text: text.trim(), source: `${row.itemName} · ${sourceLabel(row)}`, by }] : [];
    })
    .sort((a, b) => b.at.getTime() - a.at.getTime());

/** Tier yang paling sering muncul (dari kiriman yang sudah bertier); bila seri, ambil yang lebih buruk. */
export function dominantTier(items: SupplierRow[]) {
  const tiers = { 1: 0, 2: 0, 3: 0, 4: 0 } as Record<SandTier, number>;
  for (const row of items) if (row.tier) tiers[row.tier] += 1;
  const rated = SAND_TIERS.some((value) => tiers[value] > 0);
  return { tiers, tier: rated ? SAND_TIERS.reduce((best, value) => (tiers[value] >= tiers[best] ? value : best), 1 as SandTier) : null };
}

export type GroupSummary = { key: string; label: string; count: number; rows: SupplierRow[]; missingQuantity: number; avgSilt: number | null; tier: SandTier | null; last: Date; sources: string[] };

/** Rekap inventory per bahan baku atau per tag: berapa rit & jumlah yang datang, plus kualitasnya. */
export function summarizeGroups(rows: SupplierRow[], key: (row: SupplierRow) => string, label: (row: SupplierRow) => string): GroupSummary[] {
  return [...groupBy(rows, key).entries()]
    .map(([groupKey, items]) => ({
      key: groupKey,
      label: label(items[0]),
      count: items.length,
      rows: items,
      missingQuantity: items.filter((row) => !row.quantity).length,
      avgSilt: average(silts(items)),
      tier: dominantTier(items).tier,
      last: new Date(Math.max(...items.map((row) => new Date(row.receivedAt).getTime()))),
      sources: [...new Set(items.map(sourceLabel))],
    }))
    .sort((a, b) => (a.label === NO_TAG ? 1 : 0) - (b.label === NO_TAG ? 1 : 0) || b.count - a.count);
}

export type MonthSummary = { key: string; label: string; rows: SupplierRow[]; byMaterial: GroupSummary[] };

export function summarizeMonths(rows: SupplierRow[]): MonthSummary[] {
  return [...groupBy(rows, (row) => wibMonth(row.receivedAt)).entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, items]) => ({
      key,
      label: new Date(`${key}-15T00:00:00Z`).toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }),
      rows: items,
      byMaterial: summarizeGroups(items, materialKey, (row) => row.itemName),
    }));
}

export type SourceSummary = {
  key: string; label: string; materials: string[]; rows: SupplierRow[]; count: number; tested: number; avgSilt: number | null; minSilt: number | null; maxSilt: number | null;
  good: number; overLimit: number; rejected: number; tiers: Record<SandTier, number>; tier: SandTier | null; unrated: number; speedAvg: number | null; speedCount: number;
  priceAvg: number | null; viaQuarry: number; viaExpedition: number; viaSendiri: number; notes: Note[]; parts: ScoreParts; overall: number | null; complete: boolean; scored: number;
};

export function summarizeSources(rows: SupplierRow[]): SourceSummary[] {
  return [...groupBy(rows, sourceKey).entries()]
    .map(([key, items]) => {
      const values = silts(items);
      const speeds = items.flatMap((row) => (speedOf(row) ? [speedOf(row)!] : []));
      const prices = items.flatMap((row) => (row.priceRating ? [row.priceRating] : []));
      const parts = partsOf(items);
      return {
        key,
        label: sourceLabel(items[0]),
        materials: [...new Set(items.map((row) => row.itemName))],
        rows: items,
        count: items.length,
        tested: values.length,
        avgSilt: average(values),
        minSilt: values.length ? Math.min(...values) : null,
        maxSilt: values.length ? Math.max(...values) : null,
        good: items.filter((row) => levelOf(row) === "bagus").length,
        overLimit: items.filter((row) => levelOf(row) === "lewat").length,
        rejected: items.filter((row) => row.status === "ditolak").length,
        ...dominantTier(items),
        unrated: items.filter((row) => !row.tierConfirmed).length,
        speedAvg: average(speeds),
        speedCount: speeds.length,
        priceAvg: average(prices),
        viaQuarry: items.filter((row) => row.deliveryMode === "quarry").length,
        viaExpedition: items.filter((row) => row.deliveryMode === "ekspedisi").length,
        viaSendiri: items.filter((row) => row.deliveryMode === "sendiri").length,
        notes: notesOf(items, (row) => [row.qualityNote, row.qualityByName]),
        parts,
        ...overallScore(parts),
        scored: items.filter((row) => row.tier || speedOf(row) || row.priceRating).length,
      };
    })
    .sort((a, b) => (a.tier ?? 9) - (b.tier ?? 9) || (a.avgSilt ?? 99) - (b.avgSilt ?? 99) || (b.speedAvg ?? 0) - (a.speedAvg ?? 0));
}

export type VendorSummary = { key: string; name: string; mode: DeliveryMode | null; count: number; speedAvg: number | null; speedCount: number; late: number; sources: string[]; notes: Note[] };

/** Vendor pengiriman: armada quarry/supplier sendiri atau nama ekspedisi pihak ketiga. */
export function summarizeVendors(rows: SupplierRow[]): VendorSummary[] {
  return [...groupBy(rows, (row) => `${row.deliveryMode ?? "-"}|${vendorName(row).toLowerCase()}`).entries()]
    .map(([key, items]) => {
      const speeds = items.flatMap((row) => (speedOf(row) ? [speedOf(row)!] : []));
      return {
        key,
        name: vendorName(items[0]),
        mode: items[0].deliveryMode,
        count: items.length,
        speedAvg: average(speeds),
        speedCount: speeds.length,
        late: speeds.filter((speed) => speed === 1).length,
        sources: [...new Set(items.map(sourceLabel))],
        notes: notesOf(items, (row) => [row.deliveryNote, row.deliveryByName]),
      };
    })
    .sort((a, b) => (a.mode ? 0 : 1) - (b.mode ? 0 : 1) || (b.speedAvg ?? 0) - (a.speedAvg ?? 0) || b.count - a.count);
}

export function modeSummary(rows: SupplierRow[], mode: DeliveryMode) {
  const items = rows.filter((row) => row.deliveryMode === mode);
  const speeds = items.flatMap((row) => (speedOf(row) ? [speedOf(row)!] : []));
  return { count: items.length, speedAvg: average(speeds), speedCount: speeds.length, onTime: speeds.filter((speed) => speed >= 2).length };
}

export const ranked = (sources: SourceSummary[]) => sources.filter((s) => s.overall !== null).sort((a, b) => b.overall! - a.overall!);

export type CurveSeries = { key: string; label: string; color: string; values: (number | null)[] };

/** Warna garis kurva (berurutan, maks. 4): memakai token warna panel. */
export const SERIES_COLORS = ["var(--biru)", "var(--oranye-cta)", "var(--sukses)", "var(--warn)"];

/** Kurva: nilai overall per bulan untuk 4 supplier dengan kiriman ternilai terbanyak (warna urut nama supplier, selalu berbeda). */
export function curveData(rows: SupplierRow[], sources: SourceSummary[], orderOf: (key: string) => number) {
  const months = [...new Set(rows.map((row) => wibMonth(row.receivedAt)))].sort();
  const top = sources.filter((s) => s.overall !== null).sort((a, b) => b.scored - a.scored).slice(0, 4);
  const colorOrder = [...top].sort((a, b) => orderOf(a.key) - orderOf(b.key)).map((s) => s.key);
  const series: CurveSeries[] = top.map((s) => ({
    key: s.key,
    label: s.label,
    color: SERIES_COLORS[colorOrder.indexOf(s.key)],
    values: months.map((month) => {
      const items = s.rows.filter((row) => wibMonth(row.receivedAt) === month);
      return items.length ? overallScore(partsOf(items)).overall : null;
    }),
  }));
  return { months, series };
}

export type Summaries = { rows: SupplierRow[]; materials: GroupSummary[]; tags: GroupSummary[]; sources: SourceSummary[]; vendors: VendorSummary[] };

export const buildSummaries = (rows: SupplierRow[]): Summaries => ({
  rows,
  materials: summarizeGroups(rows, materialKey, (row) => row.itemName),
  tags: summarizeGroups(rows, tagKey, tagOf),
  sources: summarizeSources(rows),
  vendors: summarizeVendors(rows),
});
