// Tipe baris & rekap hasil produksi. Murni (tanpa server-only) supaya dipakai halaman server dan komponen Excel di klien.

export type ProdCategory = "precast" | "paving";

export type ProdRow = {
  id: string;
  number: string;
  date: string;
  category: ProdCategory | null;
  batchCode: string | null;
  leader: string | null;
  target: number | null;
  cementBags: number | null;
  boards: number | null;
  rejects: number | null;
  /** Grade B (reject masih dijual); hanya dicatat. */
  gradeB: number | null;
  method: "tumbuk" | "cor" | "tulangan" | null;
  cementKg: number | null;
  batchId: string | null;
  mixLogId: string | null;
  /** TTD ketidaksesuaian: Manager in charge lalu Pimpinan. */
  rejectManager: { name: string | null; at: number } | null;
  rejectLeader: { name: string | null; at: number } | null;
  issues: string[];
  note: string;
  photoKey: string | null;
  createdBy: number | null;
  createdByName: string | null;
  /** ms epoch */
  createdAt: number;
  hasil: { itemId: string; name: string; unit: string; qty: number }[];
  canChange: boolean;
};

export const CATEGORY_LABEL: Record<ProdCategory, string> = { precast: "Precast", paving: "Paving" };
export const categoryLabel = (c: ProdCategory | null) => (c ? CATEGORY_LABEL[c] : "-");

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const sum = (xs: (number | null | undefined)[]) => xs.reduce<number>((a, x) => a + (x ?? 0), 0);

/** Total qty hasil dokumen (semua barang). */
export const totalQty = (r: ProdRow) => sum(r.hasil.map((h) => h.qty));

/** Barang hasil utama dokumen (qty terbesar); papan & reject dokumen dihitung ke barang ini di rekap per produk. */
function mainItem(r: ProdRow) {
  return r.hasil.reduce<ProdRow["hasil"][number] | null>((best, h) => (!best || h.qty > best.qty ? h : best), null);
}

export type ProductSummary = {
  key: string;
  category: ProdCategory | null;
  itemId: string;
  name: string;
  unit: string;
  qty: number;
  days: Set<string>;
  issueDays: Set<string>;
  boards: number;
  rejects: number;
  gradeB: number;
  docs: number;
};

export function summarizeProducts(rows: ProdRow[]): ProductSummary[] {
  const map = new Map<string, ProductSummary>();
  for (const r of rows) {
    const main = mainItem(r);
    for (const h of r.hasil) {
      const key = `${r.category ?? "-"}|${h.itemId}`;
      const e = map.get(key) ?? { key, category: r.category, itemId: h.itemId, name: h.name, unit: h.unit, qty: 0, days: new Set<string>(), issueDays: new Set<string>(), boards: 0, rejects: 0, gradeB: 0, docs: 0 };
      e.qty += h.qty;
      e.docs += 1;
      if (h.qty > 0) e.days.add(r.date);
      if (r.issues.length) e.issueDays.add(r.date);
      if (main && main.itemId === h.itemId) {
        e.boards += r.boards ?? 0;
        e.rejects += r.rejects ?? 0;
        e.gradeB += r.gradeB ?? 0;
      }
      map.set(key, e);
    }
  }
  return [...map.values()].sort((a, b) => (a.category ?? "").localeCompare(b.category ?? "") || a.name.localeCompare(b.name));
}

export type IssueSummary = { issue: string; count: number; days: number; products: string[]; last: string; note: string };

/** Rekap kendala: berapa kali tiap kendala tercatat, di produk apa, kapan terakhir. */
export function summarizeIssues(rows: ProdRow[]): IssueSummary[] {
  const map = new Map<string, ProdRow[]>();
  for (const r of rows) for (const issue of r.issues) map.set(issue, [...(map.get(issue) ?? []), r]);
  return [...map.entries()]
    .map(([issue, rs]) => ({
      issue,
      count: rs.length,
      days: new Set(rs.map((r) => r.date)).size,
      products: [...new Set(rs.flatMap((r) => r.hasil.map((h) => h.name)))],
      last: rs.map((r) => r.date).sort().at(-1) ?? "",
      note: rs.find((r) => r.note)?.note ?? "",
    }))
    .sort((a, b) => b.count - a.count || a.issue.localeCompare(b.issue));
}

/** Dokumen yang punya Grade B atau reject (butuh TTD ketidaksesuaian). */
export const hasNonconformity = (r: ProdRow) => (r.gradeB ?? 0) > 0 || (r.rejects ?? 0) > 0;

/** "40 buah + 3 m" untuk hasil dokumen (dijumlah per satuan). */
export function hasilText(r: ProdRow, format: (n: number) => string) {
  const parts = r.hasil.map((h) => `${h.name} ${format(h.qty)} ${h.unit}`.trim());
  return parts.join(" · ") || "-";
}
